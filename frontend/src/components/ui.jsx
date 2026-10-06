/**
 * Institutional UI Components for AcademiQ ERP
 * Clean, restrained, high-contrast, production-grade academic styling.
 */
import React from 'react'

const RISK_STYLES = {
  LOW: {
    bg: '#ECFDF5',
    border: '#A7F3D0',
    color: '#059669',
    dot: '#10B981',
    label: 'Low Risk',
  },
  MEDIUM: {
    bg: '#FFFBEB',
    border: '#FDE68A',
    color: '#B45309',
    dot: '#F59E0B',
    label: 'Medium Risk',
  },
  HIGH: {
    bg: '#FEF2F2',
    border: '#FECACA',
    color: '#DC2626',
    dot: '#EF4444',
    label: 'High Risk',
  },
  CRITICAL: {
    bg: '#FEE2E2',
    border: '#FCA5A5',
    color: '#991B1B',
    dot: '#B91C1C',
    label: 'Critical Risk',
  },
}

/** Reusable restrained risk badge chip. */
export function RiskBadge({ level }) {
  if (!level) return <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
  const key = String(level).toUpperCase()
  const s = RISK_STYLES[key] || {
    bg: '#F1F5F9',
    border: '#CBD5E1',
    color: '#475569',
    dot: '#94A3B8',
    label: level,
  }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.35rem',
      padding: '0.2rem 0.55rem',
      borderRadius: '999px',
      background: s.bg,
      border: `1px solid ${s.border}`,
      color: s.color,
      fontWeight: 600,
      fontSize: '0.72rem',
      letterSpacing: '0.02em',
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        backgroundColor: s.dot,
        display: 'inline-block',
      }} />
      {key}
    </span>
  )
}

/** Loading spinner */
export function Spinner({ text = 'Loading…' }) {
  return (
    <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
      <div style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        margin: '0 auto 0.75rem',
        border: '2.5px solid var(--border)',
        borderTopColor: 'var(--accent-blue)',
        animation: 'spin 0.8s linear infinite',
      }} />
      <p style={{ margin: 0, fontSize: '0.8125rem' }}>{text}</p>
    </div>
  )
}

/** Error banner */
export function ErrorBanner({ message }) {
  return (
    <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
      <span style={{ fontWeight: 700 }}>Notice:</span> {message}
    </div>
  )
}

/** Progress bar without flashy gradients */
export function ProgressBar({ value, max = 100, color = 'var(--accent-blue)', label }) {
  const pct = Math.max(0, Math.min((value / max) * 100, 100))
  return (
    <div style={{ width: '100%' }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.75rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{Math.round(pct)}%</span>
        </div>
      )}
      <div style={{
        height: 7,
        borderRadius: 4,
        background: '#E2E8F0',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          borderRadius: 4,
          backgroundColor: color,
          transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  )
}

/** Official Regulation / Progression Badge */
const PROG_STYLES = {
  CLEAR: { bg: '#ECFDF5', border: '#A7F3D0', color: '#059669', label: 'CLEAR' },
  CONDONATION_REQUIRED: { bg: '#FFFBEB', border: '#FDE68A', color: '#B45309', label: 'CONDONATION REQUIRED' },
  ACADEMIC_RISK: { bg: '#FFFBEB', border: '#FDE68A', color: '#B45309', label: 'ACADEMIC RISK' },
  HIGH_RISK: { bg: '#FEF2F2', border: '#FECACA', color: '#DC2626', label: 'HIGH RISK' },
  CRITICAL_RISK: { bg: '#FEE2E2', border: '#FCA5A5', color: '#991B1B', label: 'CRITICAL RISK' },
  PROGRESSION_BLOCKED: { bg: '#FEF2F2', border: '#FECACA', color: '#DC2626', label: 'PROGRESSION BLOCKED' },
  ATTENDANCE_BLOCKED: { bg: '#FEF2F2', border: '#FECACA', color: '#DC2626', label: 'ATTENDANCE BLOCKED' },
  DEBARRED: { bg: '#FEF2F2', border: '#FECACA', color: '#DC2626', label: 'DEBARRED (ESE)' },
  REGULATION_UNRESOLVED: { bg: '#F1F5F9', border: '#CBD5E1', color: '#475569', label: 'UNRESOLVED' },
}

export function ProgressionBadge({ status }) {
  if (!status) return null
  const s = PROG_STYLES[status] || {
    bg: '#F1F5F9',
    border: '#CBD5E1',
    color: '#475569',
    label: status.replace(/_/g, ' '),
  }
  return (
    <span style={{
      backgroundColor: s.bg,
      border: `1px solid ${s.border}`,
      color: s.color,
      padding: '0.2rem 0.55rem',
      borderRadius: '4px',
      fontSize: '0.72rem',
      fontWeight: 600,
      letterSpacing: '0.02em',
      whiteSpace: 'nowrap',
    }}>
      {s.label || status.replace(/_/g, ' ')}
    </span>
  )
}

/** Intervention status badge */
const IV_STYLES = {
  PENDING: { bg: '#FFFBEB', border: '#FDE68A', color: '#B45309' },
  ASSIGNED: { bg: '#EFF6FF', border: '#BFDBFE', color: '#1D4ED8' },
  IN_PROGRESS: { bg: '#F5F3FF', border: '#DDD6FE', color: '#6D28D9' },
  COMPLETED: { bg: '#ECFDF5', border: '#A7F3D0', color: '#059669' },
  FOLLOW_UP: { bg: '#F0FDFA', border: '#99F6E4', color: '#0F766E' },
}

export function IVStatusBadge({ status }) {
  const s = IV_STYLES[status] || { bg: '#F1F5F9', border: '#CBD5E1', color: '#475569' }
  return (
    <span style={{
      padding: '0.15rem 0.5rem',
      borderRadius: '999px',
      background: s.bg,
      border: `1px solid ${s.border}`,
      color: s.color,
      fontWeight: 600,
      fontSize: '0.6875rem',
      whiteSpace: 'nowrap',
      letterSpacing: '0.02em',
    }}>
      {(status || '').replace(/_/g, ' ')}
    </span>
  )
}

/** Professional metric tile */
export function MetricTile({ label, value, subtext, color }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      padding: '0.75rem 0.875rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.2rem',
      minWidth: 0,
      overflow: 'hidden',
    }}>
      <span style={{
        fontSize: '0.6875rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--text-muted)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {label}
      </span>
      <div style={{
        fontSize: '1.25rem',
        fontWeight: 700,
        color: color || 'var(--text-primary)',
        lineHeight: 1.2,
        fontFeatureSettings: 'tnum',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {value}
      </div>
      {subtext && (
        <span style={{
          fontSize: '0.6875rem',
          color: 'var(--text-muted)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {subtext}
        </span>
      )}
    </div>
  )
}
