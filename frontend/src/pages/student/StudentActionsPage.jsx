/**
 * StudentActionsPage — personal intervention / action plan cards + AI Recovery Roadmap.
 * Includes interactive checklist milestone tracking and real-time progress %.
 */
import { useState } from 'react'
import authService from '../../services/auth'
import api from '../../services/api'
import { useInterventions } from '../../services/hooks'
import { Spinner, ErrorBanner, IVStatusBadge, ProgressBar } from '../../components/ui'
import { Target, CheckCircle2, Clock, CheckSquare, Square, Award, AlertCircle } from 'lucide-react'
import AIRecoveryRoadmap from '../../components/AIRecoveryRoadmap'

const TYPE_ICONS = {
  ATTENDANCE_PLAN: '📅',
  BACKLOG_PLAN: '📚',
  CREDIT_RECOVERY_PLAN: '🎯',
  ASSIGNMENT_SUPPORT: '📝',
  MENTOR_REVIEW: '👥',
}

const PRIORITY_COLOR = { HIGH: '#f43f5e', MEDIUM: '#f59e0b', LOW: '#10b981' }

export default function StudentActionsPage() {
  const user = authService.getUser()
  const { data, loading, error, refetch } = useInterventions()
  const [togglingId, setTogglingId] = useState(null)

  const handleToggleTask = async (interventionId, itemId) => {
    setTogglingId(`${interventionId}-${itemId}`)
    try {
      await api.patch(`/interventions/${interventionId}`, {
        toggle_item_id: itemId,
      })
      await refetch()
    } catch (err) {
      alert(err.response?.data?.detail || err.message)
    } finally {
      setTogglingId(null)
    }
  }

  const sortedData = [...(data || [])].sort((a, b) => {
    const aHasTasks = (a.action_checklist && a.action_checklist.length > 0) ? 1 : 0
    const bHasTasks = (b.action_checklist && b.action_checklist.length > 0) ? 1 : 0
    if (bHasTasks !== aHasTasks) return bHasTasks - aHasTasks
    return new Date(b.created_at || 0) - new Date(a.created_at || 0)
  })

  const open      = sortedData.filter(iv => iv.status !== 'COMPLETED' && iv.status !== 'FOLLOW_UP')
  const completed = sortedData.filter(iv => iv.status === 'COMPLETED' || iv.status === 'FOLLOW_UP')

  if (loading) return <Spinner text="Loading action plan…" />

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '2.5rem' }}>
      <div className="page-header">
        <h1 className="page-title">Personalized Intervention & Recovery</h1>
        <p className="page-subtitle">Track your individual recovery milestones, mark completed tasks, and monitor semester progress</p>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Feature: AI Personalized Academic Recovery Engine */}
      {user?.student_id && (
        <div style={{ marginBottom: '2rem' }}>
          <AIRecoveryRoadmap studentId={user.student_id} studentName={user.name} onInterventionAdded={refetch} />
        </div>
      )}

      {(data || []).length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <CheckCircle2 size={40} color="#10b981" style={{ margin: '0 auto 1rem', display: 'block' }} />
          <p style={{ color: 'var(--text-secondary)', fontWeight: 600, margin: '0 0 0.25rem' }}>All clear!</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
            No standard intervention plans assigned yet. Use the AI Roadmap above to generate custom milestones.
          </p>
        </div>
      ) : (
        <>
          {open.length > 0 && (
            <div style={{ marginBottom: '2.5rem' }}>
              <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Clock size={16} color="var(--accent-blue)" /> Active Action Plans & Tasks ({open.length})
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
                {open.map(iv => {
                  const pct = iv.progress_pct ?? 0
                  const checklist = iv.action_checklist || []
                  const completedTasks = checklist.filter(t => t.completed).length

                  return (
                    <div
                      key={iv.id}
                      className="card"
                      style={{
                        borderLeft: `4px solid ${PRIORITY_COLOR[iv.priority] || '#6b7280'}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                      }}
                    >
                      {/* Header with Type & Status */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontSize: '1.3rem' }}>{TYPE_ICONS[iv.type] || '📋'}</span>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>
                            {iv.type?.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <IVStatusBadge status={iv.status} />
                      </div>

                      {/* Targeted Course & Priority Badges */}
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {iv.target_course_code && (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.5rem',
                              borderRadius: 4,
                              background: '#EFF6FF',
                              border: '1px solid #BFDBFE',
                              color: '#1D4ED8',
                            }}
                          >
                            🎯 Focus: {iv.target_course_code} {iv.target_course_name ? `(${iv.target_course_name})` : ''}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.5rem',
                            borderRadius: 4,
                            background: iv.priority === 'HIGH' ? '#FEE2E2' : '#FEF3C7',
                            color: iv.priority === 'HIGH' ? '#DC2626' : '#B45309',
                          }}
                        >
                          {iv.priority} Priority
                        </span>
                        {iv.due_date && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Due: {iv.due_date}
                          </span>
                        )}
                      </div>

                      {/* Reason / Context */}
                      <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                        {iv.reason}
                      </p>

                      {/* Milestone Objective */}
                      {iv.milestone_goal && (
                        <div
                          style={{
                            background: '#F0FDF4',
                            border: '1px solid #BBF7D0',
                            borderRadius: 6,
                            padding: '0.5rem 0.75rem',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.4rem',
                          }}
                        >
                          <Award size={14} color="#16A34A" style={{ marginTop: '0.15rem', flexShrink: 0 }} />
                          <div>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#15803D', textTransform: 'uppercase', display: 'block' }}>
                              Milestone Goal
                            </span>
                            <span style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 500 }}>
                              {iv.milestone_goal}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Closed-Loop Efficacy Banner */}
                      {iv.risk_delta > 0 ? (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          background: '#ECFDF5',
                          border: '1px solid #A7F3D0',
                          padding: '0.4rem 0.65rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          color: '#065F46',
                          fontWeight: 600,
                        }}>
                          <span>📉 Efficacy Impact: -{iv.risk_delta_pct}% Risk Reduction</span>
                          <span style={{ marginLeft: 'auto', padding: '0.1rem 0.4rem', background: '#D1FAE5', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700 }}>
                            {iv.efficacy_status}
                          </span>
                        </div>
                      ) : iv.baseline_risk_prob > 0 ? (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.35rem 0.65rem',
                          background: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          color: '#64748B',
                        }}>
                          <span>Baseline Risk Anchor: {Math.round(iv.baseline_risk_prob * 100)}%</span>
                          <span>Efficacy: {iv.efficacy_status || 'Tracking'}</span>
                        </div>
                      ) : null}

                      {/* Progress Bar & Counter */}
                      <div style={{ background: 'var(--bg-elevated)', padding: '0.625rem 0.75rem', borderRadius: 6, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Intervention Progress
                          </span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: pct === 100 ? '#10B981' : pct >= 50 ? '#3B82F6' : '#F59E0B' }}>
                            {pct}% ({completedTasks}/{checklist.length || 0} tasks done)
                          </span>
                        </div>
                        <ProgressBar value={pct} color={pct === 100 ? '#10B981' : pct >= 50 ? '#3B82F6' : '#F59E0B'} />
                      </div>

                      {/* Interactive Action Checklist */}
                      {checklist.length > 0 && (
                        <div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'block' }}>
                            Action Checklist (Click to update your progress):
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {checklist.map(item => {
                              const isToggling = togglingId === `${iv.id}-${item.id}`
                              return (
                                <button
                                  key={item.id}
                                  onClick={() => handleToggleTask(iv.id, item.id)}
                                  disabled={isToggling}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '0.5rem',
                                    padding: '0.45rem 0.6rem',
                                    borderRadius: 6,
                                    border: item.completed ? '1px solid #A7F3D0' : '1px solid var(--border)',
                                    background: item.completed ? '#F0FDF4' : 'var(--bg-surface)',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    width: '100%',
                                    transition: 'all 0.15s ease',
                                    opacity: isToggling ? 0.6 : 1,
                                  }}
                                >
                                  {item.completed ? (
                                    <CheckSquare size={16} color="#16A34A" style={{ marginTop: '0.1rem', flexShrink: 0 }} />
                                  ) : (
                                    <Square size={16} color="var(--text-muted)" style={{ marginTop: '0.1rem', flexShrink: 0 }} />
                                  )}
                                  <div style={{ flex: 1 }}>
                                    <span
                                      style={{
                                        fontSize: '0.78rem',
                                        color: item.completed ? '#166534' : 'var(--text-primary)',
                                        textDecoration: item.completed ? 'line-through' : 'none',
                                        fontWeight: item.completed ? 400 : 500,
                                        display: 'block',
                                        lineHeight: 1.35,
                                      }}
                                    >
                                      {item.task}
                                    </span>
                                    {item.week && (
                                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                        Target: Week {item.week}
                                      </span>
                                    )}
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Completed Interventions Section */}
          {completed.length > 0 && (
            <div>
              <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CheckCircle2 size={16} color="#10B981" /> Completed / Resolved Milestones ({completed.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {completed.map(iv => (
                  <div
                    key={iv.id}
                    className="card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <CheckCircle2 size={18} color="#16A34A" />
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                          {iv.type?.replace(/_/g, ' ')}
                        </span>
                        {iv.target_course_code && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                            ({iv.target_course_code})
                          </span>
                        )}
                        <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {iv.reason}
                        </p>
                      </div>
                    </div>
                    <IVStatusBadge status={iv.status} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
