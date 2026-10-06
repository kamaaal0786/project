/**
 * AtRiskPage — Professional Academic At-Risk Roster Table
 * Formatted as an institutional data table for academic counseling and intervention tracking.
 */
import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useStudents } from '../../services/hooks'
import { RiskBadge, Spinner, ErrorBanner } from '../../components/ui'
import { Search, Filter, ChevronRight, AlertTriangle, ArrowUpDown } from 'lucide-react'

export default function AtRiskPage() {
  const { data, loading, error } = useStudents()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterLevel, setFilterLevel] = useState('ALL')
  const [sortBy, setSortBy] = useState('probability')

  // Filter students with MEDIUM, HIGH, or CRITICAL risk
  const filteredStudents = useMemo(() => {
    let list = (data || []).filter(s => {
      const lvl = (s.latest_risk_level || '').toUpperCase()
      if (filterLevel === 'ALL') {
        return lvl === 'HIGH' || lvl === 'MEDIUM' || lvl === 'CRITICAL'
      }
      return lvl === filterLevel
    })

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      list = list.filter(s =>
        s.name?.toLowerCase().includes(q) ||
        s.roll_no?.toLowerCase().includes(q) ||
        s.program?.toLowerCase().includes(q)
      )
    }

    list.sort((a, b) => {
      if (sortBy === 'probability') {
        return (b.latest_risk_probability ?? 0) - (a.latest_risk_probability ?? 0)
      }
      if (sortBy === 'gpa') {
        return (a.latest_academic_record?.gpa ?? 10) - (b.latest_academic_record?.gpa ?? 10)
      }
      if (sortBy === 'attendance') {
        return (a.latest_academic_record?.attendance ?? 100) - (b.latest_academic_record?.attendance ?? 100)
      }
      return a.name.localeCompare(b.name)
    })

    return list
  }, [data, filterLevel, searchTerm, sortBy])

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '2.5rem' }}>
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 className="page-title">
            At-Risk Students Roster
          </h1>
          <p className="page-subtitle">
            Students requiring early academic intervention and faculty counseling (Autonomous R19)
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-elevated)', padding: '0.3rem 0.6rem', borderRadius: 4, border: '1px solid var(--border)' }}>
            Showing {filteredStudents.length} Students
          </span>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Control Bar: Search & Filters */}
      <div
        className="card"
        style={{
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 260 }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 360 }}>
            <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="form-input"
              style={{ paddingLeft: '2rem' }}
              placeholder="Filter by student name, roll number, or program…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Filter size={13} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Risk Level:</span>
            <select
              value={filterLevel}
              onChange={e => setFilterLevel(e.target.value)}
              style={{
                fontSize: '0.78rem',
                padding: '0.35rem 0.6rem',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">All At-Risk (Med / High / Crit)</option>
              <option value="CRITICAL">Critical Risk Only</option>
              <option value="HIGH">High Risk Only</option>
              <option value="MEDIUM">Medium Risk Only</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <ArrowUpDown size={13} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sort:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{
                fontSize: '0.78rem',
                padding: '0.35rem 0.6rem',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              <option value="probability">Risk Propensity (High → Low)</option>
              <option value="attendance">Attendance (Low → High)</option>
              <option value="gpa">GPA (Low → High)</option>
              <option value="name">Student Name (A → Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Professional Data Table with Horizontal Scroll */}
      {loading ? (
        <Spinner text="Loading at-risk student records…" />
      ) : filteredStudents.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <p style={{ margin: 0, fontSize: '0.875rem' }}>No at-risk students match the current filter criteria.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
            <table className="data-table" style={{ minWidth: 920 }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>Student</th>
                  <th style={{ minWidth: 110 }}>Roll Number</th>
                  <th style={{ textAlign: 'center', minWidth: 80 }}>Semester</th>
                  <th style={{ textAlign: 'center', minWidth: 70 }}>GPA</th>
                  <th style={{ textAlign: 'center', minWidth: 95 }}>Attendance</th>
                  <th style={{ textAlign: 'center', minWidth: 120 }}>Credits Status</th>
                  <th style={{ textAlign: 'center', minWidth: 100 }}>Risk Level</th>
                  <th style={{ textAlign: 'center', minWidth: 130 }}>Dropout Propensity</th>
                  <th style={{ textAlign: 'right', minWidth: 110, paddingRight: '1.25rem' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map(s => {
                  const acad = s.latest_academic_record || {}
                  const gpaVal = acad.gpa != null ? Number(acad.gpa).toFixed(1) : '—'
                  const attVal = acad.attendance != null ? acad.attendance : 82
                  const prob = s.latest_risk_probability != null ? Math.round(s.latest_risk_probability * 100) : null

                  return (
                    <tr key={s.student_id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.8125rem' }}>
                          {s.name}
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {s.program || 'B.Tech CS'}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                        {s.roll_no}
                      </td>
                      <td style={{ textAlign: 'center', fontSize: '0.8125rem' }}>
                        Sem {s.semester || 5}
                      </td>
                      <td style={{ textAlign: 'center', fontFeatureSettings: 'tnum', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {gpaVal}
                      </td>
                      <td style={{ textAlign: 'center', fontFeatureSettings: 'tnum' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: attVal < 75 ? '#DC2626' : attVal < 80 ? '#D97706' : '#059669',
                        }}>
                          {attVal}%
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontSize: '0.75rem' }}>
                        <span style={{
                          padding: '0.15rem 0.45rem',
                          borderRadius: 4,
                          background: 'var(--bg-elevated)',
                          color: 'var(--text-secondary)',
                          fontSize: '0.72rem',
                          fontWeight: 500,
                        }}>
                          Autonomous R19
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <RiskBadge level={s.latest_risk_level} />
                      </td>
                      <td style={{ textAlign: 'center', fontFeatureSettings: 'tnum' }}>
                        {prob != null ? (
                          <span style={{
                            fontWeight: 700,
                            fontSize: '0.8125rem',
                            color: prob >= 70 ? '#DC2626' : prob >= 40 ? '#D97706' : '#059669',
                          }}>
                            {prob}%
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', paddingRight: '1.25rem' }}>
                        <Link
                          to={`/mentor/students/${s.student_id}`}
                          className="btn btn-secondary"
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.3rem 0.65rem',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          View Profile <ChevronRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
