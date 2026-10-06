/**
 * VelocityRadar — Institutional Early-Warning Velocity Radar
 * Identifies sudden academic declines and silent risks before threshold violations.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useVelocityAlerts } from '../services/hooks'
import { Spinner } from './ui'
import { Activity, TrendingDown, TrendingUp, EyeOff, ArrowRight } from 'lucide-react'

export default function VelocityRadar() {
  const { data: alerts, loading } = useVelocityAlerts()
  const [filter, setFilter] = useState('ALL')

  if (loading) return <Spinner text="Scanning academic velocity trajectories…" />

  const list = alerts || []
  const rapidCount = list.filter(a => a.trajectory === 'RAPID_DECLINE').length
  const silentCount = list.filter(a => a.is_silent_risk).length
  const improvingCount = list.filter(a => a.trajectory === 'IMPROVING').length

  const filtered = list.filter(a => {
    if (filter === 'RAPID') return a.trajectory === 'RAPID_DECLINE'
    if (filter === 'SILENT') return a.is_silent_risk
    if (filter === 'IMPROVING') return a.trajectory === 'IMPROVING'
    return true
  })

  return (
    <div className="card" style={{ borderLeft: '3px solid #DC2626' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Activity size={16} color="#DC2626" />
            Early-Warning Velocity Radar
          </h3>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Automated rate-of-change detector catching students experiencing sharp attendance or grade drops
          </p>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--bg-elevated)', padding: '0.2rem', borderRadius: 6, border: '1px solid var(--border)' }}>
          {[
            { id: 'ALL', label: `All (${list.length})` },
            { id: 'RAPID', label: `Rapid Decline (${rapidCount})` },
            { id: 'SILENT', label: `Silent Risk (${silentCount})` },
            { id: 'IMPROVING', label: `Recovering (${improvingCount})` },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                padding: '0.25rem 0.55rem',
                fontSize: '0.72rem',
                borderRadius: 4,
                border: 'none',
                cursor: 'pointer',
                fontWeight: filter === f.id ? 600 : 500,
                background: filter === f.id ? '#FFFFFF' : 'transparent',
                color: filter === f.id ? 'var(--accent-blue)' : 'var(--text-secondary)',
                boxShadow: filter === f.id ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', padding: '0.5rem 0', margin: 0 }}>
          No student trajectories match the selected filter.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 340, overflowY: 'auto' }}>
          {filtered.slice(0, 10).map(s => {
            const isRapid = s.trajectory === 'RAPID_DECLINE'
            const isImp = s.trajectory === 'IMPROVING'
            const isSilent = s.is_silent_risk

            return (
              <div
                key={s.student_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.625rem 0.875rem',
                  background: 'var(--bg-elevated)',
                  borderRadius: 6,
                  border: isRapid ? '1px solid #FECACA' : isSilent ? '1px solid #FDE68A' : '1px solid var(--border)',
                  gap: '0.875rem',
                  flexWrap: 'wrap',
                }}
              >
                {/* Identity */}
                <div style={{ minWidth: 150, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                      {s.name}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      ({s.roll_no})
                    </span>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {s.branch} · Sem {s.semester}
                  </span>
                </div>

                {/* Trajectory Badge */}
                <div>
                  {isRapid && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.15rem 0.45rem', borderRadius: 4, fontSize: '0.6875rem', fontWeight: 600, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
                      <TrendingDown size={11} /> RAPID DECLINE
                    </span>
                  )}
                  {isSilent && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.15rem 0.45rem', borderRadius: 4, fontSize: '0.6875rem', fontWeight: 600, background: '#FFFBEB', border: '1px solid #FDE68A', color: '#B45309' }}>
                      <EyeOff size={11} /> SILENT AT-RISK
                    </span>
                  )}
                  {isImp && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.15rem 0.45rem', borderRadius: 4, fontSize: '0.6875rem', fontWeight: 600, background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#059669' }}>
                      <TrendingUp size={11} /> RECOVERING
                    </span>
                  )}
                  {!isRapid && !isSilent && !isImp && (
                    <span style={{ padding: '0.15rem 0.45rem', borderRadius: 4, fontSize: '0.6875rem', fontWeight: 500, background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#475569' }}>
                      STABLE
                    </span>
                  )}
                </div>

                {/* Alert details */}
                <div style={{ flex: 1.5, minWidth: 180 }}>
                  <span style={{ fontSize: '0.75rem', color: isRapid ? '#DC2626' : isSilent ? '#B45309' : 'var(--text-secondary)' }}>
                    {s.primary_alert}
                  </span>
                </div>

                {/* Urgency Meter */}
                <div style={{ width: 90 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: 2 }}>
                    <span>Urgency</span>
                    <span style={{ fontWeight: 600, color: s.urgency_score > 60 ? '#DC2626' : s.urgency_score > 40 ? '#D97706' : '#059669' }}>
                      {s.urgency_score}%
                    </span>
                  </div>
                  <div style={{ height: 4, background: '#E2E8F0', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${s.urgency_score}%`, height: '100%', background: s.urgency_score > 60 ? '#DC2626' : s.urgency_score > 40 ? '#D97706' : '#059669' }} />
                  </div>
                </div>

                {/* Inspect Action */}
                <Link
                  to={`/students/${s.student_id}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 600 }}
                >
                  Dossier <ArrowRight size={12} />
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
