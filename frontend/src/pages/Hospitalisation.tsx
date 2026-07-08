import React, { useState, useEffect, useCallback } from 'react';
import { BedDouble, RefreshCw, Plus, Search, LogOut, FileText, Activity } from 'lucide-react';
import toast from 'react-hot-toast';
import { hospitalisationApi, patientsApi } from '../services/api';
import { Modal } from '../components/ui/Modal';
import { useT } from '../i18n';

const LIT_COLOR: Record<string, string> = {
  disponible: 'bg-green-50 border-green-200 text-green-700',
  occupe: 'bg-red-50 border-red-200 text-red-700',
  maintenance: 'bg-slate-100 border-slate-200 text-slate-500',
};

export const Hospitalisation: React.FC = () => {
  const { t } = useT();
  const [tab, setTab] = useState<'admissions' | 'lits'>('admissions');
  const [lits, setLits] = useState<any[]>([]);
  const [litStats, setLitStats] = useState<any>(null);
  const [admissions, setAdmissions] = useState<any[]>([]);

  const [showAdmit, setShowAdmit] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState<any[]>([]);
  const [selPatient, setSelPatient] = useState<any>(null);
  const [admitForm, setAdmitForm] = useState({ lit_id: '', motif: '', diagnostic_entree: '', traitement_en_cours: '' });

  const [showEvolution, setShowEvolution] = useState(false);
  const [showSortie, setShowSortie] = useState(false);
  const [selAdmission, setSelAdmission] = useState<any>(null);
  const [evolutionNote, setEvolutionNote] = useState('');
  const [compteRendu, setCompteRendu] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [l, a] = await Promise.all([
        hospitalisationApi.listLits(),
        hospitalisationApi.listAdmissions({ active: true }),
      ]);
      setLits(l.data.lits || []);
      setLitStats(l.data.stats);
      setAdmissions(a.data.admissions || []);
    } catch { toast.error(t('ts.load_error')); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (patientSearch.length < 2) { setPatientResults([]); return; }
      try { const res = await patientsApi.list({ search: patientSearch, per_page: 5 }); setPatientResults(res.data.patients); } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [patientSearch]);

  const litsDispo = lits.filter(l => l.statut === 'disponible');

  const admettre = async () => {
    if (!selPatient) { toast.error(t('ts.select_patient')); return; }
    if (!admitForm.lit_id || !admitForm.motif) { toast.error(t('ts.bed_motif_req')); return; }
    setSaving(true);
    try {
      await hospitalisationApi.admettre({ patient_id: selPatient.id, ...admitForm, lit_id: Number(admitForm.lit_id) });
      toast.success(t('ts.admitted'));
      setShowAdmit(false); setSelPatient(null); setPatientSearch('');
      setAdmitForm({ lit_id: '', motif: '', diagnostic_entree: '', traitement_en_cours: '' });
      load();
    } catch (err: any) { toast.error(err.response?.data?.detail || t('ts.error')); }
    setSaving(false);
  };

  const ajouterEvolution = async () => {
    if (!evolutionNote.trim()) return;
    try {
      await hospitalisationApi.evolution(selAdmission.id, { note: evolutionNote });
      toast.success(t('ts.note_added'));
      setShowEvolution(false); setEvolutionNote(''); load();
    } catch (err: any) { toast.error(err.response?.data?.detail || t('ts.error')); }
  };

  const faireSortie = async () => {
    if (!compteRendu.trim()) { toast.error(t('ts.report_req')); return; }
    try {
      const res = await hospitalisationApi.sortie(selAdmission.id, { compte_rendu_sortie: compteRendu });
      toast.success(t('ts.discharged') + (res.data.facture_numero ? ` — ${t('ts.billed')} (${res.data.facture_numero})` : ''));
      setShowSortie(false); setCompteRendu(''); load();
    } catch (err: any) { toast.error(err.response?.data?.detail || t('ts.error')); }
  };

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BedDouble size={24} className="text-primary-500" /> {t('hosp.title')}
          </h1>
          <p className="text-slate-500 text-sm">{t('hosp.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary flex items-center gap-2 text-sm" onClick={() => setShowAdmit(true)}>
            <Plus size={15} /> {t('hosp.new_admission')}
          </button>
          <button className="btn-outline flex items-center gap-2 text-sm" onClick={load}><RefreshCw size={14} /> {t('c.refresh')}</button>
        </div>
      </div>

      {litStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { l: t('hosp.beds_total'), v: litStats.total },
            { l: t('hosp.available'), v: litStats.disponibles, c: 'text-green-600' },
            { l: t('hosp.occupied'), v: litStats.occupes, c: 'text-red-600' },
            { l: t('hosp.inpatients'), v: admissions.length },
          ].map(({ l, v, c }) => (
            <div key={l} className="card"><p className="text-xs text-slate-500 mb-1">{l}</p><p className={`text-xl font-bold ${c || 'text-slate-800'}`}>{v}</p></div>
          ))}
        </div>
      )}

      {/* Répartition des hospitalisés par type */}
      {(() => {
        const r = admissions.reduce((acc: any, a: any) => {
          const enfant = a.age != null && a.age < 18;
          if (a.sexe === 'M') enfant ? acc.garcon++ : acc.homme++;
          else if (a.sexe === 'F') enfant ? acc.fille++ : acc.femme++;
          else acc.inconnu++;
          return acc;
        }, { homme: 0, femme: 0, garcon: 0, fille: 0, inconnu: 0 });
        const enfants = r.garcon + r.fille;
        return (
          <div className="card">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('hosp.repartition')}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                <p className="text-xs text-blue-600 mb-0.5">{t('hosp.men')}</p>
                <p className="text-2xl font-bold text-blue-700">{r.homme}</p>
              </div>
              <div className="p-3 rounded-xl bg-pink-50 border border-pink-100">
                <p className="text-xs text-pink-600 mb-0.5">{t('hosp.women')}</p>
                <p className="text-2xl font-bold text-pink-700">{r.femme}</p>
              </div>
              <div className="p-3 rounded-xl bg-purple-50 border border-purple-100">
                <p className="text-xs text-purple-600 mb-0.5">{t('hosp.children')}</p>
                <p className="text-2xl font-bold text-purple-700">{enfants}</p>
                <p className="text-[11px] text-purple-500 mt-0.5">{t('hosp.boys_girls', '{b}').replace('{b}', String(r.fille)).replace(/^/, r.garcon + ' ')}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-xs text-slate-500 mb-0.5">{t('dash.total')}</p>
                <p className="text-2xl font-bold text-slate-700">{admissions.length}</p>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[['admissions', `${t('hosp.tab_inpatients')} (${admissions.length})`], ['lits', `${t('hosp.tab_beds')} (${lits.length})`]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as any)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === k ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{l}</button>
        ))}
      </div>

      {tab === 'admissions' && (
        <div className="space-y-3">
          {admissions.length === 0 ? (
            <div className="card py-12 text-center"><BedDouble size={40} className="mx-auto text-slate-300 mb-3" /><p className="text-slate-400 text-sm">{t('hosp.none')}</p></div>
          ) : admissions.map(a => (
            <div key={a.id} className="card flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                <BedDouble size={20} className="text-primary-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800">{a.patient}</span>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{t('hosp.bed')} {a.lit_numero} · {a.type_chambre}</span>
                  <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded">{a.jours} {t('hosp.days')}</span>
                </div>
                <p className="text-sm text-slate-600 mt-1">{a.motif}</p>
                {a.diagnostic_entree && <p className="text-xs text-slate-500">{t('hosp.diagnosis')}: {a.diagnostic_entree}</p>}
                {a.notes_evolution && <p className="text-xs text-slate-400 mt-1 whitespace-pre-wrap line-clamp-2">{a.notes_evolution}</p>}
              </div>
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                <button onClick={() => { setSelAdmission(a); setEvolutionNote(''); setShowEvolution(true); }} className="btn-outline text-xs py-1 px-2 flex items-center gap-1"><Activity size={13} /> {t('hosp.evolution')}</button>
                <button onClick={() => { setSelAdmission(a); setCompteRendu(''); setShowSortie(true); }} className="btn-secondary text-xs py-1 px-2 flex items-center gap-1"><LogOut size={13} /> {t('hosp.discharge')}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'lits' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {lits.map(l => (
            <div key={l.id} className={`rounded-xl border p-3 text-center ${LIT_COLOR[l.statut]}`}>
              <BedDouble size={20} className="mx-auto mb-1" />
              <p className="font-bold">{l.numero}</p>
              <p className="text-xs">{l.type_chambre}</p>
              <p className="text-[10px] capitalize mt-1">{l.statut}</p>
              <p className="text-[10px]">{l.prix_par_jour?.toLocaleString('fr-FR')} F/j</p>
            </div>
          ))}
        </div>
      )}

      {/* Modal admission */}
      <Modal open={showAdmit} onClose={() => setShowAdmit(false)} title={t('hosp.new_admission')} size="lg">
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
          <div>
            <label className="label">{t('hosp.bed')} *</label>
            <select className="input" value={admitForm.lit_id} onChange={e => setAdmitForm(p => ({ ...p, lit_id: e.target.value }))}>
              <option value="">{t('hosp.select_bed')}</option>
              {litsDispo.map(l => <option key={l.id} value={l.id}>{t('hosp.bed')} {l.numero} — {l.type_chambre} ({l.prix_par_jour?.toLocaleString('fr-FR')} F/j)</option>)}
            </select>
            {litsDispo.length === 0 && <p className="text-xs text-red-500 mt-1">{t('hosp.available')}: 0</p>}
          </div>
          <div>
            <label className="label">{t('hosp.reason')} *</label>
            <input className="input" value={admitForm.motif} onChange={e => setAdmitForm(p => ({ ...p, motif: e.target.value }))} />
          </div>
          <div>
            <label className="label">{t('hosp.diagnosis')}</label>
            <input className="input" value={admitForm.diagnostic_entree} onChange={e => setAdmitForm(p => ({ ...p, diagnostic_entree: e.target.value }))} />
          </div>
          <div>
            <label className="label">{t('hosp.evolution')}</label>
            <textarea className="input h-16 resize-none" value={admitForm.traitement_en_cours} onChange={e => setAdmitForm(p => ({ ...p, traitement_en_cours: e.target.value }))} />
          </div>
          <div className="flex gap-3 justify-end">
            <button className="btn-outline" onClick={() => setShowAdmit(false)}>{t('c.cancel')}</button>
            <button className="btn-primary" onClick={admettre} disabled={saving}>{saving ? t('c.saving') : t('hosp.admit')}</button>
          </div>
        </div>
      </Modal>

      {/* Modal évolution */}
      <Modal open={showEvolution} onClose={() => setShowEvolution(false)} title={t('hosp.evolution')} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">{selAdmission?.patient} — {t('hosp.bed')} {selAdmission?.lit_numero}</p>
          <textarea className="input h-28 resize-none" value={evolutionNote} onChange={e => setEvolutionNote(e.target.value)} autoFocus />
          <div className="flex gap-3 justify-end">
            <button className="btn-outline" onClick={() => setShowEvolution(false)}>{t('c.cancel')}</button>
            <button className="btn-primary" onClick={ajouterEvolution}>{t('c.add')}</button>
          </div>
        </div>
      </Modal>

      {/* Modal sortie */}
      <Modal open={showSortie} onClose={() => setShowSortie(false)} title={t('hosp.discharge_title')} size="md">
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 rounded-xl">
            <p className="font-semibold text-slate-800">{selAdmission?.patient}</p>
            <p className="text-xs text-slate-500">{t('hosp.bed')} {selAdmission?.lit_numero} — {selAdmission?.jours} {t('hosp.days')} × {selAdmission?.prix_par_jour?.toLocaleString('fr-FR')} F</p>
          </div>
          <div>
            <label className="label">{t('hosp.discharge_report')} *</label>
            <textarea className="input h-28 resize-none" value={compteRendu} onChange={e => setCompteRendu(e.target.value)} autoFocus />
          </div>
          <div className="flex gap-3 justify-end">
            <button className="btn-outline" onClick={() => setShowSortie(false)}>{t('c.cancel')}</button>
            <button className="btn-primary flex items-center gap-2" onClick={faireSortie}><FileText size={15} /> {t('hosp.discharge')}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
