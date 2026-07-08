import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Eye, EyeOff, Lock, User, ArrowLeft, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '../services/api';
import { ROLES_INSCRIPTION, ROLE_LABELS, type Role } from '../config/privileges';
import { useT } from '../i18n';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useT();
  const [form, setForm] = useState({
    matricule: '', nom: '', prenom: '', email: '', telephone: '',
    role: 'medecin' as Role, service: '', password: '', confirm: '',
  });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.matricule || !form.nom || !form.prenom || !form.password) {
      toast.error(t('ts.fill_required'));
      return;
    }
    if (form.password.length < 6) { toast.error(t('ts.pwd_short')); return; }
    if (form.password !== form.confirm) { toast.error(t('ts.pwd_mismatch')); return; }
    setLoading(true);
    try {
      const { confirm, ...payload } = form;
      const res = await authApi.register(payload);
      toast.success(res.data.message || 'Compte créé', { duration: 6000 });
      navigate('/login');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('ts.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-700 flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent-400 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-primary-500 to-secondary-500 px-8 py-8 text-center">
            <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
              <Activity size={30} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">{t('reg.title')}</h1>
            <p className="text-white/80 text-xs mt-1">{t('app.name')} — {t('app.type')}</p>
          </div>

          <div className="px-8 py-6">
            {/* Avertissement validation */}
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl mb-5">
              <ShieldCheck size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">{t('reg.warn')}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('reg.nom')} *</label>
                  <input className="input" value={form.nom} onChange={(e) => set('nom', e.target.value)} />
                </div>
                <div>
                  <label className="label">{t('reg.prenom')} *</label>
                  <input className="input" value={form.prenom} onChange={(e) => set('prenom', e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('login.matricule')} *</label>
                  <div className="relative">
                    <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input className="input pl-9" placeholder="Ex: MED012" value={form.matricule}
                      onChange={(e) => set('matricule', e.target.value.toUpperCase())} />
                  </div>
                </div>
                <div>
                  <label className="label">{t('reg.role')} *</label>
                  <select className="input" value={form.role} onChange={(e) => set('role', e.target.value)}>
                    {ROLES_INSCRIPTION.map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('reg.email')}</label>
                  <input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
                </div>
                <div>
                  <label className="label">{t('reg.phone')}</label>
                  <input className="input" value={form.telephone} onChange={(e) => set('telephone', e.target.value)} />
                </div>
              </div>

              <div>
                <label className="label">{t('reg.service')}</label>
                <input className="input" value={form.service}
                  onChange={(e) => set('service', e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('login.password')} *</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input className="input pl-9 pr-9" type={showPwd ? 'text' : 'password'}
                      value={form.password} onChange={(e) => set('password', e.target.value)} />
                    <button type="button" onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="label">{t('reg.confirm')} *</label>
                  <input className="input" type={showPwd ? 'text' : 'password'}
                    value={form.confirm} onChange={(e) => set('confirm', e.target.value)} />
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base mt-2">
                {loading ? t('c.saving') : t('reg.submit')}
              </button>
            </form>

            <button onClick={() => navigate('/login')}
              className="mt-4 w-full flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-primary-600">
              <ArrowLeft size={15} /> {t('reg.back')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
