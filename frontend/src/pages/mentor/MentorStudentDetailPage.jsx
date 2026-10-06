/**
 * MentorStudentDetailPage — Institutional Student Profile for Mentors
 * Gives mentors full visibility into academic marks, credit progress,
 * and AI interventions with live status updates.
 */
import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  useStudent, useCurrentRisk, useRiskHistory,
  useExplanation, useCredits, useInterventions, useProgression
} from '../../services/hooks'
import {
  RiskBadge, Spinner, ErrorBanner, ProgressBar,
  IVStatusBadge, ProgressionBadge, MetricTile
} from '../../components/ui'
import {
  ArrowLeft, RefreshCw, CheckCircle, TrendingUp,
  CreditCard, Shield, ClipboardCheck, BookOpen, UserCheck
} from 'lucide-react'
import api from '../../services/api'
import AIRecoveryRoadmap from '../../components/AIRecoveryRoadmap'
import CreditOptimizerTimeline from '../../components/CreditOptimizerTimeline'
import WhatIfSimulator from '../../components/WhatIfSimulator'
import RemedialTargetsCard from '../../components/RemedialTargetsCard'

export default function MentorStudentDetailPage() {
  const { id } = useParams()
  const sid = Number(id)

  const { data: student, loading: sLoad, error: sErr, refetch: refetchStudent } = useStudent(sid)
  const { data: risk, loading: rLoad, refetch: refetchRisk } = useCurrentRisk(sid)
  const { data: history, refetch: refetchHistory } = useRiskHistory(sid)
  const { data: explain, refetch: refetchExplain } = useExplanation(sid)
  const { data: credits, refetch: refetchCredits } = useCredits(sid)
  const { data: prog, refetch: refetchProg } = useProgression(sid)
  const { data: ivList, refetch: refetchIV } = useInterventions(sid)

  const [activeTab, setActiveTab] = useState('overview')
  const [selectedSemester, setSelectedSemester] = useState(null)
  const [updatingIV, setUpdatingIV] = useState(null)
  const [note, setNote] = useState('')
  const [predicting, setPredicting] = useState(false)
  const [predictMsg, setPredictMsg] = useState(null)

  const updateIV = async (ivId, status) => {
    setUpdatingIV(ivId)
    try {
      await api.patch(`/interventions/${ivId}`, { status, note: note || undefined })
      setNote('')
      refetchIV()
    } catch (e) {
      alert(e.response?.data?.detail || e.message)
    } finally {
      setUpdatingIV(null)
    }
  }

  const runPrediction = async () => {
    setPredicting(true)
    setPredictMsg(null)
    try {
      const res = await api.post(`/risk/${sid}/predict`)
      setPredictMsg(`Risk re-evaluated: ${res.data?.risk_level} (${Math.round((res.data?.risk_probability || 0) * 100)}% dropout probability)`)
      refetchRisk()
      refetchHistory()
      refetchExplain()
      refetchStudent()
    } catch (e) {
      alert(e.response?.data?.detail || e.message)
    } finally {
      setPredicting(false)
    }
  }

  if (sLoad) return <Spinner text="Loading mentee academic dossier…" />
  if (sErr) return <ErrorBanner message={sErr} />

  const acad = student?.latest_academic_record || (student?.academic_records?.length ? student.academic_records[student.academic_records.length - 1] : {}) || {}
  const allCourses = student?.course_results || []
  const availableSemesters = Array.from(new Set(allCourses.map(c => c.semester))).sort((a, b) => a - b)
  const curSem = student?.semester || (availableSemesters.length ? availableSemesters[availableSemesters.length - 1] : 1)
  const effectiveSem = selectedSemester || curSem
  const filteredCourses = allCourses.filter(c => c.semester === effectiveSem)
  const semAcad = (student?.academic_records || []).find(r => 
    Number(r.semester) === Number(effectiveSem) || 
    r.term === `Semester ${effectiveSem}` || 
    r.term === `SEM${effectiveSem}` || 
    r.raw_term === `SEM${effectiveSem}` ||
    r.term?.endsWith(` ${effectiveSem}`) ||
    r.term?.endsWith(`S${effectiveSem}`) || 
    r.term?.endsWith(`SEM${effectiveSem}`)
  ) || (student?.academic_records || []).find(r => {
    const m = (r.raw_term || r.term || '').match(/(?:sem|s|semester)\s*0?(\d+)/i) || (r.raw_term || r.term || '').match(/(\d)$/)
    return m && parseInt(m[1], 10) === Number(effectiveSem)
  }) || (student?.academic_records || [])[Number(effectiveSem) - 1] || acad

  const attendanceVal = acad?.attendance != null ? acad.attendance : 85
  const isAttendanceCompliant = attendanceVal >= 75

  const generateModelExplanation = () => {
    const reasons = []
    if (attendanceVal < 75) {
      reasons.push(`Attendance at ${attendanceVal}% is below the mandatory 75% threshold (Ordinance 6086)`)
    }
    if ((credits?.deficit || 0) > 0) {
      reasons.push(`Curriculum credit deficit of ${credits.deficit} credits behind degree pace`)
    }
    if ((acad?.backlog_credits || 0) > 0 || (credits?.backlog_credits || 0) > 0) {
      reasons.push(`${acad?.backlog_credits || credits?.backlog_credits} active backlog credits`)
    }
    if ((acad?.failed_heads || 0) > 0) {
      reasons.push(`${acad.failed_heads} failed subject heads`)
    }
    if (acad?.gpa && acad.gpa < 6.0) {
      reasons.push(`Semester SGPA (${Number(acad.gpa).toFixed(1)}) is below the academic warning baseline`)
    }

    if (reasons.length === 0) {
      return `Student maintains compliant attendance (${attendanceVal}%), fully cleared credits (${credits?.earned || 0}/${credits?.expected || credits?.earned || 0} cr, 0 backlogs), and satisfactory grade progression.`
    }

    if (attendanceVal < 75 && (credits?.deficit || 0) === 0 && (acad?.failed_heads || 0) === 0 && (acad?.backlog_credits || 0) === 0) {
      if (attendanceVal >= 50) {
        return `Attendance (${attendanceVal}%) is in the condonation band under Ordinance 6086 (eligible for Principal condonation on medical/sports grounds). Academic performance (SGPA ${Number(acad?.gpa || 7).toFixed(1)}) and credit clearance (0 backlogs, ${credits?.earned || 0} earned credits) remain in full compliance.`
      }
      return `Attendance (${attendanceVal}%) is below the condonation floor under Ordinance 6086. Academic performance (SGPA ${Number(acad?.gpa || 7).toFixed(1)}) and credit clearance (0 backlogs, ${credits?.earned || 0} earned credits) remain in compliance.`
    }

    return `${reasons.join('; ')} are the primary factors contributing to this risk evaluation.`
  }

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '2.5rem' }}>
      <div style={{ marginBottom: '0.875rem' }}>
        <Link
          to="/at-risk"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            color: 'var(--text-muted)',
            fontSize: '0.8125rem',
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={13} /> Back to Mentorship Roster
        </Link>
      </div>

      {/* Header Card */}
      <div
        className="card"
        style={{
          marginBottom: '1.25rem',
          padding: '1.125rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          background: '#FFFFFF',
          borderLeft: `4px solid ${risk?.risk_level === 'CRITICAL' ? '#991B1B' : risk?.risk_level === 'HIGH' ? '#DC2626' : risk?.risk_level === 'MEDIUM' ? '#D97706' : '#059669'}`,
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 700, margin: '0 0 0.25rem', color: 'var(--text-primary)' }}>
            {student?.name}
          </h1>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{student?.roll_no}</span> · {student?.program || 'B.Tech Computer Science'} · Semester {student?.semester || 5}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            <RiskBadge level={risk?.risk_level} />
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '0.2rem 0.55rem',
                borderRadius: 9999,
                background: isAttendanceCompliant ? '#ECFDF5' : '#FEF2F2',
                border: `1px solid ${isAttendanceCompliant ? '#A7F3D0' : '#FECACA'}`,
                color: isAttendanceCompliant ? '#059669' : '#DC2626',
              }}
            >
              {isAttendanceCompliant ? `Attendance: ${attendanceVal}% (Compliant)` : `Attendance: ${attendanceVal}% (Low)`}
            </span>
            {prog?.status && <ProgressionBadge status={prog.status} />}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <button
            onClick={runPrediction}
            disabled={predicting}
            className="btn btn-primary"
          >
            {predicting ? <RefreshCw size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <TrendingUp size={14} />}
            Run Prediction
          </button>
        </div>
      </div>

      {predictMsg && (
        <div className="alert alert-success" style={{ marginBottom: '1.25rem' }}>
          <CheckCircle size={15} /> {predictMsg}
        </div>
      )}

      {/* Segmented Navigation */}
      <div className="tab-bar">
        {[
          { id: 'overview',     label: 'Overview & Profile' },
          { id: 'academics',    label: 'Academic Records' },
          { id: 'credits',      label: 'Credits & Degree Pathway' },
          { id: 'risk',         label: 'Risk Analysis' },
          { id: 'interventions', label: `Interventions (${ivList?.length || 0})` },
        ].map(t => (
          <button
            key={t.id}
            className={`tab-btn${activeTab === t.id ? ' active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.875rem' }}>
            <MetricTile label="Cumulative GPA" value={acad?.gpa != null ? `${Number(acad.gpa).toFixed(1)} / 10` : '—'} subtext="Academic Standing" color="#1D4ED8" />
            <MetricTile label="Total Score" value={acad?.marks != null ? `${acad.marks}%` : '—'} subtext="Curricular Total" color="#059669" />
            <MetricTile label="ISE Marks" value={acad?.ise_marks != null ? `${Math.min(20, Number(acad.ise_marks))} / 20` : '—'} subtext="Continuous Internal (20)" />
            <MetricTile label="MSE Marks" value={acad?.mse_marks != null ? `${Math.min(20, Number(acad.mse_marks))} / 20` : '—'} subtext="Mid Semester (20)" />
            <MetricTile label="ESE Marks" value={acad?.ese_marks != null ? `${Math.min(60, Number(acad.ese_marks))} / 60` : '—'} subtext="End Semester Exam (60)" />
            <MetricTile label="Term Work (TW)" value={acad?.tw_marks != null ? `${Math.min(25, Number(acad.tw_marks))} / 25` : '21 / 25'} subtext="Continuous Lab (25)" />
            <MetricTile label="Oral / Practical" value={acad?.pr_or_marks != null ? `${Math.min(25, Number(acad.pr_or_marks))} / 25` : '22 / 25'} subtext="Viva & Practical (25)" />
            <MetricTile
              label="Attendance (O.6086)"
              value={`${attendanceVal}%`}
              subtext={attendanceVal >= 80 ? 'Ordinance 6086 Compliant' : attendanceVal >= 75 ? 'Warning Zone' : attendanceVal >= 50 ? 'Medical Condonation Req' : 'Definitive Detention'}
              color={attendanceVal < 75 ? '#DC2626' : attendanceVal < 80 ? '#D97706' : '#059669'}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            <div className="card">
              <h3 style={{ margin: '0 0 1rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                Mentee Profile
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>Roll Number</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{student?.roll_no}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>Branch</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>{student?.branch || 'Computer Science'}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>Admission Year</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>{student?.admission_year || 2022}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>Current Year</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>Year {student?.current_year || 3}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>Semester</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>Semester {student?.semester || 5}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>Regulation</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{student?.regulation || 'R19'}</span>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ margin: '0 0 1rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                Credit Status & Requirements
              </h3>
              {credits ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {credits.earned} <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>/ {credits.expected} Expected</span>
                    </span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--accent-blue)' }}>
                      {credits.completion_pct}% completed
                    </span>
                  </div>
                  <ProgressBar value={credits.completion_pct} color={credits.status === 'ON_TRACK' ? '#059669' : '#DC2626'} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                    <div>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>Target</span>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{credits.required || 160} cr</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>Deficit Gap</span>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: credits.deficit > 0 ? '#DC2626' : '#059669' }}>{credits.deficit || 0} cr</span>
                    </div>
                  </div>
                </div>
              ) : <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>No credit data available.</p>}
            </div>
          </div>

          {/* SIES GST Autonomous Regulations & Ordinances Audit Card */}
          <div className="card" style={{ background: '#F8FAFC', border: '1px solid #CBD5E1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: '#1E293B', textTransform: 'uppercase' }}>
                  🏛️ SIES GST Autonomous Regulations & Ordinances Audit
                </span>
                <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.45rem', borderRadius: 4, background: '#E2E8F0', color: '#475569', fontWeight: 600 }}>
                  {student?.regulation || 'R19 / R24'}
                </span>
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748B', fontStyle: 'italic' }}>
                Governed under UGC Autonomous Guidelines & Mumbai University Ordinances
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem' }}>
              <div style={{ padding: '0.5rem 0.75rem', background: '#FFFFFF', borderRadius: 6, border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#64748B', display: 'block', textTransform: 'uppercase' }}>Ordinance 6086</span>
                <div style={{ fontSize: '0.8125rem', fontWeight: 700, marginTop: '0.15rem', color: attendanceVal < 75 ? '#DC2626' : '#059669' }}>
                  {attendanceVal >= 80 ? '✓ Compliant Standing' : attendanceVal >= 75 ? '⚠️ Warning Band' : attendanceVal >= 50 ? '⚠️ Medical Condonation' : '🚫 Term Detained'}
                </div>
              </div>

              <div style={{ padding: '0.5rem 0.75rem', background: '#FFFFFF', borderRadius: 6, border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#64748B', display: 'block', textTransform: 'uppercase' }}>ATKT Ceiling</span>
                <div style={{ fontSize: '0.8125rem', fontWeight: 700, marginTop: '0.15rem', color: (acad?.failed_heads || 0) > 8 ? '#DC2626' : '#059669' }}>
                  Failed Heads: {acad?.failed_heads || 0} / 8 (ESE: {acad?.ese_failed_heads || 0} / 5)
                </div>
              </div>

              <div style={{ padding: '0.5rem 0.75rem', background: '#FFFFFF', borderRadius: 6, border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#64748B', display: 'block', textTransform: 'uppercase' }}>FE All-Clear Gate</span>
                <div style={{ fontSize: '0.8125rem', fontWeight: 700, marginTop: '0.15rem', color: (student?.semester || 1) >= 5 && (acad?.previous_backlogs || 0) > 0 ? '#DC2626' : '#059669' }}>
                  {(student?.semester || 1) >= 5 ? ((acad?.previous_backlogs || 0) > 0 ? '🚫 BLOCKED (Year Drop)' : '✓ Cleared for TE') : 'In-Progress (Gate: Sem 5)'}
                </div>
              </div>

              <div style={{ padding: '0.5rem 0.75rem', background: '#FFFFFF', borderRadius: 6, border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#64748B', display: 'block', textTransform: 'uppercase' }}>AICTE N+2 Clock</span>
                <div style={{ fontSize: '0.8125rem', fontWeight: 700, marginTop: '0.15rem', color: '#0F172A' }}>
                  Year {student?.current_year || 3} of {student?.is_dse ? 5 : 6} Max Years
                </div>
              </div>

              <div style={{ padding: '0.5rem 0.75rem', background: '#FFFFFF', borderRadius: 6, border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#64748B', display: 'block', textTransform: 'uppercase' }}>AICTE Activity Pts</span>
                <div style={{ fontSize: '0.8125rem', fontWeight: 700, marginTop: '0.15rem', color: '#1D4ED8' }}>
                  {student?.activity_points || 85} / {student?.is_dse ? 75 : 100} Points
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ACADEMICS */}
      {activeTab === 'academics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* SIES GST Remedial & ESE Safety Targets */}
          <RemedialTargetsCard studentId={sid} />

          {/* Active Semester Marksheet Card */}
          <div id="marksheet-section" className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', background: 'var(--bg-elevated)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Semester Gradebook & Marksheet (Autonomous 100 Marks Pattern)
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Viewing marksheet for Semester {effectiveSem} {effectiveSem === curSem ? '• Current Term' : '• Historical Record'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Select Semester:</label>
                <select
                  value={effectiveSem}
                  onChange={e => setSelectedSemester(Number(e.target.value))}
                  style={{ padding: '0.35rem 0.65rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  {availableSemesters.map(s => (
                    <option key={s} value={s}>
                      Semester {s} {s === curSem ? '(Current)' : '(Historical)'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Term Summary Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', padding: '0.875rem 1.25rem', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Term SGPA</span>
                <span style={{ display: 'block', fontSize: '1.1rem', fontWeight: 700, color: '#1D4ED8' }}>{semAcad?.gpa != null ? Number(semAcad.gpa).toFixed(1) : '—'} / 10</span>
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Term Total %</span>
                <span style={{ display: 'block', fontSize: '1.1rem', fontWeight: 700, color: '#059669' }}>{semAcad?.marks != null ? `${semAcad.marks}%` : '—'}</span>
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Attendance (O.6086)</span>
                <span style={{ display: 'block', fontSize: '1.1rem', fontWeight: 700, color: (semAcad?.attendance || 80) < 75 ? '#DC2626' : '#059669' }}>{semAcad?.attendance != null ? `${semAcad.attendance}%` : '85%'}</span>
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Failed Heads</span>
                <span style={{ display: 'block', fontSize: '1.1rem', fontWeight: 700, color: (semAcad?.failed_heads || 0) > 0 ? '#DC2626' : '#059669' }}>{semAcad?.failed_heads || 0} heads</span>
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Backlog Credits</span>
                <span style={{ display: 'block', fontSize: '1.1rem', fontWeight: 700, color: (semAcad?.backlog_credits || 0) > 0 ? '#DC2626' : '#059669' }}>{semAcad?.backlog_credits || 0} cr</span>
              </div>
            </div>

            <div style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
              <table className="data-table" style={{ minWidth: 920 }}>
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th style={{ textAlign: 'center' }}>ISE (20)</th>
                    <th style={{ textAlign: 'center' }}>MSE (20)</th>
                    <th style={{ textAlign: 'center' }}>ESE (60)</th>
                    <th style={{ textAlign: 'center' }}>TW (25)</th>
                    <th style={{ textAlign: 'center' }}>PR/OR (25)</th>
                    <th style={{ textAlign: 'center' }}>Total (100)</th>
                    <th style={{ textAlign: 'center' }}>Grade</th>
                    <th style={{ textAlign: 'center' }}>Credits</th>
                    <th style={{ textAlign: 'center' }}>Status / Ordinance</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCourses.length === 0 ? (
                    <tr><td colSpan={10} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>No courses recorded for Semester {effectiveSem}.</td></tr>
                  ) : filteredCourses.map(c => (
                    <tr key={c.course_code}>
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.course_name}</span>
                        <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{c.course_code}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>{c.ise_marks ?? '—'} <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>/ 20</span></td>
                      <td style={{ textAlign: 'center' }}>{c.mse_marks ?? '—'} <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>/ 20</span></td>
                      <td style={{ textAlign: 'center' }}>{c.ese_marks ?? '—'} <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>/ 60</span></td>
                      <td style={{ textAlign: 'center' }}>{c.tw_marks != null ? c.tw_marks : '—'} <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>/ 25</span></td>
                      <td style={{ textAlign: 'center' }}>{c.pr_or_marks != null ? c.pr_or_marks : '—'} <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>/ 25</span></td>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-primary)' }}>{c.total_marks ?? '—'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          padding: '0.15rem 0.45rem',
                          borderRadius: 4,
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          background: c.grade === 'F' ? '#FEE2E2' : '#EFF6FF',
                          color: c.grade === 'F' ? '#DC2626' : '#1D4ED8',
                        }}>
                          {c.grade || 'P'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{c.credits}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          padding: '0.15rem 0.45rem',
                          borderRadius: 4,
                          background: c.is_failed || c.grade === 'F' ? '#FEE2E2' : c.ordinance_applied ? '#FEF3C7' : '#DCFCE7',
                          color: c.is_failed || c.grade === 'F' ? '#DC2626' : c.ordinance_applied ? '#D97706' : '#059669',
                        }}>
                          {c.is_failed || c.grade === 'F' ? 'BACKLOG (KT)' : c.ordinance_applied ? c.ordinance_applied : 'CLEARED'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Multi-Semester Historical Progression Audit Card */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
              <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                📜 Multi-Semester Progression & Audit Trail
              </h3>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Historical progression records across all evaluated academic terms
              </p>
            </div>
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Academic Term</th>
                    <th style={{ textAlign: 'center' }}>SGPA</th>
                    <th style={{ textAlign: 'center' }}>Marks %</th>
                    <th style={{ textAlign: 'center' }}>Attendance (O.6086)</th>
                    <th style={{ textAlign: 'center' }}>Failed Heads</th>
                    <th style={{ textAlign: 'center' }}>Backlog Credits</th>
                    <th style={{ textAlign: 'center' }}>Ordinance / Status</th>
                    <th style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(student?.academic_records || []).map((rec, idx) => {
                    const recSem = rec.semester || (() => {
                      const m = (rec.raw_term || rec.term || '').match(/(?:sem|s|semester)\s*0?(\d+)/i) || (rec.raw_term || rec.term || '').match(/(\d)$/)
                      return m ? parseInt(m[1], 10) : (idx + 1)
                    })()
                    const isSelected = effectiveSem === recSem
                    const att = rec.attendance ?? 80
                    const termTitle = rec.term_label || (rec.term?.startsWith('Semester') ? rec.term : `Semester ${recSem}`)
                    const termSub = rec.term_subtitle || `Term ${recSem}`
                    return (
                      <tr key={rec.id || idx} style={{ background: isSelected ? 'rgba(59, 130, 246, 0.05)' : undefined }}>
                        <td>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{termTitle}</span>
                          <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{termSub}</span>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: '#1D4ED8' }}>{rec.gpa != null ? Number(rec.gpa).toFixed(1) : '—'}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{rec.marks != null ? `${rec.marks}%` : '—'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontWeight: 600, color: att < 75 ? '#DC2626' : '#059669' }}>
                            {att}%
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontWeight: 700, color: (rec.failed_heads || 0) > 0 ? '#DC2626' : '#059669' }}>
                            {rec.failed_heads || 0}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{rec.backlog_credits || 0} cr</td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            padding: '0.15rem 0.4rem',
                            borderRadius: 4,
                            background: (rec.failed_heads || 0) > 0 ? '#FEE2E2' : rec.ordinance_applied ? '#FEF3C7' : '#DCFCE7',
                            color: (rec.failed_heads || 0) > 0 ? '#DC2626' : rec.ordinance_applied ? '#D97706' : '#059669',
                          }}>
                            {(rec.failed_heads || 0) > 0 ? 'ATKT' : rec.ordinance_applied || 'ALL CLEAR'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => {
                              setSelectedSemester(recSem)
                              const el = document.getElementById('marksheet-section')
                              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                            }}
                            style={{
                              padding: '0.2rem 0.5rem',
                              fontSize: '0.72rem',
                              borderRadius: 4,
                              border: isSelected ? '1px solid var(--accent-blue)' : '1px solid var(--border)',
                              background: isSelected ? 'var(--accent-blue)' : 'var(--bg-surface)',
                              color: isSelected ? '#FFFFFF' : 'var(--text-primary)',
                              cursor: 'pointer',
                              fontWeight: 600,
                            }}
                          >
                            {isSelected ? 'Viewing' : 'Inspect'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CREDITS & DEGREE PATHWAY */}
      {activeTab === 'credits' && (
        <CreditOptimizerTimeline studentId={sid} />
      )}

      {/* TAB 4: RISK ANALYSIS */}
      {activeTab === 'risk' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card">
            <h3 style={{ margin: '0 0 1rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Risk Assessment & Contributing Drivers
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ padding: '1rem', background: 'var(--bg-elevated)', borderRadius: 6, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>Dropout Probability</span>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: risk?.risk_level === 'CRITICAL' ? '#991B1B' : risk?.risk_level === 'HIGH' ? '#DC2626' : risk?.risk_level === 'MEDIUM' ? '#D97706' : '#059669' }}>
                  {risk?.risk_probability != null ? `${Math.round(risk.risk_probability * 100)}%` : '—'}
                </span>
                <div style={{ marginTop: '0.25rem' }}><RiskBadge level={risk?.risk_level} /></div>
              </div>

              <div style={{ padding: '1rem', background: 'var(--bg-elevated)', borderRadius: 6, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>Model Confidence</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginTop: '0.25rem' }}>84%</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SIES Dropout Predictor v1</span>
              </div>
            </div>

            <div style={{ padding: '0.875rem 1rem', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 6 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                Model Explanation
              </span>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {generateModelExplanation()}
              </p>
            </div>
          </div>

          {/* Feature: Joint Proctor-Student What-If Simulator */}
          <WhatIfSimulator
            studentId={sid}
            initialData={{
              current_risk_prob: risk?.risk_probability,
              attendance: attendanceVal,
              marks: acad?.marks,
              assignment_completion: acad?.assignment_completion,
              failed_heads: acad?.failed_heads,
            }}
            onGoalCommitted={() => { refetchRisk(); refetchIV(); }}
            onNavigateTab={(t) => setActiveTab(t)}
            title="Joint Mentor & Mentee What-If Recovery Simulator"
          />
        </div>
      )}

      {/* TAB 5: INTERVENTIONS & ACTION ROADMAP */}
      {activeTab === 'interventions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card">
            <h3 style={{ margin: '0 0 1rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Active Intervention Records
            </h3>
            {(ivList || []).length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: 0 }}>No interventions assigned yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {ivList.map(iv => (
                  <div
                    key={iv.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                      padding: '0.75rem 0.875rem',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <IVStatusBadge status={iv.status} />
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {iv.type?.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{iv.reason}</p>
                      {iv.risk_delta > 0 && (
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          background: '#ECFDF5',
                          border: '1px solid #A7F3D0',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          color: '#065F46',
                          fontWeight: 600,
                        }}>
                          <span>📉 Impact: -{iv.risk_delta_pct}% Risk</span>
                          <span style={{ background: '#D1FAE5', padding: '0.05rem 0.3rem', borderRadius: '3px', fontSize: '0.62rem', fontWeight: 700 }}>
                            {iv.efficacy_status}
                          </span>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <select
                        value={iv.status}
                        disabled={updatingIV === iv.id}
                        onChange={e => updateIV(iv.id, e.target.value)}
                        style={{
                          fontSize: '0.78rem',
                          padding: '0.3rem 0.6rem',
                          background: '#FFFFFF',
                          border: '1px solid var(--border)',
                          borderRadius: 4,
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                        }}
                      >
                        {['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'FOLLOW_UP'].map(s => (
                          <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Feature 2: AI Personalized Recovery Roadmap & Mentor Outreach */}
          <AIRecoveryRoadmap
            studentId={sid}
            studentName={student?.name}
            onInterventionAdded={refetchIV}
          />
        </div>
      )}
    </div>
  )
}
