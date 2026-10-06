/**
 * CreditOptimizerTimeline — Institutional Credit Graduation Pathway Optimizer
 * Semester-by-semester clearance plan towards autonomous 160-credit degree requirements.
 */
import { useOptimizedGraduationPath } from '../services/hooks'
import { Spinner } from './ui'
import { Award, Compass, CheckCircle2, AlertCircle } from 'lucide-react'

export default function CreditOptimizerTimeline({ studentId }) {
  const { data: opt, loading } = useOptimizedGraduationPath(studentId)

  if (loading) return <Spinner text="Calculating optimal degree completion pathway…" />
  if (!opt) return null

  const isFeasible = opt.feasibility === 'ON_TIME_FEASIBLE'

  return (
    <div className="card" style={{ borderLeft: '3px solid var(--accent-blue)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Compass size={16} color="var(--accent-blue)" />
            Credit Graduation Path Optimizer
          </h3>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Course registration & backlog clearance pathway towards 160-credit degree completion
          </p>
        </div>

        {/* Status Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          padding: '0.25rem 0.6rem',
          borderRadius: 4,
          fontSize: '0.72rem',
          fontWeight: 600,
          background: isFeasible ? '#ECFDF5' : '#FFFBEB',
          border: `1px solid ${isFeasible ? '#A7F3D0' : '#FDE68A'}`,
          color: isFeasible ? '#059669' : '#B45309',
        }}>
          {isFeasible ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
          {isFeasible ? 'ON-TIME GRADUATION FEASIBLE (SEM 8)' : 'REMEDIAL TERM RECOMMENDED'}
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
        <div style={{ background: 'var(--bg-elevated)', padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Earned Credits</span>
          <span style={{ fontSize: '1.125rem', fontWeight: 700, color: '#059669' }}>{opt.earned_credits} / {opt.total_degree_credits}</span>
        </div>
        <div style={{ background: 'var(--bg-elevated)', padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Backlog Credits</span>
          <span style={{ fontSize: '1.125rem', fontWeight: 700, color: opt.backlog_credits > 0 ? '#DC2626' : 'var(--text-primary)' }}>{opt.backlog_credits} credits</span>
        </div>
        <div style={{ background: 'var(--bg-elevated)', padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Degree Progress</span>
          <span style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--accent-blue)' }}>{opt.completion_pct}%</span>
        </div>
        <div style={{ background: 'var(--bg-elevated)', padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Term Max Cap</span>
          <span style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{opt.max_credits_per_term} cr/sem</span>
        </div>
      </div>

      {/* Semester Clearance Cards */}
      <div style={{ marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.5rem' }}>
          Semester-By-Semester Pathway Plan:
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.5rem' }}>
          {(opt.semesters_plan || []).map(p => {
            const hasBacklogCleared = p.backlog_cleared > 0
            return (
              <div
                key={p.semester}
                style={{
                  background: 'var(--bg-elevated)',
                  border: hasBacklogCleared ? '1px solid #FDE68A' : '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '0.625rem 0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.3rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)' }}>{p.semester_name}</span>
                  <span style={{ fontSize: '0.6875rem', color: p.status === 'CLEAR' ? '#059669' : '#D97706', fontWeight: 600 }}>
                    {p.status}
                  </span>
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span>Regular: <strong>{p.regular_credits} cr</strong></span>
                  {hasBacklogCleared ? (
                    <span style={{ color: '#D97706', fontWeight: 600 }}>Backlog Clearance: +{p.backlog_cleared} cr</span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>Backlog: 0 cr</span>
                  )}
                  <span>Term Load: <strong>{p.total_term_credits} / {p.max_allowed} cr</strong></span>
                </div>

                {/* Capacity Bar */}
                <div style={{ marginTop: 2 }}>
                  <div style={{ height: 4, background: '#E2E8F0', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(p.capacity_usage_pct, 100)}%`, height: '100%', background: hasBacklogCleared ? '#D97706' : 'var(--accent-blue)' }} />
                  </div>
                  <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: 2, display: 'block' }}>
                    Cumulative: {p.cumulative_credits} / 160 cr
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Graduation Target Advice */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 4, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        <Award size={14} color="var(--accent-blue)" />
        <span>
          Clearance schedule adheres to SIES GST autonomous regulation cap (maximum {opt.max_credits_per_term} credits per semester).
        </span>
      </div>
    </div>
  )
}
