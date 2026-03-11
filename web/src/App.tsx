import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { useAuth } from '@/hooks/useAuth'
import { Spinner } from '@/components/ui/Spinner'

// Auth pages
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'

// App pages
import DashboardPage from '@/pages/DashboardPage'
import MedicationsPage from '@/pages/MedicationsPage'
import CalendarPage from '@/pages/CalendarPage'
import TasksPage from '@/pages/TasksPage'
import FamilyDashboardPage from '@/pages/FamilyDashboardPage'
import ProfilePage from '@/pages/ProfilePage'

// Layout
import AppLayout from '@/components/layout/AppLayout'

function AppRoutes() {
  const { session, loading, role } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/medications" element={<MedicationsPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/tasks" element={
          role === 'elder' || role === 'family'
            ? <Navigate to="/dashboard" replace />
            : <TasksPage />
        } />
        <Route path="/family" element={
          role === 'family'
            ? <FamilyDashboardPage />
            : <Navigate to="/dashboard" replace />
        } />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/login" element={<Navigate to="/dashboard" replace />} />
        <Route path="/register" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppLayout>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
