import React, { useEffect, useState } from 'react';
import { Users, Stethoscope, AlertTriangle, BedDouble, TrendingUp, Clock, Pill } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { dashboardApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useT } from '../i18n';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';

interface Stats {
  date: string;
  patients_jour: number;
  consultations_jour: number;
  consultations_en_attente: number;
  alertes_stock_medicaments: number;
  recette_jour_fcfa: number;
  lits_disponibles: number;
  total_patients: number;
}

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string; alert?: boolean }> = ({ icon, label, value, sub, color, alert }) => (
  <div className={`card flex items-center gap-4 ${alert ? 'border-l-4 border-red-400' : ''}`}>
    <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center flex-shrink-0`}>
      {icon}
    </div>
    <div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

export const Dashboard: React.FC = () => {
  const { user } = useAuthStore();
  const { t, lang } = useT();
  const dfns = lang === 'en' ? enUS : fr;
  const [stats, setStats] = useState<Stats | null>(null);
  const [parService, setParService] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, ps] = await Promise.all([dashboardApi.stats(), dashboardApi.parService()]);
        setStats(s.data);
        setParService(ps.data);
      } catch {}
      setLoading(false);
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  const today = format(new Date(), "EEEE d MMMM yyyy", { locale: dfns });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 text-sm">{t('c.loading')}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('dash.title')}</h1>
          <p className="text-slate-500 text-sm capitalize mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-2 bg-secondary-50 text-secondary-700 px-4 py-2 rounded-xl">
          <Clock size={16} />
          <span className="text-sm font-medium">{format(new Date(), 'HH:mm')}</span>
        </div>
      </div>

      {/* Message bienvenue */}
      <div className="bg-gradient-to-r from-primary-500 to-secondary-500 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/80 text-sm">{t('c.welcome')},</p>
            <h2 className="text-xl font-bold">{user?.prenom} {user?.nom}</h2>
            <p className="text-white/70 text-sm capitalize mt-0.5">{user?.role} — {user?.service}</p>
          </div>
          <div className="text-right">
            <p className="text-white/70 text-xs">{t('dash.recette')}</p>
            <p className="text-2xl font-bold">{stats?.recette_jour_fcfa?.toLocaleString('fr-FR')} <span className="text-lg font-normal">FCFA</span></p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users size={22} className="text-white" />}
          label={t('dash.patients_jour')}
          value={stats?.patients_jour || 0}
          sub={`${t('dash.total')}: ${stats?.total_patients || 0}`}
          color="bg-primary-500"
        />
        <StatCard
          icon={<Stethoscope size={22} className="text-white" />}
          label={t('dash.consultations')}
          value={stats?.consultations_jour || 0}
          sub={`${stats?.consultations_en_attente || 0} ${t('dash.en_attente')}`}
          color="bg-secondary-500"
        />
        <StatCard
          icon={<BedDouble size={22} className="text-white" />}
          label={t('dash.lits_dispo')}
          value={stats?.lits_disponibles || 0}
          color="bg-indigo-500"
        />
        <StatCard
          icon={<AlertTriangle size={22} className="text-white" />}
          label={t('dash.alertes_stock')}
          value={stats?.alertes_stock_medicaments || 0}
          sub={t('dash.medicaments')}
          color="bg-red-500"
          alert={(stats?.alertes_stock_medicaments || 0) > 0}
        />
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-primary-500" />
            {t('dash.cons_par_service')}
          </h3>
          {parService.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
              {t('dash.aucune_cons')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={parService} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <XAxis dataKey="service" tick={{ fontSize: 11 }} tickFormatter={(v) => v.split(' ')[0]} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v} consultation(s)`, 'Total']} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {parService.map((_, i) => (
                    <Cell key={i} fill={['#1565C0', '#00897B', '#F9A825', '#e53935', '#8e24aa', '#0288d1'][i % 6]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Infos rapides */}
        <div className="card">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Pill size={18} className="text-secondary-500" />
            {t('dash.services_dispo')}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              'dash.s_cons_gen', 'dash.s_cons_spe', 'dash.s_cpn', 'dash.s_chir',
              'dash.s_labo', 'dash.s_vac', 'dash.s_gyn', 'dash.s_pharma',
              'dash.s_kine', 'dash.s_edu',
            ].map((s) => (
              <div key={s} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                <span className="w-2 h-2 bg-secondary-400 rounded-full flex-shrink-0" />
                <span className="text-xs text-slate-600">{t(s)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
