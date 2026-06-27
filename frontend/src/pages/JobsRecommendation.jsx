import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'

// Mini score ring for the job cards
function MiniScoreRing({ score, size = 60 }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const color = score >= 75 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444'
  const dash = circ - (score / 100) * circ

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} stroke="rgba(255,255,255,0.05)" strokeWidth={4} fill="none" />
        <circle
          cx={size/2} cy={size/2} r={r}
          strokeWidth={4}
          stroke={color}
          strokeDasharray={circ}
          strokeDashoffset={dash}
          strokeLinecap="round"
          fill="none"
          style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{Math.round(score)}%</span>
      </div>
    </div>
  )
}

export default function JobsRecommendation() {
  const { user } = useAuth()
  const { fetchWithAuth } = useApi()
  const navigate = useNavigate()
  
  const [recommendations, setRecommendations] = useState([])
  const [hasResume, setHasResume] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedJobId, setExpandedJobId] = useState(null)

  useEffect(() => {
    fetchWithAuth('/api/jobs/recommendations')
      .then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || 'Failed to fetch job recommendations')
        setRecommendations(data.recommendations || [])
        setHasResume(data.has_resume !== false)
      })
      .catch(err => {
        setError(err.message)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const toggleExpandJob = (id) => {
    setExpandedJobId(prev => prev === id ? null : id)
  }

  return (
    <div className="app-shell">
      <div className="bg-mesh" />
      <Sidebar />
      
      <div className="main-content">
        {/* Header */}
        <div className="page-header">
          <div className="page-header-inner">
            <div>
              <div className="page-title">💼 Job Recommendations</div>
              <div className="page-subtitle">
                Tailored opportunities matching your resume skill profile
              </div>
            </div>
          </div>
        </div>

        <div className="page-body">
          {error && <div className="alert alert-error">⚠️ {error}</div>}

          {loading ? (
            <div className="loading-center">
              <div className="spinner spinner-lg" />
              <p style={{ marginTop: 12, color: 'var(--text-secondary)' }}>Matching jobs with your skills…</p>
            </div>
          ) : !hasResume ? (
            <div className="card text-center" style={{ padding: '40px 24px' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
              <div className="card-title">Upload your resume first</div>
              <div className="card-subtitle" style={{ maxWidth: 500, margin: '0 auto 20px auto' }}>
                We need to extract the skills from your resume to calculate match scores and find the best jobs for you.
              </div>
              <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
                🎯 Go to Resume Analyzer
              </button>
            </div>
          ) : recommendations.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">💼</div>
              <div className="empty-title">No job recommendations</div>
              <div className="empty-desc">We couldn't find any job postings in our database right now.</div>
            </div>
          ) : (
            <div className="jobs-list" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {recommendations.map(job => {
                const isExpanded = expandedJobId === job.id
                const matchClass = job.match_score >= 75 ? 'success' : job.match_score >= 40 ? 'warning' : 'danger'
                
                return (
                  <div key={job.id} className={`card ${isExpanded ? 'active' : ''}`} style={{ margin: 0, transition: 'all 0.3s ease' }}>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                      
                      <div style={{ display: 'flex', gap: 16, flex: 1, minWidth: 280 }}>
                        <MiniScoreRing score={job.match_score} />
                        <div>
                          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                            {job.title}
                          </h3>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', color: 'var(--text-secondary)', fontSize: 13, marginBottom: 8 }}>
                            <span style={{ fontWeight: 600, color: 'var(--indigo-400)' }}>🏢 {job.company}</span>
                            <span>•</span>
                            <span>📍 {job.location}</span>
                            <span>•</span>
                            <span style={{ color: '#10b981', fontWeight: 500 }}>💰 {job.salary}</span>
                          </div>
                          
                          <div style={{ display: 'flex', gap: 6 }}>
                            <span className="badge badge-user">{job.experience_level} Experience</span>
                            <span className={`badge badge-${matchClass}`}>
                              {job.match_score >= 75 ? 'Strong Match' : job.match_score >= 40 ? 'Good Match' : 'Gap Identified'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <button 
                        className="btn btn-ghost btn-sm" 
                        onClick={() => toggleExpandJob(job.id)}
                        style={{ height: 'fit-content' }}
                      >
                        {isExpanded ? 'Collapse Details ⌃' : 'Match Analysis & JD ⌄'}
                      </button>
                    </div>

                    {/* AI Fit reasoning always visible but styled nicely */}
                    <div style={{ 
                      marginTop: 16, 
                      padding: '10px 14px', 
                      background: 'rgba(99, 102, 241, 0.05)', 
                      borderLeft: '3px solid var(--indigo-500)', 
                      borderRadius: '4px',
                      fontSize: 13,
                      color: 'var(--text-primary)'
                    }}>
                      <strong>💡 Career Advisor: </strong> {job.fit_reasoning}
                    </div>

                    {/* Collapsible details section */}
                    {isExpanded && (
                      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }} className="animate-fadeIn">
                        
                        {/* Skills match section */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
                          <div>
                            <div className="skill-group-title" style={{ fontSize: 13, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span>✅</span> Matched Skills ({job.matched_skills.length})
                            </div>
                            <div className="tag-cloud" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                              {job.matched_skills.length > 0 ? (
                                job.matched_skills.map(s => <span key={s} className="skill-tag matched" style={{ fontSize: 11 }}>{s}</span>)
                              ) : (
                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>None matching yet</span>
                              )}
                            </div>
                          </div>
                          
                          <div>
                            <div className="skill-group-title" style={{ fontSize: 13, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span>⚠️</span> Missing Skills ({job.missing_skills.length})
                            </div>
                            <div className="tag-cloud" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                              {job.missing_skills.length > 0 ? (
                                job.missing_skills.map(s => <span key={s} className="skill-tag missing" style={{ fontSize: 11 }}>{s}</span>)
                              ) : (
                                <span style={{ fontSize: 12, color: '#10b981' }}>Perfect skills match! 🎉</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Job description */}
                        <div>
                          <div className="skill-group-title" style={{ fontSize: 13, marginBottom: 8 }}>📋 Job Description</div>
                          <p style={{ 
                            fontSize: 14, 
                            color: 'var(--text-secondary)', 
                            lineHeight: '1.6', 
                            whiteSpace: 'pre-line',
                            background: 'rgba(0,0,0,0.15)',
                            padding: 16,
                            borderRadius: '8px',
                            border: '1px solid var(--border)'
                          }}>
                            {job.description}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
