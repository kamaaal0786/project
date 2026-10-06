import React, { useState, useEffect, useCallback, useRef } from 'react'
import api from '../services/api'
import { Sparkles, Sliders, CheckCircle2, AlertTriangle, ShieldCheck, ArrowRight, BookmarkCheck, TrendingDown, RefreshCw, RotateCcw } from 'lucide-react'

export default function WhatIfSimulator({ studentId, initialData, onGoalCommitted, onNavigateTab, title = "2026 Prescriptive What-If Simulator" }) {
  const [att, setAtt] = useState(initialData?.attendance ? Math.round(initialData.attendance) : 75)
  const [marks, setMarks] = useState(initialData?.marks ? Math.round(initialData.marks) : 60)
  const [asg, setAsg] = useState(initialData?.assignment_completion ? Math.round(initialData.assignment_completion) : 70)
  const [clearedBacklogs, setClearedBacklogs] = useState(0)
  const [targetEse, setTargetEse] = useState(initialData?.marks ? Math.round(initialData.marks * 0.60) : 36)

  const [loading, setLoading] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [result, setResult] = useState(null)
  const [committedMsg, setCommittedMsg] = useState(null)
  const [lockedGoal, setLockedGoal] = useState(null)
  const [error, setError] = useState(null)

  // Track whether sliders have been synced to actual baseline from API
  const baselineSynced = useRef(false)
  // Store the ground-truth baseline values permanently so Reset to Baseline always restores the exact starting state
  const baselineRef = useRef(null)

  const isResetting = useRef(false)

  // Reset state when switching between students or when initialData arrives
  useEffect(() => {
    baselineSynced.current = false
    baselineRef.current = null
    setResult(null)
    setCommittedMsg(null)
    setLockedGoal(null)
    setError(null)
    setClearedBacklogs(0)

    if (initialData?.attendance != null || initialData?.marks != null) {
      const initAtt = Math.round(initialData.attendance ?? 75)
      const initMarks = Math.round(initialData.marks ?? 60)
      const initEse = Math.round(initMarks * 0.60)
      const initAsg = Math.round(initialData.assignment_completion ?? 70)
      setAtt(initAtt)
      setMarks(initMarks)
      setTargetEse(initEse)
      setAsg(initAsg)
      baselineRef.current = {
        attendance: initAtt,
        marks: initMarks,
        target_ese_score: initEse,
        assignment_completion: initAsg,
        failed_heads: initialData.failed_heads ?? 0,
      }
    }
  }, [studentId, initialData?.attendance, initialData?.marks])

  // Maximum backlogs student can clear
  const maxBacklogs = Math.max(0, initialData?.failed_heads ?? initialData?.failed_subjects ?? 2)

  const runSimulation = useCallback(async (isCommit = false) => {
    if (!studentId) return
    if (isResetting.current) {
      isResetting.current = false
      return
    }
    if (isCommit) setCommitting(true)
    else setLoading(true)
    setError(null)

    try {
      const payload = {
        target_attendance: Number(att),
        target_marks: Number(marks),
        target_assignments: Number(asg),
        target_backlogs_cleared: Number(clearedBacklogs),
        commit_goal: isCommit,
      }
      // Only send explicit ESE score after sliders have synced to baseline
      if (baselineSynced.current) {
        payload.target_ese_score = Number(targetEse)
      }
      const res = await api.post(`/risk/${studentId}/simulate`, payload)
      setResult(res.data)

      // Capture and auto-sync to student's actual baseline on first response
      if (res.data?.baseline) {
        const b = res.data.baseline
        const baseAtt = Math.round(b.attendance ?? 75)
        const baseMarks = Math.round(b.marks ?? 60)
        const baseEse = Math.round(baseMarks * 0.60)
        const baseAsg = Math.round(b.assignment_completion ?? 70)

        // Always save ground-truth baseline to baselineRef
        baselineRef.current = {
          attendance: baseAtt,
          marks: baseMarks,
          target_ese_score: baseEse,
          assignment_completion: baseAsg,
          failed_heads: b.failed_heads ?? 0,
        }

        // Auto-sync sliders on first response
        if (!baselineSynced.current) {
          setAtt(baseAtt)
          setMarks(baseMarks)
          setTargetEse(baseEse)
          setAsg(baseAsg)
          baselineSynced.current = true
        }
      }

      if (isCommit) {
        setLockedGoal({
          ...res.data,
          committedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          simAtt: Number(att),
          simMarks: Number(marks),
          targetEse: Number(targetEse),
          baseRisk: res.data?.baseline?.risk_probability ?? (initialData?.current_risk_prob ?? 0.40),
          targetRisk: res.data?.simulated?.risk_probability ?? 0.10,
          delta: res.data?.risk_delta ?? 0,
        })
        setCommittedMsg("Recovery goal successfully locked in! Added to your active action plan.")
        if (onGoalCommitted) onGoalCommitted(res.data)
      }
    } catch (err) {
      console.error("Simulation failed:", err)
      setError(err.response?.data?.detail || "Simulation unavailable")
    } finally {
      setLoading(false)
      setCommitting(false)
    }
  }, [studentId, att, marks, asg, clearedBacklogs, targetEse, onGoalCommitted])

  // Instant Reset to Baseline: restores all sliders and immediately recalculates neutral baseline impact
  const handleResetToBaseline = async () => {
    const b = result?.baseline || baselineRef.current || initialData
    const resetAtt = Math.round(b?.attendance ?? 75)
    const resetMarks = Math.round(b?.marks ?? 60)
    const resetEse = Math.round(b?.target_ese_score ?? (resetMarks * 0.60))
    const resetAsg = Math.round(b?.assignment_completion ?? 70)
    const resetBacklogs = 0

    isResetting.current = true
    setAtt(resetAtt)
    setMarks(resetMarks)
    setTargetEse(resetEse)
    setAsg(resetAsg)
    setClearedBacklogs(resetBacklogs)

    // Run simulation immediately without waiting for debounce
    try {
      setLoading(true)
      setError(null)
      const payload = {
        target_attendance: resetAtt,
        target_marks: resetMarks,
        target_assignments: resetAsg,
        target_backlogs_cleared: resetBacklogs,
        target_ese_score: resetEse,
        commit_goal: false,
      }
      const res = await api.post(`/risk/${studentId}/simulate`, payload)
      setResult(res.data)
    } catch (err) {
      console.error("Reset simulation failed:", err)
    } finally {
      setLoading(false)
    }
  }

  // Initial simulation run and debounced updates
  useEffect(() => {
    const timer = setTimeout(() => {
      runSimulation(false)
    }, 250)
    return () => clearTimeout(timer)
  }, [runSimulation])

  const baseRisk = result?.baseline?.risk_probability ?? (initialData?.current_risk_prob ?? 0.40)
  const simRisk = result?.simulated?.risk_probability ?? baseRisk
  const delta = result?.risk_delta ?? 0
  const reductionPct = result?.risk_reduction_pct ?? 0
  const isDebarred = result?.is_debarred || att < 50
  const safety = result?.passing_safety
  const isCourseSafe = safety?.course_safe ?? (safety?.is_ese_head_cleared || safety?.ordinance_5042_eligible)

  const projectedSgpa = isDebarred
    ? '0.00'
    : (result?.projected_sgpa !== undefined && result?.projected_sgpa !== null
        ? Number(result.projected_sgpa).toFixed(2)
        : '—')

  const internalMarksContrib = Math.round(marks * 0.40 * 10) / 10
  const compositeMarks = result?.composite_marks ?? Math.round((internalMarksContrib + Number(targetEse)) * 10) / 10

  // SGPA Grade label helper
  const getGradeLabel = (sgpaNum, safe, debarred) => {
    if (debarred) return { text: 'Debarred (Ordinance 6086: Att < 50%)', color: '#dc2626', bg: '#fef2f2' }
    if (!safe) return { text: 'ATKT / Grade F (Failed ESE Head / Aggregate)', color: '#dc2626', bg: '#fef2f2' }
    if (sgpaNum >= 9.0) return { text: 'Grade O (Outstanding)', color: '#059669', bg: '#ecfdf5' }
    if (sgpaNum >= 8.0) return { text: 'Grade A (Excellent)', color: '#059669', bg: '#ecfdf5' }
    if (sgpaNum >= 7.0) return { text: 'Grade B (Very Good)', color: '#2563eb', bg: '#eff6ff' }
    if (sgpaNum >= 6.0) return { text: 'Grade C (Good)', color: '#0891b2', bg: '#ecfeff' }
    if (sgpaNum >= 5.0) return { text: 'Grade D (Fair)', color: '#d97706', bg: '#fffbeb' }
    return { text: 'Grade P (Pass)', color: '#65a30d', bg: '#f7fee7' }
  }
  const gradeInfo = getGradeLabel(Number(projectedSgpa) || 0, isCourseSafe, isDebarred)

  return (
    <div className="card" style={{
      padding: '1.5rem',
      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.98))',
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
      borderRadius: '16px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
            <div style={{ padding: '0.35rem', background: '#eff6ff', borderRadius: '8px', color: '#2563eb' }}>
              <Sliders size={18} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {title}
            </h3>
            <span style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '0.15rem 0.5rem',
              background: '#e0e7ff',
              color: '#3730a3',
              borderRadius: '999px',
              textTransform: 'uppercase',
            }}>
              Autonomous 2026 Engine
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Prescriptive Academic Simulator: ESE accounts for 60% of marks, Internals 40%. Adjust levers to simulate SGPA and risk.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={handleResetToBaseline}
            title="Reset all sliders to current baseline"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.75rem',
              padding: '0.35rem 0.65rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#475569',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'all 0.15s ease',
            }}
          >
            <RotateCcw size={12} /> Reset to Baseline
          </button>

          {loading && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: '#64748b' }}>
              <RefreshCw size={12} className="spin" /> Computing…
            </span>
          )}
        </div>
      </div>

      {committedMsg && (
        <div style={{
          padding: '0.75rem 1rem',
          background: '#ecfdf5',
          border: '1px solid #6ee7b7',
          color: '#065f46',
          borderRadius: '8px',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '1rem',
        }}>
          <CheckCircle2 size={16} />
          <span>{committedMsg}</span>
        </div>
      )}

      {error && (
        <div style={{
          padding: '0.65rem 1rem',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#991b1b',
          borderRadius: '8px',
          fontSize: '0.8rem',
          marginBottom: '1rem',
        }}>
          {error}
        </div>
      )}

      {/* Main Grid: Controls on left, Live Impact on right */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        
        {/* Left Column: Sliders */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          
          {/* PRIMARY LEVER: End-Sem ESE Marks Target Slider (Out of 60 - 60% Weightage) */}
          <div style={{
            background: targetEse >= 24 ? '#f0fdf4' : (targetEse >= 22 ? '#fffbeb' : '#fff1f2'),
            padding: '0.85rem 1rem',
            borderRadius: '12px',
            border: `1.5px solid ${targetEse >= 24 ? '#bbf7d0' : (targetEse >= 22 ? '#fed7aa' : '#fecdd3')}`,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', fontSize: '0.82rem' }}>
              <div>
                <span style={{ fontWeight: 800, color: targetEse >= 24 ? '#14532d' : '#991b1b' }}>
                  Target ESE Theory Exam Score
                </span>
                <span style={{
                  fontSize: '0.68rem',
                  color: '#ffffff',
                  background: '#059669',
                  fontWeight: 700,
                  marginLeft: '0.45rem',
                  padding: '0.1rem 0.45rem',
                  borderRadius: '999px',
                }}>
                  60% Weightage (Highest Factor)
                </span>
              </div>
              <span style={{ fontWeight: 800, fontSize: '0.95rem', color: targetEse >= 24 ? '#059669' : (targetEse >= 22 ? '#d97706' : '#dc2626') }}>
                {Math.round(targetEse)} / 60 marks
              </span>
            </div>
            <input
              type="range"
              min="18"
              max="60"
              step="1"
              value={Math.round(targetEse)}
              onChange={(e) => setTargetEse(Number(e.target.value))}
              style={{ width: '100%', accentColor: targetEse >= 24 ? '#10b981' : '#ef4444' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem' }}>
              <span style={{ color: '#ef4444' }}>18 (Fail Head)</span>
              <span style={{ color: '#059669', fontWeight: 700 }}>≥ 24 (Mandatory Separate Passing Head)</span>
              <span>60 (Max)</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: targetEse >= 24 ? '#15803d' : '#b91c1c', marginTop: '0.4rem', fontWeight: 600, lineHeight: 1.35 }}>
              {targetEse >= 24
                ? `✓ Clearing ESE Head: ${Math.round(targetEse)}/60 marks directly contributes to 60% of your course composite.`
                : (targetEse >= 22
                  ? '⚠ Borderline: Scoring 22-23 requires Ordinance 5042 grace marks to clear separate head.'
                  : '✕ Separate Head Failure: Scoring <24 leads to ATKT / Grade F regardless of high internal marks.')}
            </div>
          </div>

          {/* SECONDARY LEVER: Internal & Termwork Marks Slider (40% Weightage) */}
          <div style={{
            background: '#f8fafc',
            padding: '0.75rem 0.85rem',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.82rem' }}>
              <div>
                <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>Target Internal & Termwork</span>
                <span style={{ fontSize: '0.68rem', color: '#2563eb', fontWeight: 700, marginLeft: '0.4rem' }}>
                  [40% Weightage]
                </span>
              </div>
              <span style={{ fontWeight: 700, color: '#2563eb' }}>
                {Math.round(marks)}% <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b' }}>({internalMarksContrib}/40 marks)</span>
              </span>
            </div>
            <input
              type="range"
              min="30"
              max="95"
              step="1"
              value={Math.round(marks)}
              onChange={(e) => setMarks(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#2563eb' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8' }}>
              <span>30%</span>
              <span>ISE (20) + MSE (20) + Term Work</span>
              <span>95% Max</span>
            </div>
          </div>

          {/* Attendance Slider (Ordinance 6086) */}
          <div style={{
            background: isDebarred ? '#fff1f2' : (att < 75 ? '#fffbeb' : '#f8fafc'),
            padding: '0.75rem 0.85rem',
            borderRadius: '10px',
            border: `1px solid ${isDebarred ? '#fecdd3' : (att < 75 ? '#fed7aa' : '#e2e8f0')}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.82rem' }}>
              <div>
                <span style={{ fontWeight: 700, color: isDebarred ? '#991b1b' : 'var(--text-secondary)' }}>Target Attendance</span>
                <span style={{ fontSize: '0.68rem', color: '#64748b', marginLeft: '0.4rem' }}>
                  (O.6086: Floor ≥ 75%)
                </span>
              </div>
              <span style={{ fontWeight: 800, color: att >= 75 ? '#059669' : (att >= 50 ? '#d97706' : '#dc2626') }}>
                {Math.round(att)}% {att >= 75 ? '✓ Compliant' : (att >= 50 ? '⚠ Condonation Zone' : '✕ Debarred (<50%)')}
              </span>
            </div>
            <input
              type="range"
              min="30"
              max="100"
              step="1"
              value={Math.round(att)}
              onChange={(e) => setAtt(Number(e.target.value))}
              style={{ width: '100%', accentColor: att >= 75 ? '#10b981' : (att >= 50 ? '#f59e0b' : '#ef4444') }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8' }}>
              <span style={{ color: '#ef4444' }}>&lt;50% Debarred</span>
              <span style={{ color: '#d97706' }}>50-74% Condonation</span>
              <span style={{ color: '#059669', fontWeight: 700 }}>≥75% Compliant</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: att >= 75 ? '#15803d' : (att >= 50 ? '#b45309' : '#b91c1c'), marginTop: '0.3rem', fontWeight: 500 }}>
              {att >= 75
                ? '✓ Eligible for all semester examinations without condonation.'
                : (att >= 50
                  ? '⚠ In Condonation Zone: Requires Principal approval under Ordinance 6086 to appear for ESE.'
                  : '✕ Debarred: Under Ordinance 6086, students with <50% attendance cannot appear for ESE exams.')}
            </div>
          </div>

          {/* Assignments Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.82rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Assignment & Lab Completion</span>
              <span style={{ fontWeight: 700, color: '#0891b2' }}>{Math.round(asg)}%</span>
            </div>
            <input
              type="range"
              min="30"
              max="100"
              step="1"
              value={Math.round(asg)}
              onChange={(e) => setAsg(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#0891b2' }}
            />
          </div>

          {/* Backlogs to Clear */}
          {maxBacklogs > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.82rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>ATKT Backlog Heads to Clear</span>
                <span style={{ fontWeight: 700, color: '#7c3aed' }}>
                  {clearedBacklogs} of {maxBacklogs} backlogs
                </span>
              </div>
              <input
                type="range"
                min="0"
                max={maxBacklogs}
                step="1"
                value={clearedBacklogs}
                onChange={(e) => setClearedBacklogs(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#7c3aed' }}
              />
            </div>
          )}
        </div>

        {/* Right Column: Dynamic Impact & Recovery Prescription */}
        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '1rem',
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.65rem' }}>
              Projected Performance & Trajectory Impact
            </div>

            {/* Top Stat Cards: Always displays Current Risk, Simulated Risk, AND Projected SGPA */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {/* Current Risk */}
              <div style={{ textAlign: 'center', padding: '0.6rem 0.4rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Current Risk</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: baseRisk >= 0.5 ? '#dc2626' : '#d97706' }}>
                  {Math.round(baseRisk * 100)}%
                </div>
              </div>

              {/* Simulated Risk */}
              <div style={{
                textAlign: 'center',
                padding: '0.6rem 0.4rem',
                background: simRisk <= baseRisk ? '#ecfdf5' : '#fef2f2',
                borderRadius: '8px',
                border: `1px solid ${simRisk <= baseRisk ? '#a7f3d0' : '#fecaca'}`,
              }}>
                <div style={{ fontSize: '0.7rem', color: simRisk <= baseRisk ? '#047857' : '#991b1b', fontWeight: 600 }}>
                  Simulated Risk
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: simRisk <= baseRisk ? '#059669' : '#dc2626' }}>
                  {Math.round(simRisk * 100)}%
                </div>
              </div>

              {/* ALWAYS SHOW PROJECTED SGPA */}
              <div style={{
                textAlign: 'center',
                padding: '0.6rem 0.4rem',
                background: isDebarred ? '#fef2f2' : (Number(projectedSgpa) >= 7.0 ? '#eff6ff' : (Number(projectedSgpa) >= 5.0 ? '#f0fdf4' : '#fff1f2')),
                borderRadius: '8px',
                border: `1px solid ${isDebarred ? '#fecaca' : (Number(projectedSgpa) >= 7.0 ? '#bfdbfe' : (Number(projectedSgpa) >= 5.0 ? '#bbf7d0' : '#fecdd3'))}`,
              }}>
                <div style={{ fontSize: '0.7rem', color: isDebarred ? '#991b1b' : '#1e40af', fontWeight: 600 }}>Projected SGPA</div>
                <div style={{
                  fontSize: '1.2rem',
                  fontWeight: 800,
                  color: isDebarred ? '#dc2626' : (Number(projectedSgpa) >= 7.0 ? '#1d4ed8' : (Number(projectedSgpa) >= 5.0 ? '#15803d' : '#b91c1c')),
                }}>
                  {projectedSgpa}
                </div>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, marginTop: '2px', color: isDebarred ? '#dc2626' : (att >= 75 ? '#059669' : '#d97706') }}>
                  {isDebarred ? 'Debarred (<50%)' : (att >= 75 ? '✓ Compliant' : '⚠ Condonation (50-74%)')}
                </div>
              </div>
            </div>

            {/* Composite Academic Score & Grade Breakdown */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
              padding: '0.65rem 0.75rem',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              marginBottom: '0.65rem',
              fontSize: '0.75rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ color: '#475569', fontWeight: 600 }}>Course Composite: </span>
                  <strong style={{ color: '#0f172a', fontSize: '0.9rem' }}>{compositeMarks}%</strong>
                </div>
                <span style={{
                  padding: '0.15rem 0.45rem',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: gradeInfo.color,
                  background: gradeInfo.bg,
                }}>
                  {gradeInfo.text}
                </span>
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                Formula: Internal ({internalMarksContrib}/40) + ESE ({Math.round(targetEse)}/60) = {compositeMarks}/100
              </div>
            </div>

            {/* Delta & Trajectory Callout */}
            {delta > 0 ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.75rem',
                background: '#f0fdf4',
                color: '#15803d',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 600,
                marginBottom: '0.75rem',
              }}>
                <TrendingDown size={15} />
                <span>{reductionPct}% Risk Reduction (-{Math.round(delta * 100)} pts)</span>
              </div>
            ) : delta < 0 ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.75rem',
                background: '#fef2f2',
                color: '#b91c1c',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 600,
                marginBottom: '0.75rem',
              }}>
                <AlertTriangle size={15} />
                <span>+{Math.round(Math.abs(delta) * 100)} pts Increased Risk ({isDebarred ? 'Debarred from ESE' : 'Check ESE passing head / attendance'})</span>
              </div>
            ) : (
              <div style={{
                fontSize: '0.75rem',
                color: '#64748b',
                padding: '0.45rem 0.75rem',
                background: '#f8fafc',
                borderRadius: '8px',
                marginBottom: '0.75rem',
              }}>
                Baseline trajectory — adjust sliders to simulate academic improvements
              </div>
            )}

            {/* SIES GST Autonomous ESE Passing Head Assessment */}
            <div style={{
              padding: '0.65rem 0.85rem',
              borderRadius: '8px',
              border: `1px solid ${isDebarred ? '#fecdd3' : (safety?.is_ese_head_cleared ? '#bbf7d0' : (safety?.ordinance_5042_eligible ? '#fed7aa' : '#fecaca'))}`,
              background: isDebarred ? '#fff1f2' : (safety?.is_ese_head_cleared ? '#f0fdf4' : (safety?.ordinance_5042_eligible ? '#fffbeb' : '#fef2f2')),
              marginBottom: '0.75rem',
              fontSize: '0.78rem',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontWeight: 700,
                color: isDebarred ? '#991b1b' : (safety?.is_ese_head_cleared ? '#15803d' : (safety?.ordinance_5042_eligible ? '#b45309' : '#b91c1c')),
                marginBottom: '0.2rem'
              }}>
                {isDebarred ? <AlertTriangle size={15} /> : (safety?.is_ese_head_cleared ? <ShieldCheck size={15} /> : <AlertTriangle size={15} />)}
                <span>SIES GST R19/R24 Autonomous Passing Head Rules</span>
              </div>
              <div style={{ color: '#475569', lineHeight: 1.4 }}>
                {isDebarred ? (
                  <span><strong>Debarred under Ordinance 6086:</strong> Attendance is below 50%. The student cannot sit for ESE theory examination until attendance is condoned or term is repeated.</span>
                ) : safety?.is_ese_head_cleared ? (
                  <span>Target score of <strong>{Math.round(targetEse)}/60</strong> safely clears the 40% separate passing threshold (min 24 marks). Aggregate is {compositeMarks >= 40 ? 'cleared (≥40%)' : 'below 40%!'}.</span>
                ) : safety?.ordinance_5042_eligible ? (
                  <span>Target <strong>{Math.round(targetEse)}/60</strong> is borderline. Qualifies for up to 2 grace marks under <strong>Ordinance 5042</strong> because course aggregate is {compositeMarks}%.</span>
                ) : (
                  <span>Target <strong>{Math.round(targetEse)}/60</strong> fails the separate passing head (&lt;24 marks). Leads to ATKT backlog regardless of internal marks.</span>
                )}
              </div>
            </div>

            {/* Actionable Milestones List */}
            {result?.actionable_milestones && (
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  Targeted Recovery Milestones
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {result.actionable_milestones.map((m, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', fontSize: '0.75rem', color: '#334155' }}>
                      <CheckCircle2 size={13} color={m.includes('CRITICAL') ? '#dc2626' : '#10b981'} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span style={{ fontWeight: m.includes('CRITICAL') ? 600 : 400 }}>{m}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Locked Goal Confirmation Card vs Lock In Goal Button */}
          {lockedGoal ? (
            <div style={{
              background: '#f0fdf4',
              border: '2px solid #86efac',
              borderRadius: '12px',
              padding: '1.15rem',
              boxShadow: '0 4px 14px rgba(22, 163, 74, 0.12)',
              animation: 'fadeIn 0.25s ease-out',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ padding: '0.35rem', background: '#dcfce7', borderRadius: '50%', color: '#16a34a' }}>
                    <CheckCircle2 size={18} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#14532d' }}>
                      Recovery Goal Locked & Action Plan Created
                    </h4>
                    <span style={{ fontSize: '0.7rem', color: '#15803d' }}>
                      Enforced at {lockedGoal.committedAt} · Active in Interventions
                    </span>
                  </div>
                </div>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  background: '#16a34a',
                  color: '#ffffff',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '999px',
                }}>
                  -{Math.round(lockedGoal.delta * 100)}% Risk Drop
                </span>
              </div>

              {/* Recovery Trajectory Chart */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #bbf7d0',
                borderRadius: '10px',
                padding: '0.75rem 0.85rem',
                marginBottom: '0.85rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b' }}>
                    📈 Recovery Flight Path Trajectory (Next 12 Weeks)
                  </span>
                  <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                    Risk Reduction Roadmap
                  </span>
                </div>
                <TrajectoryChart
                  baseRisk={lockedGoal.baseRisk}
                  targetRisk={lockedGoal.targetRisk}
                />
                <div style={{ display: 'flex', justifyContent: 'center', gap: '1.25rem', marginTop: '0.35rem', fontSize: '0.68rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#dc2626' }}>
                    <span style={{ width: 12, height: 2, background: '#ef4444', display: 'inline-block', borderTop: '2px dashed #ef4444' }}></span>
                    Status Quo ({Math.round(lockedGoal.baseRisk * 100)}%)
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#059669', fontWeight: 700 }}>
                    <span style={{ width: 12, height: 3, background: '#10b981', display: 'inline-block', borderRadius: 2 }}></span>
                    Recovery Target ({Math.round(lockedGoal.targetRisk * 100)}%)
                  </span>
                </div>
              </div>

              {/* Actionable Milestones List */}
              <div style={{ marginBottom: '0.85rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
                  Committed Action Milestones:
                </span>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.75rem', color: '#14532d', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {(lockedGoal.actionable_milestones || result?.actionable_milestones || []).map((m, idx) => (
                    <li key={idx} style={{ lineHeight: 1.35 }}>{m}</li>
                  ))}
                </ul>
              </div>

              {/* Next Steps Buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('interventions')}
                    className="btn btn-primary"
                    style={{
                      flex: '1 1 auto',
                      fontSize: '0.78rem',
                      padding: '0.5rem 0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                      background: '#15803d',
                      borderColor: '#15803d',
                      fontWeight: 700,
                    }}
                  >
                    <span>Track in Interventions Tab</span>
                    <ArrowRight size={13} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setLockedGoal(null)}
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.78rem',
                    padding: '0.5rem 0.75rem',
                    color: '#475569',
                    background: '#ffffff',
                  }}
                >
                  Simulate New Goal
                </button>
              </div>
            </div>
          ) : (
            <>
              {delta <= 0 && (
                <div style={{
                  fontSize: '0.72rem',
                  color: '#475569',
                  background: '#f8fafc',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '6px',
                  padding: '0.4rem 0.65rem',
                  lineHeight: 1.35,
                }}>
                  <span style={{ fontWeight: 600, color: '#334155' }}>🔒 Goal Lock Condition:</span> Set target values on the sliders to produce a net risk reduction (simulated risk &lt; current risk) to commit this plan.
                </div>
              )}

              <button
                type="button"
                onClick={() => runSimulation(true)}
                disabled={committing || delta <= 0}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 1rem',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  background: delta > 0 ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : '#94a3b8',
                  cursor: delta > 0 ? 'pointer' : 'not-allowed',
                  boxShadow: delta > 0 ? '0 2px 8px rgba(37, 99, 235, 0.25)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <BookmarkCheck size={16} />
                {committing ? "Locking in Commitment…" : delta > 0 ? `Lock In Recovery Goal (-${Math.round(delta * 100)}% Risk)` : "Increase Targets to Unlock Goal Lock"}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  )
}

function TrajectoryChart({ baseRisk, targetRisk }) {
  const width = 460
  const height = 135
  const padX = 40
  const padY = 18

  const p0y = padY + (1 - Math.min(0.95, Math.max(0.05, baseRisk))) * (height - 2 * padY)
  const p1y = padY + (1 - Math.min(0.95, Math.max(0.05, baseRisk * 0.70 + targetRisk * 0.30))) * (height - 2 * padY)
  const p2y = padY + (1 - Math.min(0.95, Math.max(0.05, baseRisk * 0.35 + targetRisk * 0.65))) * (height - 2 * padY)
  const p3y = padY + (1 - Math.min(0.95, Math.max(0.05, targetRisk))) * (height - 2 * padY)

  const x0 = padX
  const x1 = padX + (width - 2 * padX) * 0.33
  const x2 = padX + (width - 2 * padX) * 0.66
  const x3 = width - padX

  const recoveryPath = `M ${x0} ${p0y} C ${x0 + 40} ${p0y}, ${x1 - 40} ${p1y}, ${x1} ${p1y} C ${x1 + 40} ${p1y}, ${x2 - 40} ${p2y}, ${x2} ${p2y} C ${x2 + 40} ${p2y}, ${x3 - 40} ${p3y}, ${x3} ${p3y}`
  const areaPath = `${recoveryPath} L ${x3} ${height - padY} L ${x0} ${height - padY} Z`

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <defs>
          <linearGradient id="recoveryGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="strokeGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0.25, 0.50, 0.75].map(v => {
          const y = padY + (1 - v) * (height - 2 * padY)
          return (
            <g key={v}>
              <line x1={padX} y1={y} x2={width - padX} y2={y} stroke="#f1f5f9" strokeDasharray="3 3" />
              <text x={padX - 6} y={y + 3} fontSize="8.5" fill="#94a3b8" textAnchor="end">{Math.round(v * 100)}%</text>
            </g>
          )
        })}

        {/* Status quo line (dashed red) */}
        <line x1={x0} y1={p0y} x2={x3} y2={p0y} stroke="#fca5a5" strokeWidth="2" strokeDasharray="4 4" />

        {/* Shaded area */}
        <path d={areaPath} fill="url(#recoveryGrad)" />

        {/* Smooth recovery trajectory curve */}
        <path d={recoveryPath} fill="none" stroke="url(#strokeGrad)" strokeWidth="3" strokeLinecap="round" />

        {/* Milestone marker points */}
        <circle cx={x0} cy={p0y} r="5" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
        <circle cx={x1} cy={p1y} r="4" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
        <circle cx={x2} cy={p2y} r="4" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
        <circle cx={x3} cy={p3y} r="6" fill="#059669" stroke="#ffffff" strokeWidth="2" />

        {/* Milestone Labels */}
        <text x={x0} y={height - 3} fontSize="8.5" fill="#64748b" textAnchor="middle" fontWeight="600">Week 0 (Now)</text>
        <text x={x1} y={height - 3} fontSize="8.5" fill="#64748b" textAnchor="middle" fontWeight="600">Week 4 (Mid-Sem)</text>
        <text x={x2} y={height - 3} fontSize="8.5" fill="#64748b" textAnchor="middle" fontWeight="600">Week 8 (ESE Prep)</text>
        <text x={x3} y={height - 3} fontSize="8.5" fill="#059669" textAnchor="middle" fontWeight="700">Week 12 (Target)</text>

        {/* Point values */}
        <text x={x0} y={p0y - 7} fontSize="9.5" fill="#dc2626" textAnchor="middle" fontWeight="700">{Math.round(baseRisk * 100)}%</text>
        <text x={x3} y={p3y - 7} fontSize="9.5" fill="#059669" textAnchor="middle" fontWeight="700">{Math.round(targetRisk * 100)}%</text>
      </svg>
    </div>
  )
}

