import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Setup } from './pages/Setup';
import { Register } from './pages/Register';
import { Comptes } from './pages/Comptes';
import { Journal } from './pages/Journal';
import { Dashboard } from './pages/Dashboard';
import { Patients } from './pages/Patients';
import { Consultations } from './pages/Consultations';
import { Pharmacie } from './pages/Pharmacie';
import { Caisse } from './pages/Caisse';
import { AssistantIA } from './pages/AssistantIA';
import { ConsultationDetail } from './pages/ConsultationDetail';
import { PatientDetail } from './pages/PatientDetail';
import { Laboratoire } from './pages/Laboratoire';
import { Hospitalisation } from './pages/Hospitalisation';
import { Vaccination } from './pages/Vaccination';
import { CPN } from './pages/CPN';
import { Teleconsultation } from './pages/Teleconsultation';
import { RoomTele } from './pages/RoomTele';
import { Salle } from './pages/Salle';
import { useAuthStore } from './store/authStore';
import { useConfigStore } from './store/configStore';
import { canAccess, type NavRoute } from './config/privileges';
import { LanguageProvider } from './i18n';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

/** Affiche la connexion seulement si la structure est configurée, sinon redirige vers /setup */
const LoginGate: React.FC = () => {
  const configured = useConfigStore((s) => s.configured);
  return configured ? <Login /> : <Navigate to="/setup" replace />;
};

/** Bloque l'accès direct à une route protégée (ex: taper /caisse dans la barre) */
const GuardedRoute: React.FC<{ route: NavRoute; children: React.ReactNode }> = ({ route, children }) => {
  const user = useAuthStore((s) => s.user);
  if (!canAccess(user?.role, route)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

function App() {
  return (
    <LanguageProvider>
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { background: '#1e293b', color: '#f1f5f9', borderRadius: '12px', fontSize: '14px' },
          success: { style: { background: '#00897B', color: '#fff' } },
          error: { style: { background: '#e53935', color: '#fff' } },
        }}
      />
      <Routes>
        <Route path="/setup" element={<Setup />} />
        <Route path="/salle/:token" element={<Salle />} />
        <Route path="/login" element={<LoginGate />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="patients" element={<GuardedRoute route="/patients"><Patients /></GuardedRoute>} />
          <Route path="patients/:id" element={<GuardedRoute route="/patients"><PatientDetail /></GuardedRoute>} />
          <Route path="consultations" element={<GuardedRoute route="/consultations"><Consultations /></GuardedRoute>} />
          <Route path="consultations/:id" element={<GuardedRoute route="/consultations"><ConsultationDetail /></GuardedRoute>} />
          <Route path="pharmacie" element={<GuardedRoute route="/pharmacie"><Pharmacie /></GuardedRoute>} />
          <Route path="caisse" element={<GuardedRoute route="/caisse"><Caisse /></GuardedRoute>} />
          <Route path="assistant" element={<GuardedRoute route="/assistant"><AssistantIA /></GuardedRoute>} />
          <Route path="comptes" element={<GuardedRoute route="/comptes"><Comptes /></GuardedRoute>} />
          <Route path="journal" element={<GuardedRoute route="/journal"><Journal /></GuardedRoute>} />
          <Route path="laboratoire" element={<GuardedRoute route="/laboratoire"><Laboratoire /></GuardedRoute>} />
          <Route path="hospitalisation" element={<GuardedRoute route="/hospitalisation"><Hospitalisation /></GuardedRoute>} />
          <Route path="vaccination" element={<GuardedRoute route="/vaccination"><Vaccination /></GuardedRoute>} />
          <Route path="cpn" element={<GuardedRoute route="/cpn"><CPN /></GuardedRoute>} />
          <Route path="teleconsultation" element={<GuardedRoute route="/teleconsultation"><Teleconsultation /></GuardedRoute>} />
          <Route path="teleconsultation/:id/salle" element={<GuardedRoute route="/teleconsultation"><RoomTele /></GuardedRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </LanguageProvider>
  );
}

export default App;
