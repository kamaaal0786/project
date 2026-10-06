/**
 * AIRecoveryRoadmap — Institutional Academic Recovery Engine
 * 4-week structured milestone roadmap and ready-to-use faculty outreach draft.
 */
import { useState } from 'react'
import api from '../services/api'
import authService from '../services/auth'
import {
  Calendar, Clock, Target, Mail, CheckCircle2,
  Copy, Check, Save, RefreshCw, ChevronDown, ChevronUp, BookOpen
} from 'lucide-react'

export default function AIRecoveryRoadmap({ studentId, studentName, onInterventionAdded, isStudent: isStudentProp }) {
  const currentUser = authService.getUser()
  const isStudent = isStudentProp !== undefined ? isStudentProp : currentUser?.role === 'student'
  const [loading, setLoading] = useState(false)
  const [plan, setPlan] = useState(null)
  const [err, setErr] = useState(null)
  const [activeWeek, setActiveWeek] = useState(1)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [showOutreach, setShowOutreach] = useState(false)

  const generatePlan = async () => {
    setLoading(true)
    setErr(null)
    setSavedSuccess(false)
    try {
      const res = await api.post(`/interventions/${studentId}/generate-roadmap`)
      setPlan(res.data)
      setActiveWeek(1)
    } catch (e) {
      setErr(e.response?.data?.detail || e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCopyEmail = () => {
    if (plan?.outreach?.body) {
      navigator.clipboard.writeText(plan.outreach.body)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  const saveAsIntervention = async () => {
    if (!plan) return
    setSaving(true)
    try {
      await api.post(`/interventions/${studentId}/save-roadmap-plan`, {
        title: '4-Week Academic Recovery Plan',
        reason: `Targeting: ${plan.primary_priorities?.join(', ')}. Action items structured across 4 weekly milestones.`,
        target_course_code: plan.target_course_code,
        target_course_name: plan.target_course_name,
        milestone_goal: plan.milestone_goal,
        action_checklist: plan.action_checklist,
      })
      setSavedSuccess(true)
      if (onInterventionAdded) onInterventionAdded()
    } catch (e) {
      alert(e.response?.data?.detail || e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card" style={{ borderLeft: '3px solid var(--accent-blue)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <BookOpen size={16} color="var(--accent-blue)" />
            {isStudent ? 'My Academic Recovery Roadmap' : 'Personalized Academic Recovery Roadmap'}
          </h3>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {isStudent
              ? 'Your personalized 4-week milestone recovery plan synthesized from attendance, coursework, and credit requirements'
              : 'Automated 4-week milestone recovery plan synthesized from student attendance, backlogs, and credit gaps'}
          </p>
        </div>

        <button
          onClick={generatePlan}
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? (
            <>
              <RefreshCw size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> Generating Roadmap…
            </>
          ) : (
            <>
              <Calendar size={13} /> {plan ? (isStudent ? 'Refresh Recovery Roadmap' : 'Regenerate Plan') : (isStudent ? 'Generate My Recovery Roadmap' : 'Generate Recovery Roadmap')}
            </>
          )}
        </button>
      </div>

      {err && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          {err}
        </div>
      )}

      {!plan && !loading && (
        <div style={{ textAlign: 'center', padding: '1.75rem 1rem', border: '1px dashed var(--border)', borderRadius: 6, background: 'var(--bg-elevated)' }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
            No active recovery roadmap generated
          </p>
          <p style={{ margin: '0.25rem auto 0.875rem', fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: 420 }}>
            {isStudent
              ? 'Generate a targeted 4-week milestone plan based on your current semester coursework, exam scores, and attendance.'
              : "Generate a targeted 4-week milestone plan based on the student's current semester credits, failed heads, and attendance deficit."}
          </p>
          <button onClick={generatePlan} className="btn btn-secondary">
            {isStudent ? 'Synthesize My Recovery Roadmap' : `Synthesize Plan for ${studentName || 'Student'}`}
          </button>
        </div>
      )}

      {plan && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Priorities header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', background: 'var(--bg-elevated)', padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Recovery Priorities:</span>
              {(plan.primary_priorities || []).map((p, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: '0.7rem',
                    padding: '0.15rem 0.45rem',
                    background: '#EFF6FF',
                    border: '1px solid #BFDBFE',
                    color: '#1D4ED8',
                    borderRadius: 4,
                    fontWeight: 600,
                  }}
                >
                  {p}
                </span>
              ))}
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Engine: {plan.engine_type}
            </span>
          </div>

          {/* Week Selection Tabs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
            {(plan.roadmap || []).map(w => {
              const isActive = activeWeek === w.week_number
              return (
                <button
                  key={w.week_number}
                  onClick={() => setActiveWeek(w.week_number)}
                  style={{
                    padding: '0.5rem 0.4rem',
                    textAlign: 'center',
                    borderRadius: 6,
                    border: isActive ? '1px solid var(--accent-blue)' : '1px solid var(--border)',
                    cursor: 'pointer',
                    background: isActive ? '#EFF6FF' : 'var(--bg-surface)',
                    color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>Week {w.week_number}</div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {w.primary_focus}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Active Week Details Card */}
          {(() => {
            const curW = (plan.roadmap || []).find(w => w.week_number === activeWeek) || plan.roadmap?.[0]
            if (!curW) return null

            return (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Week {curW.week_number}: {curW.title}
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: 'var(--text-secondary)', background: 'var(--bg-elevated)', padding: '0.2rem 0.5rem', borderRadius: 4, fontWeight: 600 }}>
                    <Clock size={12} /> {curW.daily_study_hours} hrs/day recommended
                  </div>
                </div>

                {/* Key action items */}
                <div>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Scheduled Tasks:
                  </span>
                  <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1.25rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {(curW.action_items || []).map((item, idx) => (
                      <li key={idx} style={{ lineHeight: 1.4 }}>{item}</li>
                    ))}
                  </ul>
                </div>

                {/* Milestone & Mentor Checkpoint */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.625rem', marginTop: '0.25rem' }}>
                  <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '0.625rem', borderRadius: 6 }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Target size={12} /> Milestone Objective
                    </span>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: '#065F46' }}>
                      {curW.milestone_goal}
                    </p>
                  </div>
                  <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '0.625rem', borderRadius: 6 }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#1D4ED8', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Calendar size={12} /> Mentor Checkpoint
                    </span>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: '#1E40AF' }}>
                      {curW.mentor_checkpoint}
                    </p>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Faculty / Mentor Action Row */}
          {!isStudent && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.625rem', paddingTop: '0.25rem' }}>
              <button
                onClick={() => setShowOutreach(!showOutreach)}
                className="btn btn-secondary"
              >
                <Mail size={13} style={{ marginRight: '0.25rem' }} />
                {showOutreach ? 'Hide Mentor Outreach Draft' : 'Preview Mentor Outreach Draft'}
                {showOutreach ? <ChevronUp size={13} style={{ marginLeft: '0.25rem' }} /> : <ChevronDown size={13} style={{ marginLeft: '0.25rem' }} />}
              </button>

              <button
                onClick={saveAsIntervention}
                disabled={saving || savedSuccess}
                className="btn"
                style={{
                  background: savedSuccess ? '#059669' : 'var(--bg-surface)',
                  border: '1px solid var(--border-strong)',
                  color: savedSuccess ? '#FFFFFF' : 'var(--text-primary)',
                }}
              >
                {savedSuccess ? (
                  <>
                    <CheckCircle2 size={13} /> Recorded in Interventions
                  </>
                ) : saving ? (
                  <>
                    <RefreshCw size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> Recording…
                  </>
                ) : (
                  <>
                    <Save size={13} /> Commit as Official Intervention
                  </>
                )}
              </button>
            </div>
          )}

          {/* Student Guidance Note */}
          {isStudent && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 0.875rem', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 6, marginTop: '0.25rem' }}>
              <Calendar size={14} color="var(--accent-blue)" />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Bring this roadmap to your Friday mentor checkpoint to review weekly progress and milestone completion.
              </span>
            </div>
          )}

          {/* Collapsible Outreach Draft (Faculty/Mentor only) */}
          {!isStudent && showOutreach && plan.outreach && (
            <div className="card" style={{ background: 'var(--bg-elevated)', padding: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Subject: {plan.outreach.subject}
                </span>
                <button
                  onClick={handleCopyEmail}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                >
                  {copied ? <><Check size={12} color="#059669" /> Copied</> : <><Copy size={12} /> Copy Draft</>}
                </button>
              </div>
              <pre style={{
                margin: 0,
                padding: '0.75rem',
                background: '#FFFFFF',
                border: '1px solid var(--border)',
                borderRadius: 4,
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                fontFamily: 'inherit',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.5,
              }}>
                {plan.outreach.body}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
