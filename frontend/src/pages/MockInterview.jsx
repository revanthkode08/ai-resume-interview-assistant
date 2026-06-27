import { useState, useEffect, useRef } from 'react'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'

// Score Ring from Dashboard for visual consistency
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
        <span className="score-ring-num" style={{ color, fontSize: 24, fontWeight: 800 }}>{score}%</span>
        <span className="score-ring-label">{label}</span>
      </div>
    </div>
  )
}

export default function MockInterview() {
  const { user } = useAuth()
  const { fetchWithAuth } = useApi()

  // Navigation / Tab states
  const [activeTab, setActiveTab] = useState('new') // 'new', 'history', 'interview', 'report'
  
  // History state
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Interview creation state
  const [role, setRole] = useState('Frontend Developer')
  const [customRole, setCustomRole] = useState('')
  const [category, setCategory] = useState('Technical')
  const [numQuestions, setNumQuestions] = useState(3)

  // In-progress interview state
  const [sessionId, setSessionId] = useState('')
  const [currentQuestion, setCurrentQuestion] = useState('')
  const [progress, setProgress] = useState(0)
  const [totalQuestions, setTotalQuestions] = useState(3)
  const [userAnswer, setUserAnswer] = useState('')
  const [apiLoading, setApiLoading] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  
  // Voice recognition states
  const [isRecording, setIsRecording] = useState(false)
  const recognitionRef = useRef(null)

  // Report state
  const [report, setReport] = useState(null)
  const [openCritiqueId, setOpenCritiqueId] = useState(null)

  // General errors/messages
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // ── Speech Synthesis (TTS) ──────────────────────────────────────────────────
  const speakQuestion = (text) => {
    if (!('speechSynthesis' in window)) return
    
    // Stop any active speech
    window.speechSynthesis.cancel()
    setIsSpeaking(true)

    const utterance = new SpeechSynthesisUtterance(text)
    
    // Configure voice (choose English voice if available)
    const voices = window.speechSynthesis.getVoices()
    const englishVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural'))) || 
                         voices.find(v => v.lang.startsWith('en'))
    if (englishVoice) {
      utterance.voice = englishVoice
    }
    
    utterance.onend = () => {
      setIsSpeaking(false)
    }
    utterance.onerror = () => {
      setIsSpeaking(false)
    }

    window.speechSynthesis.speak(utterance)
  }

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
    }
  }

  // ── Speech Recognition (STT) ────────────────────────────────────────────────
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      const rec = new SpeechRecognition()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = 'en-US'

      rec.onresult = (event) => {
        let finalTrans = ''
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTrans += event.results[i][0].transcript + ' '
          }
        }
        if (finalTrans) {
          setUserAnswer(prev => prev + finalTrans)
        }
      }

      rec.onerror = (e) => {
        console.error('Speech recognition error:', e)
        setIsRecording(false)
      }

      rec.onend = () => {
        setIsRecording(false)
      }

      recognitionRef.current = rec
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const startRecording = () => {
    if (!recognitionRef.current) {
      setError('Voice recognition is not supported in this browser. Please type your answer.')
      return
    }
    setError('')
    try {
      recognitionRef.current.start()
      setIsRecording(true)
    } catch (e) {
      console.error(e)
    }
  }

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop()
      setIsRecording(false)
    }
  }

  // ── API Actions ─────────────────────────────────────────────────────────────
  const loadHistory = () => {
    setHistoryLoading(true)
    setError('')
    fetchWithAuth('/api/voice-bot/history')
      .then(res => res.json())
      .then(data => {
        setHistory(data.history || [])
      })
      .catch(() => {
        setError('Failed to load interview history.')
      })
      .finally(() => {
        setHistoryLoading(false)
      })
  }

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory()
    }
  }, [activeTab])

  const startInterview = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setApiLoading(true)

    const selectedRole = role === 'Custom' ? customRole : role
    if (!selectedRole.trim()) {
      setError('Please provide a target job role.')
      setApiLoading(false)
      return
    }

    try {
      const fd = new FormData()
      fd.append('role', selectedRole)
      fd.append('category', category)
      fd.append('num_questions', numQuestions)

      const res = await fetchWithAuth('/api/voice-bot/start', {
        method: 'POST',
        body: fd
      })
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.detail || 'Failed to start interview')
      
      setSessionId(data.session_id)
      setCurrentQuestion(data.question)
      setProgress(data.progress)
      setTotalQuestions(data.num_questions)
      setUserAnswer('')
      setActiveTab('interview')
      
      // Auto-read first question
      setTimeout(() => speakQuestion(data.question), 600)
    } catch (err) {
      setError(err.message)
    } finally {
      setApiLoading(false)
    }
  }

  const submitAnswer = async (e) => {
    e.preventDefault()
    if (!userAnswer.trim()) {
      setError('Please type or record an answer before submitting.')
      return
    }

    setError('')
    setApiLoading(true)
    stopRecording()
    stopSpeaking()

    try {
      const fd = new FormData()
      fd.append('session_id', sessionId)
      fd.append('user_answer', userAnswer.trim())

      const res = await fetchWithAuth('/api/voice-bot/respond', {
        method: 'POST',
        body: fd
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.detail || 'Failed to process answer')

      if (data.status === 'completed') {
        setReport(data.feedback)
        setActiveTab('report')
      } else {
        setCurrentQuestion(data.question)
        setProgress(data.progress)
        setTotalQuestions(data.num_questions)
        setUserAnswer('')
        // Auto-read next question
        setTimeout(() => speakQuestion(data.question), 600)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setApiLoading(false)
    }
  }

  const viewReport = (id) => {
    setError('')
    setApiLoading(true)
    fetchWithAuth(`/api/voice-bot/session/${id}`)
      .then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || 'Failed to load report')
        setReport(data.feedback)
        setActiveTab('report')
      })
      .catch(err => {
        setError(err.message)
      })
      .finally(() => {
        setApiLoading(false)
      })
  }

  const triggerHistoryTab = () => {
    stopSpeaking()
    stopRecording()
    setActiveTab('history')
  }

  const triggerNewTab = () => {
    stopSpeaking()
    stopRecording()
    setActiveTab('new')
  }

  return (
    <div className="app-shell">
      <div className="bg-mesh" />
      <Sidebar />

      <div className="main-content">
        <div className="page-header">
          <div className="page-header-inner">
            <div>
              <div className="page-title">🎙️ Mock Interview Voice Bot</div>
              <div className="page-subtitle">
                Practice interactive interviews with real-time AI feedback and critique
              </div>
            </div>
            
            {(activeTab === 'new' || activeTab === 'history') && (
              <div className="flex gap-8">
                <button
                  className={`btn btn-sm ${activeTab === 'new' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={triggerNewTab}
                >
                  New Interview
                </button>
                <button
                  className={`btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={triggerHistoryTab}
                >
                  History
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="page-body">
          {error && <div className="alert alert-error">⚠️ {error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          {/* LOADING SCREEN FOR TRANSITIONS */}
          {apiLoading && activeTab !== 'interview' && (
            <div className="loading-center">
              <div className="spinner spinner-lg" />
              <p style={{ marginTop: 12, color: 'var(--text-secondary)' }}>Processing session details…</p>
            </div>
          )}

          {/* TAB 1: NEW INTERVIEW CONFIG */}
          {!apiLoading && activeTab === 'new' && (
            <div className="card" style={{ maxWidth: 650, margin: '0 auto' }}>
              <div className="card-title">🚀 Configure Mock Interview</div>
              <div className="card-subtitle">Choose your practice settings and start talking</div>

              <form onSubmit={startInterview} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                <div className="form-group">
                  <label className="form-label">Job Role</label>
                  <select
                    className="form-input"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                  >
                    <option value="Frontend Developer">Frontend Developer (React)</option>
                    <option value="Backend Software Engineer">Backend Software Engineer (Node.js)</option>
                    <option value="Machine Learning Engineer">Machine Learning Engineer</option>
                    <option value="DevOps & Cloud Engineer">DevOps & Cloud Engineer</option>
                    <option value="Python Data Scientist">Python Data Scientist</option>
                    <option value="Custom">Custom Role...</option>
                  </select>
                </div>

                {role === 'Custom' && (
                  <div className="form-group animate-fadeIn">
                    <label className="form-label">Custom Job Role Title *</label>
                    <input
                      className="form-input"
                      placeholder="e.g. Android Developer, Full Stack Engineer"
                      value={customRole}
                      onChange={e => setCustomRole(e.target.value)}
                      required
                    />
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Interview Type</label>
                    <select
                      className="form-input"
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                    >
                      <option value="Technical">Technical Questions</option>
                      <option value="Behavioral">Behavioral / HR</option>
                      <option value="Mixed">Mixed (Tech & Behavioral)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Number of Questions</label>
                    <select
                      className="form-input"
                      value={numQuestions}
                      onChange={e => setNumQuestions(parseInt(e.target.value))}
                    >
                      <option value={3}>3 Questions (Quick)</option>
                      <option value={5}>5 Questions (Standard)</option>
                      <option value={8}>8 Questions (Thorough)</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: 8, padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-secondary)' }}>
                  <strong>💡 Tip:</strong> Make sure your microphone is connected and you are in a quiet room if you want to respond using your voice.
                </div>

                <button type="submit" className="btn btn-primary btn-lg" style={{ marginTop: 8 }}>
                  ⚡ Start Mock Interview
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: INTERVIEW HISTORY LIST */}
          {!apiLoading && activeTab === 'history' && (
            <div className="card" style={{ margin: 0 }}>
              <div className="card-title">📜 Completed Interview Sessions</div>
              <div className="card-subtitle">Review scores and feedback from past interviews</div>
              
              {historyLoading ? (
                <div className="loading-center" style={{ padding: 40 }}>
                  <div className="spinner" />
                </div>
              ) : history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--text-secondary)' }}>
                  No mock interviews found. Start one in the "New Interview" tab!
                </div>
              ) : (
                <div className="table-wrap" style={{ marginTop: 16 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Job Role</th>
                        <th>Category</th>
                        <th>Score</th>
                        <th>Completed Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map(item => (
                        <tr key={item.session_id}>
                          <td style={{ fontWeight: 600 }}>{item.role}</td>
                          <td>
                            <span className="badge badge-user">{item.category}</span>
                          </td>
                          <td>
                            <span className={`badge ${item.score >= 70 ? 'badge-success' : item.score >= 45 ? 'badge-warning' : 'badge-danger'}`} style={{ fontWeight: 700 }}>
                              {item.score}%
                            </span>
                          </td>
                          <td>{item.completed_at ? new Date(item.completed_at).toLocaleDateString() : '—'}</td>
                          <td>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => viewReport(item.session_id)}
                            >
                              👀 View Critique
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: IN-PROGRESS MOCK INTERVIEW CHAT */}
          {activeTab === 'interview' && (
            <div style={{ maxWidth: 800, margin: '0 auto' }}>
              <div className="card" style={{ paddingBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 20 }}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                      🎙️ {role === 'Custom' ? customRole : role} Interview
                    </h3>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      Type: <strong>{category}</strong>
                    </div>
                  </div>
                  <div className="badge badge-admin" style={{ fontSize: 13, padding: '6px 12px' }}>
                    Question {progress} of {totalQuestions}
                  </div>
                </div>

                {/* Interviewer Box */}
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 24 }}>
                  <div style={{ 
                    width: 44, 
                    height: 44, 
                    borderRadius: '50%', 
                    background: 'var(--gradient)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontSize: 20,
                    boxShadow: 'var(--shadow-glow)',
                    flexShrink: 0
                  }}>
                    🤖
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--indigo-400)' }}>AI Interviewer</span>
                      {isSpeaking && <span style={{ color: '#10b981', fontSize: 11, animation: 'pulse 1.5s infinite' }}>🔊 Speaking…</span>}
                    </div>
                    
                    <div style={{ 
                      background: 'rgba(255,255,255,0.03)', 
                      border: '1px solid var(--border)', 
                      padding: 16, 
                      borderRadius: '0 16px 16px 16px',
                      color: 'var(--text-primary)',
                      fontSize: 15,
                      lineHeight: '1.5'
                    }}>
                      {currentQuestion}
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button 
                        className={`btn btn-sm ${isSpeaking ? 'btn-danger' : 'btn-ghost'}`} 
                        onClick={() => isSpeaking ? stopSpeaking() : speakQuestion(currentQuestion)}
                      >
                        {isSpeaking ? '🛑 Stop Listening' : '🔊 Listen to Question'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Candidate Input Box */}
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                  <div style={{ 
                    width: 44, 
                    height: 44, 
                    borderRadius: '50%', 
                    background: 'rgba(255,255,255,0.05)', 
                    border: '1px solid var(--border)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontSize: 18,
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                    flexShrink: 0
                  }}>
                    {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Your Answer</span>
                      {isRecording && (
                        <span style={{ color: '#ef4444', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'pulse 1.2s infinite' }} />
                          Recording voice... Speak clearly
                        </span>
                      )}
                    </div>

                    <textarea
                      className="form-input"
                      placeholder={isRecording ? "Listening to your voice..." : "Type your technical details here, or use the microphone button below to talk..."}
                      value={userAnswer}
                      onChange={e => setUserAnswer(e.target.value)}
                      rows={6}
                      disabled={apiLoading}
                      id="candidate-answer-input"
                    />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                      <div className="flex gap-8">
                        <button
                          type="button"
                          className={`btn ${isRecording ? 'btn-danger' : 'btn-ghost'}`}
                          onClick={isRecording ? stopRecording : startRecording}
                          disabled={apiLoading}
                          style={{ minWidth: 160 }}
                        >
                          {isRecording ? '🛑 Stop Recording' : '🎙️ Record Answer'}
                        </button>
                        {userAnswer && (
                          <button 
                            type="button" 
                            className="btn btn-ghost" 
                            onClick={() => setUserAnswer('')} 
                            disabled={apiLoading}
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      <button
                        onClick={submitAnswer}
                        className="btn btn-primary"
                        disabled={apiLoading || !userAnswer.trim()}
                        id="submit-answer-btn"
                      >
                        {apiLoading ? <><span className="spinner" /> Evaluating…</> : 'Next Question ➡️'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DETAILED EVALUATION REPORT */}
          {activeTab === 'report' && report && (
            <div style={{ maxWidth: 850, margin: '0 auto' }} className="animate-fadeIn">
              
              {/* Score Header */}
              <div className="card" style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                <ScoreRing score={report.score} label="Overall Match" size={140} />
                <div style={{ flex: 1, minWidth: 280 }}>
                  <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
                    Interview Evaluation Completed!
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: '1.5' }}>
                    {report.feedback_summary}
                  </p>
                  
                  <button 
                    className="btn btn-ghost mt-16" 
                    onClick={() => setActiveTab('new')}
                    style={{ marginTop: 16 }}
                  >
                    ⬅️ Back to Mock Dashboard
                  </button>
                </div>
              </div>

              {/* Strengths & Weaknesses */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
                
                <div className="card" style={{ margin: 0 }}>
                  <div className="card-title" style={{ color: '#10b981' }}>🟢 Key Strengths</div>
                  <ul style={{ listStyleType: 'disc', paddingLeft: 20, marginTop: 12, fontSize: 14, color: 'var(--text-secondary)' }}>
                    {report.strengths?.map((str, i) => (
                      <li key={i} style={{ marginBottom: 8 }}>{str}</li>
                    ))}
                    {(!report.strengths || report.strengths.length === 0) && (
                      <li style={{ color: 'var(--text-muted)' }}>No major strengths documented.</li>
                    )}
                  </ul>
                </div>

                <div className="card" style={{ margin: 0 }}>
                  <div className="card-title" style={{ color: '#f59e0b' }}>🟠 Areas for Improvement</div>
                  <ul style={{ listStyleType: 'disc', paddingLeft: 20, marginTop: 12, fontSize: 14, color: 'var(--text-secondary)' }}>
                    {report.weaknesses?.map((weak, i) => (
                      <li key={i} style={{ marginBottom: 8 }}>{weak}</li>
                    ))}
                    {(!report.weaknesses || report.weaknesses.length === 0) && (
                      <li style={{ color: 'var(--text-muted)' }}>Perfect assessment, no weaknesses noted!</li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Question Breakdown */}
              <div className="card" style={{ margin: 0 }}>
                <div className="card-title" style={{ marginBottom: 16 }}>💬 Question-by-Question Breakdown</div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {report.question_breakdown?.map((item, index) => {
                    const isOpen = openCritiqueId === index
                    const scoreColor = item.score >= 75 ? '#10b981' : item.score >= 45 ? '#f59e0b' : '#ef4444'
                    
                    return (
                      <div key={index} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                        
                        <div 
                          onClick={() => setOpenCritiqueId(isOpen ? null : index)}
                          style={{ 
                            background: 'rgba(255,255,255,0.02)', 
                            padding: '16px', 
                            cursor: 'pointer', 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 12
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 260 }}>
                            <strong style={{ color: 'var(--indigo-400)', fontSize: 13, display: 'block', marginBottom: 4 }}>
                              QUESTION {index + 1}
                            </strong>
                            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                              {item.question}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <span style={{ color: scoreColor, fontWeight: 700, fontSize: 15 }}>
                              {item.score}%
                            </span>
                            <span style={{ fontSize: 16, color: 'var(--text-muted)' }}>
                              {isOpen ? '⌃' : '⌄'}
                            </span>
                          </div>
                        </div>

                        {isOpen && (
                          <div style={{ padding: 16, background: 'rgba(0,0,0,0.15)', borderTop: '1px solid var(--border)' }} className="animate-fadeIn">
                            <div style={{ marginBottom: 12 }}>
                              <strong style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                                Your Answer:
                              </strong>
                              <p style={{ fontSize: 13, color: 'var(--text-primary)', fontStyle: 'italic', background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 6 }}>
                                "{item.answer || '—'}"
                              </p>
                            </div>
                            
                            <div>
                              <strong style={{ fontSize: 12, color: '#f59e0b', display: 'block', marginBottom: 4 }}>
                                AI Critique & Recommendations:
                              </strong>
                              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                {item.critique}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
