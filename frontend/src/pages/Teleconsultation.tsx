import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, RefreshCw, Plus, Search, Play, CheckCircle, Ban, Link2, Stethoscope, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { teleconsultationApi, patientsApi, authApi } from '../services/api';
import { Modal } from '../components/ui/Modal';
import { useT } from '../i18n';
import { useConfigStore } from '../store/configStore';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const TABS = [
  { key: 'planifie', tkey: 'tc.tab_upcoming' },
  { key: 'en_cours', tkey: 'tc.tab_inprogress' },
  { key: 'termine', tkey: 'tc.tab_done' },
  { key: 'annule', tkey: 'tc.tab_cancelled' },
];

export const Teleconsultation: React.FC = () => {
  const { t } = useT();
  const navigate = useNavigate();
  const { jitsiDomain } = useConfigStore();
  const [tab, setTab] = useState('planifie');
  const [rdvs, setRdvs] = useState<any[]>([]);
  const [medecins, setMedecins] = useState<any[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState<any[]>([]);
  const [selPatient, setSelPatient] = useState<any>(null);
  const [form, setForm] = useState({ medecin_id: '', date_heure: '', type_rdv: 'teleconsultation', motif: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await teleconsultationApi.list({ statut: tab });
      setRdvs(res.data.rendez_vous || []);
    } catch { toast.error(t('ts.load_error')); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { authApi.listPersonnel('medecin').then(r => setMedecins(r.data || [])).catch(() => {}); }, []);

  useEffect(() => {
    const tm = setTimeout(async () => {
      if (patientSearch.length < 2) { setPatientResults([]); return; }
      try { const res = await patientsApi.list({ search: patientSearch, per_page: 5 }); setPatientResults(res.data.patients); } catch {}
    }, 300);
    return () => clearTimeout(tm);
  }, [patientSearch]);

  const create = async () => {
    if (!selPatient) { toast.error(t('ts.select_patient')); return; }
    if (!form.date_heure) { toast.error(t('tc.datetime')); return; }
    setSaving(true);
    try {
      await teleconsultationApi.create({
        patient_id: selPatient.id,
        medecin_id: form.medecin_id ? Number(form.medecin_id) : null,
        date_heure: form.date_heure, type_rdv: form.type_rdv, motif: form.motif,
      });
      toast.success(t('c.save'));
      setShowCreate(false); setSelPatient(null); setPatientSearch('');
      setForm({ medecin_id: '', date_heure: '', type_rdv: 'teleconsultation', motif: '' });
      load();
    } catch (err: any) { toast.error(err.response?.data?.detail || t('ts.error')); }
    setSaving(false);
  };

  const demarrer = async (r: any) => {
    try {
      const res = await teleconsultationApi.demarrer(r.id);
      toast.success(t('tc.started'));
      if (r.type_rdv === 'teleconsultation') { navigate(`/teleconsultation/${r.id}/salle`); return; }
      load();
      if (res.data.consultation_id) navigate(`/consultations/${res.data.consultation_id}`);
    } catch (err: any) { toast.error(err.response?.data?.detail || t('ts.error')); }
  };

  const terminer = async (r: any) => {
    try {
      const res = await teleconsultationApi.terminer(r.id);
      toast.success(t('tc.finished') + (res.data.facture_numero ? ` — ${t('ts.billed')} (${res.data.facture_numero})` : ''));
      load();
    } catch (err: any) { toast.error(err.response?.data?.detail || t('ts.error')); }
  };

  const annuler = async (r: any) => {
    if (!window.confirm(t('tc.cancel_confirm'))) return;
    try { await teleconsultationApi.annuler(r.id); toast.success(t('tc.cancelled')); load(); }
    catch (err: any) { toast.error(err.response?.data?.detail || t('ts.error')); }
  };

  const copyLink = (r: any) => {
    const v = jitsiDomain && jitsiDomain !== 'meet.jit.si' ? `?v=${encodeURIComponent(jitsiDomain)}` : '';
    const url = `${window.location.origin}/salle/${r.token_patient}${v}`;
    navigator.clipboard.writeText(url).then(() => toast.success(t('tc.link_copied'))).catch(() => toast(url));
  };

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Video size={24} className="text-primary-500" /> {t('tc.title')}
          </h1>
          <p className="text-slate-500 text-sm">{t('tc.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary flex items-center gap-2 text-sm" onClick={() => setShowCreate(true)}><Plus size={15} /> {t('tc.new')}</button>
          <button className="btn-outline flex items-center gap-2 text-sm" onClick={load}><RefreshCw size={14} /> {t('c.refresh')}</button>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit flex-wrap">
        {TABS.map(tb => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === tb.key ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t(tb.tkey)}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {rdvs.length === 0 ? (
          <div className="card py-12 text-center"><Video size={40} className="mx-auto text-slate-300 mb-3" /><p className="text-slate-400 text-sm">{t('tc.none')}</p></div>
        ) : rdvs.map(r => (
          <div key={r.id} className="card flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${r.type_rdv === 'teleconsultation' ? 'bg-primary-50' : 'bg-slate-100'}`}>
              {r.type_rdv === 'teleconsultation' ? <Video size={20} className="text-primary-500" /> : <Stethoscope size={20} className="text-slate-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-800">{r.patient}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${r.type_rdv === 'teleconsultation' ? 'bg-primary-50 text-primary-700' : 'bg-slate-100 text-slate-600'}`}>
                  {r.type_rdv === 'teleconsultation' ? t('tc.type_tele') : t('tc.type_presentiel')}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Calendar size={11} />{r.date_heure ? format(new Date(r.date_heure), 'dd/MM/yy HH:mm', { locale: fr }) : '—'}</span>
                <span>{t('tc.doctor')}: {r.medecin || t('tc.no_doctor')}</span>
              </div>
              {r.motif && <p className="text-sm text-slate-600 mt-1">{r.motif}</p>}
            </div>
            <div className="flex flex-col gap-1.5 flex-shrink-0">
              {r.statut === 'planifie' && (
                <button onClick={() => demarrer(r)} className="btn-primary text-xs py-1 px-2 flex items-center gap-1"><Play size={13} /> {t('tc.start')}</button>
              )}
              {r.statut === 'en_cours' && (
                <>
                  {r.type_rdv === 'teleconsultation' && (
                    <button onClick={() => navigate(`/teleconsultation/${r.id}/salle`)} className="btn-primary text-xs py-1 px-2 flex items-center gap-1"><Video size={13} /> {t('tc.join')}</button>
                  )}
                  {r.consultation_id && <button onClick={() => navigate(`/consultations/${r.consultation_id}`)} className="btn-secondary text-xs py-1 px-2 flex items-center gap-1"><Stethoscope size={13} /> {t('tc.open_consult')}</button>}
                  <button onClick={() => terminer(r)} className="btn-outline text-xs py-1 px-2 flex items-center gap-1"><CheckCircle size={13} /> {t('tc.finish')}</button>
                </>
              )}
              {r.type_rdv === 'teleconsultation' && r.token_patient && r.statut !== 'termine' && r.statut !== 'annule' && (
                <button onClick={() => copyLink(r)} className="text-xs py-1 px-2 rounded-lg text-primary-600 hover:bg-primary-50 flex items-center gap-1"><Link2 size={13} /> {t('tc.copy_link')}</button>
              )}
              {r.statut === 'planifie' && (
                <button onClick={() => annuler(r)} className="text-xs py-1 px-2 rounded-lg text-red-500 hover:bg-red-50 flex items-center gap-1"><Ban size={13} /> {t('c.cancel')}</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal création */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={t('tc.create_title')} size="lg">
        <div className="space-y-4">
          <div>
            <label className="label">{t('c.patient')} *</label>
            {selPatient ? (
              <div className="flex items-center justify-between p-3 bg-primary-50 rounded-lg border border-primary-200">
                <div><p className="font-semibold text-primary-800">{selPatient.nom_complet}</p><p className="text-xs text-primary-600">{selPatient.numero_dossier}</p></div>
                <button type="button" onClick={() => setSelPatient(null)} className="text-xs text-red-500 hover:underline">{t('c.change')}</button>
              </div>
            ) : (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="input pl-8" placeholder={t('c.search_patient')} value={patientSearch} onChange={e => setPatientSearch(e.target.value)} autoComplete="off" />
                {patientResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-[200] overflow-hidden">
                    {patientResults.map(p => (
                      <button key={p.id} type="button" className="w-full text-left px-4 py-2.5 hover:bg-primary-50 border-b border-slate-50 last:border-0"
                        onMouseDown={e => { e.preventDefault(); setSelPatient(p); setPatientSearch(''); setPatientResults([]); }}>
                        <p className="font-medium text-slate-800 text-sm">{p.nom_complet}</p>
                        <p className="text-xs text-slate-500">{p.numero_dossier}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('tc.type')}</label>
              <select className="input" value={form.type_rdv} onChange={e => setForm(p => ({ ...p, type_rdv: e.target.value }))}>
                <option value="teleconsultation">{t('tc.type_tele')}</option>
                <option value="presentiel">{t('tc.type_presentiel')}</option>
              </select>
            </div>
            <div>
              <label className="label">{t('tc.doctor')}</label>
              <select className="input" value={form.medecin_id} onChange={e => setForm(p => ({ ...p, medecin_id: e.target.value }))}>
                <option value="">{t('tc.select_doctor')}</option>
                {medecins.map(m => <option key={m.id} value={m.id}>{m.nom_complet}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">{t('tc.datetime')} *</label>
              <input className="input" type="datetime-local" value={form.date_heure} onChange={e => setForm(p => ({ ...p, date_heure: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label">{t('cons.motif')}</label>
              <input className="input" value={form.motif} onChange={e => setForm(p => ({ ...p, motif: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button className="btn-outline" onClick={() => setShowCreate(false)}>{t('c.cancel')}</button>
            <button className="btn-primary" onClick={create} disabled={saving}>{saving ? t('c.saving') : t('c.save')}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
