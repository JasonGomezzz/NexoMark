import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import EmailChangeConfirmPage from './pages/EmailChangeConfirmPage'
import DashboardPage from './pages/DashboardPage'
import ClientDashboardPage from './pages/ClientDashboardPage'
import ClientReviewPage from './pages/ClientReviewPage'
import ClientCampaignsPage from './pages/ClientCampaignsPage'
import ClientHelpPage from './pages/ClientHelpPage'
import CampaignListPage from './pages/CampaignListPage'
import NewCampaignPage from './pages/NewCampaignPage'
import CampaignDetailPage from './pages/CampaignDetailPage'
import AnalyticsPage from './pages/AnalyticsPage'
import PublicationsStatsPage from './pages/PublicationsStatsPage'
import UsersAdminPage from './pages/UsersAdminPage'
import AccountSettingsPage from './pages/AccountSettingsPage'
import PromptGuidePage from './pages/PromptGuidePage'
import CreditsDetailPage from './pages/CreditsDetailPage'
import MetaRetornoPage from './pages/MetaRetornoPage'
import XRetornoPage from './pages/XRetornoPage'
import PrivateRoute from './components/PrivateRoute'
import RoleRoute from './components/RoleRoute'
import AppLayout from './components/AppLayout'
import { useVerifiedUser } from './hooks/useVerifiedUser'

/**
 * Ruta /dashboard según rol: el cliente ve su dashboard (Spring Boot :8080),
 * marketero/superadmin ven el suyo (Django). Cada uno es un componente propio,
 * así sus hooks viven aislados (sin violar las reglas de hooks de React).
 */
function DashboardRouter() {
  const role = useVerifiedUser()?.rol
  return role === 'cliente' ? <ClientDashboardPage /> : <DashboardPage />
}

function PromptGuideRouter() {
  const role = useVerifiedUser()?.rol
  return role === 'cliente' ? <Navigate to="/client-help" replace /> : <PromptGuidePage />
}

const STAFF = ['marketero', 'superadmin']

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/confirm-email-change" element={<EmailChangeConfirmPage />} />

          <Route element={<PrivateRoute />}>
            <Route element={<AppLayout />}>
              {/* Los tres roles */}
              <Route path="/dashboard" element={<DashboardRouter />} />
              <Route path="/stats" element={<PublicationsStatsPage />} />
              <Route path="/settings" element={<AccountSettingsPage />} />
              <Route path="/prompt-guide" element={<PromptGuideRouter />} />
              <Route path="/redes/meta-retorno" element={<MetaRetornoPage />} />
              <Route path="/redes/x-retorno" element={<XRetornoPage />} />

              <Route element={<RoleRoute roles={STAFF} />}>
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
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </MotionConfig>
  )
}
