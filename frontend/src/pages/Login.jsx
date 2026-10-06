/**
 * Login Page — Institutional Academic Portal Authentication
 * Production-grade university ERP login with institutional branding and quick demo role selection.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import authService from '../services/auth'
import { Mail, Lock, ArrowRight, Loader, School, ShieldCheck } from 'lucide-react'

const ROLE_REDIRECT = {
  admin:   '/admin',
  faculty: '/faculty',
  mentor:  '/mentor',
  student: '/student',
}

const DEMO_ACCOUNTS = [
  { role: 'admin',   email: 'admin@college.edu',   label: 'Administrator' },
  { role: 'mentor',  email: 'mentor1@college.edu',  label: 'Faculty Mentor' },
  { role: 'faculty', email: 'faculty1@college.edu', label: 'Course Faculty' },
  { role: 'student', email: 'student001@college.edu', label: 'Student' },
]

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = await authService.login(email, password)
      const redirect = ROLE_REDIRECT[data.role] || '/student'
      navigate(redirect, { replace: true })
    } catch (err) {
      const msg = err.response?.data?.detail || 'Authentication failed. Please verify your institutional email and password.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  function fillDemo(demoEmail) {
    setEmail(demoEmail)
    setPassword('Demo@1234')
  }

  return (
    <div className="login-bg">
      <div className="login-card animate-fade-in">
        {/* Institutional Branding Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: 44,
            height: 44,
            margin: '0 auto 0.75rem',
            background: '#1D4ED8',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
          }}>
            <School size={22} color="#FFFFFF" />
          </div>
          <h1 style={{
            margin: '0 0 0.2rem',
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.01em',
          }}>
            AcademiQ ERP Portal
          </h1>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            SIES Graduate School of Technology · Autonomous R19
          </p>
        </div>

        {/* Authentication Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="email">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Mail size={12} /> Institutional Email
              </span>
            </label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="e.g. mentor1@college.edu"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Lock size={12} /> Password
              </span>
            </label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="••••••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '0.55rem', marginTop: '0.25rem', fontSize: '0.875rem' }}
          >
            {loading ? (
              <>
                <Loader size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Authenticating…
              </>
            ) : (
              <>
                Sign In to Academic Portal <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Credentials */}
        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Quick Demo Selection:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.375rem' }}>
            {DEMO_ACCOUNTS.map(acc => (
              <button
                key={acc.role}
                type="button"
                onClick={() => fillDemo(acc.email)}
                style={{
                  padding: '0.35rem 0.5rem',
                  fontSize: '0.72rem',
                  fontWeight: 500,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <ShieldCheck size={11} color="var(--accent-blue)" />
                {acc.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
