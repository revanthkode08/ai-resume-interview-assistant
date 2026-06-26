import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useEffect } from 'react'

const FEATURES = [
  {
    icon: '📄',
    title: 'Smart Resume Parsing',
    desc: 'Upload PDF, DOCX or TXT. Our engine extracts clean text instantly, ready for deep analysis.',
    delay: '0.1s',
  },
  {
    icon: '🎯',
    title: 'ATS Score Analysis',
    desc: 'Combines semantic similarity + keyword matching to give you an accurate ATS compatibility score.',
    delay: '0.2s',
  },
  {
    icon: '🧠',
    title: 'Skill Gap Detection',
    desc: 'See exactly which skills the job requires that your resume is missing — and which you already ace.',
    delay: '0.3s',
  },
  {
    icon: '💬',
    title: 'AI Interview Questions',
    desc: 'Groq + LLaMA 3.3 generates tailored technical, behavioral, and resume-specific questions in seconds.',
    delay: '0.4s',
  },
  {
    icon: '📊',
    title: 'Personal Dashboard',
    desc: 'Track all your past analyses in one place. Review scores, skills, and questions anytime.',
    delay: '0.5s',
  },
  {
    icon: '🔐',
    title: 'Secure & Private',
    desc: 'JWT authentication keeps your data safe. Your resume and analysis history are tied only to you.',
    delay: '0.6s',
  },
]

export default function LandingPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate(user.role === 'admin' ? '/admin' : '/dashboard', { replace: true })
  }, [user, navigate])

  return (
    <div className="landing">
      <div className="bg-mesh" />

      {/* Navbar */}
      <nav className="landing-nav">
        <div className="sidebar-logo-mark">
          <div className="logo-icon">🎯</div>
          <span className="logo-text">ResumeAI</span>
        </div>
        <div className="flex gap-8">
          <Link to="/auth" className="btn btn-ghost btn-sm">Sign in</Link>
          <Link to="/auth?tab=register" className="btn btn-primary btn-sm">Get Started →</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="hero-eyebrow">
          ✨ Powered by Groq · LLaMA 3.3 · AI-native
        </div>
        <h1 className="hero-title">
          Land Your Dream Job with{' '}
          <span className="hero-gradient-text">AI-Powered</span> Resume Intelligence
        </h1>
        <p className="hero-subtitle">
          Upload your resume, paste any job description, and get your ATS score,
          skill gap analysis, and tailored interview questions — all in under 30 seconds.
        </p>
        <div className="hero-actions">
          <Link to="/auth?tab=register" className="btn btn-primary btn-lg">
            🚀 Start for Free
          </Link>
          <Link to="/auth" className="btn btn-ghost btn-lg">
            Sign In
          </Link>
        </div>
      </section>

      {/* Features */}
      <section style={{ background: 'rgba(255,255,255,0.015)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ padding: '16px 40px 8px', maxWidth: 1100, margin: '0 auto' }}>
          <div className="text-center mt-8">
            <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>
              Everything you need to <span className="hero-gradient-text">ace the interview</span>
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 15, marginBottom: 0 }}>
              A complete AI career toolkit, built for serious job seekers.
            </p>
          </div>
        </div>
        <div className="features-grid">
          {FEATURES.map((f, i) => (
            <div className="feature-card" key={i} style={{ animationDelay: f.delay }}>
              <span className="feature-icon">{f.icon}</span>
              <div className="feature-title">{f.title}</div>
              <div className="feature-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA footer */}
      <section style={{ padding: '60px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 30, fontWeight: 800, marginBottom: 12, letterSpacing: '-0.03em' }}>
          Ready to get started?
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 28 }}>
          Create your free account and run your first analysis in minutes.
        </p>
        <Link to="/auth?tab=register" className="btn btn-primary btn-lg">
          Create Free Account →
        </Link>
        <p style={{ marginTop: 20, fontSize: 13, color: 'var(--text-muted)' }}>
          No credit card required. Forever free for individuals.
        </p>
      </section>
    </div>
  )
}
