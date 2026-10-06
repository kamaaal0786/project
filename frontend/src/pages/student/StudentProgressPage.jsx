/**
 * StudentProgressPage — week-by-week academic trend, multi-semester progression,
 * and historical gradebook audit tracker for the logged-in student.
 */
import { useState } from 'react'
import authService from '../../services/auth'
import { useFetch } from '../../services/hooks'
import { Spinner, ErrorBanner, ProgressBar } from '../../components/ui'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ReferenceLine, ResponsiveContainer
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, BookOpen, History, Award } from 'lucide-react'

export default function StudentProgressPage() {
  const user = authService.getUser()
  const sid = user?.student_id

  const { data: history, loading: hLoad, error: hErr } = useFetch(sid ? `/risk/${sid}/history` : null)
  const { data: student, loading: aLoad, error: aErr } = useFetch(sid ? `/students/${sid}` : null)
  const [selectedSemester, setSelectedSemester] = useState(null)

  const riskData = (history || []).map((h, i) => ({
    week: `W${h.week || i + 1}`,
    risk: Math.round(h.risk_probability * 100),
    level: h.risk_level,
  }))

  // Multi-semester course results & academic progression
  const allCourses = student?.course_results || []
  const availableSemesters = Array.from(new Set(allCourses.map(c => c.semester))).sort((a, b) => a - b)
  const curSem = student?.semester || (availableSemesters.length ? availableSemesters[availableSemesters.length - 1] : 1)
  const effectiveSem = selectedSemester || curSem
  const filteredCourses = allCourses.filter(c => c.semester === effectiveSem)
  const acadRecords = student?.academic_records || []
  const semAcad = acadRecords.find(r => 
    Number(r.semester) === Number(effectiveSem) || 
    r.term === `Semester ${effectiveSem}` || 
    r.term === `SEM${effectiveSem}` || 
    r.raw_term === `SEM${effectiveSem}` ||
    r.term?.endsWith(` ${effectiveSem}`) ||
    r.term?.endsWith(`S${effectiveSem}`) || 
    r.term?.endsWith(`SEM${effectiveSem}`)
  ) || acadRecords.find(r => {
    const m = (r.raw_term || r.term || '').match(/(?:sem|s|semester)\s*0?(\d+)/i) || (r.raw_term || r.term || '').match(/(\d)$/)
    return m && parseInt(m[1], 10) === Number(effectiveSem)
  }) || acadRecords[Number(effectiveSem) - 1] || student?.latest_academic_record

  // Trend direction
  const trend = riskData.length >= 2
    ? riskData[riskData.length - 1].risk - riskData[riskData.length - 2].risk
    : 0

  const TrendIcon = trend > 2 ? TrendingUp : trend < -2 ? TrendingDown : Minus
  const trendColor = trend > 2 ? '#f43f5e' : trend < -2 ? '#10b981' : '#6b7280'

  if (hLoad || aLoad) return <Spinner text="Loading progress & academic records…" />

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '2.5rem' }}>
      <div className="page-header">
        <h1 className="page-title">Progress & Academic History</h1>
        <p className="page-subtitle">Track your weekly risk evolution, historical semester progression, and subject-wise gradebooks</p>
      </div>

      {(hErr || aErr) && <ErrorBanner message={hErr || aErr} />}

      {/* Top KPI Trend Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="kpi-card">
          <span className="kpi-label">Current Risk</span>
          <span className="kpi-value" style={{ color: '#3b82f6' }}>{riskData.length > 0 ? `${riskData[riskData.length - 1]?.risk}%` : '—'}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Risk Trend</span>
          <span className="kpi-value" style={{ color: trendColor, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <TrendIcon size={20} /> {Math.abs(trend)}%
          </span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Current Semester</span>
          <span className="kpi-value">Sem {curSem}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Semesters Completed</span>
          <span className="kpi-value">{acadRecords.length}</span>
        </div>
      </div>

      {/* Risk Trend Chart */}
      {riskData.length >= 2 ? (
        <div className="card" style={{ marginBottom: '1.75rem' }}>
          <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Weekly Dropout Risk Evolution Over Time
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={riskData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} unit="%" />
              <Tooltip
                formatter={v => [`${v}%`, 'Risk']}
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
              />
              <ReferenceLine y={70} stroke="#f43f5e" strokeDasharray="4 4" label={{ value: 'HIGH threshold', position: 'right', fill: '#f43f5e', fontSize: 10 }} />
              <ReferenceLine y={40} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'MEDIUM threshold', position: 'right', fill: '#f59e0b', fontSize: 10 }} />
              <Line type="monotone" dataKey="risk" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 5, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 7 }} name="Risk %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      {/* Multi-Semester Historical Progression Table */}
      {acadRecords.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '1.75rem' }}>
          <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <History size={16} color="var(--accent-blue)" />
            <div>
              <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Multi-Semester Progression & Audit Trail
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Your complete term-by-term academic progression history
              </span>
            </div>
          </div>
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Academic Term</th>
                  <th style={{ textAlign: 'center' }}>SGPA</th>
                  <th style={{ textAlign: 'center' }}>Total Marks %</th>
                  <th style={{ textAlign: 'center' }}>Attendance (O.6086)</th>
                  <th style={{ textAlign: 'center' }}>Failed Heads</th>
                  <th style={{ textAlign: 'center' }}>Backlog Credits</th>
                  <th style={{ textAlign: 'center' }}>Ordinance / Status</th>
                  <th style={{ textAlign: 'center' }}>Inspect</th>
                </tr>
              </thead>
              <tbody>
                {acadRecords.map((rec, idx) => {
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
                            const el = document.getElementById('gradebook-section')
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
      )}

      {/* Selected Semester Subject Gradebook */}
      <div id="gradebook-section" className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', background: 'var(--bg-elevated)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BookOpen size={16} color="var(--accent-blue)" />
            <div>
              <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Semester {effectiveSem} Gradebook & Marksheet
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Autonomous 100 Marks Pattern (ISE 20 + MSE 20 + ESE 60 + Labs)
              </span>
            </div>
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

        {/* Selected Term Summary Ribbon */}
        {semAcad && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', padding: '0.75rem 1.25rem', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
            <div>
              <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>SGPA</span>
              <span style={{ display: 'block', fontSize: '1.05rem', fontWeight: 700, color: '#1D4ED8' }}>{semAcad.gpa != null ? Number(semAcad.gpa).toFixed(1) : '—'} / 10</span>
            </div>
            <div>
              <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Total Marks %</span>
              <span style={{ display: 'block', fontSize: '1.05rem', fontWeight: 700, color: '#059669' }}>{semAcad.marks != null ? `${semAcad.marks}%` : '—'}</span>
            </div>
            <div>
              <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Attendance</span>
              <span style={{ display: 'block', fontSize: '1.05rem', fontWeight: 700, color: (semAcad.attendance || 80) < 75 ? '#DC2626' : '#059669' }}>{semAcad.attendance != null ? `${semAcad.attendance}%` : '—'}</span>
            </div>
            <div>
              <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Failed Heads</span>
              <span style={{ display: 'block', fontSize: '1.05rem', fontWeight: 700, color: (semAcad.failed_heads || 0) > 0 ? '#DC2626' : '#059669' }}>{semAcad.failed_heads || 0}</span>
            </div>
          </div>
        )}

        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table className="data-table" style={{ minWidth: 880 }}>
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
    </div>
  )
}
