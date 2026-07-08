import React, { useState, useEffect, useCallback } from 'react';
import { Baby, RefreshCw, Plus, Search, Heart } from 'lucide-react';
import toast from 'react-hot-toast';
import { cpnApi, patientsApi } from '../services/api';
import { Modal } from '../components/ui/Modal';
import { useT } from '../i18n';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const PRESENTATIONS = ['Céphalique', 'Siège', 'Transverse', 'Non déterminée'];

export const CPN: React.FC = () => {
  const { t } = useT();
  const [tab, setTab] = useState<'suivis' | 'accouchements'>('suivis');
  const [suivis, setSuivis] = useState<any[]>([]);
  const [accouchements, setAccouchements] = useState<any[]>([]);

  const [showCPN, setShowCPN] = useState(false);
  const [showAcc, setShowAcc] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState<any[]>([]);
  const [selPatient, setSelPatient] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [cpn, setCpn] = useState<any>({
    date_derniere_regle: '', tension_arterielle: '', poids: '', hauteur_uterine: '',
    bruit_coeur_foetal: '', presentation: '', oedemes: false, albuminurie: '', glycosurie: '',
    hemoglobine: '', groupe_rhesus: '', test_vih: '', test_syphilis: '',
    fer_folate: false, moustiquaire: false, prevention_paludisme: false,
    observations: '', plan_accouchement: '', prochain_rdv: '',
  });
  const [acc, setAcc] = useState<any>({
    type_accouchement: 'Voie basse', duree_travail: '', sexe_nouveau_ne: 'M', poids_naissance: '',
    apgar_1min: '', apgar_5min: '', etat_nouveau_ne: '', complications: '', pertes_sang: '', notes: '',
  });

  const load = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([cpnApi.listSuivis(), cpnApi.listAccouchements()]);
      setSuivis(s.data.suivis || []);
      setAccouchements(a.data.accouchements || []);
    } catch { toast.error(t('ts.load_error')); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (patientSearch.length < 2) { setPatientResults([]); return; }
      try { const res = await patientsApi.list({ search: patientSearch, per_page: 5 }); setPatientResults(res.data.patients.filter((p: any) => p.sexe === 'F')); } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [patientSearch]);

  const num = (v: string) => v ? parseFloat(v) : null;
  const int = (v: string) => v ? parseInt(v) : null;

  const saveCPN = async () => {
    if (!selPatient) { toast.error(t('ts.select_patient')); return; }
    setSaving(true);
    try {
      const res = await cpnApi.createSuivi({
        patient_id: selPatient.id, ...cpn,
        poids: num(cpn.poids), hauteur_uterine: num(cpn.hauteur_uterine), hemoglobine: num(cpn.hemoglobine),
        date_derniere_regle: cpn.date_derniere_regle || null, prochain_rdv: cpn.prochain_rdv || null,
      });
      toast.success(`${t('ts.cpn_visit')} ${res.data.numero_visite} — ${res.data.age_gestationnel || ''}`);
      setShowCPN(false); setSelPatient(null); setPatientSearch('');
      load();
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Erreur'); }
    setSaving(false);
  };

  const saveAcc = async () => {
    if (!selPatient) { toast.error(t('ts.select_patient')); return; }
    setSaving(true);
    try {
      await cpnApi.createAccouchement({
        patient_id: selPatient.id, ...acc,
        poids_naissance: num(acc.poids_naissance), pertes_sang: num(acc.pertes_sang),
        apgar_1min: int(acc.apgar_1min), apgar_5min: int(acc.apgar_5min),
      });
      toast.success(t('ts.cpn_delivery'));
      setShowAcc(false); setSelPatient(null); setPatientSearch('');
      load();
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Erreur'); }
    setSaving(false);
  };

  const PatientSelect = () => (
    <div>
      <label className="label">{t('cpn.patient_f')} *</label>
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
                  <p className="text-xs text-slate-500">{p.numero_dossier} — {p.age ?? '?'} ans</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const cf = (k: string) => (e: any) => setCpn((p: any) => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const af = (k: string) => (e: any) => setAcc((p: any) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Baby size={24} className="text-primary-500" /> {t('cpn.title')}
          </h1>
          <p className="text-slate-500 text-sm">{t('cpn.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary flex items-center gap-2 text-sm" onClick={() => { setSelPatient(null); setShowCPN(true); }}><Plus size={15} /> {t('cpn.visit')}</button>
          <button className="btn-secondary flex items-center gap-2 text-sm" onClick={() => { setSelPatient(null); setShowAcc(true); }}><Heart size={15} /> {t('cpn.delivery')}</button>
          <button className="btn-outline flex items-center gap-2 text-sm" onClick={load}><RefreshCw size={14} /></button>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[['suivis', `${t('cpn.tab_followups')} (${suivis.length})`], ['accouchements', `${t('cpn.tab_deliveries')} (${accouchements.length})`]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as any)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === k ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{l}</button>
        ))}
      </div>

      {tab === 'suivis' && (
        <div className="space-y-3">
          {suivis.length === 0 ? (
            <div className="card py-12 text-center"><Baby size={40} className="mx-auto text-slate-300 mb-3" /><p className="text-slate-400 text-sm">{t('cpn.none_followup')}</p></div>
          ) : suivis.map(s => (
            <div key={s.id} className="card flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-pink-50 flex items-center justify-center flex-shrink-0"><Baby size={20} className="text-pink-500" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800">{s.patient}</span>
                  <span className="text-xs bg-pink-50 text-pink-700 px-2 py-0.5 rounded">CPN {s.numero_visite}</span>
                  {s.age_gestationnel && <span className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded">{s.age_gestationnel}</span>}
                  {s.terme_calcule && <span className="text-xs text-slate-500">Terme: {s.terme_calcule}</span>}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-slate-500">
                  {s.tension_arterielle && <span>TA: {s.tension_arterielle}</span>}
                  {s.poids && <span>Poids: {s.poids} kg</span>}
                  {s.hauteur_uterine && <span>HU: {s.hauteur_uterine} cm</span>}
                  {s.bruit_coeur_foetal && <span>BCF: {s.bruit_coeur_foetal}</span>}
                  {s.hemoglobine && <span>Hb: {s.hemoglobine} g/dL</span>}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {s.fer_folate && <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded">Fer+Folate</span>}
                  {s.moustiquaire && <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded">Moustiquaire</span>}
                  {s.prevention_paludisme && <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded">SP paludisme</span>}
                  {s.oedemes && <span className="text-[10px] bg-red-50 text-red-700 px-1.5 py-0.5 rounded">Œdèmes</span>}
                </div>
              </div>
              <div className="text-right text-xs text-slate-400 flex-shrink-0">
                {format(new Date(s.date_visite), 'dd/MM/yy', { locale: fr })}
                {s.prochain_rdv && <p className="text-amber-600 mt-1">RDV: {format(new Date(s.prochain_rdv), 'dd/MM/yy', { locale: fr })}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'accouchements' && (
        <div className="space-y-3">
          {accouchements.length === 0 ? (
            <div className="card py-12 text-center"><Heart size={40} className="mx-auto text-slate-300 mb-3" /><p className="text-slate-400 text-sm">{t('cpn.none_delivery')}</p></div>
          ) : accouchements.map(a => (
            <div key={a.id} className="card flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center flex-shrink-0"><Heart size={20} className="text-rose-500" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800">{a.patient}</span>
                  <span className="text-xs bg-rose-50 text-rose-700 px-2 py-0.5 rounded">{a.type_accouchement}</span>
                </div>
                <div className="flex flex-wrap gap-x-4 mt-1 text-xs text-slate-500">
                  {a.sexe_nouveau_ne && <span>Nouveau-né: {a.sexe_nouveau_ne === 'M' ? 'Garçon' : 'Fille'}</span>}
                  {a.poids_naissance && <span>Poids: {a.poids_naissance} kg</span>}
                  {(a.apgar_1min != null) && <span>APGAR: {a.apgar_1min}/{a.apgar_5min}</span>}
                  {a.etat_nouveau_ne && <span>{a.etat_nouveau_ne}</span>}
                </div>
                {a.complications && <p className="text-xs text-red-500 mt-1">Complications: {a.complications}</p>}
              </div>
              <span className="text-xs text-slate-400 flex-shrink-0">{format(new Date(a.date_accouchement), 'dd/MM/yy', { locale: fr })}</span>
            </div>
          ))}
        </div>
      )}

      {/* Modal CPN */}
      <Modal open={showCPN} onClose={() => setShowCPN(false)} title={t('cpn.visit_title')} size="xl">
        <div className="space-y-4">
          <PatientSelect />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div><label className="label">{t('cpn.ddr')}</label><input className="input" type="date" value={cpn.date_derniere_regle} onChange={cf('date_derniere_regle')} /></div>
            <div><label className="label">{t('cpn.ta')}</label><input className="input" value={cpn.tension_arterielle} onChange={cf('tension_arterielle')} placeholder="120/80" /></div>
            <div><label className="label">{t('cpn.poids')}</label><input className="input" type="number" step="0.1" value={cpn.poids} onChange={cf('poids')} /></div>
            <div><label className="label">{t('cpn.hu')}</label><input className="input" type="number" step="0.1" value={cpn.hauteur_uterine} onChange={cf('hauteur_uterine')} /></div>
            <div><label className="label">{t('cpn.bcf')}</label><input className="input" value={cpn.bruit_coeur_foetal} onChange={cf('bruit_coeur_foetal')} placeholder="140 bpm" /></div>
            <div><label className="label">{t('cpn.presentation')}</label><select className="input" value={cpn.presentation} onChange={cf('presentation')}><option value="">—</option>{PRESENTATIONS.map(p => <option key={p}>{p}</option>)}</select></div>
            <div><label className="label">{t('cpn.hb')}</label><input className="input" type="number" step="0.1" value={cpn.hemoglobine} onChange={cf('hemoglobine')} /></div>
            <div><label className="label">{t('cpn.albu')}</label><input className="input" value={cpn.albuminurie} onChange={cf('albuminurie')} /></div>
            <div><label className="label">{t('cpn.glyco')}</label><input className="input" value={cpn.glycosurie} onChange={cf('glycosurie')} /></div>
            <div><label className="label">{t('cpn.rhesus')}</label><input className="input" value={cpn.groupe_rhesus} onChange={cf('groupe_rhesus')} placeholder="O+" /></div>
            <div><label className="label">{t('cpn.vih')}</label><input className="input" value={cpn.test_vih} onChange={cf('test_vih')} /></div>
            <div><label className="label">{t('cpn.syphilis')}</label><input className="input" value={cpn.test_syphilis} onChange={cf('test_syphilis')} /></div>
          </div>
          <div className="flex flex-wrap gap-4 p-3 bg-slate-50 rounded-xl">
            {[['fer_folate', t('cpn.fer')], ['moustiquaire', t('cpn.moust')], ['prevention_paludisme', t('cpn.sp')], ['oedemes', t('cpn.oedemes')]].map(([k, l]) => (
              <label key={k} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" checked={cpn[k]} onChange={cf(k)} className="rounded" /> {l}
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">{t('cpn.obs')}</label><textarea className="input h-16 resize-none" value={cpn.observations} onChange={cf('observations')} /></div>
            <div><label className="label">{t('cpn.plan')}</label><textarea className="input h-16 resize-none" value={cpn.plan_accouchement} onChange={cf('plan_accouchement')} /></div>
          </div>
          <div><label className="label">{t('cpn.rdv')}</label><input className="input w-48" type="date" value={cpn.prochain_rdv} onChange={cf('prochain_rdv')} /></div>
          <div className="flex gap-3 justify-end">
            <button className="btn-outline" onClick={() => setShowCPN(false)}>{t('c.cancel')}</button>
            <button className="btn-primary" onClick={saveCPN} disabled={saving}>{saving ? t('c.saving') : t('cpn.save_visit')}</button>
          </div>
        </div>
      </Modal>

      {/* Modal Accouchement */}
      <Modal open={showAcc} onClose={() => setShowAcc(false)} title={t('cpn.delivery_title')} size="lg">
        <div className="space-y-4">
          <PatientSelect />
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">{t('cpn.acc_type')}</label><select className="input" value={acc.type_accouchement} onChange={af('type_accouchement')}><option>Voie basse</option><option>Césarienne</option><option>Voie basse instrumentale</option></select></div>
            <div><label className="label">{t('cpn.acc_duree')}</label><input className="input" value={acc.duree_travail} onChange={af('duree_travail')} placeholder="8h" /></div>
            <div><label className="label">{t('cpn.acc_sexe')}</label><select className="input" value={acc.sexe_nouveau_ne} onChange={af('sexe_nouveau_ne')}><option value="M">{t('cpn.boy')}</option><option value="F">{t('cpn.girl')}</option></select></div>
            <div><label className="label">{t('cpn.acc_poids')}</label><input className="input" type="number" step="0.01" value={acc.poids_naissance} onChange={af('poids_naissance')} placeholder="3.2" /></div>
            <div><label className="label">APGAR 1 min</label><input className="input" type="number" min="0" max="10" value={acc.apgar_1min} onChange={af('apgar_1min')} /></div>
            <div><label className="label">APGAR 5 min</label><input className="input" type="number" min="0" max="10" value={acc.apgar_5min} onChange={af('apgar_5min')} /></div>
            <div><label className="label">{t('cpn.acc_blood')}</label><input className="input" type="number" value={acc.pertes_sang} onChange={af('pertes_sang')} /></div>
            <div><label className="label">{t('cpn.acc_etat')}</label><input className="input" value={acc.etat_nouveau_ne} onChange={af('etat_nouveau_ne')} /></div>
          </div>
          <div><label className="label">{t('cpn.acc_comp')}</label><textarea className="input h-14 resize-none" value={acc.complications} onChange={af('complications')} /></div>
          <div><label className="label">{t('cpn.acc_notes')}</label><textarea className="input h-14 resize-none" value={acc.notes} onChange={af('notes')} /></div>
          <div className="flex gap-3 justify-end">
            <button className="btn-outline" onClick={() => setShowAcc(false)}>{t('c.cancel')}</button>
            <button className="btn-primary" onClick={saveAcc} disabled={saving}>{saving ? t('c.saving') : t('c.save')}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
