import React, { useState, useEffect } from 'react'
import api from '../services/api'
import { Target, AlertCircle, CheckCircle, Award, BookOpen, ChevronRight, Stethoscope } from 'lucide-react'

export default function RemedialTargetsCard({ studentId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!studentId) return
    let isMounted = true
    setLoading(true)

    api.get(`/risk/${studentId}/remedial-targets`)
      .then(res => {
        if (isMounted) setData(res.data)
      })
      .catch(err => {
        if (isMounted) setError(err.response?.data?.detail || "Could not load course targets")
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => { isMounted = false }
  }, [studentId])

  if (loading) {
    return (
      <div className="card" style={{ padding: '1.25rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
        Loading SIES GST Remedial & ESE safety thresholds…
      </div>
    )
  }

  if (error || !data || !data.targets || data.targets.length === 0) {
    return null // Graceful omit if no course records
  }

  const { targets, urgent_remedial_count, semester } = data

  return (
    <div className="card" style={{
      padding: '1.5rem',
      borderRadius: '16px',
      background: '#ffffff',
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.04)',
    }}>
      {/* Card Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ padding: '0.4rem', background: '#ecfdf5', borderRadius: '8px', color: '#059669' }}>
            <Target size={18} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              SIES GST Autonomous ESE Passing Head Targets
            </h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Semester {semester} separate passing head calculator: Minimum 24/60 in ESE and 40% overall aggregate.
            </p>
          </div>
        </div>

        {urgent_remedial_count > 0 && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.25rem 0.65rem',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            borderRadius: '999px',
            fontSize: '0.75rem',
            fontWeight: 700,
          }}>
            <AlertCircle size={13} />
            {urgent_remedial_count} Course(s) Need Retest
          </span>
        )}
      </div>

      {/* Course List Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '1rem' }}>
        {targets.map(c => {
          const isCritical = c.urgency === 'CRITICAL'
          const isAttention = c.urgency === 'ATTENTION'

          return (
            <div
              key={c.course_code}
              style={{
                borderRadius: '12px',
                border: `1px solid ${isCritical ? '#fecaca' : (isAttention ? '#fde68a' : '#e2e8f0')}`,
                background: isCritical ? '#fffafb' : (isAttention ? '#fffdfa' : '#fafafa'),
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.75rem',
              }}
            >
              <div>
                {/* Course Title & Code */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                      {c.course_code}
                    </span>
                    <h4 style={{ margin: '0.1rem 0 0', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {c.course_name}
                    </h4>
                  </div>
                  {isCritical ? (
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.5rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px' }}>
                      MSE Retest Urgency
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '0.15rem 0.5rem', background: '#f1f5f9', color: '#475569', borderRadius: '6px' }}>
                      {c.credits} Credits
                    </span>
                  )}
                </div>

                {/* Score Breakdown Pills */}
                <div style={{ display: 'flex', gap: '0.4rem', margin: '0.6rem 0', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', background: '#f1f5f9', borderRadius: '6px', color: '#334155' }}>
                    ISE: <strong>{c.ise_marks}/20</strong>
                  </div>
                  <div style={{
                    fontSize: '0.72rem',
                    padding: '0.2rem 0.5rem',
                    background: c.mse_marks < 8 ? '#fee2e2' : '#f1f5f9',
                    color: c.mse_marks < 8 ? '#b91c1c' : '#334155',
                    fontWeight: c.mse_marks < 8 ? 700 : 500,
                    borderRadius: '6px'
                  }}>
                    MSE: <strong>{c.mse_marks}/20</strong>
                  </div>
                  <div style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', background: '#e0f2fe', borderRadius: '6px', color: '#0369a1' }}>
                    Internal: <strong>{c.internal_total}/40</strong>
                  </div>
                </div>

                {/* Prescription Callout */}
                <div style={{
                  padding: '0.5rem 0.65rem',
                  background: isCritical ? '#fef2f2' : '#ffffff',
                  borderRadius: '8px',
                  border: `1px solid ${isCritical ? '#fecaca' : '#e2e8f0'}`,
                  fontSize: '0.78rem',
                  color: isCritical ? '#991b1b' : '#334155',
                  lineHeight: 1.35,
                }}>
                  {c.recommendation}
                </div>
              </div>

              {/* Bottom Target Strip */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '0.5rem',
                borderTop: '1px solid #e2e8f0',
                fontSize: '0.78rem',
              }}>
                <div>
                  <span style={{ color: '#64748b' }}>Target ESE: </span>
                  <span style={{ fontWeight: 800, color: c.min_ese_needed > 24 ? '#d97706' : '#059669', fontSize: '0.9rem' }}>
                    {c.min_ese_needed}/60
                  </span>
                </div>

                {c.o5042_grace_eligible && (
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: '#7c3aed',
                    background: '#f5f3ff',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    border: '1px solid #ddd6fe',
                  }}>
                    O.5042 Buffer (2M)
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
