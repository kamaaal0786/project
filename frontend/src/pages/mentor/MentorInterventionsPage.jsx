/**
 * MentorInterventionsPage — mentor-specific view of assigned interventions.
 * Shows targeted subject focus, milestone progress %, and interactive task tracking.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInterventions } from '../../services/hooks'
import api from '../../services/api'
import { Spinner, ErrorBanner, IVStatusBadge, ProgressBar } from '../../components/ui'
import { ClipboardCheck, ChevronRight, AlertCircle, Target, Award, CheckSquare, Square } from 'lucide-react'

const PRIORITY_COLOR = { HIGH: '#f43f5e', MEDIUM: '#f59e0b', LOW: '#10b981' }
const MENTOR_STATUSES = ['ASSIGNED', 'IN_PROGRESS', 'FOLLOW_UP', 'COMPLETED', 'DISMISSED']

export default function MentorInterventionsPage() {
  const { data: rawList, loading, error, refetch } = useInterventions()
  const [updating, setUpdating]   = useState(null)
  const [notes, setNotes]         = useState({})
  const [expanded, setExpanded]   = useState({})
  const [togglingId, setTogglingId] = useState(null)

  const updateStatus = async (id, status) => {
    setUpdating(id)
    try {
      await api.patch(`/interventions/${id}`, {
        status,
        note: notes[id] || undefined,
      })
      refetch()
    } catch (e) {
      alert(e.response?.data?.detail || e.message)
    } finally {
      setUpdating(null)
    }
  }

  const handleToggleTask = async (interventionId, itemId) => {
    setTogglingId(`${interventionId}-${itemId}`)
    try {
      await api.patch(`/interventions/${interventionId}`, {
        toggle_item_id: itemId,
      })
      await refetch()
    } catch (e) {
      alert(e.response?.data?.detail || e.message)
    } finally {
      setTogglingId(null)
    }
  }

  // Group by student
  const grouped = (rawList || []).reduce((acc, iv) => {
    const key = iv.student_name || `Student #${iv.student_id}`
    if (!acc[key]) acc[key] = { sid: iv.student_id, items: [] }
    acc[key].items.push(iv)
    return acc
  }, {})

  Object.values(grouped).forEach(g => {
    g.items.sort((a, b) => {
      const aHas = (a.action_checklist && a.action_checklist.length > 0) ? 1 : 0
      const bHas = (b.action_checklist && b.action_checklist.length > 0) ? 1 : 0
      if (bHas !== aHas) return bHas - aHas
      return new Date(b.created_at || 0) - new Date(a.created_at || 0)
    })
  })

  const groups = Object.entries(grouped).map(([name, val]) => ({ name, ...val }))

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '2.5rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Assigned Interventions & Milestones</h1>
          <p className="page-subtitle">Review, track progress, and update action plans for your mentored students</p>
        </div>
      </div>

      {/* Role explanation banner */}
      <div className="card" style={{ marginBottom: '1.25rem', display: 'flex', gap: '0.875rem', alignItems: 'flex-start', borderLeft: '3px solid #3b82f6' }}>
        <ClipboardCheck size={18} color="#3b82f6" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
        <div>
          <p style={{ margin: '0 0 0.2rem', fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>Your role as Mentor</p>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Review students' individualized recovery targets, track checklist task completion, 
            and record progress notes. Both you and the student can check off milestones as they are accomplished.
          </p>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {loading ? <Spinner /> : groups.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <AlertCircle size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
          <p style={{ margin: 0 }}>No intervention plans assigned yet.</p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem' }}>Plans will appear here when generated or assigned to your students.</p>
        </div>
      ) : (
        groups.map(({ name, sid, items }) => {
          const pending = items.filter(i => i.status === 'PENDING' || i.status === 'ASSIGNED').length
          return (
            <div key={sid} className="card" style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#8b5cf6' }}>
                    {name[0]}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{name}</p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {items.length} plan{items.length !== 1 ? 's' : ''} · 
                      {pending > 0 ? <span style={{ color: '#f59e0b' }}> {pending} need attention</span> : <span style={{ color: '#10b981' }}> all actioned</span>}
                    </p>
                  </div>
                </div>
                <Link to={`/mentor/students/${sid}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#3b82f6', fontSize: '0.8rem', textDecoration: 'none', fontWeight: 600 }}>
                  View Profile & Gradebook <ChevronRight size={13} />
                </Link>
              </div>

              {items.map(iv => {
                const pct = iv.progress_pct ?? 0
                const checklist = iv.action_checklist || []
                const completedTasks = checklist.filter(t => t.completed).length

                return (
                  <div key={iv.id} style={{ borderTop: '1px solid var(--border)', paddingTop: '0.875rem', marginTop: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', flex: 1 }}>
                        <IVStatusBadge status={iv.status} />
                        <span style={{ fontWeight: 700, fontSize: '0.75rem', color: PRIORITY_COLOR[iv.priority] || '#6b7280' }}>
                          {iv.priority}
                        </span>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {iv.type?.replace(/_/g, ' ')}
                        </span>
                        {iv.target_course_code && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              padding: '0.1rem 0.4rem',
                              borderRadius: 4,
                              background: '#EFF6FF',
                              border: '1px solid #BFDBFE',
                              color: '#1D4ED8',
                            }}
                          >
                            🎯 {iv.target_course_code} {iv.target_course_name ? `(${iv.target_course_name})` : ''}
                          </span>
                        )}
                      </div>

                      {/* Status control */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <select
                          value={iv.status}
                          disabled={updating === iv.id}
                          onChange={e => updateStatus(iv.id, e.target.value)}
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', cursor: 'pointer' }}
                        >
                          {MENTOR_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                        </select>

                        <button
                          onClick={() => setExpanded(prev => ({ ...prev, [iv.id]: !prev[iv.id] }))}
                          style={{ fontSize: '0.75rem', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem 0.4rem', fontWeight: 600 }}
                        >
                          {expanded[iv.id] ? 'Hide details' : 'Tasks & Notes'}
                        </button>
                      </div>
                    </div>

                    <p style={{ margin: '0.35rem 0 0.5rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {iv.reason}
                    </p>

                    {/* Progress Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.5rem 0' }}>
                      <div style={{ flex: 1 }}>
                        <ProgressBar value={pct} color={pct === 100 ? '#10B981' : pct >= 50 ? '#3B82F6' : '#F59E0B'} />
                      </div>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: pct === 100 ? '#10B981' : pct >= 50 ? '#3B82F6' : '#F59E0B', whiteSpace: 'nowrap' }}>
                        {pct}% ({completedTasks}/{checklist.length} done)
                      </span>
                    </div>

                    {/* Milestone Goal Display */}
                    {iv.milestone_goal && (
                      <div style={{ fontSize: '0.75rem', color: '#166534', background: '#F0FDF4', padding: '0.3rem 0.6rem', borderRadius: 4, border: '1px solid #BBF7D0', marginBottom: '0.5rem' }}>
                        <strong>Milestone:</strong> {iv.milestone_goal}
                      </div>
                    )}

                    {/* Expanded Tasks & Note Input */}
                    {expanded[iv.id] && (
                      <div style={{ marginTop: '0.6rem', padding: '0.625rem', background: 'var(--bg-elevated)', borderRadius: 6, border: '1px solid var(--border)' }}>
                        {checklist.length > 0 && (
                          <div style={{ marginBottom: '0.75rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem', display: 'block' }}>
                              Milestone Action Items:
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                              {checklist.map(item => {
                                const isToggling = togglingId === `${iv.id}-${item.id}`
                                return (
                                  <button
                                    key={item.id}
                                    onClick={() => handleToggleTask(iv.id, item.id)}
                                    disabled={isToggling}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.5rem',
                                      padding: '0.35rem 0.5rem',
                                      borderRadius: 4,
                                      border: '1px solid var(--border)',
                                      background: item.completed ? '#F0FDF4' : 'var(--bg-surface)',
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                    }}
                                  >
                                    {item.completed ? (
                                      <CheckSquare size={14} color="#16A34A" />
                                    ) : (
                                      <Square size={14} color="var(--text-muted)" />
                                    )}
                                    <span style={{ fontSize: '0.75rem', color: item.completed ? '#166534' : 'var(--text-primary)', textDecoration: item.completed ? 'line-through' : 'none' }}>
                                      {item.task}
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input
                            placeholder="Add mentor observation or outcome note…"
                            value={notes[iv.id] || ''}
                            onChange={e => setNotes(prev => ({ ...prev, [iv.id]: e.target.value }))}
                            style={{ flex: 1, padding: '0.4rem 0.65rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: '0.8rem' }}
                          />
                          <button
                            className="btn btn-primary"
                            style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
                            disabled={updating === iv.id}
                            onClick={() => updateStatus(iv.id, iv.status)}
                          >
                            Save Note
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })
      )}
    </div>
  )
}
