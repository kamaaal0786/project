/**
 * FacultyStudentsPage — Institutional Course Enrollment Roster
 * Clean data table for faculty members to monitor academic performance and risks.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStudents } from '../../services/hooks'
import { RiskBadge, Spinner, ErrorBanner } from '../../components/ui'
import { Search, ChevronRight, GraduationCap } from 'lucide-react'

export default function FacultyStudentsPage() {
  const { data, loading, error } = useStudents()
  const [q, setQ] = useState('')

  const students = (data || []).filter(s =>
    s.name?.toLowerCase().includes(q.toLowerCase()) ||
    s.roll_no?.toLowerCase().includes(q.toLowerCase()) ||
    s.program?.toLowerCase().includes(q.toLowerCase())
  )

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '2.5rem' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 className="page-title">Enrolled Students Roster</h1>
          <p className="page-subtitle">Students registered across your assigned courses and departments</p>
        </div>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-elevated)', padding: '0.3rem 0.6rem', borderRadius: 4, border: '1px solid var(--border)' }}>
          Total Enrolled: {students.length}
        </span>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: '1rem' }}>
        <div style={{ position: 'relative', maxWidth: 380 }}>
          <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="form-input"
            style={{ paddingLeft: '2rem' }}
            placeholder="Search by student name or roll number…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <Spinner text="Loading enrolled student roster…" />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
            <table className="data-table" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>Student</th>
                  <th style={{ minWidth: 110 }}>Roll Number</th>
                  <th style={{ minWidth: 160 }}>Branch & Program</th>
                  <th style={{ textAlign: 'center', minWidth: 80 }}>Semester</th>
                  <th style={{ textAlign: 'center', minWidth: 110 }}>Academic Risk Status</th>
                  <th style={{ textAlign: 'right', minWidth: 110, paddingRight: '1.25rem' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                      No enrolled students match your search criteria.
                    </td>
                  </tr>
                ) : (
                  students.map(s => (
                    <tr key={s.student_id}>
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>
                          {s.name}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {s.email}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                        {s.roll_no}
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {s.program || 'B.Tech CS'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        Sem {s.semester}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <RiskBadge level={s.latest_risk_level} />
                      </td>
                      <td style={{ textAlign: 'right', paddingRight: '1.25rem' }}>
                        <Link
                          to={`/students/${s.student_id}`}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem', textDecoration: 'none', display: 'inline-flex', whiteSpace: 'nowrap' }}
                        >
                          View Profile <ChevronRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
