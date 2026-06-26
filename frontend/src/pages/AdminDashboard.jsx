import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import Sidebar from '../components/Sidebar'

function StatCard({ icon, value, label, color = '#6366f1' }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
      </div>
      <div className="stat-value" style={{ background: `linear-gradient(135deg, ${color}, #06b6d4)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
        {value}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

function UsersTable({ users }) {
  const [search, setSearch] = useState('')
  const fmtDate = iso => iso ? new Date(iso).toLocaleDateString() : '—'

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex gap-12" style={{ marginBottom: 16, alignItems: 'center' }}>
        <input
          className="form-input"
          style={{ maxWidth: 280 }}
          placeholder="🔍 Search users…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          id="admin-user-search"
        />
        <span className="text-muted text-sm">{filtered.length} users</span>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Joined</th>
              <th>Analyses</th>
              <th>Questions</th>
              <th>Last Active</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No users found</td></tr>
            ) : filtered.map(u => (
              <tr key={u.id}>
                <td>
                  <div className="flex gap-12" style={{ alignItems: 'center' }}>
                    <div className="user-avatar" style={{ width: 32, height: 32, fontSize: 13 }}>
                      {u.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{u.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`badge badge-${u.role}`}>{u.role}</span>
                </td>
                <td>{fmtDate(u.created_at)}</td>
                <td>
                  <span style={{ fontWeight: 700, color: '#6366f1' }}>{u.analyses_count}</span>
                </td>
                <td>
                  <span style={{ fontWeight: 700, color: '#06b6d4' }}>{u.questions_count}</span>
                </td>
                <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{u.last_active ? new Date(u.last_active).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ActivityFeed({ activity }) {
  const fmtDate = iso => iso ? new Date(iso).toLocaleString() : 'N/A'
  if (!activity.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon">⚡</div>
        <div className="empty-title">No activity yet</div>
        <div className="empty-desc">Activity will appear here as users interact with the platform.</div>
      </div>
    )
  }
  return (
    <div className="activity-list">
      {activity.map((a, i) => (
        <div key={i} className="activity-item">
          <div className={`activity-dot ${a.type}`} />
          <div className="activity-body">
            <div className="activity-title">
              <strong>{a.user_name}</strong>{' '}
              {a.type === 'analysis' ? 'ran an ATS analysis' : 'generated interview questions'}
              {a.ats_score != null && <span style={{ marginLeft: 8, color: '#6366f1', fontWeight: 700 }}>{a.ats_score}% score</span>}
            </div>
            <div className="activity-meta">{a.user_email} · {fmtDate(a.created_at)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function AdminDashboard() {
  const { fetchWithAuth } = useApi()
  const location = useLocation()
  const navigate = useNavigate()
  
  let view = 'overview'
  if (location.pathname.includes('/users')) {
    view = 'users'
  } else if (location.pathname.includes('/activity')) {
    view = 'activity'
  }
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchWithAuth('/api/admin/stats').then(r => r.json()),
      fetchWithAuth('/api/admin/users').then(r => r.json()),
      fetchWithAuth('/api/admin/recent-activity?limit=30').then(r => r.json()),
    ]).then(([s, u, a]) => {
      setStats(s)
      setUsers(u.users || [])
      setActivity(a.activity || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  return (
    <div className="app-shell">
      <div className="bg-mesh" />
      <Sidebar />
      <div className="main-content">
        {/* Header */}
        <div className="page-header">
          <div className="page-header-inner">
            <div>
              <div className="page-title">🛡️ Admin Dashboard</div>
              <div className="page-subtitle">Platform overview and user management</div>
            </div>
            <div className="flex gap-8">
              {[
                { key: 'overview', icon: '📊', label: 'Overview', path: '/admin' },
                { key: 'users',    icon: '👥', label: 'Users', path: '/admin/users' },
                { key: 'activity', icon: '⚡', label: 'Activity', path: '/admin/activity' },
              ].map(v => (
                <button
                  key={v.key}
                  id={`admin-tab-${v.key}`}
                  className={`btn btn-sm ${view === v.key ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => navigate(v.path)}
                >
                  {v.icon} {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="page-body">
          {loading ? (
            <div className="loading-center">
              <div className="spinner spinner-lg" />
              <p>Loading admin data…</p>
            </div>
          ) : (
            <>
              {/* Stats always visible */}
              {stats && (
                <div className="stats-grid" id="admin-stats">
                  <StatCard icon="👥" value={stats.total_users}     label="Total Users"      color="#6366f1" />
                  <StatCard icon="🎯" value={stats.total_analyses}  label="Total Analyses"   color="#06b6d4" />
                  <StatCard icon="💬" value={stats.total_questions} label="Question Sessions" color="#10b981" />
                  <StatCard icon="📈" value={`${stats.avg_ats_score}%`} label="Avg ATS Score" color="#f59e0b" />
                </div>
              )}

              {view === 'overview' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  {/* Recent users */}
                  <div className="card" style={{ margin: 0 }}>
                    <div className="card-title" style={{ marginBottom: 16 }}>👥 Recent Users</div>
                    <div className="activity-list">
                      {users.slice(0, 6).map(u => (
                        <div key={u.id} className="activity-item">
                          <div className="user-avatar" style={{ width: 32, height: 32, fontSize: 12, flexShrink: 0 }}>
                            {u.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                          <div className="activity-body">
                            <div className="activity-title" style={{ fontSize: 13 }}>{u.name}</div>
                            <div className="activity-meta">{u.email}</div>
                          </div>
                          <span className={`badge badge-${u.role}`}>{u.role}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent activity */}
                  <div className="card" style={{ margin: 0 }}>
                    <div className="card-title" style={{ marginBottom: 16 }}>⚡ Recent Activity</div>
                    <ActivityFeed activity={activity.slice(0, 8)} />
                  </div>
                </div>
              )}

              {view === 'users' && (
                <div className="card" id="admin-users-panel">
                  <div className="card-title" style={{ marginBottom: 4 }}>👥 All Users</div>
                  <div className="card-subtitle">Manage and monitor all registered users</div>
                  <UsersTable users={users} />
                </div>
              )}

              {view === 'activity' && (
                <div className="card" id="admin-activity-panel">
                  <div className="card-title" style={{ marginBottom: 16 }}>⚡ Recent Activity Feed</div>
                  <ActivityFeed activity={activity} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
