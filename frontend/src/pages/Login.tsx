import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Eye, EyeOff, Lock, User, Briefcase, FolderHeart, ShieldCheck, Bot, Globe, ArrowLeft, Video } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useConfigStore } from '../store/configStore';
import { canAccess, type NavRoute } from '../config/privileges';
import { useT } from '../i18n';

// Services proposés à la connexion → route correspondante (restriction selon le rôle)
const SERVICES: { key: string; tkey: string; route: NavRoute }[] = [
  { key: 'externes', tkey: 'svc.consult_ext', route: '/consultations' },
  { key: 'internes', tkey: 'svc.consult_int', route: '/hospitalisation' },
];

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { t, lang, setLang } = useT();
  const { nomStructure, logo } = useConfigStore();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [matricule, setMatricule] = useState('');
  const [password, setPassword] = useState('');
  const [service, setService] = useState('externes');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matricule || !password) { toast.error(t('login.fill_all')); return; }
    setLoading(true);
    try {
      const res = await authApi.login(matricule, password);
      const user = res.data.user;
      setAuth(res.data.access_token, user, service);
      toast.success(`${t('login.welcome')}, ${user.prenom} !`);
      // Restriction selon le rôle : si le service choisi est autorisé, on y va, sinon dashboard
      const svc = SERVICES.find((s) => s.key === service);
      if (svc && svc.route !== '/dashboard') {
        if (canAccess(user.role, svc.route)) {
          navigate(svc.route);
        } else {
          toast(t('login.no_service_access'), { icon: '🔒' });
          navigate('/dashboard');
        }
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('login.bad_creds'));
    } finally {
      setLoading(false);
    }
  };

  const LangToggle = (
    <div className="flex items-center gap-1 bg-white/15 backdrop-blur rounded-full p-0.5 text-xs">
      {(['fr', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${lang === l ? 'bg-white text-primary-700' : 'text-white/80 hover:text-white'}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50">
      {/* ─── Panneau gauche : marque & structure ─── */}
      <div className="relative lg:w-1/2 bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-700 text-white px-8 py-10 lg:px-14 lg:py-0 flex flex-col justify-center overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute -top-10 -left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent-400 rounded-full blur-3xl" />
        </div>
        {/* Flèche retour vers la page principale (configuration) */}
        <button
          type="button"
          onClick={() => navigate('/setup')}
          title={t('login.back_home')}
          className="absolute top-6 left-8 z-10 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur flex items-center justify-center transition-colors"
        >
          <ArrowLeft size={18} />
        </button>

        {/* Toggle langue (desktop) */}
        <div className="hidden lg:block absolute top-6 right-8 z-10">{LangToggle}</div>

        <div className="relative max-w-md mx-auto text-center flex flex-col items-center">
          <div className="w-24 h-24 bg-white/20 backdrop-blur rounded-3xl flex items-center justify-center shadow-lg mb-4 overflow-hidden">
            {logo ? (
              <img src={logo} alt="logo" className="w-full h-full object-contain p-1" />
            ) : (
              <Activity size={44} className="text-white" />
            )}
          </div>
          <h1 className="text-3xl font-bold leading-tight">{nomStructure}</h1>
          <p className="text-white/80 text-sm mb-5">{t('app.type')}</p>

          <div className="inline-flex items-center gap-1.5 bg-accent-400/30 px-3 py-1 rounded-full mb-7">
            <span className="w-2 h-2 bg-accent-300 rounded-full animate-pulse" />
            <span className="text-white/90 text-xs font-medium">{t('app.slogan')}</span>
          </div>

          <h2 className="text-xl lg:text-2xl font-bold mb-3">{t('login.left_title')}</h2>
          <p className="text-white/80 text-sm leading-relaxed mb-8 max-w-sm">{t('login.left_desc')}</p>

          <ul className="space-y-3 w-full max-w-xs">
            {[
              { icon: FolderHeart, key: 'login.feat_dossier' },
              { icon: ShieldCheck, key: 'login.feat_secure' },
              { icon: Bot, key: 'login.feat_offline' },
              { icon: Video, key: 'login.feat_tele' },
            ].map(({ icon: Icon, key }) => (
              <li key={key} className="flex items-center gap-3 text-sm text-white/90 bg-white/10 rounded-xl px-4 py-2.5">
                <span className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                  <Icon size={16} />
                </span>
                <span className="text-left">{t(key)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ─── Panneau droit : connexion ─── */}
      <div className="lg:w-1/2 flex items-center justify-center px-6 py-10 sm:px-10 relative overflow-hidden bg-slate-50">
        {/* Filigrane stéthoscope (SVG, hors-ligne) */}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 text-primary-300/70 pointer-events-none select-none" aria-hidden="true">
          <path d="M4.8 2.3A.3.3 0 1 0 5 2a.3.3 0 0 0-.2.3" />
          <path d="M8 2H6a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-2" />
          <path d="M11 15v2a6 6 0 0 0 12 0v-4" />
          <circle cx="20" cy="10" r="2" />
        </svg>

        {/* Toggle langue (mobile) */}
        <div className="lg:hidden absolute top-5 right-5 z-20">
          <div className="flex items-center gap-1 bg-slate-100 rounded-full p-0.5 text-xs">
            {(['fr', 'en'] as const).map((l) => (
              <button key={l} type="button" onClick={() => setLang(l)}
                className={`px-2.5 py-1 rounded-full font-semibold flex items-center gap-1 ${lang === l ? 'bg-primary-600 text-white' : 'text-slate-500'}`}>
                {l === 'fr' && <Globe size={11} />}{l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="relative z-10 w-full max-w-lg bg-white/75 backdrop-blur-md rounded-3xl shadow-xl shadow-slate-200/60 border border-white/60 p-7 sm:p-10">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-1">{t('login.title')}</h2>
            <p className="text-slate-500 text-sm">{nomStructure} — {t('app.type')}</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="label">{t('login.matricule')}</label>
              <div className="relative">
                <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="input pl-11 py-3 text-base" placeholder="Ex: MED001" value={matricule}
                  onChange={(e) => setMatricule(e.target.value.toUpperCase())} autoComplete="username" />
              </div>
            </div>

            <div>
              <label className="label">{t('login.password')}</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="input pl-11 pr-11 py-3 text-base" type={showPwd ? 'text' : 'password'} placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="label">{t('login.service')}</label>
              <div className="relative">
                <Briefcase size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <select className="input pl-11 py-3 text-base" value={service} onChange={(e) => setService(e.target.value)}>
                  {SERVICES.map((s) => <option key={s.key} value={s.key}>{t(s.tkey)}</option>)}
                </select>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 text-base mt-2">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                    <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  {t('login.connecting')}
                </span>
              ) : t('login.submit')}
            </button>
          </form>

          <div className="mt-4 text-center">
            <span className="text-sm text-slate-500">{t('login.no_account')} </span>
            <button type="button" onClick={() => navigate('/register')}
              className="text-sm font-semibold text-primary-600 hover:text-primary-700 hover:underline">
              {t('login.create_account')}
            </button>
          </div>

          {/* Comptes démo */}
          <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">{t('login.demo')}</p>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {[
                ['SUPER001', 'Super2024!', 'Superadmin'],
                ['ADMIN001', 'Admin2024!', 'Admin'],
                ['MED001', 'Med2024!', 'Médecin'],
                ['PHM001', 'Phm2024!', 'Pharmacie'],
              ].map(([m, p, r]) => (
                <button key={m} type="button" onClick={() => { setMatricule(m); setPassword(p); }}
                  className="flex flex-col items-start p-2 bg-white rounded-lg border border-slate-200 hover:border-primary-300 hover:bg-primary-50 transition-colors text-left">
                  <span className="font-semibold text-primary-600">{r}</span>
                  <span className="text-slate-400">{m}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="text-center text-slate-400 text-xs mt-6">{t('app.norm')}</p>
        </div>
      </div>
    </div>
  );
};
