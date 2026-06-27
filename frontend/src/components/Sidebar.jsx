import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const USER_NAV = [
  { to: '/dashboard', icon: '🎯', label: 'Resume Analyzer' },
  { to: '/dashboard/history', icon: '📋', label: 'Analysis History' },
  { to: '/dashboard/interview', icon: '🎙️', label: 'Mock Interview' },
  { to: '/dashboard/jobs', icon: '💼', label: 'Job Recommendations' },
  { to: '/dashboard/leetcode', icon: '📊', label: 'LeetCode Tracker' },
]

const ADMIN_NAV = [
  { to: '/admin', icon: '📊', label: 'Overview' },
  { to: '/admin/users', icon: '👥', label: 'Users' },
  { to: '/admin/activity', icon: '⚡', label: 'Activity' },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  const isAdmin = user?.role === 'admin'

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">
          <div className="logo-icon">🎯</div>
          <span className="logo-text">ResumeAI</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {isAdmin ? (
          <>
            <div className="nav-section-label">Admin</div>
            {ADMIN_NAV.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/admin'}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
            <div className="nav-section-label" style={{ marginTop: 8 }}>User Area</div>
            {USER_NAV.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/dashboard'}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </>
        ) : (
          <>
            <div className="nav-section-label">Menu</div>
            {USER_NAV.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/dashboard'}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User card + logout */}
      <div className="sidebar-user">
        <div className="user-card">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">{user?.name || 'User'}</div>
            <div className="user-role">{user?.role || 'user'}</div>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm btn-full" onClick={handleLogout}
          style={{ justifyContent: 'flex-start', gap: '8px' }}>
          <span>🚪</span> Sign out
        </button>
      </div>
    </aside>
  )
}
