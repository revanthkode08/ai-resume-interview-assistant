import { useState, useRef, useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useApi } from '../hooks/useApi'
import Sidebar from '../components/Sidebar'

// ── Score Ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score, label, size = 100 }) {
  const r = (size - 12) / 2
  const circ = 2 * Math.PI * r
  const color = score >= 70 ? '#10b981' : score >= 45 ? '#f59e0b' : '#ef4444'
  const dash = circ - (score / 100) * circ

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} className="score-ring-svg">
        <circle className="score-ring-bg" cx={size/2} cy={size/2} r={r} strokeWidth={8} />
        <circle
          className="score-ring-fill"
          cx={size/2} cy={size/2} r={r}
          strokeWidth={8}
          stroke={color}
          strokeDasharray={circ}
          strokeDashoffset={dash}
          strokeLinecap="round"
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span className="score-ring-num" style={{ color }}>{score}%</span>
        <span className="score-ring-label">{label}</span>
      </div>
    </div>
  )
}

// ── Score Bar ─────────────────────────────────────────────────────────────────
function ScoreBar({ label, value }) {
  const color = value >= 70 ? '#10b981' : value >= 45 ? '#f59e0b' : '#ef4444'
  return (
    <div className="score-bar-item">
      <div className="score-bar-header">
        <span className="score-bar-name">{label}</span>
        <span className="score-bar-val" style={{ color }}>{value}%</span>
      </div>
      <div className="score-bar-track">
        <div className="score-bar-fill-el" style={{ width: `${value}%`, background: `linear-gradient(90deg, ${color}99, ${color})` }} />
      </div>
    </div>
  )
}

// ── Question Section ──────────────────────────────────────────────────────────
const Q_SECTIONS = [
  { key: 'technical_questions',      label: 'Technical',         icon: '💻', color: '#6366f1' },
  { key: 'resume_specific_questions', label: 'Resume-Specific',  icon: '📄', color: '#06b6d4' },
  { key: 'behavioral_questions',     label: 'Behavioral',        icon: '🤝', color: '#10b981' },
  { key: 'missing_skill_questions',  label: 'Probing Gaps',      icon: '🔍', color: '#f59e0b' },
]

