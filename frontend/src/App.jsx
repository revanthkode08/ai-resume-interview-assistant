import { Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import AdminDashboard from './pages/AdminDashboard'
import ProtectedRoute from './components/ProtectedRoute'
import MockInterview from './pages/MockInterview'
import JobsRecommendation from './pages/JobsRecommendation'
import LeetCodeTracker from './pages/LeetCodeTracker'

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthPage />} />

      {/* Protected — any logged-in user */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/dashboard/history" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/dashboard/interview" element={
        <ProtectedRoute>
          <MockInterview />
        </ProtectedRoute>
      } />
      <Route path="/dashboard/jobs" element={
        <ProtectedRoute>
          <JobsRecommendation />
        </ProtectedRoute>
      } />
      <Route path="/dashboard/leetcode" element={
        <ProtectedRoute>
          <LeetCodeTracker />
        </ProtectedRoute>
      } />

      {/* Protected — admin only */}
      <Route path="/admin/*" element={
        <ProtectedRoute adminOnly>
          <AdminDashboard />
        </ProtectedRoute>
      } />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
