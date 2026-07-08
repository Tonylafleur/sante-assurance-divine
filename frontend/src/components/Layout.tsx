import React, { useState } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Users, Stethoscope, FlaskConical,
  Pill, Receipt, BedDouble, Syringe, Baby, Bot,
  LogOut, Bell, Menu, X, Activity, Lock, UserCog, ScrollText, Video
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { canAccess, isHidden, ROLE_LABELS, ACCESS_DENIED_REASON, type NavRoute, type Role } from '../config/privileges';
import { useT } from '../i18n';

const NAV_ITEMS: { to: NavRoute; icon: React.ElementType; tkey: string }[] = [
  { to: '/dashboard', icon: LayoutDashboard, tkey: 'nav.dashboard' },
  { to: '/patients', icon: Users, tkey: 'nav.patients' },
  { to: '/consultations', icon: Stethoscope, tkey: 'nav.consultations' },
  { to: '/laboratoire', icon: FlaskConical, tkey: 'nav.laboratoire' },
  { to: '/pharmacie', icon: Pill, tkey: 'nav.pharmacie' },
  { to: '/caisse', icon: Receipt, tkey: 'nav.caisse' },
  { to: '/hospitalisation', icon: BedDouble, tkey: 'nav.hospitalisation' },
  { to: '/vaccination', icon: Syringe, tkey: 'nav.vaccination' },
  { to: '/cpn', icon: Baby, tkey: 'nav.cpn' },
  { to: '/teleconsultation', icon: Video, tkey: 'nav.teleconsultation' },
  { to: '/assistant', icon: Bot, tkey: 'nav.assistant' },
  { to: '/comptes', icon: UserCog, tkey: 'nav.comptes' },
  { to: '/journal', icon: ScrollText, tkey: 'nav.journal' },
];

export const Layout: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { t, lang, setLang } = useT();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notifOpen, setNotifOpen] = useState(false);
  const { notifications, markAllRead, unreadCount } = useNotificationStore();
  const unread = unreadCount();

  // Connecter le WebSocket selon le rôle
  useWebSocket(user?.role === 'pharmacien' ? 'pharmacie' : user?.role === 'caissier' ? 'caisse' : user?.role === 'laborantin' ? 'laboratoire' : 'notifications');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-white border-r border-slate-200 flex flex-col transition-all duration-300 shadow-sm flex-shrink-0`}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-100">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
            <Activity size={20} className="text-white" />
          </div>
          {sidebarOpen && (
            <div className="min-w-0">
              <p className="text-sm font-bold text-primary-700 leading-tight truncate">Assurance Divine</p>
              <p className="text-xs text-slate-500 truncate">Centre de Santé</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ to, icon: Icon, tkey }) => {
            // Routes confidentielles : entièrement masquées si non autorisées
            if (isHidden(user?.role, to)) return null;
            const label = t(tkey);
            const allowed = canAccess(user?.role, to);
            const reason = !allowed
              ? (ACCESS_DENIED_REASON[user?.role as Role]?.[to] ?? 'Accès non autorisé pour votre rôle')
              : undefined;

            if (!allowed) {
              return (
                <div
                  key={to}
                  className={`sidebar-link opacity-35 cursor-not-allowed select-none ${!sidebarOpen ? 'justify-center px-2' : ''}`}
                  title={sidebarOpen ? reason : `${label} — ${reason}`}
                >
                  <Icon size={18} className="flex-shrink-0" />
                  {sidebarOpen && (
                    <>
                      <span className="truncate flex-1">{label}</span>
                      <Lock size={11} className="flex-shrink-0 text-slate-400" />
                    </>
                  )}
                </div>
              );
            }

            return (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'active' : ''} ${!sidebarOpen ? 'justify-center px-2' : ''}`
                }
                title={!sidebarOpen ? label : undefined}
              >
                <Icon size={18} className="flex-shrink-0" />
                {sidebarOpen && <span className="truncate">{label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-slate-100 p-3">
          {sidebarOpen && (
            <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-primary-700 font-semibold text-xs">
                  {user?.prenom?.[0]}{user?.nom?.[0]}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{user?.prenom} {user?.nom}</p>
                <p className="text-xs text-slate-500 truncate">{ROLE_LABELS[user?.role as Role] ?? user?.role}</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`sidebar-link w-full text-red-500 hover:bg-red-50 hover:text-red-600 ${!sidebarOpen ? 'justify-center px-2' : ''}`}
            title={!sidebarOpen ? 'Déconnexion' : undefined}
          >
            <LogOut size={18} className="flex-shrink-0" />
            {sidebarOpen && <span>{t('nav.logout')}</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <div className="flex items-center gap-2">
            {/* Sélecteur de langue */}
            <div className="flex items-center gap-0.5 bg-slate-100 rounded-full p-0.5 text-xs">
              {(['fr', 'en'] as const).map((l) => (
                <button key={l} onClick={() => setLang(l)}
                  className={`px-2 py-1 rounded-full font-semibold transition-colors ${lang === l ? 'bg-primary-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => { setNotifOpen(!notifOpen); if (!notifOpen) markAllRead(); }}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors relative"
              >
                <Bell size={18} />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-xl border border-slate-100 z-50 fade-in">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="font-semibold text-slate-800 text-sm">Notifications</span>
                    <button onClick={() => setNotifOpen(false)} className="text-slate-400 hover:text-slate-600">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-center text-slate-400 text-sm py-8">Aucune notification</p>
                    ) : notifications.slice(0, 10).map(n => (
                      <div key={n.id} className={`px-4 py-3 border-b border-slate-50 hover:bg-slate-50 ${!n.read ? 'bg-primary-50/50' : ''}`}>
                        <p className="text-sm font-medium text-slate-800">{n.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-xs text-slate-400 mt-1">{new Date(n.timestamp).toLocaleTimeString('fr-FR')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="h-8 w-8 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-xs">{user?.prenom?.[0]}{user?.nom?.[0]}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
