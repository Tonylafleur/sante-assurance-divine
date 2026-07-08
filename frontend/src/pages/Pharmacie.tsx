import React, { useState, useEffect, useCallback } from 'react';
import {
  Pill, AlertTriangle, CheckCircle, Plus, Package, Search,
  RefreshCw, Edit2, Trash2, Ban, Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import { pharmacieApi } from '../services/api';
import { Modal } from '../components/ui/Modal';
import { useWebSocket } from '../hooks/useWebSocket';
import { uniteContenu } from '../utils/pharma';
import { useT } from '../i18n';

const FORMES = ['Comprimé', 'Gélule', 'Sirop', 'Injectable', 'Pommade', 'Suppositoire', 'Collyre', 'Sachet', 'Solution', 'Suspension buvable', 'Crème', 'Autre'];
const CONDITIONNEMENTS: Record<string, { label: string; hint: string }> = {
  plaquette: { label: 'Plaquette', hint: 'Ex: 10 cp/plaquette' },
  'boîte': { label: 'Boîte', hint: 'Ex: 6 ampoules/boîte' },
  flacon: { label: 'Flacon', hint: 'Ex: 125 mL/flacon' },
  tube: { label: 'Tube', hint: 'Ex: 30g/tube' },
  sachet: { label: 'Sachet', hint: 'Ex: 1 dose/sachet' },
  ampoule: { label: 'Ampoule', hint: 'Unité injectable' },
  'unité': { label: 'Unité', hint: 'Vente à l\'unité' },
  bidon: { label: 'Bidon', hint: 'Grandes solutions' },
};

const STATUT_COLORS: Record<string, string> = {
  en_attente: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  dispensee: 'bg-green-100 text-green-700 border-green-200',
  partiellement_dispensee: 'bg-blue-100 text-blue-700 border-blue-200',
  annulee: 'bg-slate-100 text-slate-500 border-slate-200',
};

const STATUT_LABELS: Record<string, string> = {
  en_attente: 'En attente',
  dispensee: 'Dispensée',
  partiellement_dispensee: 'Partielle',
  annulee: 'Annulée',
  validee: 'Validée',
};

const emptyMed = {
  nom_commercial: '', dci: '', forme: 'Comprimé', dosage: '',
  type_conditionnement: 'plaquette', nb_par_conditionnement: 10,
  volume_ml: '', prix_unitaire: '', prix_conditionnement: '',
  stock_actuel: '', seuil_alerte: '10',
  fabricant: '', classe_therapeutique: '', necessite_ordonnance: true, notes: '',
};

export const Pharmacie: React.FC = () => {
  const { t } = useT();
  const [tab, setTab] = useState<'prescriptions' | 'stock'>('prescriptions');
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [medicaments, setMedicaments] = useState<any[]>([]);
  const [searchMed, setSearchMed] = useState('');
  const [alerteOnly, setAlerteOnly] = useState(false);
  const [showMedModal, setShowMedModal] = useState(false);
  const [showEntreeModal, setShowEntreeModal] = useState(false);
  const [editingMed, setEditingMed] = useState<any>(null);   // null = création
  const [selectedMedForStock, setSelectedMedForStock] = useState<any>(null);
  const [entreeQte, setEntreeQte] = useState('');
  const [entreeMotif, setEntreeMotif] = useState('Approvisionnement');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyMed });
  const [dispensQte, setDispensQte] = useState<Record<number, string>>({});
  // Disponibilité (badge indisponible)
  const [showDispoModal, setShowDispoModal] = useState(false);
  const [dispoMed, setDispoMed] = useState<any>(null);
  const [motifIndispo, setMotifIndispo] = useState('');

  useWebSocket('pharmacie');

  const loadPrescriptions = useCallback(async () => {
    try {
      const res = await pharmacieApi.listPrescriptions({ statut: 'en_attente' });
      setPrescriptions(res.data.prescriptions || []);
    } catch {}
  }, []);

  const loadMedicaments = useCallback(async () => {
    try {
      const params: any = {};
      if (searchMed) params.search = searchMed;
      if (alerteOnly) params.alerte_stock = true;
      const res = await pharmacieApi.listMedicaments(params);
      setMedicaments(res.data.medicaments || []);
    } catch {}
  }, [searchMed, alerteOnly]);

  useEffect(() => { loadPrescriptions(); }, [loadPrescriptions]);
  useEffect(() => {
    const t = setTimeout(() => loadMedicaments(), 300);
    return () => clearTimeout(t);
  }, [loadMedicaments]);

  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const openCreate = () => {
    setEditingMed(null);
    setForm({ ...emptyMed });
    setShowMedModal(true);
  };

  const openEdit = (med: any) => {
    setEditingMed(med);
    setForm({
      nom_commercial: med.nom_commercial || '',
      dci: med.dci || '',
      forme: med.forme || 'Comprimé',
      dosage: med.dosage || '',
      type_conditionnement: med.type_conditionnement || 'plaquette',
      nb_par_conditionnement: med.nb_par_conditionnement || 1,
      volume_ml: med.volume_ml || '',
      prix_unitaire: med.prix_unitaire || '',
      prix_conditionnement: med.prix_conditionnement || '',
      stock_actuel: med.stock_actuel || '',
      seuil_alerte: med.seuil_alerte || '10',
      fabricant: med.fabricant || '',
      classe_therapeutique: med.classe_therapeutique || '',
      necessite_ordonnance: med.necessite_ordonnance ?? true,
      notes: med.notes || '',
    });
    setShowMedModal(true);
  };

  const saveMed = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        nb_par_conditionnement: parseInt(String(form.nb_par_conditionnement)) || 1,
        volume_ml: form.volume_ml ? parseFloat(String(form.volume_ml)) : null,
        prix_unitaire: parseFloat(String(form.prix_unitaire)) || 0,
        prix_conditionnement: parseFloat(String(form.prix_conditionnement)) || 0,
        stock_actuel: parseFloat(String(form.stock_actuel)) || 0,
        seuil_alerte: parseFloat(String(form.seuil_alerte)) || 10,
      };
      if (editingMed) {
        await pharmacieApi.updateMedicament(editingMed.id, payload);
        toast.success(t('ts.med_updated'));
      } else {
        await pharmacieApi.createMedicament(payload);
        toast.success(t('ts.med_added'));
      }
      setShowMedModal(false);
      loadMedicaments();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('ts.error'));
    }
    setSaving(false);
  };

  const deleteMed = async (med: any) => {
    if (!confirm(`${t('ts.disable_confirm')} (${med.nom_commercial})`)) return;
    try {
      await pharmacieApi.deleteMedicament(med.id);
      toast.success(t('ts.med_disabled'));
      loadMedicaments();
    } catch { toast.error(t('ts.error')); }
  };

  const entreeStock = async () => {
    if (!selectedMedForStock || !entreeQte) return;
    setSaving(true);
    try {
      await pharmacieApi.entreeStock({
        medicament_id: selectedMedForStock.id,
        quantite: parseFloat(entreeQte),
        motif: entreeMotif,
      });
      toast.success(`${t('ts.stock_added')}: ${entreeQte} ${selectedMedForStock.unite_stock}(s)`);
      setShowEntreeModal(false);
      setEntreeQte('');
      setEntreeMotif('Approvisionnement');
      loadMedicaments();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('ts.error'));
    }
    setSaving(false);
  };

  const dispenser = async (prescription: any) => {
    const qteOverride = dispensQte[prescription.id];
    try {
      const res = await pharmacieApi.dispenser(prescription.id, qteOverride ? { quantite: parseFloat(qteOverride) } : undefined);
      toast.success(res.data.message);
      if (res.data.alerte_stock) toast(res.data.alerte_stock, { icon: '⚠️' });
      loadPrescriptions();
      loadMedicaments();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('ts.stock_insufficient'));
    }
  };

  const condLabel = (med: any) => {
    const cond = CONDITIONNEMENTS[med.type_conditionnement];
    return cond ? cond.label : med.type_conditionnement;
  };

  // Disponibilité : indisponible → demande un motif ; redisponible → direct
  const openIndispo = (med: any) => { setDispoMed(med); setMotifIndispo(''); setShowDispoModal(true); };
  const confirmIndispo = async () => {
    if (!dispoMed) return;
    try {
      await pharmacieApi.setDisponibilite(dispoMed.id, false, motifIndispo.trim());
      toast.success(`${t('ts.marked_unavail')} (${dispoMed.nom_commercial})`);
      setShowDispoModal(false);
      loadMedicaments();
    } catch { toast.error(t('ts.error')); }
  };
  const rendreDisponible = async (med: any) => {
    try {
      await pharmacieApi.setDisponibilite(med.id, true);
      toast.success(`${t('ts.now_avail')} (${med.nom_commercial})`);
      loadMedicaments();
    } catch { toast.error(t('ts.error')); }
  };

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('pha.title')}</h1>
          <p className="text-slate-500 text-sm">{prescriptions.length} {t('pha.pending')}</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={openCreate}>
          <Plus size={16} /> {t('pha.new_med')}
        </button>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[
          { key: 'prescriptions', label: `${t('pha.tab_orders')} (${prescriptions.length})` },
          { key: 'stock', label: t('pha.tab_stock') },
        ].map(tb => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === tb.key ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* ── PRESCRIPTIONS ── */}
      {tab === 'prescriptions' && (
        <div className="space-y-3">
          {prescriptions.length === 0 ? (
            <div className="card py-12 text-center">
              <CheckCircle size={40} className="mx-auto text-green-300 mb-3" />
              <p className="text-slate-400 text-sm">{t('pha.none_order')}</p>
            </div>
          ) : prescriptions.map((p) => (
            <div key={p.id} className="card space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded">{p.consultation_numero}</span>
                    <span className="font-semibold text-slate-800">{p.patient}</span>
                    <span className={`text-xs px-2 py-0.5 rounded border ${STATUT_COLORS[p.statut] || ''}`}>
                      {STATUT_LABELS[p.statut] || p.statut}
                    </span>
                    {p.est_disponible === false && (
                      <span className="text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded-full">{t('pha.unavailable')}</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    <span className="font-medium">{p.medicament}</span>
                    {p.dci && <span className="text-slate-400"> ({p.dci})</span>}
                    {p.dosage && <span className="text-slate-500"> — {p.dosage}</span>}
                  </p>
                  <p className="text-xs text-slate-500">{p.posologie}</p>
                  {p.duree_traitement && <p className="text-xs text-slate-400">Durée: {p.duree_traitement}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-slate-700">
                    {p.quantite_prescrite} {p.unite_stock || condLabel(p)}
                    {p.nb_par_conditionnement > 1 && (
                      <span className="text-xs text-slate-400 ml-1">× {p.nb_par_conditionnement} unités</span>
                    )}
                  </p>
                  {p.quantite_dispensee > 0 && (
                    <p className="text-xs text-slate-400">{p.quantite_dispensee} dispensée(s)</p>
                  )}
                </div>
              </div>

              {p.statut !== 'dispensee' && p.statut !== 'annulee' && (
                <div className="flex items-center gap-2 pt-1 border-t border-slate-50">
                  <input
                    type="number"
                    className="input w-24 text-sm"
                    placeholder={String(p.quantite_prescrite - p.quantite_dispensee)}
                    value={dispensQte[p.id] || ''}
                    onChange={e => setDispensQte(prev => ({ ...prev, [p.id]: e.target.value }))}
                    min="0.5"
                    step="0.5"
                  />
                  <span className="text-xs text-slate-400">{p.unite_stock || condLabel(p)}(s)</span>
                  <button
                    className="btn-primary text-sm py-1.5 px-4"
                    onClick={() => dispenser(p)}
                  >
                    {t('pha.dispense')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── STOCK ── */}
      {tab === 'stock' && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pl-8 text-sm" placeholder={t('pha.search_ph')} value={searchMed} onChange={e => setSearchMed(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={alerteOnly} onChange={e => setAlerteOnly(e.target.checked)} className="rounded" />
              {t('pha.alerts_only')}
            </label>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-100 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">{t('pha.col_med')}</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">{t('pha.col_form')}</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">{t('pha.col_packaging')}</th>
                  <th className="text-right px-4 py-3 text-slate-500 font-medium">{t('pha.col_stock')}</th>
                  <th className="text-right px-4 py-3 text-slate-500 font-medium">{t('pha.col_price')}</th>
                  <th className="text-center px-4 py-3 text-slate-500 font-medium">{t('c.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {medicaments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400">
                      <Package size={32} className="mx-auto mb-2 text-slate-300" />
                      {t('pha.none_med')}
                    </td>
                  </tr>
                ) : medicaments.map((m) => (
                  <tr key={m.id} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${m.est_disponible === false ? 'bg-red-50/60' : m.stock_alerte ? 'bg-red-50/40' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-slate-800">{m.nom_commercial}</p>
                        {m.est_disponible === false && (
                          <span className="text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded-full">INDISPONIBLE</span>
                        )}
                      </div>
                      {m.dci && <p className="text-xs text-slate-400">{m.dci}</p>}
                      {m.classe_therapeutique && <p className="text-xs text-primary-500">{m.classe_therapeutique}</p>}
                      {m.est_disponible === false && m.motif_indisponibilite && (
                        <p className="text-[11px] text-red-500 mt-0.5">Motif : {m.motif_indisponibilite}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{m.forme} {m.dosage && `${m.dosage}`}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {CONDITIONNEMENTS[m.type_conditionnement]?.label || m.type_conditionnement}
                      </span>
                      {m.nb_par_conditionnement > 1 && (
                        <span className="text-xs text-slate-400 ml-1">{m.nb_par_conditionnement}{uniteContenu(m.forme)}/{CONDITIONNEMENTS[m.type_conditionnement]?.label?.toLowerCase() || 'cond.'}</span>
                      )}
                      {m.volume_ml && <span className="text-xs text-slate-400 ml-1">{m.volume_ml} mL</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {m.stock_alerte && <AlertTriangle size={14} className="text-red-500" />}
                        <span className={`font-semibold ${m.stock_alerte ? 'text-red-600' : 'text-slate-700'}`}>
                          {m.stock_actuel}
                        </span>
                        <span className="text-xs text-slate-400">{m.unite_stock}</span>
                      </div>
                      <p className="text-xs text-slate-400">seuil: {m.seuil_alerte}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {m.prix_conditionnement > 0 ? `${m.prix_conditionnement.toLocaleString()} F` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors"
                          title={t('pha.entry_stock')}
                          onClick={() => { setSelectedMedForStock(m); setShowEntreeModal(true); }}
                        >
                          <Plus size={15} />
                        </button>
                        <button
                          className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600 transition-colors"
                          title={t('c.edit')}
                          onClick={() => openEdit(m)}
                        >
                          <Edit2 size={15} />
                        </button>
                        {m.est_disponible === false ? (
                          <button
                            className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors"
                            title={t('pha.make_avail')}
                            onClick={() => rendreDisponible(m)}
                          >
                            <Eye size={15} />
                          </button>
                        ) : (
                          <button
                            className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition-colors"
                            title={t('pha.mark_unavail')}
                            onClick={() => openIndispo(m)}
                          >
                            <Ban size={15} />
                          </button>
                        )}
                        <button
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                          title={t('pha.disable')}
                          onClick={() => deleteMed(m)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL Médicament (créer / modifier) ── */}
      <Modal open={showMedModal} onClose={() => setShowMedModal(false)} title={editingMed ? t('c.edit') : t('pha.new_med')} size="xl">
        <form onSubmit={saveMed} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="label">Nom commercial *</label>
              <input className="input" value={form.nom_commercial} onChange={f('nom_commercial')} required placeholder="Ex: Paracétamol COOPER" />
            </div>
            <div>
              <label className="label">DCI (substance active)</label>
              <input className="input" value={form.dci} onChange={f('dci')} placeholder="Ex: Paracétamol" />
            </div>
            <div>
              <label className="label">Forme galénique</label>
              <select className="input" value={form.forme} onChange={f('forme')}>
                {FORMES.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Dosage</label>
              <input className="input" value={form.dosage} onChange={f('dosage')} placeholder="Ex: 500mg, 250mg/5mL" />
            </div>
            <div>
              <label className="label">Classe thérapeutique</label>
              <input className="input" value={form.classe_therapeutique} onChange={f('classe_therapeutique')} placeholder="Ex: Antipaludéen, Antibiotique" />
            </div>
            <div>
              <label className="label">Fabricant</label>
              <input className="input" value={form.fabricant} onChange={f('fabricant')} />
            </div>
          </div>

          {/* Conditionnement */}
          <div className="border-t pt-4">
            <p className="text-sm font-semibold text-slate-600 mb-3">Conditionnement & Stock</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Type de conditionnement</label>
                <select className="input" value={form.type_conditionnement} onChange={f('type_conditionnement')}>
                  {Object.entries(CONDITIONNEMENTS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-0.5">{CONDITIONNEMENTS[form.type_conditionnement]?.hint}</p>
              </div>
              <div>
                <label className="label">Unités par conditionnement</label>
                <input type="number" className="input" value={form.nb_par_conditionnement} onChange={f('nb_par_conditionnement')} min={1} placeholder="10" />
              </div>
              {(form.type_conditionnement === 'flacon' || form.type_conditionnement === 'bidon') && (
                <div>
                  <label className="label">Volume (mL)</label>
                  <input type="number" className="input" value={form.volume_ml} onChange={f('volume_ml')} placeholder="125" />
                </div>
              )}
              <div>
                <label className="label">Stock initial (conditionnements)</label>
                <input type="number" className="input" value={form.stock_actuel} onChange={f('stock_actuel')} min={0} placeholder="0" />
              </div>
              <div>
                <label className="label">Seuil d'alerte</label>
                <input type="number" className="input" value={form.seuil_alerte} onChange={f('seuil_alerte')} min={0} />
              </div>
            </div>
          </div>

          {/* Prix */}
          <div className="border-t pt-4">
            <p className="text-sm font-semibold text-slate-600 mb-3">Prix</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Prix par unité (FCFA)</label>
                <input type="number" className="input" value={form.prix_unitaire} onChange={f('prix_unitaire')} min={0} placeholder="0" />
                <p className="text-xs text-slate-400 mt-0.5">Prix d'un comprimé, mL, etc.</p>
              </div>
              <div>
                <label className="label">Prix par conditionnement (FCFA)</label>
                <input type="number" className="input" value={form.prix_conditionnement} onChange={f('prix_conditionnement')} min={0} placeholder="0" />
                <p className="text-xs text-slate-400 mt-0.5">Prix affiché au patient</p>
              </div>
            </div>
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea className="input h-16 resize-none" value={form.notes} onChange={f('notes')} placeholder="Informations complémentaires..." />
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="ordo" checked={form.necessite_ordonnance} onChange={f('necessite_ordonnance')} className="rounded" />
            <label htmlFor="ordo" className="text-sm text-slate-600 cursor-pointer">Nécessite une ordonnance</label>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" className="btn-outline" onClick={() => setShowMedModal(false)}>{t('c.cancel')}</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? t('c.saving') : editingMed ? t('c.save') : t('pha.new_med')}</button>
          </div>
        </form>
      </Modal>

      {/* ── MODAL Entrée stock ── */}
      <Modal open={showEntreeModal} onClose={() => setShowEntreeModal(false)} title={t('vac.stock')} size="sm">
        {selectedMedForStock && (
          <div className="space-y-4">
            <div className="p-3 bg-primary-50 rounded-xl border border-primary-100">
              <p className="font-semibold text-primary-800">{selectedMedForStock.nom_commercial}</p>
              <p className="text-xs text-primary-600">{selectedMedForStock.dosage} — {selectedMedForStock.forme}</p>
              <p className="text-sm text-primary-700 mt-1">
                Stock actuel: <strong>{selectedMedForStock.stock_actuel} {selectedMedForStock.unite_stock}(s)</strong>
              </p>
            </div>
            <div>
              <label className="label">Quantité reçue ({selectedMedForStock.unite_stock}s)</label>
              <input
                type="number"
                className="input"
                value={entreeQte}
                onChange={e => setEntreeQte(e.target.value)}
                placeholder={`Nombre de ${selectedMedForStock.unite_stock}s`}
                min="0.5" step="0.5" autoFocus
              />
              {entreeQte && selectedMedForStock.nb_par_conditionnement > 1 && (
                <p className="text-xs text-slate-500 mt-1">
                  = {(parseFloat(entreeQte) * selectedMedForStock.nb_par_conditionnement).toFixed(0)} unités totales
                </p>
              )}
            </div>
            <div>
              <label className="label">Motif</label>
              <input className="input" value={entreeMotif} onChange={e => setEntreeMotif(e.target.value)} />
            </div>
            <div className="flex gap-3 justify-end">
              <button className="btn-outline" onClick={() => setShowEntreeModal(false)}>{t('c.cancel')}</button>
              <button className="btn-primary" onClick={entreeStock} disabled={!entreeQte || saving}>
                {saving ? t('c.saving') : t('c.validate')}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MODAL Indisponibilité ── */}
      <Modal open={showDispoModal} onClose={() => setShowDispoModal(false)} title={t('pha.unavailable')} size="sm">
        {dispoMed && (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
              <p className="font-semibold text-amber-800">{dispoMed.nom_commercial}</p>
              <p className="text-xs text-amber-600">{dispoMed.dosage} — {dispoMed.forme}</p>
              <p className="text-xs text-amber-700 mt-1">
                {t('pha.presc_info')}
              </p>
            </div>
            <div>
              <label className="label">Motif (rupture, retrait, péremption...)</label>
              <textarea className="input h-20 resize-none" value={motifIndispo} onChange={e => setMotifIndispo(e.target.value)}
                placeholder="Ex: rupture fournisseur, en attente de réapprovisionnement" autoFocus />
            </div>
            <div className="flex gap-3 justify-end">
              <button className="btn-outline" onClick={() => setShowDispoModal(false)}>{t('c.cancel')}</button>
              <button className="btn-primary !bg-amber-500 hover:!bg-amber-600 flex items-center gap-2" onClick={confirmIndispo}>
                <Ban size={16} /> {t('c.validate')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
