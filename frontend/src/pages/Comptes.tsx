import React, { useState, useEffect, useCallback } from 'react';
import { UserCog, CheckCircle, XCircle, RefreshCw, Clock, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '../services/api';
import { ROLE_LABELS, type Role } from '../config/privileges';
import { useAuthStore } from '../store/authStore';
import { useT } from '../i18n';

export const Comptes: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const { t } = useT();
  const isSuperadmin = user?.role === 'superadmin';
  const [comptes, setComptes] = useState<any[]>([]);
  const [filtre, setFiltre] = useState<'tous' | 'attente'>('attente');

  const load = useCallback(async () => {
    try {
      const res = await authApi.listComptes(filtre === 'attente' ? { en_attente: true } : {});
      setComptes(res.data || []);
    } catch {
      toast.error(t('ts.accounts_error'));
    }
  }, [filtre]);

  useEffect(() => { load(); }, [load]);

  const valider = async (id: number) => {
    try {
      await authApi.validerCompte(id);
      toast.success(t('ts.account_validated'));
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('ts.error'));
    }
  };

  const revoquer = async (id: number) => {
    try {
      await authApi.revoquerCompte(id);
      toast.success(t('ts.account_revoked'));
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('ts.error'));
    }
  };

  const enAttente = comptes.filter((c) => !c.est_valide).length;

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <UserCog size={24} className="text-primary-500" /> {t('cpt.title')}
          </h1>
          <p className="text-slate-500 text-sm">{t('cpt.subtitle')}</p>
        </div>
        <button className="btn-outline flex items-center gap-2 text-sm" onClick={load}>
          <RefreshCw size={14} /> {t('c.refresh')}
        </button>
      </div>

      <div className="flex gap-2">
        {([['attente', `${t('cpt.pending')} (${enAttente})`], ['tous', t('cpt.all')]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFiltre(k)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filtre === k ? 'bg-primary-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="card !p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-4 py-3 text-slate-500 font-medium">{t('login.matricule')}</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">{t('pat.fullname')}</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">{t('cpt.role')}</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium hidden md:table-cell">{t('cpt.service')}</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">{t('c.status')}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {comptes.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-slate-400 text-sm">
                <UserCog size={32} className="mx-auto mb-2 text-slate-300" />
                {t('cpt.none')}
              </td></tr>
            ) : comptes.map((c) => (
              <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3"><span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">{c.matricule}</span></td>
                <td className="px-4 py-3 font-medium text-slate-800">{c.prenom} {c.nom}</td>
                <td className="px-4 py-3 text-slate-600">{ROLE_LABELS[c.role as Role] ?? c.role}</td>
                <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{c.service || '—'}</td>
                <td className="px-4 py-3">
                  {!c.est_valide ? (
                    <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-full">
                      <Clock size={11} /> {t('cpt.pending')}
                    </span>
                  ) : c.est_actif ? (
                    <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full">
                      <ShieldCheck size={11} /> {t('cpt.active')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-full">
                      <XCircle size={11} /> {t('cpt.revoked')}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {isSuperadmin ? (
                    <div className="flex items-center gap-1 justify-end">
                      {!c.est_valide && (
                        <button onClick={() => valider(c.id)}
                          className="btn-primary text-xs py-1 px-2 flex items-center gap-1">
                          <CheckCircle size={13} /> {t('c.validate')}
                        </button>
                      )}
                      {c.est_valide && c.est_actif && c.role !== 'superadmin' && (
                        <button onClick={() => revoquer(c.id)}
                          className="text-xs py-1 px-2 rounded-lg text-red-600 hover:bg-red-50 flex items-center gap-1">
                          <XCircle size={13} /> {t('cpt.revoke')}
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Superadmin requis</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
