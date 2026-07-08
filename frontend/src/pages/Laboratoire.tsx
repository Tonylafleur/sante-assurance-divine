import React, { useState, useEffect, useCallback } from 'react';
import { FlaskConical, RefreshCw, FlaskRound, CheckCircle, FileText, Beaker, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { laboratoireApi } from '../services/api';
import { Modal } from '../components/ui/Modal';
import { CompteRenduLabo } from '../components/ui/CompteRenduLabo';
import { parseResultat, resumeResultat, type ParamResultat } from '../utils/labResult';
import { useWebSocket } from '../hooks/useWebSocket';
import { useT } from '../i18n';

const TABS = [
  { key: 'prescrit', tkey: 'lab.tab_prescrit' },
  { key: 'en_cours', tkey: 'lab.tab_encours' },
  { key: 'resultat_disponible', tkey: 'lab.tab_resultats' },
  { key: 'valide', tkey: 'lab.tab_valides' },
];

export const Laboratoire: React.FC = () => {
  const { t } = useT();
  const [tab, setTab] = useState('prescrit');
  const [examens, setExamens] = useState<any[]>([]);
  const [showResultat, setShowResultat] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState({ resultat: '', valeur_normale: '', unite: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [printExam, setPrintExam] = useState<any>(null);
  // Panels (catalogue) + saisie structurée
  const [panels, setPanels] = useState<Record<string, any[]>>({});
  const [params, setParams] = useState<ParamResultat[] | null>(null);

  useWebSocket('laboratoire');

  const load = useCallback(async () => {
    try {
      const res = await laboratoireApi.listExamens({ statut: tab });
      setExamens(res.data.examens || []);
    } catch { toast.error(t('ts.load_error')); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    laboratoireApi.catalogue().then(r => {
      const map: Record<string, any[]> = {};
      (r.data || []).forEach((c: any) => { if (c.parametres?.length) map[c.libelle] = c.parametres; });
      setPanels(map);
    }).catch(() => {});
  }, []);

  const prelever = async (e: any) => {
    try { await laboratoireApi.prelevement(e.id); toast.success(t('ts.lab_sample')); load(); }
    catch (err: any) { toast.error(err.response?.data?.detail || t('ts.error')); }
  };

  const openResultat = (e: any) => {
    setSelected(e);
    // Résultat déjà structuré ? sinon, panel du catalogue ? sinon, champ simple.
    const dejaStruct = parseResultat(e.resultat);
    const modele = panels[e.libelle];
    if (dejaStruct) {
      setParams(dejaStruct);
    } else if (modele) {
      setParams(modele.map((p: any) => ({ nom: p.nom, valeur: '', unite: p.unite, valeur_normale: p.valeur_normale })));
    } else {
      setParams(null);
    }
    setForm({ resultat: e.resultat || '', valeur_normale: e.valeur_normale || '', unite: e.unite || '', notes: e.notes || '' });
    setShowResultat(true);
  };

  const setParam = (i: number, valeur: string) =>
    setParams(prev => prev ? prev.map((p, idx) => idx === i ? { ...p, valeur } : p) : prev);

  const saveResultat = async () => {
    let payload: any;
    if (params) {
      if (!params.some(p => p.valeur && p.valeur.trim())) { toast.error(t('ts.lab_param')); return; }
      payload = { resultat: JSON.stringify(params), notes: form.notes };
    } else {
      if (!form.resultat) { toast.error(t('ts.lab_result_req')); return; }
      payload = form;
    }
    setSaving(true);
    try {
      await laboratoireApi.saisirResultat(selected.id, payload);
      toast.success(t('ts.lab_result_ok'));
      setShowResultat(false);
      load();
    } catch (err: any) { toast.error(err.response?.data?.detail || t('ts.error')); }
    setSaving(false);
  };

  const valider = async (e: any) => {
    try {
      const res = await laboratoireApi.valider(e.id);
      toast.success(t('ts.lab_validated') + (res.data.facture_numero ? ` — ${t('ts.billed')} (${res.data.facture_numero})` : ''));
      load();
    } catch (err: any) { toast.error(err.response?.data?.detail || t('ts.error')); }
  };

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FlaskConical size={24} className="text-primary-500" /> {t('lab.title')}
          </h1>
          <p className="text-slate-500 text-sm">{t('lab.subtitle')}</p>
        </div>
        <button className="btn-outline flex items-center gap-2 text-sm" onClick={load}>
          <RefreshCw size={14} /> {t('c.refresh')}
        </button>
      </div>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit flex-wrap">
        {TABS.map(tb => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === tb.key ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t(tb.tkey)}
          </button>
        ))}
      </div>

      <div className="card !p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-4 py-3 text-slate-500 font-medium">N° / {t('c.patient')}</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">{t('lab.col_exam')}</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium hidden md:table-cell">{t('lab.col_result')}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {examens.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-10 text-slate-400 text-sm">
                <Beaker size={32} className="mx-auto mb-2 text-slate-300" />
                {t('lab.none')}
              </td></tr>
            ) : examens.map(e => (
              <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{e.numero}</span>
                  <p className="font-medium text-slate-800 mt-1">{e.patient}</p>
                  <p className="text-xs text-slate-400">{e.consultation_numero}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-700">{e.libelle}</p>
                  <span className="text-xs bg-primary-50 text-primary-600 px-1.5 py-0.5 rounded">{e.type_examen}</span>
                  {e.valeur_normale && <p className="text-xs text-slate-400 mt-0.5">Réf: {e.valeur_normale}</p>}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {e.resultat ? (
                    <span className="font-semibold text-slate-800">{resumeResultat(e.resultat, e.unite)}</span>
                  ) : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    {e.statut === 'prescrit' && (
                      <button onClick={() => prelever(e)} className="btn-outline text-xs py-1 px-2 flex items-center gap-1">
                        <FlaskRound size={13} /> {t('lab.sample')}
                      </button>
                    )}
                    {(e.statut === 'en_cours' || e.statut === 'resultat_disponible') && (
                      <button onClick={() => openResultat(e)} className="btn-secondary text-xs py-1 px-2 flex items-center gap-1">
                        <FileText size={13} /> {e.resultat ? t('lab.edit_result') : t('lab.enter_result')}
                      </button>
                    )}
                    {e.statut === 'resultat_disponible' && (
                      <button onClick={() => valider(e)} className="btn-primary text-xs py-1 px-2 flex items-center gap-1">
                        <CheckCircle size={13} /> {t('c.validate')}
                      </button>
                    )}
                    {e.statut === 'valide' && (
                      <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle size={13} /> {t('lab.validated')}</span>
                    )}
                    {e.resultat && (
                      <button onClick={() => setPrintExam(e)} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600" title={t('c.print')}>
                        <Printer size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={showResultat} onClose={() => setShowResultat(false)} title={t('lab.result_title')} size="md">
        {selected && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl">
              <p className="font-semibold text-slate-800">{selected.libelle}</p>
              <p className="text-xs text-slate-500">{selected.patient} — {selected.numero}</p>
            </div>
            {params ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="bg-primary-50 text-primary-600 px-2 py-0.5 rounded font-medium">{t('lab.panel')} — {params.length} {t('lab.parameters')}</span>
                </div>
                <div className="max-h-[50vh] overflow-auto rounded-lg border border-slate-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="text-left px-3 py-2 text-slate-500 font-medium">{t('lab.parameter')}</th>
                        <th className="text-left px-3 py-2 text-slate-500 font-medium w-28">{t('lab.col_result')}</th>
                        <th className="text-left px-3 py-2 text-slate-500 font-medium hidden sm:table-cell">{t('lab.ref_value')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {params.map((p, i) => (
                        <tr key={i} className="border-b border-slate-50">
                          <td className="px-3 py-1.5 text-slate-700">{p.nom}</td>
                          <td className="px-3 py-1.5">
                            <div className="flex items-center gap-1">
                              <input className="input text-sm !py-1" value={p.valeur} onChange={e => setParam(i, e.target.value)} />
                              {p.unite && <span className="text-xs text-slate-400 whitespace-nowrap">{p.unite}</span>}
                            </div>
                          </td>
                          <td className="px-3 py-1.5 text-xs text-slate-400 hidden sm:table-cell">{p.valeur_normale || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <label className="label">{t('lab.notes')}</label>
                  <input className="input" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">{t('lab.col_result')} *</label>
                  <textarea className="input h-20 resize-none" value={form.resultat} onChange={e => setForm(p => ({ ...p, resultat: e.target.value }))} autoFocus />
                </div>
                <div>
                  <label className="label">{t('lab.ref_value')}</label>
                  <input className="input" value={form.valeur_normale} onChange={e => setForm(p => ({ ...p, valeur_normale: e.target.value }))} />
                </div>
                <div>
                  <label className="label">{t('lab.unit')}</label>
                  <input className="input" value={form.unite} onChange={e => setForm(p => ({ ...p, unite: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="label">{t('lab.notes')}</label>
                  <input className="input" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                </div>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button className="btn-outline" onClick={() => setShowResultat(false)}>{t('c.cancel')}</button>
              <button className="btn-primary" onClick={saveResultat} disabled={saving}>{saving ? t('c.saving') : t('c.save')}</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!printExam} onClose={() => setPrintExam(null)} title={t('lab.report_title')} size="lg">
        {printExam && (
          <CompteRenduLabo
            patient={{ nom: printExam.patient, prenom: '', numero_dossier: '' }}
            consultation={{ numero: printExam.consultation_numero }}
            examens={[printExam]}
            onClose={() => setPrintExam(null)}
          />
        )}
      </Modal>
    </div>
  );
};
