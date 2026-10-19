import { getAuthItem } from '@/lib/authStorage'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import PasswordRecoveryPage from './pages/PasswordRecoveryPage'
import EmailChangeConfirmPage from './pages/EmailChangeConfirmPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import ClientDashboardPage from './pages/ClientDashboardPage'
import ClientReviewPage from './pages/ClientReviewPage'
import ClientCampaignsPage from './pages/ClientCampaignsPage'
import ClientHelpPage from './pages/ClientHelpPage'
import CampaignListPage from './pages/CampaignListPage'
import NewCampaignPage from './pages/NewCampaignPage'
import CampaignDetailPage from './pages/CampaignDetailPage'
import AnalyticsPage from './pages/AnalyticsPage'
import UsersAdminPage from './pages/UsersAdminPage'
import AccountSettingsPage from './pages/AccountSettingsPage'
import PromptGuidePage from './pages/PromptGuidePage'
import CreditsDetailPage from './pages/CreditsDetailPage'
import PrivateRoute from './components/PrivateRoute'
import RoleRoute from './components/RoleRoute'
import AppLayout from './components/AppLayout'

/**
 * Ruta /dashboard según rol: el cliente ve su dashboard (Spring Boot :8080),
 * marketero/superadmin ven el suyo (Django). Cada uno es un componente propio,
 * así sus hooks viven aislados (sin violar las reglas de hooks de React).
 */
function DashboardRouter() {
  const role = getAuthItem('user_role') || ''
  return role === 'cliente' ? <ClientDashboardPage /> : <DashboardPage />
}

function PromptGuideRouter() {
  const role = getAuthItem('user_role') || ''
  return role === 'cliente' ? <Navigate to="/client-help" replace /> : <PromptGuidePage />
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<PasswordRecoveryPage key="request" />} />
          <Route path="/reset-password" element={<PasswordRecoveryPage key="confirm" />} />
          <Route path="/confirm-email-change" element={<EmailChangeConfirmPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route element={<PrivateRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardRouter />} />
              <Route element={<RoleRoute roles={['marketero', 'superadmin']} />}>
              <Route path="/campaigns" element={<CampaignListPage />} />
              <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
              <Route path="/credits" element={<CreditsDetailPage />} />
              </Route>
              <Route element={<RoleRoute roles={['marketero']} />}>
              <Route path="/campaigns/new" element={<NewCampaignPage />} />
              </Route>
              <Route element={<RoleRoute roles={['cliente']} />}>
              <Route path="/review/:id" element={<ClientReviewPage />} />
              <Route path="/client-campaigns" element={<ClientCampaignsPage />} />
              <Route path="/client-help" element={<ClientHelpPage />} />
              </Route>
              <Route element={<RoleRoute roles={['superadmin']} />}>
              <Route path="/admin" element={<UsersAdminPage />} />
              <Route path="/admin/analytics" element={<AnalyticsPage />} />
              </Route>
              <Route path="/settings" element={<AccountSettingsPage />} />
              <Route path="/prompt-guide" element={<PromptGuideRouter />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </MotionConfig>
  )
}
