/**
 * StudentAcademicPage — Faculty/Admin: manually edit a student's academic record.
 * Includes all SIES GST fields: attendance, marks, GPA, ISE/MSE/ESE, failed heads, credits, backlogs.
 * PATCH /api/students/{id}/academic  ->  runs regulation engine + ML inference
 */
import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useStudent, useCredits } from '../../services/hooks'
import { Spinner, ErrorBanner, ProgressionBadge } from '../../components/ui'
import api from '../../services/api'
import { ArrowLeft, Save, RefreshCw, CheckCircle } from 'lucide-react'

const RISK_COLOR = { HIGH: '#f43f5e', MEDIUM: '#f59e0b', LOW: '#10b981', CRITICAL: '#991b1b' }

const SECTION = ({ title, children }) => (
  <div className="card" style={{ marginBottom: '1.25rem' }}>
    <p style={{ margin: '0 0 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {title}
    </p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
      {children}
    </div>
  </div>
)

const Field = ({ label, field, form, setForm, min = 0, max = 100, step = 0.1, optional = false }) => (
  <div>
    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>
      {label} {optional && <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>(optional)</span>}
    </label>
    <input
      type="number"
      min={min} max={max} step={step}
      value={form[field] ?? ''}
      onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
      style={{
        width: '100%', padding: '0.6rem 0.75rem', boxSizing: 'border-box',
        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
        borderRadius: '0.5rem', color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 600,
      }}
    />
  </div>
)

export default function StudentAcademicPage() {
  const { id } = useParams()
  const { data: student, loading: sLoad } = useStudent(Number(id))

  const curYear = new Date().getFullYear()
  const sem = new Date().getMonth() < 6 ? 1 : 2

  const [form, setForm] = useState({
    term: `${curYear}-SEM${sem}`,
    attendance: 75, marks: 60, gpa: 6.0,
    assignment_completion: 70, failed_subjects: 0,
    ise_marks: '', mse_marks: '', ese_marks: '',
    tw_marks: '', pr_or_marks: '',
    failed_heads: 0, ese_failed_heads: 0, backlog_credits: 0,
    previous_backlogs: 0, previous_failed_heads: 0,
    earned_credits: 20, expected_credits: 24, required_credits: 24,
  })

  const { data: credits } = useCredits(Number(id))

  // Load existing data if available
  useEffect(() => {
    if (student) {
      const acad = student.latest_academic_record
      const studentSem = student.semester || 1
      
      if (acad) {
        setForm(f => ({
          ...f,
          term: acad.term && !acad.term.includes('S08') ? acad.term : `SEM${studentSem}`,
          attendance: acad.attendance ?? f.attendance,
          marks: acad.marks ?? f.marks,
          gpa: acad.gpa ?? f.gpa,
          assignment_completion: acad.assignment_completion ?? f.assignment_completion,
          failed_subjects: acad.failed_subjects ?? f.failed_subjects,
          ise_marks: acad.ise_marks != null ? Math.min(20, Number(acad.ise_marks)) : '',
          mse_marks: acad.mse_marks != null ? Math.min(20, Number(acad.mse_marks)) : '',
          ese_marks: acad.ese_marks != null ? Math.min(60, Number(acad.ese_marks)) : '',
          tw_marks: acad.tw_marks != null ? Math.min(25, Number(acad.tw_marks)) : '',
          pr_or_marks: acad.pr_or_marks != null ? Math.min(25, Number(acad.pr_or_marks)) : '',
          failed_heads: acad.failed_heads ?? 0,
          ese_failed_heads: acad.ese_failed_heads ?? 0,
          backlog_credits: acad.backlog_credits ?? 0,
          previous_backlogs: acad.previous_backlogs ?? 0,
          previous_failed_heads: acad.previous_failed_heads ?? 0,
          earned_credits: credits?.earned_credits ?? f.earned_credits,
          expected_credits: credits?.expected_credits ?? f.expected_credits,
          required_credits: credits?.required_credits ?? f.required_credits,
        }))
      }
    }
  }, [student, credits])

  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)
  const [err, setErr] = useState(null)

  const toNum = v => v === '' || v === null || v === undefined ? null : Number(v)

  const save = async (e) => {
    e.preventDefault()
    setSaving(true); setErr(null); setResult(null)
    try {
      const payload = {
        term: form.term,
        attendance:            Number(form.attendance),
        marks:                 Number(form.marks),
        gpa:                   Number(form.gpa),
        assignment_completion: Number(form.assignment_completion),
        failed_subjects:       Number(form.failed_subjects),
        earned_credits:        Number(form.earned_credits),
        expected_credits:      Number(form.expected_credits),
        required_credits:      Number(form.required_credits),
        // SIES GST
        ise_marks:             toNum(form.ise_marks),
        mse_marks:             toNum(form.mse_marks),
        ese_marks:             toNum(form.ese_marks),
        tw_marks:              toNum(form.tw_marks),
        pr_or_marks:           toNum(form.pr_or_marks),
        failed_heads:          Number(form.failed_heads) || 0,
        ese_failed_heads:      Number(form.ese_failed_heads) || 0,
        backlog_credits:       Number(form.backlog_credits) || 0,
        previous_backlogs:     Number(form.previous_backlogs) || 0,
        previous_failed_heads: Number(form.previous_failed_heads) || 0,
      }
      const res = await api.patch(`/students/${id}/academic`, payload)
      setResult(res.data)
    } catch (e) {
      setErr(e.response?.data?.detail || e.message)
    } finally {
      setSaving(false)
    }
  }

  if (sLoad) return <Spinner />

  return (
    <div className="animate-fade-in">
      <Link
        to={`/students/${id}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', color: 'var(--text-muted)', fontSize: '0.875rem', textDecoration: 'none', marginBottom: '1.25rem' }}
      >
        <ArrowLeft size={14} /> Back to {student?.name}
      </Link>

      <div className="page-header">
        <h1 className="page-title">Update Academic Record</h1>
        <p className="page-subtitle">
          {student?.name} · {student?.roll_no} · {student?.program} · Sem {student?.semester}
        </p>
      </div>

      {err && <ErrorBanner message={err} />}

      {/* Result card after save */}
      {result && (() => {
        const rc = RISK_COLOR[result.risk_level] || '#6b7280'
        return (
          <div className="card" style={{ marginBottom: '1.5rem', borderLeft: `4px solid ${rc}`, background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <CheckCircle size={20} color="#10b981" />
              <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>
                Record saved — AI inference complete
              </p>
            </div>
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ML Risk Level</span>
                <p style={{ margin: '0.25rem 0 0', fontWeight: 800, fontSize: '1.25rem', color: rc }}>{result.risk_level}</p>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Risk Probability</span>
                <p style={{ margin: '0.25rem 0 0', fontWeight: 800, fontSize: '1.25rem', color: rc }}>
                  {Math.round(result.risk_probability * 100)}%
                </p>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Credit Status</span>
                <p style={{ margin: '0.25rem 0 0', fontWeight: 700, fontSize: '1rem', color: 'var(--text-secondary)' }}>{result.credit_status}</p>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Academic Status</span>
                <div style={{ marginTop: '0.25rem' }}>
                  <ProgressionBadge status={result.academic_status || 'CLEAR'} />
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Interventions Triggered</span>
                <p style={{ margin: '0.25rem 0 0', fontWeight: 700, fontSize: '1rem', color: '#8b5cf6' }}>
                  {result.interventions_triggered}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                ✅ Academic record saved & SIES GST Autonomous Risk Engine re-evaluated.
              </p>
              <Link
                to={`/students/${id}`}
                className="btn btn-primary"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', textDecoration: 'none' }}
              >
                View Updated Student Dossier →
              </Link>
            </div>
          </div>
        )
      })()}

      <form onSubmit={save}>
        {/* Term */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>
            Term / Semester Identifier
          </label>
          <input
            value={form.term}
            onChange={e => setForm(f => ({ ...f, term: e.target.value }))}
            placeholder="e.g. 2024-SEM1"
            style={{
              width: '100%', maxWidth: 300, padding: '0.6rem 0.75rem', boxSizing: 'border-box',
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: '0.5rem', color: 'var(--text-primary)', fontSize: '0.875rem',
            }}
          />
        </div>

        {/* Section A: Attendance & Overall */}
        <SECTION title="A. Attendance & Overall Performance">
          <Field label="Attendance (%)" field="attendance" form={form} setForm={setForm} min={0} max={100} step={0.1} />
          <Field label="Overall Marks (%)" field="marks" form={form} setForm={setForm} min={0} max={100} step={0.1} />
          <Field label="GPA (0–10)" field="gpa" form={form} setForm={setForm} min={0} max={10} step={0.01} />
          <Field label="Assignment Completion (%)" field="assignment_completion" form={form} setForm={setForm} min={0} max={100} step={1} />
          <Field label="Failed Subjects" field="failed_subjects" form={form} setForm={setForm} min={0} max={20} step={1} />
        </SECTION>

        {/* Section B: SIES GST Mark Breakdown */}
        <SECTION title="B. SIES GST Mark Breakdown (ISE 20 / MSE 20 / ESE 60 / TW 25 / PR 25)">
          <Field label="ISE Marks (out of 20)" field="ise_marks" form={form} setForm={setForm} min={0} max={20} step={0.5} optional />
          <Field label="MSE Marks (out of 20)" field="mse_marks" form={form} setForm={setForm} min={0} max={20} step={0.5} optional />
          <Field label="ESE Marks (out of 60)" field="ese_marks" form={form} setForm={setForm} min={0} max={60} step={0.5} optional />
          <Field label="Term Work (TW out of 25)" field="tw_marks" form={form} setForm={setForm} min={0} max={25} step={0.5} optional />
          <Field label="Practical / Oral (PR/OR out of 25)" field="pr_or_marks" form={form} setForm={setForm} min={0} max={25} step={0.5} optional />
        </SECTION>

        {/* Section C: Backlogs & Failed Heads */}
        <SECTION title="C. Backlogs & Failed Heads (ATKT / Progression Eligibility)">
          <Field label="Failed Heads (current sem)" field="failed_heads" form={form} setForm={setForm} min={0} max={20} step={1} />
          <Field label="ESE Failed Heads" field="ese_failed_heads" form={form} setForm={setForm} min={0} max={20} step={1} />
          <Field label="Backlog Credits" field="backlog_credits" form={form} setForm={setForm} min={0} max={100} step={1} />
          <Field label="Previous Year Backlogs" field="previous_backlogs" form={form} setForm={setForm} min={0} max={20} step={1} />
          <Field label="Previous Year Failed Heads" field="previous_failed_heads" form={form} setForm={setForm} min={0} max={20} step={1} />
        </SECTION>

        {/* Section D: Credits */}
        <SECTION title="D. Credits">
          <Field label="Earned Credits" field="earned_credits" form={form} setForm={setForm} min={0} max={200} step={1} />
          <Field label="Expected Credits (this sem)" field="expected_credits" form={form} setForm={setForm} min={0} max={200} step={1} />
          <Field label="Required Credits (total)" field="required_credits" form={form} setForm={setForm} min={0} max={300} step={1} />
        </SECTION>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ justifyContent: 'center', minWidth: 200 }}>
            {saving
              ? <><RefreshCw size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Saving & Running Inference…</>
              : <><Save size={14} /> Save & Run Inference</>
            }
          </button>
          <Link
            to={`/students/${id}`}
            className="btn"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
