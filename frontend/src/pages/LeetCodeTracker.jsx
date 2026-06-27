import { useState, useEffect } from 'react'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'

export default function LeetCodeTracker() {
  const { user } = useAuth()
  const { fetchWithAuth } = useApi()

  // States
  const [logs, setLogs] = useState([])
  const [stats, setStats] = useState({ total: 0, easy: 0, medium: 0, hard: 0, topics: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Sync state
  const [username, setUsername] = useState('')
  const [syncLoading, setSyncLoading] = useState(false)
  const [externalStats, setExternalStats] = useState(null)

  // Log Form state
  const [showLogForm, setShowLogForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formDifficulty, setFormDifficulty] = useState('Easy')
  const [formTopic, setFormTopic] = useState('General')
  const [formNotes, setFormNotes] = useState('')
  const [formCode, setFormCode] = useState('')
  const [formSubmitting, setFormSubmitting] = useState(false)

  // Expanded log ID to view notes/code
  const [expandedLogId, setExpandedLogId] = useState(null)

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [logsRes, statsRes] = await Promise.all([
        fetchWithAuth('/api/leetcode/logs'),
        fetchWithAuth('/api/leetcode/stats')
      ])
      
      const logsData = await logsRes.json()
      const statsData = await statsRes.json()

      if (!logsRes.ok) throw new Error('Failed to load logs')
      if (!statsRes.ok) throw new Error('Failed to load statistics')

      setLogs(logsData || [])
      setStats(statsData || { total: 0, easy: 0, medium: 0, hard: 0, topics: {} })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // If user already has a username in profile, try loading external stats
    if (user?.leetcode_username) {
      setUsername(user.leetcode_username)
      fetchExternalStats(user.leetcode_username)
    }
  }, [user])

  const fetchExternalStats = (uname) => {
    setSyncLoading(true)
    fetchWithAuth(`/api/leetcode/external/${uname}`)
      .then(async res => {
        const data = await res.json()
        if (data.status === 'success') {
          setExternalStats(data)
          setSuccess('✅ Synced LeetCode stats successfully!')
        } else {
          setError(data.message || 'Could not find LeetCode profile')
        }
      })
      .catch(err => {
        setError('Failed to connect to LeetCode API')
      })
      .finally(() => {
        setSyncLoading(false)
      })
  }

  const handleSync = (e) => {
    e.preventDefault()
    if (!username.trim()) return
    setError('')
    setSuccess('')
    fetchExternalStats(username.trim())
  }

  const handleLogProblem = async (e) => {
    e.preventDefault()
    if (!formTitle.trim()) {
      setError('Problem title is required')
      return
    }

    setError('')
    setSuccess('')
    setFormSubmitting(true)

    try {
      const fd = new FormData()
      fd.append('problem_title', formTitle)
      fd.append('problem_url', formUrl)
      fd.append('difficulty', formDifficulty)
      fd.append('topic', formTopic)
      fd.append('notes', formNotes)
      fd.append('solution_code', formCode)

      const res = await fetchWithAuth('/api/leetcode/log', {
        method: 'POST',
        body: fd
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to log problem')

      setSuccess(`✅ Logged problem "${formTitle}" successfully!`)
      
      // Reset form
      setFormTitle('')
      setFormUrl('')
      setFormDifficulty('Easy')
      setFormTopic('General')
      setFormNotes('')
      setFormCode('')
      setShowLogForm(false)

      // Reload
      loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleDeleteLog = async (id) => {
    if (!window.confirm('Are you sure you want to delete this log?')) return
    setError('')
    setSuccess('')
    try {
      const res = await fetchWithAuth(`/api/leetcode/log/${id}`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Failed to delete log')
      }
      setSuccess('Deleted log successfully.')
      loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  const getDifficultyBadge = (diff) => {
    if (diff === 'Easy') return 'badge-success'
    if (diff === 'Medium') return 'badge-warning'
    return 'badge-danger'
  }

  return (
    <div className="app-shell">
      <div className="bg-mesh" />
      <Sidebar />

      <div className="main-content">
        <div className="page-header">
          <div className="page-header-inner">
            <div>
              <div className="page-title">📊 LeetCode Tracker</div>
              <div className="page-subtitle">
                Track your local progress and sync with your public LeetCode profile
              </div>
            </div>
            <button 
              className="btn btn-primary"
              onClick={() => setShowLogForm(prev => !prev)}
            >
              {showLogForm ? 'Close Form' : '➕ Log Solved Problem'}
            </button>
          </div>
        </div>

        <div className="page-body">
          {error && <div className="alert alert-error">⚠️ {error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          {/* Sync & Stats Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
            
            {/* Sync Card */}
            <div className="card" style={{ margin: 0 }}>
              <div className="card-title">🔗 LeetCode Profile Sync</div>
              <div className="card-subtitle">Import your public LeetCode stats</div>
              <form onSubmit={handleSync} className="flex gap-8" style={{ marginTop: 12 }}>
                <input
                  className="form-input"
                  placeholder="LeetCode username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  disabled={syncLoading}
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn btn-primary" disabled={syncLoading || !username.trim()}>
                  {syncLoading ? 'Syncing…' : 'Sync'}
                </button>
              </form>

              {externalStats && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Global Ranking</span>
                    <strong style={{ color: 'var(--cyan-400)' }}>#{externalStats.ranking?.toLocaleString() || '—'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Acceptance Rate</span>
                    <strong>{externalStats.acceptance_rate ? `${externalStats.acceptance_rate}%` : '—'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Total Solved</span>
                    <strong>{externalStats.total_solved || 0}</strong>
                  </div>

                  {/* Difficulty breakdown */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 16 }}>
                    <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: '#6ee7b7' }}>Easy</div>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{externalStats.easy_solved || 0}</div>
                    </div>
                    <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: '#fcd34d' }}>Medium</div>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{externalStats.medium_solved || 0}</div>
                    </div>
                    <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: '#fca5a5' }}>Hard</div>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{externalStats.hard_solved || 0}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Local Stats Card */}
            <div className="card" style={{ margin: 0 }}>
              <div className="card-title">📋 Local Log Stats</div>
              <div className="card-subtitle">Your locally recorded practice progress</div>
              
              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 16 }}>
                <div className="stat-card" style={{ padding: '12px 8px' }}>
                  <div className="stat-value" style={{ fontSize: 24 }}>{stats.total || 0}</div>
                  <div className="stat-label" style={{ fontSize: 11 }}>Total Logs</div>
                </div>
                <div className="stat-card" style={{ padding: '12px 8px' }}>
                  <div className="stat-value" style={{ fontSize: 24, color: '#10b981' }}>{stats.easy || 0}</div>
                  <div className="stat-label" style={{ fontSize: 11 }}>Easy</div>
                </div>
                <div className="stat-card" style={{ padding: '12px 8px' }}>
                  <div className="stat-value" style={{ fontSize: 24, color: '#f59e0b' }}>{stats.medium || 0}</div>
                  <div className="stat-label" style={{ fontSize: 11 }}>Medium</div>
                </div>
                <div className="stat-card" style={{ padding: '12px 8px' }}>
                  <div className="stat-value" style={{ fontSize: 24, color: '#ef4444' }}>{stats.hard || 0}</div>
                  <div className="stat-label" style={{ fontSize: 11 }}>Hard</div>
                </div>
              </div>

              {/* Topics cloud */}
              {stats.topics && Object.keys(stats.topics).length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Topics Practice Distribution</div>
                  <div className="tag-cloud" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {Object.entries(stats.topics).map(([topic, count]) => (
                      <span key={topic} className="skill-tag matched" style={{ fontSize: 11 }}>
                        {topic} <strong style={{ marginLeft: 4, opacity: 0.8 }}>({count})</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Collapsible log form */}
          {showLogForm && (
            <div className="card animate-fadeIn" style={{ marginBottom: 20 }}>
              <div className="card-title">📝 Record Problem Solved</div>
              <form onSubmit={handleLogProblem} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, flexWrap: 'wrap' }}>
                  <div className="form-group">
                    <label className="form-label">Problem Title *</label>
                    <input
                      className="form-input"
                      placeholder="e.g. Two Sum"
                      value={formTitle}
                      onChange={e => setFormTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Difficulty</label>
                    <select
                      className="form-input"
                      value={formDifficulty}
                      onChange={e => setFormDifficulty(e.target.value)}
                    >
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Topic</label>
                    <input
                      className="form-input"
                      placeholder="e.g. Array, DP"
                      value={formTopic}
                      onChange={e => setFormTopic(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Problem Link URL (optional)</label>
                  <input
                    className="form-input"
                    placeholder="https://leetcode.com/problems/..."
                    value={formUrl}
                    onChange={e => setFormUrl(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Key Insights & Notes</label>
                  <textarea
                    className="form-input"
                    placeholder="Write down logic, edge cases, or complexity details…"
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Your Solution Code</label>
                  <textarea
                    className="form-input"
                    placeholder="// Paste your Python/Javascript/Java/C++ code here…"
                    value={formCode}
                    onChange={e => setFormCode(e.target.value)}
                    rows={6}
                    style={{ fontFamily: 'monospace', fontSize: 13 }}
                  />
                </div>

                <div className="flex gap-12" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowLogForm(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={formSubmitting}>
                    {formSubmitting ? 'Saving…' : 'Save Problem Log'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Logs table */}
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title">📜 Logged Problems</div>
            <div className="card-subtitle">List of coding practice entries</div>

            {loading ? (
              <div className="loading-center" style={{ padding: 40 }}>
                <div className="spinner" />
              </div>
            ) : logs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--text-secondary)' }}>
                No logged problems yet. Click "Log Solved Problem" to record your first solve!
              </div>
            ) : (
              <div className="table-wrap" style={{ marginTop: 16 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Topic</th>
                      <th>Difficulty</th>
                      <th>Logged Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => {
                      const isExpanded = expandedLogId === log._id
                      const dateStr = log.created_at ? new Date(log.created_at).toLocaleDateString() : '—'
                      
                      return (
                        <tr key={log._id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td>
                            {log.problem_url ? (
                              <a href={log.problem_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--indigo-400)', fontWeight: 600, textDecoration: 'underline' }}>
                                {log.problem_title} ↗
                              </a>
                            ) : (
                              <span style={{ fontWeight: 600 }}>{log.problem_title}</span>
                            )}
                          </td>
                          <td>
                            <span className="badge badge-user">{log.topic}</span>
                          </td>
                          <td>
                            <span className={`badge ${getDifficultyBadge(log.difficulty)}`}>
                              {log.difficulty}
                            </span>
                          </td>
                          <td>{dateStr}</td>
                          <td>
                            <div className="flex gap-8">
                              <button 
                                className="btn btn-ghost btn-sm"
                                onClick={() => setExpandedLogId(prev => prev === log._id ? null : log._id)}
                              >
                                {isExpanded ? 'Hide' : 'View Code'}
                              </button>
                              <button 
                                className="btn btn-danger btn-sm"
                                onClick={() => handleDeleteLog(log._id)}
                              >
                                🗑️
                              </button>
                            </div>

                            {isExpanded && (
                              <div style={{ display: 'block', width: '100%', marginTop: 12, padding: 12, background: 'rgba(0,0,0,0.2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                                {log.notes && (
                                  <div style={{ marginBottom: 12 }}>
                                    <strong style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Notes & Logic:</strong>
                                    <p style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{log.notes}</p>
                                  </div>
                                )}
                                {log.solution_code && (
                                  <div>
                                    <strong style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Solution Code:</strong>
                                    <pre style={{ 
                                      background: 'rgba(0,0,0,0.4)', 
                                      padding: 12, 
                                      borderRadius: 6, 
                                      fontSize: 12, 
                                      overflowX: 'auto', 
                                      fontFamily: 'monospace', 
                                      color: '#a7f3d0' 
                                    }}>
                                      <code>{log.solution_code}</code>
                                    </pre>
                                  </div>
                                )}
                                {!log.notes && !log.solution_code && (
                                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No notes or code recorded.</span>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
