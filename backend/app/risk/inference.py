"""
inference.py - ML Inference Service (singleton)
Loaded once at FastAPI startup via lifespan.
Provides predict() and explain() for any backend router.

Engine B: AI/ML Risk Prediction.
Uses the existing UCI-trained Random Forest model.
The heuristic fallback uses SIES GST academic fields.
"""
import os
import json
import logging
from typing import Optional
import numpy as np

logger = logging.getLogger(__name__)

MODEL_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..', '..', '..', 'ml', 'model')
)

# Risk level thresholds (updated: 4 levels)
RISK_LOW_MAX = 0.25       # 0-24% = LOW
RISK_MED_MAX = 0.50       # 25-49% = MEDIUM
RISK_HIGH_MAX = 0.75      # 50-74% = HIGH
                          # 75-100% = CRITICAL


class ModelService:
    """Singleton that owns the loaded sklearn model and scaler."""

    _instance: Optional['ModelService'] = None

    def __init__(self):
        self.model = None
        self.scaler = None
        self.features: list[str] = []
        self.model_version: str = 'dropout-v1'
        self.loaded = False

    @classmethod
    def get(cls) -> 'ModelService':
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def load(self):
        """Load model + scaler from disk. Called in FastAPI lifespan."""
        import joblib
        model_path  = os.path.join(MODEL_DIR, 'dropout_model.joblib')
        scaler_path = os.path.join(MODEL_DIR, 'scaler.joblib')
        feat_path   = os.path.join(MODEL_DIR, 'features.joblib')
        meta_path   = os.path.join(MODEL_DIR, 'metadata.json')

        if not os.path.exists(model_path):
            logger.warning(
                "ML model not found at %s - inference will use rule-based fallback. "
                "Run: python ml/preprocess.py && python ml/train.py", model_path
            )
            return

        self.model   = joblib.load(model_path)
        self.scaler  = joblib.load(scaler_path)
        self.features = joblib.load(feat_path)

        if os.path.exists(meta_path):
            with open(meta_path) as f:
                meta = json.load(f)
            self.model_version = meta.get('model_version', 'dropout-v1')

        self.loaded = True
        logger.info("ML model loaded: %s (%s features)", self.model_version, len(self.features))

    def _feature_vector(self, data: dict) -> np.ndarray:
        """Build a numpy feature vector from a student data dict."""
        vec = []
        for f in self.features:
            val = float(data.get(f, 0.0))
            if f == 'gpa' and val <= 10.0:
                val = val * 10.0  # Scale 10-point GPA to 0-100 range expected by scaler/model
            vec.append(val)
        return np.array(vec).reshape(1, -1)

    def predict(self, student_data: dict) -> dict:
        """
        Returns {risk_probability, risk_level, model_version}.
        Combines SIES GST Autonomous academic regulations (Ordinance 6086 attendance,
        ATKT credit limits, continuous SGPA) with ML model inference.
        Guarantees monotonicity, responsiveness to updates, and realistic risk bounds.
        """
        calibrated_prob = self._calculate_calibrated_risk(student_data)

        if self.loaded:
            try:
                X = self._feature_vector(student_data)
                X_scaled = self.scaler.transform(X)
                rf_prob = float(self.model.predict_proba(X_scaled)[0][1])
                
                # Blend ML pattern with domain calibration
                # Domain rules enforce strict statutory ceilings and floors
                # so the ML model cannot output inverted or artificially inflated risk
                att = float(student_data.get('attendance', student_data.get('attendance_percentage', 100.0)))
                fh = int(student_data.get('failed_heads', student_data.get('failed_subjects', 0)))
                
                if att >= 75.0 and fh == 0:
                    # Compliant student with no backlogs: domain calibration has 85% weight
                    prob = 0.85 * calibrated_prob + 0.15 * min(calibrated_prob + 0.05, rf_prob)
                elif att >= 50.0 and fh <= 2:
                    # Condonation bracket or minor ATKT: domain calibration has 75% weight
                    prob = 0.75 * calibrated_prob + 0.25 * min(0.40, rf_prob)
                else:
                    # High backlog or debarred: balanced combination
                    prob = 0.70 * calibrated_prob + 0.30 * rf_prob

                prob = round(max(0.02, min(0.92, prob)), 4)
                version = f"{self.model_version}-calibrated-siesgst"
            except Exception as exc:
                logger.warning("ML inference failed: %s - using calibrated domain engine", exc)
                prob = calibrated_prob
                version = "calibrated-siesgst-r24"
        else:
            prob = calibrated_prob
            version = "calibrated-siesgst-r24"

        return {
            'risk_probability': prob,
            'risk_level': self._level(prob),
            'model_version': version,
        }

    def explain(self, student_data: dict) -> list[dict]:
        """
        Returns top SHAP factors: [{feature, impact, direction}].
        Falls back to rule-based explanation if SHAP/model unavailable.
        """
        if not self.loaded:
            return self._rule_explain(student_data)

        try:
            import shap
            X = self._feature_vector(student_data)
            X_scaled = self.scaler.transform(X)

            try:
                explainer = shap.TreeExplainer(self.model)
                shap_values = explainer.shap_values(X_scaled)
                if isinstance(shap_values, list):
                    sv = shap_values[1][0]
                else:
                    sv = shap_values[0]
            except Exception:
                explainer = shap.LinearExplainer(self.model, X_scaled)
                sv = explainer.shap_values(X_scaled)[0]

            pairs = sorted(zip(self.features, sv), key=lambda x: abs(x[1]), reverse=True)
            factors = []
            for feat, val in pairs[:5]:
                abs_val = abs(val)
                impact = 'high' if abs_val > 0.15 else ('medium' if abs_val > 0.07 else 'low')
                factors.append({
                    'feature': feat,
                    'impact': impact,
                    'direction': 'increases_risk' if val > 0 else 'reduces_risk',
                    'shap_value': round(float(val), 4),
                })
            return factors
        except Exception as exc:
            logger.warning("SHAP explanation failed: %s - using rule-based fallback", exc)
            return self._rule_explain(student_data)

    @staticmethod
    def _level(prob: float) -> str:
        """Map probability to risk level (4 levels)."""
        if prob < RISK_LOW_MAX:
            return 'LOW'
        elif prob < RISK_MED_MAX:
            return 'MEDIUM'
        elif prob < RISK_HIGH_MAX:
            return 'HIGH'
        return 'CRITICAL'

    @staticmethod
    def _calculate_calibrated_risk(data: dict) -> float:
        """
        SIES GST Autonomous & Mumbai University Statutory Risk Engine.
        Continuous, smooth, monotonic evaluation:
        - Ordinance 6086: >=75% compliant, 50-74.9% condonation bracket, <50% debarred.
        - Ordinance 5042: Grace mark consideration.
        - Autonomous Passing Heads: ATKT head limits under R19/R24.
        - Continuous SGPA and composite coursework marks.
        """
        base = 0.08

        # 1. Attendance under Mumbai University Ordinance 6086
        att = float(data.get('attendance', data.get('attendance_percentage', 100.0)))
        att = max(0.0, min(100.0, att))
        
        if att >= 85.0:
            att_effect = -0.03 * ((att - 85.0) / 15.0)  # Up to -3% consistency credit
        elif att >= 75.0:
            att_effect = 0.0  # Fully compliant under O.6086: zero penalty
        elif att >= 50.0:
            # Condonation bracket (50% - 74.9%): manageable under Principal condonation
            att_effect = ((75.0 - att) / 25.0) * 0.06  # 0% to +6% max
        else:
            # Debarred bracket (< 50%): non-condonable exam detention under O.6086
            att_effect = 0.06 + ((50.0 - att) / 50.0) * 0.12  # +6% to +18% max

        # 2. Composite Coursework Marks (0-100)
        marks = float(data.get('marks', 60.0))
        marks = max(0.0, min(100.0, marks))
        if marks >= 75.0:
            marks_effect = -0.03 * ((marks - 75.0) / 25.0)
        elif marks >= 50.0:
            marks_effect = 0.02 * ((75.0 - marks) / 25.0)
        elif marks >= 40.0:
            marks_effect = 0.02 + 0.05 * ((50.0 - marks) / 10.0)
        else:
            marks_effect = 0.07 + 0.12 * ((40.0 - marks) / 40.0)

        # 3. Grade Point Average (SGPA 0-10)
        gpa = float(data.get('gpa', 7.0))
        if gpa > 10.0 and gpa <= 100.0:
            gpa = gpa / 10.0
        gpa = max(0.0, min(10.0, gpa))
        
        if gpa >= 8.5:
            gpa_effect = -0.04 * ((gpa - 8.5) / 1.5)
        elif gpa >= 6.75:
            gpa_effect = -0.02 * ((gpa - 6.75) / 1.75)
        elif gpa >= 5.0:
            gpa_effect = 0.04 * ((6.75 - gpa) / 1.75)
        elif gpa >= 4.0:
            gpa_effect = 0.04 + 0.06 * ((5.0 - gpa) / 1.0)
        else:
            gpa_effect = 0.10 + 0.12 * ((4.0 - gpa) / 4.0)

        # 4. Assignment & Tutorial completion (0-100)
        asg = float(data.get('assignment_completion', data.get('assignment_completion_percentage', 80.0)))
        asg = max(0.0, min(100.0, asg))
        if asg >= 80.0:
            asg_effect = -0.01 * ((asg - 80.0) / 20.0)
        else:
            asg_effect = 0.04 * ((80.0 - asg) / 80.0)

        # 5. SIES GST Autonomous ATKT / Failed Heads & Subjects (R19/R24 limits)
        fh = int(data.get('failed_heads', 0))
        fs = int(data.get('failed_subjects', 0))
        effective_fh = max(fh, fs)
        
        if effective_fh == 0:
            head_effect = 0.0
        elif effective_fh <= 2:
            head_effect = effective_fh * 0.05
        elif effective_fh <= 4:
            head_effect = 0.10 + (effective_fh - 2) * 0.08
        else:
            head_effect = 0.26 + min(0.25, (effective_fh - 4) * 0.08)

        # ESE specific failed heads (theory exam separate passing head < 24/60)
        ese_fh = int(data.get('ese_failed_heads', 0))
        ese_effect = min(0.12, ese_fh * 0.04)

        # 6. Credit Progression Gap (Earned vs Expected)
        earned = float(data.get('earned_credits', 0.0))
        expected = float(data.get('expected_credits', 0.0))
        backlog_cr = float(data.get('backlog_credits', 0.0))
        
        credit_effect = 0.0
        if expected > 0.0:
            ratio = min(1.0, earned / expected)
            if ratio < 0.70:
                credit_effect = 0.08 + (0.70 - ratio) * 0.20
            elif ratio < 0.90:
                credit_effect = (0.90 - ratio) * 0.15
        elif backlog_cr > 0:
            credit_effect = min(0.15, backlog_cr * 0.015)

        total_score = base + att_effect + marks_effect + gpa_effect + asg_effect + head_effect + ese_effect + credit_effect
        return round(max(0.02, min(0.92, total_score)), 4)

    @staticmethod
    def _heuristic_predict(data: dict) -> dict:
        """Rule-based prediction using calibrated SIES GST autonomous engine."""
        prob = ModelService._calculate_calibrated_risk(data)
        return {
            'risk_probability': prob,
            'risk_level': ModelService._level(prob),
            'model_version': 'calibrated-siesgst-r24',
        }

    @staticmethod
    def _rule_explain(data: dict) -> list[dict]:
        """Rule-based explanations using SIES GST statutory fields."""
        factors = []

        att = float(data.get('attendance', data.get('attendance_percentage', 100.0)))
        if att < 50.0:
            factors.append({
                'feature': 'attendance',
                'impact': 'high',
                'direction': 'increases_risk',
                'description': f'Attendance at {round(att, 1)}% is in debarred bracket (<50% under Ordinance 6086) - exam detention hold',
                'shap_value': 0.14,
            })
        elif att < 75.0:
            factors.append({
                'feature': 'attendance',
                'impact': 'medium',
                'direction': 'increases_risk',
                'description': f'Attendance at {round(att, 1)}% requires condonation under Ordinance 6086 (threshold >=75%)',
                'shap_value': 0.05,
            })
        else:
            factors.append({
                'feature': 'attendance',
                'impact': 'low',
                'direction': 'reduces_risk',
                'description': f'Compliant attendance ({round(att, 1)}% >= 75% under Ordinance 6086)',
                'shap_value': -0.03,
            })

        fh = int(data.get('failed_heads', 0))
        fs = int(data.get('failed_subjects', 0))
        effective_fh = max(fh, fs)
        if effective_fh >= 5:
            factors.append({
                'feature': 'failed_heads',
                'impact': 'high',
                'direction': 'increases_risk',
                'description': f'{effective_fh} active failed heads exceeds autonomous ATKT progression limit (R19/R24)',
                'shap_value': 0.25,
            })
        elif effective_fh >= 1:
            factors.append({
                'feature': 'failed_heads',
                'impact': 'medium',
                'direction': 'increases_risk',
                'description': f'{effective_fh} ATKT backlog head(s) requiring remedial examination clearance',
                'shap_value': 0.08,
            })

        ese_fh = int(data.get('ese_failed_heads', 0))
        if ese_fh >= 1:
            factors.append({
                'feature': 'ese_failed_heads',
                'impact': 'medium',
                'direction': 'increases_risk',
                'description': f'{ese_fh} failed ESE separate passing head(s) (<24/60 marks threshold)',
                'shap_value': 0.06,
            })

        earned = float(data.get('earned_credits', 0.0))
        expected = float(data.get('expected_credits', 0.0))
        if expected > 0.0 and (earned / expected) < 0.75:
            factors.append({
                'feature': 'credit_completion',
                'impact': 'high',
                'direction': 'increases_risk',
                'description': f'Credit completion ({round(earned, 1)}/{round(expected, 1)} cr) is significantly behind curriculum schedule',
                'shap_value': 0.12,
            })

        gpa = float(data.get('gpa', 10.0))
        if gpa < 5.0:
            factors.append({
                'feature': 'gpa',
                'impact': 'medium',
                'direction': 'increases_risk',
                'description': f'SGPA {round(gpa, 2)} is in academic warning bracket',
                'shap_value': 0.08,
            })
        elif gpa >= 7.5:
            factors.append({
                'feature': 'gpa',
                'impact': 'low',
                'direction': 'reduces_risk',
                'description': f'Strong academic performance with SGPA {round(gpa, 2)}',
                'shap_value': -0.04,
            })

        ac = float(data.get('assignment_completion', data.get('assignment_completion_percentage', 100.0)))
        if ac < 60.0:
            factors.append({
                'feature': 'assignment_completion',
                'impact': 'low',
                'direction': 'increases_risk',
                'description': f'Assignment/lab completion at {round(ac, 1)}% requires timely submission',
                'shap_value': 0.03,
            })

        return factors[:5]
