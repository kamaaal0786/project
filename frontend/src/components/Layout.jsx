/**
 * Institutional Layout Shell for AcademiQ ERP
 * Clean, restrained, role-aware navigation adhering to real university ERP design.
 */
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import authService from '../services/auth'
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, Upload,
  UserCheck, AlertTriangle, ClipboardList, TrendingUp,
  CreditCard, CheckSquare, BarChart2, LogOut, Shield, School
} from 'lucide-react'

const NAV_CONFIG = {
  admin: {
    label: 'Academic Administration',
    roleTag: 'Administrator',
    items: [
      { to: '/admin',          icon: LayoutDashboard, label: 'Overview Dashboard' },
      { to: '/users',          icon: Users,           label: 'User Directory' },
      { to: '/admin/students', icon: GraduationCap,   label: 'All Students' },
      { to: '/assignments',    icon: UserCheck,       label: 'Faculty Allocation' },
      { to: '/courses',        icon: BookOpen,        label: 'Curriculum & Courses' },
      { to: '/uploads',        icon: Upload,          label: 'Data Upload Center' },
    ],
  },
  faculty: {
    label: 'Faculty Academic Desk',
    roleTag: 'Faculty Member',
    items: [
      { to: '/faculty',       icon: LayoutDashboard, label: 'Course Dashboard' },
      { to: '/students',      icon: GraduationCap,   label: 'My Enrolled Students' },
      { to: '/interventions', icon: ClipboardList,   label: 'Action Plans' },
      { to: '/uploads',       icon: Upload,          label: 'Upload Marks & Attendance' },
    ],
  },
  mentor: {
    label: 'Mentorship & Advisory',
    roleTag: 'Faculty Mentor',
    items: [
      { to: '/mentor',               icon: LayoutDashboard, label: 'Mentor Dashboard' },
      { to: '/at-risk',              icon: AlertTriangle,   label: 'At-Risk Students' },
      { to: '/students',             icon: GraduationCap,   label: 'All Mentored Students' },
      { to: '/mentor/interventions', icon: ClipboardList,   label: 'Intervention Plans' },
    ],
  },
  student: {
    label: 'Student Academic Portal',
    roleTag: 'Student',
    items: [
      { to: '/student',          icon: LayoutDashboard, label: 'Academic Dashboard' },
      { to: '/student/risk',     icon: TrendingUp,      label: 'Performance Analysis' },
      { to: '/student/credits',  icon: CreditCard,      label: 'Credit Audit & Pathway' },
      { to: '/student/actions',  icon: CheckSquare,     label: 'Academic Recovery Plan' },
      { to: '/student/progress', icon: BarChart2,       label: 'Term Progression' },
    ],
  },
}

export default function Layout() {
  const navigate = useNavigate()
  const user = authService.getUser()
  const role = user?.role || 'student'
  const config = NAV_CONFIG[role] || NAV_CONFIG.student

  function handleLogout() {
    authService.logout()
    navigate('/login')
  }

  return (
    <div className="app-layout">
      {/* ── Left Sidebar (White institutional ERP) ──────────────────── */}
      <aside className="sidebar">
        {/* Brand Header */}
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              background: '#1D4ED8',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <School size={18} color="#FFFFFF" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                AcademiQ ERP
              </p>
              <p style={{ margin: 0, fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                SIES GST Academic Suite
              </p>
            </div>
          </div>
        </div>

        {/* User Card */}
        <div style={{ padding: '0.75rem 0.875rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '0.5rem 0.65rem',
          }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: '#1D4ED8',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 700,
              flexShrink: 0,
            }}>
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <p style={{
                margin: 0,
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {user?.name || 'User'}
              </p>
              <p style={{
                margin: 0,
                fontSize: '0.6875rem',
                color: 'var(--text-muted)',
                textTransform: 'capitalize',
              }}>
                {config.roleTag}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <div style={{ flex: 1, padding: '0.5rem 0' }}>
          <p className="sidebar-section-label">{config.label}</p>
          {config.items.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={['/admin', '/faculty', '/mentor', '/student'].includes(to)}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <Icon size={15} style={{ flexShrink: 0, opacity: 0.85 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {label}
              </span>
            </NavLink>
          ))}
        </div>

        {/* Bottom Sign Out */}
        <div style={{ borderTop: '1px solid var(--border)', padding: '0.625rem 0.875rem' }}>
          <button
            className="nav-item btn-danger"
            style={{
              width: '100%',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: '0.5rem',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.8125rem',
              padding: '0.45rem 0.65rem',
            }}
            onClick={handleLogout}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#DC2626'
              e.currentTarget.style.background = '#FEF2F2'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--text-muted)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── Main Area ──────────────────────────────────────────────── */}
      <div className="main-area">
        {/* Minimal Institutional Topbar */}
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              AI-Based Credit & Dropout Evaluation System
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>|</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              SIES Graduate School of Technology (Autonomous R19)
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 600,
              padding: '0.2rem 0.5rem',
              borderRadius: 4,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
            }}>
              AY 2024–25
            </span>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: '#F1F5F9',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}>
              {user?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
