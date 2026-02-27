import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LandingPage from './components/landing/LandingPage';
import Login from './components/auth/Login';
import Layout from './components/layout/Layout';
import Dashboard from './components/dashboard/Dashboard';
import WhatsappSessionV2 from './components/whatsapp/WhatsappSessionV2'; // ✅ CAMBIO
import LeadsManager from './components/leads/LeadsManager';
import ListenerControl from './components/listener/ListenerControl';
import AdminSessions from './components/admin/AdminSessions';
import CampaignsManager from './components/campaigns/CampaignsManager';
import ConfigPanel from './components/config/ConfigPanel';
import GestionDestinatariosPage from './components/destinatarios/GestionDestinatariosPage';

// Componente para manejar redirección si ya está autenticado
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  }
  
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
};

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Routes>
          {/* Ruta pública de landing */}
          <Route 
            path="/" 
            element={
              <PublicRoute>
                <LandingPage />
              </PublicRoute>
            } 
          />
          
          {/* Ruta pública de login */}
          <Route 
            path="/login" 
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            } 
          />
          
          {/* Rutas protegidas */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/whatsapp"
            element={
              <ProtectedRoute>
                <Layout>
                  <WhatsappSessionV2 /> {/* ✅ CAMBIO */}
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/leads"
            element={
              <ProtectedRoute>
                <Layout>
                  <LeadsManager />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/listener"
            element={
              <ProtectedRoute>
                <Layout>
                  <ListenerControl />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/sessions"
            element={
              <ProtectedRoute>
                <Layout>
                  <AdminSessions />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/campaigns"
            element={
              <ProtectedRoute>
                <Layout>
                  <CampaignsManager />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/config"
            element={
              <ProtectedRoute>
                <Layout>
                  <ConfigPanel />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/prospectos"
            element={
              <ProtectedRoute>
                <Layout>
                  <GestionDestinatariosPage />
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;