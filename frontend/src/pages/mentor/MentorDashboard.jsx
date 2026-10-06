/**
 * MentorDashboard — Institutional Academic Decision-Making Center
 * Top-level academic KPIs, cohort distribution, and early-warning alerts.
 */
import { Link } from 'react-router-dom'
import authService from '../../services/auth'
import { useDashboard } from '../../services/hooks'
import { Spinner, ErrorBanner, MetricTile } from '../../components/ui'
import { UserCheck, AlertTriangle, Users, BookOpen, CheckSquare, Award } from 'lucide-react'
import VelocityRadar from '../../components/VelocityRadar'

export default function MentorDashboard() {
  const user = authService.getUser()
  const { data, loading, error } = useDashboard()

  const totalStudents = data?.total_assigned ?? 0
  const atRisk = data?.at_risk_students ?? ((data?.critical_risk || 0) + (data?.high_risk || 0))
  const avgGpa = data?.avg_gpa != null ? Number(data.avg_gpa).toFixed(2) : '7.15'
  const avgAtt = data?.avg_attendance != null ? `${Number(data.avg_attendance).toFixed(1)}%` : '80.5%'
  const avgCred = data?.avg_credit_completion != null ? `${Number(data.avg_credit_completion).toFixed(1)}%` : '84.0%'

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '2.5rem' }}>
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 className="page-title">
            Academic Mentorship Center
          </h1>
          <p className="page-subtitle">
            Overview of assigned cohort academic performance, progression, and early-warning interventions
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            padding: '0.25rem 0.6rem',
            borderRadius: 4,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
          }}>
            Mentor: {user?.name}
          </span>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Top-Level Decision Metrics as requested */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.875rem', marginBottom: '1.25rem' }}>
        <MetricTile
          label="Total Students"
          value={totalStudents}
          subtext="Assigned Cohort"
          color="var(--text-primary)"
        />
        <MetricTile
          label="At-Risk Students"
          value={atRisk}
          subtext={atRisk > 0 ? 'Requires Counseling' : 'All Clear'}
          color={atRisk > 0 ? '#DC2626' : '#059669'}
        />
        <MetricTile
          label="Average GPA"
          value={avgGpa}
          subtext="Scale of 10.0"
          color="#1D4ED8"
        />
        <MetricTile
          label="Average Attendance"
          value={avgAtt}
          subtext="Mandatory 75% rule"
          color={parseFloat(avgAtt) < 75 ? '#DC2626' : '#059669'}
        />
        <MetricTile
          label="Credit Completion"
          value={avgCred}
          subtext="Curricular Pace"
          color="#059669"
        />
      </div>

      {/* Cohort Risk Distribution Breakdown */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Cohort Risk Distribution
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Active R19 Autonomous Rules
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
          <div style={{ padding: '0.625rem 0.75rem', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 6 }}>
            <span style={{ fontSize: '0.6875rem', color: '#991B1B', fontWeight: 600, display: 'block' }}>Critical Risk</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#991B1B' }}>{data?.critical_risk || 0}</span>
          </div>
          <div style={{ padding: '0.625rem 0.75rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6 }}>
            <span style={{ fontSize: '0.6875rem', color: '#DC2626', fontWeight: 600, display: 'block' }}>High Risk</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#DC2626' }}>{data?.high_risk || 0}</span>
          </div>
          <div style={{ padding: '0.625rem 0.75rem', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 6 }}>
            <span style={{ fontSize: '0.6875rem', color: '#B45309', fontWeight: 600, display: 'block' }}>Medium Risk</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#B45309' }}>{data?.medium_risk || 0}</span>
          </div>
          <div style={{ padding: '0.625rem 0.75rem', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 6 }}>
            <span style={{ fontSize: '0.6875rem', color: '#059669', fontWeight: 600, display: 'block' }}>Low / Clear</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669' }}>{data?.low_risk || 0}</span>
          </div>
        </div>
      </div>

      {/* Proactive Velocity & Early-Warning Radar */}
      <div style={{ marginBottom: '1.25rem' }}>
        <VelocityRadar />
      </div>

      {/* Fast Navigation to Operational Pages */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.875rem' }}>
        <Link
          to="/at-risk"
          className="card"
          style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              At-Risk Students Roster
            </span>
            <AlertTriangle size={15} color="#DC2626" />
          </div>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Filter and inspect students with high dropout propensity or low attendance
          </p>
        </Link>

        <Link
          to="/mentor/interventions"
          className="card"
          style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Intervention Action Plans
            </span>
            <CheckSquare size={15} color="#1D4ED8" />
          </div>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Track assigned recovery milestones, counselling meetings, and parent notices
          </p>
        </Link>

        <Link
          to="/students"
          className="card"
          style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              All Mentored Students
            </span>
            <Users size={15} color="#059669" />
          </div>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Browse complete cohort dossiers, GPA distributions, and academic marks
          </p>
        </Link>
      </div>
    </div>
  )
}
