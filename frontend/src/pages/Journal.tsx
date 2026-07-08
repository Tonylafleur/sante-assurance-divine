import React, { useState, useEffect, useCallback } from 'react';
import { ScrollText, RefreshCw, Search, AlertTriangle, Activity, Filter, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { journalApi } from '../services/api';
import { ROLE_LABELS, type Role } from '../config/privileges';
import { useT } from '../i18n';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const MODULES = ['Patients', 'Consultations', 'Pharmacie', 'Caisse', 'Authentification', 'Journal', 'Assistant IA'];

export const Journal: React.FC = () => {
  const { t } = useT();
  const [events, setEvents] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [recherche, setRecherche] = useState('');
  const [module, setModule] = useState('');
  const [seulementErreurs, setSeulementErreurs] = useState(false);

  const load = useCallback(async () => {
    try {
      const params: any = { limit: 300 };
      if (recherche) params.recherche = recherche;
      if (module) params.module = module;
      if (seulementErreurs) params.succes = false;
      const [e, s] = await Promise.all([journalApi.list(params), journalApi.stats()]);
      setEvents(e.data || []);
      setStats(s.data);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Accès refusé au journal');
    }
  }, [recherche, module, seulementErreurs]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ScrollText size={24} className="text-primary-500" /> {t('jrnl.title')}
            <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-600 px-2 py-1 rounded-full font-medium">
              <Lock size={11} /> {t('jrnl.confidential')}
            </span>
          </h1>
          <p className="text-slate-500 text-sm">{t('jrnl.subtitle')}</p>
        </div>
        <button className="btn-outline flex items-center gap-2 text-sm" onClick={load}>
          <RefreshCw size={14} /> {t('c.refresh')}
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card">
            <p className="text-xs text-slate-500 mb-1">{t('jrnl.events')}</p>
            <p className="text-xl font-bold text-slate-800">{stats.total_evenements?.toLocaleString('fr-FR')}</p>
          </div>
          <div className="card">
            <p className="text-xs text-slate-500 mb-1">{t('jrnl.total_errors')}</p>
            <p className="text-xl font-bold text-red-600">{stats.total_erreurs?.toLocaleString('fr-FR')}</p>
          </div>
          <div className="card">
            <p className="text-xs text-slate-500 mb-1">{t('jrnl.errors_7d')}</p>
            <p className="text-xl font-bold text-amber-600">{stats.erreurs_7_jours?.toLocaleString('fr-FR')}</p>
          </div>
          <div className="card">
            <p className="text-xs text-slate-500 mb-1">{t('jrnl.col_user')}</p>
            <p className="text-xl font-bold text-slate-800">{stats.top_utilisateurs_erreurs?.length || 0}</p>
          </div>
        </div>
      )}

      {/* Top utilisateurs en difficulté */}
      {stats?.top_utilisateurs_erreurs?.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-500" /> Utilisateurs avec le plus d'erreurs d'utilisation
          </h3>
          <div className="flex flex-wrap gap-2">
            {stats.top_utilisateurs_erreurs.map((u: any) => (
              <span key={u.matricule} className="text-xs bg-amber-50 text-amber-800 px-3 py-1.5 rounded-lg">
                <strong>{u.nom_complet}</strong> ({ROLE_LABELS[u.role as Role] ?? u.role}) — {u.nb_erreurs} erreur(s)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="card !p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-8 text-sm" placeholder={t('c.search')}
            value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </div>
        <select className="input text-sm !w-auto" value={module} onChange={(e) => setModule(e.target.value)}>
          <option value="">{t('jrnl.all_modules')}</option>
          {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
          <input type="checkbox" checked={seulementErreurs} onChange={(e) => setSeulementErreurs(e.target.checked)} />
          <Filter size={13} /> {t('jrnl.errors_only')}
        </label>
      </div>

      {/* Table */}
      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-3 text-slate-500 font-medium">{t('c.date')}</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">{t('jrnl.col_user')}</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">{t('jrnl.col_action')}</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium hidden lg:table-cell">URL</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">{t('c.status')}</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium hidden md:table-cell">IP</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-slate-400 text-sm">
                  <Activity size={32} className="mx-auto mb-2 text-slate-300" />
                  {t('jrnl.none')}
                </td></tr>
              ) : events.map((ev) => (
                <tr key={ev.id} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${!ev.succes ? 'bg-red-50/40' : ''}`}>
                  <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                    {ev.created_at ? format(new Date(ev.created_at), 'dd/MM/yy HH:mm:ss', { locale: fr }) : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-slate-700">{ev.nom_complet}</div>
                    <div className="text-xs text-slate-400">{ev.matricule} · {ROLE_LABELS[ev.role as Role] ?? ev.role}</div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{ev.action}</td>
                  <td className="px-4 py-2.5 hidden lg:table-cell">
                    <span className="font-mono text-xs text-slate-500">{ev.methode} {ev.chemin}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ev.succes ? 'bg-green-50 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {ev.statut_code}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-400 hidden md:table-cell">{ev.ip || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