function QuestionSection({ section, questions }) {
  const [open, setOpen] = useState(true)
  if (!questions?.length) return null
  return (
    <div className="q-section">
      <div className="q-section-header" onClick={() => setOpen(o => !o)} id={`q-section-${section.key}`}>
        <div className="q-section-title">
          <span style={{ fontSize: 18 }}>{section.icon}</span>
          <span style={{ color: section.color }}>{section.label}</span>
          <span className="q-count">{questions.length}</span>
        </div>
        <span className={`q-chevron${open ? ' open' : ''}`}>⌃</span>
      </div>
      {open && (
        <div className="q-list">
          {questions.map((q, i) => (
            <div key={i} className="q-item">
              <div className="q-num">{i + 1}</div>
              <div>{q}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── History Panel ─────────────────────────────────────────────────────────────
function HistoryPanel() {
  const { fetchWithAuth } = useApi()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchWithAuth('/api/history')
      .then(r => r.json())
      .then(d => setHistory(d.history || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading-center"><div className="spinner" /></div>
  if (!history.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📋</div>
        <div className="empty-title">No analyses yet</div>
        <div className="empty-desc">Run your first resume analysis to see it here.</div>
      </div>
    )
  }

  const fmtDate = iso => iso ? new Date(iso).toLocaleString() : 'N/A'

  return (
    <div className="history-list">
      {history.map((h, i) => (
        <div key={i} className="history-item">
          <div className="history-type-icon" style={{
            background: h.type === 'analysis' ? 'rgba(99,102,241,0.12)' : 'rgba(6,182,212,0.12)'
          }}>
            {h.type === 'analysis' ? '🎯' : '💬'}
          </div>
          <div className="history-info">
            <div className="history-title">{h.type === 'analysis' ? 'ATS Analysis' : 'Interview Questions'}</div>
            <div className="history-date">{fmtDate(h.created_at)}</div>
            {h.matched_skills?.length > 0 && (
              <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {h.matched_skills.slice(0, 5).map(s => (
                  <span key={s} className="skill-tag matched" style={{ fontSize: 11 }}>{s}</span>
                ))}
                {h.matched_skills.length > 5 && <span className="text-muted text-xs">+{h.matched_skills.length - 5} more</span>}
              </div>
            )}
          </div>
          {h.ats_score != null && (
            <div className="history-score">{h.ats_score}%</div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth()
  const { fetchWithAuth } = useApi()
  const fileInputRef = useRef(null)

  const location = useLocation()
  const navigate = useNavigate()
  const view = location.pathname.includes('/history') ? 'history' : 'analyze'
  const [dragover, setDragover] = useState(false)

  const [resumeFile, setResumeFile] = useState(null)
  const [resumeText, setResumeText] = useState('')
  const [jdText, setJdText] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [questions, setQuestions] = useState(null)

  const [loading, setLoading] = useState({ parse: false, analyze: false, questions: false })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const setErr = msg => { setError(msg); setSuccess('') }
  const setOk = msg => { setSuccess(msg); setError('') }

  const handleFile = useCallback((file) => {
    if (!file) return
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['pdf', 'docx', 'txt'].includes(ext)) { setErr('Only PDF, DOCX, or TXT files are supported.'); return }
    setResumeFile(file)
    setResumeText('')
    setAnalysis(null)
    setQuestions(null)
    setError('')
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragover(false)
    handleFile(e.dataTransfer.files[0])
  }, [handleFile])

  const handleUpload = async () => {
    if (!resumeFile) return
    setError('')
    setLoading(l => ({ ...l, parse: true }))
    try {
      const fd = new FormData()
      fd.append('file', resumeFile)
      const res = await fetchWithAuth('/api/parse-resume', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to parse resume')
      setResumeText(data.resume_text)
      setOk('✅ Resume parsed successfully!')
    } catch (e) { setErr(e.message) }
    finally { setLoading(l => ({ ...l, parse: false })) }
  }

  const handleAnalyze = async () => {
    setError(''); setAnalysis(null)
    setLoading(l => ({ ...l, analyze: true }))
    try {
      const fd = new FormData()
      fd.append('resume_text', resumeText)
      fd.append('jd_text', jdText)
      const res = await fetchWithAuth('/api/analyze', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Analysis failed')
      setAnalysis(data)
      setOk('✅ Analysis complete!')
    } catch (e) { setErr(e.message) }
    finally { setLoading(l => ({ ...l, analyze: false })) }
  }

  const handleQuestions = async () => {
    setError(''); setQuestions(null)
    setLoading(l => ({ ...l, questions: true }))
    try {
      const fd = new FormData()
      fd.append('resume_text', resumeText)
      fd.append('jd_text', jdText)
      const res = await fetchWithAuth('/api/interview-questions', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Question generation failed')
      setQuestions(data)
      setOk('✅ Interview questions generated!')
    } catch (e) { setErr(e.message) }
    finally { setLoading(l => ({ ...l, questions: false })) }
  }

  const canAnalyze = resumeText.trim().length > 0 && jdText.trim().length > 0

  return (
    <div className="app-shell">
      <div className="bg-mesh" />
      <Sidebar />
      <div className="main-content">
        {/* Header */}
        <div className="page-header">
          <div className="page-header-inner">
            <div>
              <div className="page-title">
                {view === 'analyze' ? '🎯 Resume Analyzer' : '📋 Analysis History'}
              </div>
              <div className="page-subtitle">
                {view === 'analyze'
                  ? `Welcome back, ${user?.name?.split(' ')[0] || 'there'}!`
                  : 'All your past resume analyses'}
              </div>
            </div>
            <div className="flex gap-8">
              <button
                className={`btn btn-sm ${view === 'analyze' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => navigate('/dashboard')}
                id="view-analyze-btn"
              >🎯 Analyze</button>
              <button
                className={`btn btn-sm ${view === 'history' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => navigate('/dashboard/history')}
                id="view-history-btn"
              >📋 History</button>
            </div>
          </div>
        </div>

        <div className="page-body">
          {/* Alerts */}
          {error   && <div className="alert alert-error">⚠️ {error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          {view === 'history' ? <HistoryPanel /> : (
            <>
              {/* Step 1 — Upload */}
              <div className="card">
                <div className="card-title"><span className="step-badge">1</span> Upload Resume</div>
                <div className="card-subtitle">Supported formats: PDF, DOCX, TXT</div>

                <div
                  className={`dropzone${resumeFile ? ' has-file' : ''}${dragover ? ' dragover' : ''}`}
                  onDragOver={e => { e.preventDefault(); setDragover(true) }}
                  onDragLeave={() => setDragover(false)}
                  onDrop={handleDrop}
                  id="resume-dropzone"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={e => handleFile(e.target.files[0])}
                    id="resume-file-input"
                  />
                  <div className="dropzone-icon">{resumeFile ? '✅' : '📁'}</div>
                  <div className="dropzone-text">
                    {resumeFile ? resumeFile.name : 'Drop your resume here or click to browse'}
                  </div>
                  <div className="dropzone-sub">
                    {resumeFile ? `${(resumeFile.size / 1024).toFixed(1)} KB` : 'PDF, DOCX or TXT · Max 10MB'}
                  </div>
                </div>

                {resumeFile && !resumeText && (
                  <button
                    className="btn btn-primary mt-16"
                    onClick={handleUpload}
                    disabled={loading.parse}
                    id="parse-resume-btn"
                  >
                    {loading.parse ? <><span className="spinner" /> Parsing…</> : '⚡ Parse Resume'}
                  </button>
                )}

                {resumeText && (
                  <div style={{ marginTop: 16 }}>
                    <div className="form-label" style={{ marginBottom: 6 }}>Extracted Text — edit if needed</div>
                    <textarea
                      className="form-input"
                      value={resumeText}
                      onChange={e => setResumeText(e.target.value)}
                      rows={8}
                      id="resume-text-area"
                    />
                  </div>
                )}
              </div>

              {/* Step 2 — Job Description */}
              <div className="card">
                <div className="card-title"><span className="step-badge">2</span> Paste Job Description</div>
                <div className="card-subtitle">Copy the full job posting for best results</div>
                <textarea
                  className="form-input"
                  placeholder="Paste the job description here…"
                  value={jdText}
                  onChange={e => setJdText(e.target.value)}
                  rows={8}
                  id="jd-text-area"
                />
              </div>

              {/* Step 3 — Actions */}
              <div className="card">
                <div className="card-title"><span className="step-badge">3</span> Run Analysis</div>
                <div className="card-subtitle">Both resume text and job description are required</div>
                <div className="flex gap-12" style={{ flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-primary"
                    onClick={handleAnalyze}
                    disabled={!canAnalyze || loading.analyze}
                    id="run-analysis-btn"
                  >
                    {loading.analyze ? <><span className="spinner" /> Analyzing…</> : '🎯 Get ATS Score & Skill Gap'}
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={handleQuestions}
                    disabled={!canAnalyze || loading.questions}
                    id="generate-questions-btn"
                  >
                    {loading.questions ? <><span className="spinner" /> Generating…</> : '💬 Generate Interview Questions'}
                  </button>
                </div>
              </div>

              {/* Results — Analysis */}
              {analysis && (
                <div className="card animate-fadeIn" id="analysis-results">
                  <div className="card-title">🎯 ATS Analysis Results</div>

                  <div className="score-ring-wrap">
                    <ScoreRing score={analysis.ats_score} label="ATS Score" size={120} />
                    <div className="score-bars">
                      <ScoreBar label="Semantic Similarity" value={analysis.semantic_similarity_score} />
                      <ScoreBar label="Keyword Match"       value={analysis.keyword_match_score} />
                      <ScoreBar label="Qualifications"      value={analysis.qualification_score || 0} />
                      <ScoreBar label="Rewards & Honors"    value={analysis.rewards_score || 0} />
                      <ScoreBar label="Participation"       value={analysis.participation_score || 0} />
                    </div>
                  </div>

                  <div className="skills-section" style={{ marginTop: 24 }}>
                    <div>
                      <div className="skill-group-title">✅ Matched Skills</div>
                      <div className="tag-cloud">
                        {analysis.matched_skills?.length
                          ? analysis.matched_skills.map(s => <span key={s} className="skill-tag matched">{s}</span>)
                          : <span className="text-muted text-sm">None matched</span>}
                      </div>
                    </div>
                    <div>
                      <div className="skill-group-title">❌ Missing Skills</div>
                      <div className="tag-cloud">
                        {analysis.missing_skills?.length
                          ? analysis.missing_skills.map(s => <span key={s} className="skill-tag missing">{s}</span>)
                          : <span className="text-muted text-sm">None missing 🎉</span>}
                      </div>
                    </div>
                    <div>
                      <div className="skill-group-title">➕ Extra in Resume</div>
                      <div className="tag-cloud">
                        {analysis.extra_skills_in_resume?.length
                          ? analysis.extra_skills_in_resume.map(s => <span key={s} className="skill-tag extra">{s}</span>)
                          : <span className="text-muted text-sm">None</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Results — Questions */}
              {questions && (
                <div className="card animate-fadeIn" id="questions-results">
                  <div className="card-title" style={{ marginBottom: 16 }}>💬 Tailored Interview Questions</div>
                  {questions.parse_error && (
                    <div className="alert alert-info" style={{ marginBottom: 12 }}>
                      ℹ️ Response wasn't perfectly structured — raw output shown below.
                    </div>
                  )}
                  {Q_SECTIONS.map(s => (
                    <QuestionSection key={s.key} section={s} questions={questions[s.key]} />
                  ))}
                  {questions.raw_response && (
                    <pre style={{ whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.3)', padding: 16, borderRadius: 8, fontSize: 13, marginTop: 12, color: 'var(--text-secondary)' }}>
                      {questions.raw_response}
                    </pre>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
