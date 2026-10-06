/**
 * StudentDetailPage — full profile used by faculty (/students/:id) and mentor (/mentor/students/:id).
 */
import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useStudent, useCurrentRisk, useRiskHistory, useExplanation, useCredits, useInterventions, useProgression } from '../../services/hooks'
import { RiskBadge, Spinner, ErrorBanner, ProgressBar, IVStatusBadge, ProgressionBadge } from '../../components/ui'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { ArrowLeft, Brain, TrendingUp, CreditCard, Target, Zap, RefreshCw, AlertTriangle, Edit } from 'lucide-react'
import api from '../../services/api'

const IMPACT_COLOR = { high: '#f43f5e', medium: '#f59e0b', low: '#10b981' }

export default function StudentDetailPage() {
  const { id } = useParams()
  const sid = Number(id)

  const { data: student, loading: sLoad, error: sErr, refetch: refetchStudent } = useStudent(sid)
  const { data: risk,    loading: rLoad, refetch: refetchRisk } = useCurrentRisk(sid)
  const { data: history, refetch: refetchHistory }          = useRiskHistory(sid)
  const { data: explain, refetch: refetchExplain }          = useExplanation(sid)
  const { data: credits, refetch: refetchCredits }          = useCredits(sid)
  const { data: prog, refetch: refetchProg }                = useProgression(sid)
  const { data: ivList }                                    = useInterventions(sid)

  const [inferring, setInferring] = useState(false)
  const [inferResult, setInferResult] = useState(null)
  const [inferErr, setInferErr]   = useState(null)

  const runInference = async () => {
    setInferring(true); setInferErr(null); setInferResult(null)
    try {
      const res = await api.post(`/risk/${sid}/predict`)
      setInferResult(res.data)
      refetchRisk(); refetchHistory(); refetchExplain(); refetchStudent(); refetchCredits(); refetchProg()
    } catch (e) { setInferErr(e.response?.data?.detail || e.message) }
    finally { setInferring(false) }
  }

  if (sLoad) return <Spinner text="Loading student…" />
  if (sErr)  return <ErrorBanner message={sErr} />

  const chartData = (history || []).map((h, i) => ({ week: `W${h.week || i + 1}`, risk: Math.round(h.risk_probability * 100) }))
  
  // Combine all academic stats from the most recent record
  const acad = student?.academic_records?.[student.academic_records.length - 1] || {}

  return (
    <div className="animate-fade-in">
      <Link to={-1} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', color: 'var(--text-muted)', fontSize: '0.875rem', textDecoration: 'none', marginBottom: '1.25rem' }}>
        <ArrowLeft size={14} /> Back
      </Link>

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.5rem' }}>{student?.name}</h1>
          <p className="page-subtitle">{student?.roll_no} · {student?.program} · Semester {student?.semester}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <RiskBadge level={risk?.risk_level} />
          {prog?.status && <ProgressionBadge status={prog.status} />}
                      <Link to={`/students/${id}/academic`} className="btn" style={{ fontSize: '0.8125rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
              <Edit size={13} style={{ marginRight: '0.375rem' }} /> Update Data
            </Link>
<button onClick={runInference} disabled={inferring} className="btn btn-primary" style={{ fontSize: '0.8125rem', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
            {inferring ? <><RefreshCw size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> Running…</> : <><Zap size={13} /> Run Inference</>}
          </button>
        </div>
      </div>

      {inferErr && <ErrorBanner message={inferErr} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>

        {/* Section A: Academic Profile */}
        <div className="card">
          <h3 style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>A. Academic Profile</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="kpi-card"><span className="kpi-label">Roll Number</span><span className="kpi-value">{student?.roll_no}</span></div>
            <div className="kpi-card"><span className="kpi-label">Branch</span><span className="kpi-value" style={{ fontSize: '1rem' }}>{student?.branch || 'N/A'}</span></div>
            <div className="kpi-card"><span className="kpi-label">Admission Year</span><span className="kpi-value">{student?.admission_year || 'N/A'}</span></div>
            <div className="kpi-card"><span className="kpi-label">Current Year</span><span className="kpi-value">{student?.current_year || 'N/A'}</span></div>
            <div className="kpi-card"><span className="kpi-label">Semester</span><span className="kpi-value">{student?.semester}</span></div>
            <div className="kpi-card"><span className="kpi-label">Regulation</span><span className="kpi-value">{student?.regulation || 'N/A'}</span></div>
          </div>
        </div>

        {/* Section B: Academic Performance */}
        <div className="card">
          <h3 style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>B. Academic Performance</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="kpi-card"><span className="kpi-label">GPA</span><span className="kpi-value">{acad?.gpa ?? 'N/A'}</span></div>
            <div className="kpi-card"><span className="kpi-label">Total %</span><span className="kpi-value">{acad?.marks ?? 'N/A'}%</span></div>
            <div className="kpi-card"><span className="kpi-label">ISE Marks</span><span className="kpi-value">{acad?.ise_marks ?? 'N/A'}</span></div>
            <div className="kpi-card"><span className="kpi-label">MSE Marks</span><span className="kpi-value">{acad?.mse_marks ?? 'N/A'}</span></div>
            <div className="kpi-card"><span className="kpi-label">ESE Marks</span><span className="kpi-value">{acad?.ese_marks ?? 'N/A'}</span></div>
            <div className="kpi-card"><span className="kpi-label">Attendance</span><span className="kpi-value" style={{ color: (acad?.attendance || 100) < 75 ? '#f43f5e' : '#10b981' }}>{acad?.attendance ?? 'N/A'}%</span></div>
          </div>
        </div>

        {/* Section C: Backlogs */}
        <div className="card">
          <h3 style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>C. Backlogs</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="kpi-card"><span className="kpi-label">Failed Subjects</span><span className="kpi-value" style={{ color: acad?.failed_subjects > 0 ? '#f43f5e' : 'inherit' }}>{acad?.failed_subjects ?? 0}</span></div>
            <div className="kpi-card"><span className="kpi-label">Failed Heads</span><span className="kpi-value" style={{ color: acad?.failed_heads > 0 ? '#f43f5e' : 'inherit' }}>{acad?.failed_heads ?? 0}</span></div>
            <div className="kpi-card"><span className="kpi-label">ESE Failed Heads</span><span className="kpi-value" style={{ color: acad?.ese_failed_heads > 0 ? '#f43f5e' : 'inherit' }}>{acad?.ese_failed_heads ?? 0}</span></div>
            <div className="kpi-card"><span className="kpi-label">Backlog Credits</span><span className="kpi-value" style={{ color: acad?.backlog_credits > 0 ? '#f59e0b' : 'inherit' }}>{acad?.backlog_credits ?? 0}</span></div>
          </div>
        </div>

        {/* Section D: Credits */}
        <div className="card">
          <h3 style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>D. Credits</h3>
          {credits ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="kpi-card"><span className="kpi-label">Earned</span><span className="kpi-value">{credits.earned}</span></div>
              <div className="kpi-card"><span className="kpi-label">Expected</span><span className="kpi-value">{credits.expected}</span></div>
              <div className="kpi-card"><span className="kpi-label">Required</span><span className="kpi-value">{credits.required}</span></div>
              <div className="kpi-card"><span className="kpi-label">Credit Gap</span><span className="kpi-value" style={{ color: credits.deficit > 0 ? '#f43f5e' : 'inherit' }}>{credits.deficit}</span></div>
              <div className="kpi-card" style={{ gridColumn: 'span 2' }}>
                <span className="kpi-label">Completion %</span>
                <ProgressBar value={credits.completion_pct} color={credits.status === 'ON_TRACK' ? '#10b981' : credits.status === 'AT_RISK' ? '#f59e0b' : '#f43f5e'} />
              </div>
            </div>
          ) : <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No credit data.</p>}
        </div>

        {/* Section E: Progression */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>E. Progression</h3>
          {prog ? (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                   <div className="kpi-card" style={{ flex: 1 }}>
                     <span className="kpi-label">Status</span>
                     <div style={{ marginTop: '0.5rem' }}><ProgressionBadge status={prog.status} /></div>
                   </div>
                   <div className="kpi-card" style={{ flex: 1 }}>
                     <span className="kpi-label">Progression Eligibility</span>
                     <span className="kpi-value" style={{ fontSize: '1.25rem', color: prog.eligible ? '#10b981' : '#f43f5e' }}>{prog.eligible ? 'ELIGIBLE' : 'BLOCKED'}</span>
                   </div>
                   <div className="kpi-card" style={{ flex: 1 }}>
                     <span className="kpi-label">ATKT Eligibility</span>
                     <span className="kpi-value" style={{ fontSize: '1.25rem', color: prog.failed_heads <= prog.allowed_failed_heads ? '#10b981' : '#f43f5e' }}>
                        {prog.failed_heads <= prog.allowed_failed_heads ? 'ELIGIBLE' : 'INELIGIBLE'}
                     </span>
                   </div>
                </div>
                {prog.blocking_reasons && prog.blocking_reasons.length > 0 && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecdd3', padding: '1rem', borderRadius: '8px' }}>
                    <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: '#991b1b', fontSize: '0.875rem' }}>Blocking Reasons:</p>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#e11d48', fontSize: '0.875rem' }}>
                      {prog.blocking_reasons.map((r, idx) => <li key={idx}>{r}</li>)}
                    </ul>
                  </div>
                )}
             </div>
          ) : <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No progression data available.</p>}
        </div>
        
        {/* Explainability - WHY IS THIS STUDENT AT RISK? */}
        <div className="card" style={{ gridColumn: 'span 2', borderLeft: '4px solid #7c3aed' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            WHY IS THIS STUDENT AT RISK?
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <div>
               <h4 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <Brain size={16} color="#3b82f6" /> Predictive Factors (AI)
               </h4>
               {explain?.top_factors?.length ? (
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                     {explain.top_factors.map(f => (
                        <li key={f.feature}>
                           <span style={{ textTransform: 'capitalize' }}>{f.feature.replace(/_/g, ' ')}</span>: 
                           <span style={{ fontWeight: 600, marginLeft: '0.3rem', color: f.direction === 'increases_risk' ? '#f43f5e' : '#10b981' }}>
                              {f.impact.toUpperCase()} IMPACT
                           </span>
                        </li>
                     ))}
                  </ul>
               ) : <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Run inference to see factors.</p>}
               <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                 * These are predictive factors and do not themselves determine official progression eligibility.
               </p>
            </div>
            <div>
               <h4 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <AlertTriangle size={16} color="#f59e0b" /> Academic Factors (Regulation)
               </h4>
               {prog || credits?.deficit > 0 || acad?.failed_heads > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                     {prog && !prog.attendance_met && <li>Attendance below required threshold</li>}
                     {(prog?.failed_heads || acad?.failed_heads) > 0 && <li>{(prog?.failed_heads || acad?.failed_heads)} failed heads recorded</li>}
                     {(prog?.ese_failed_heads || acad?.ese_failed_heads) > 0 && <li>{(prog?.ese_failed_heads || acad?.ese_failed_heads)} ESE failed heads recorded</li>}
                     {credits?.deficit > 0 && <li>Credit gap: {credits.deficit}</li>}
                     {acad?.backlog_credits > 0 && <li>Backlog credits: {acad.backlog_credits}</li>}
                     {prog && !prog.eligible && <li style={{ color: '#f43f5e', fontWeight: 600 }}>Progression Blocked</li>}
                  </ul>
               ) : <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No progression data evaluated.</p>}
            </div>
          </div>
          <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '2rem' }}>
             <div>
               <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>AI Risk:</span>
               <RiskBadge level={risk?.risk_level} />
             </div>
             <div>
               <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Official Academic Status:</span>
               {prog?.status ? <ProgressionBadge status={prog.status} /> : <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Pending</span>}
             </div>
          </div>
        </div>
        
        {/* Section F: AI Risk */}
        <div className="card">
          <h3 style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>F. AI Risk Profile</h3>
          {rLoad ? <Spinner /> : risk ? (
            <>
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <p style={{ margin: 0, fontSize: '3rem', fontWeight: 800, color: risk.risk_level === 'CRITICAL' ? '#991b1b' : risk.risk_level === 'HIGH' ? '#f43f5e' : risk.risk_level === 'MEDIUM' ? '#f59e0b' : '#10b981' }}>
                  {Math.round(risk.risk_probability * 100)}%
                </p>
                <RiskBadge level={risk.risk_level} />
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Model: {risk.model_version} ({risk.risk_type || 'ML'})
                </p>
              </div>
            </>
          ) : <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No risk score yet.</p>}
        </div>

        {/* Section G: Interventions */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Target size={14} /> G. Interventions
          </h3>
          {ivList?.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {ivList.map((iv) => (
                <div key={iv.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.625rem 0', borderBottom: '1px solid var(--border)' }}>
                  <IVStatusBadge status={iv.status} />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
                    {iv.type?.replace(/_/g, ' ')}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: 300 }}>{iv.reason}</span>
                  {iv.due_date && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Due: {iv.due_date}</span>}
                </div>
              ))}
            </div>
          ) : <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No interventions yet.</p>}
        </div>

      </div>
    </div>
  )
}
