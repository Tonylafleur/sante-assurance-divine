import React, { useState, useEffect, useCallback } from 'react';
import { Syringe, RefreshCw, Plus, Search, AlertTriangle, Calendar, Pencil, Trash2, Boxes } from 'lucide-react';
import toast from 'react-hot-toast';
import { vaccinationApi, patientsApi } from '../services/api';
import { Modal } from '../components/ui/Modal';
import { useT } from '../i18n';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const SITES = ['Bras gauche (deltoïde)', 'Bras droit (deltoïde)', 'Cuisse gauche', 'Cuisse droite', 'Orale', 'Fessier'];

export const Vaccination: React.FC = () => {
  const { t } = useT();
  const [tab, setTab] = useState<'vaccinations' | 'vaccins'>('vaccinations');
  const [vaccins, setVaccins] = useState<any[]>([]);
  const [vaccinations, setVaccinations] = useState<any[]>([]);

  const [showAdmin, setShowAdmin] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState<any[]>([]);
  const [selPatient, setSelPatient] = useState<any>(null);
  const [form, setForm] = useState({ vaccin_id: '', numero_dose: '1', numero_lot: '', site_injection: SITES[0], prochain_rdv: '', reactions: '' });
  const [saving, setSaving] = useState(false);

  // CRUD vaccins
  const emptyVaccin = { nom: '', maladie_ciblee: '', nombre_doses: '1', intervalle_doses: '', rappel: '', prix: '', stock: '' };
  const [showVaccin, setShowVaccin] = useState(false);
  const [editVaccinId, setEditVaccinId] = useState<number | null>(null);
  const [vaccinForm, setVaccinForm] = useState({ ...emptyVaccin });
  const [showStock, setShowStock] = useState(false);
  const [stockVaccin, setStockVaccin] = useState<any>(null);
  const [stockQte, setStockQte] = useState('');

  const openCreateVaccin = () => { setEditVaccinId(null); setVaccinForm({ ...emptyVaccin }); setShowVaccin(true); };
  const openEditVaccin = (v: any) => {
    setEditVaccinId(v.id);
    setVaccinForm({
      nom: v.nom || '', maladie_ciblee: v.maladie_ciblee || '', nombre_doses: String(v.nombre_doses ?? 1),
      intervalle_doses: v.intervalle_doses || '', rappel: v.rappel || '', prix: String(v.prix ?? ''), stock: String(v.stock ?? ''),
    });
    setShowVaccin(true);
  };
  const saveVaccin = async () => {
    if (!vaccinForm.nom.trim()) { toast.error(t('vac.name_required')); return; }
    setSaving(true);
    try {
      const payload = {
        nom: vaccinForm.nom.trim(), maladie_ciblee: vaccinForm.maladie_ciblee,
        nombre_doses: parseInt(vaccinForm.nombre_doses) || 1,
        intervalle_doses: vaccinForm.intervalle_doses, rappel: vaccinForm.rappel,
        prix: parseFloat(vaccinForm.prix) || 0, stock: parseFloat(vaccinForm.stock) || 0,
      };
      if (editVaccinId) { await vaccinationApi.updateVaccin(editVaccinId, payload); toast.success(t('ts.vaccine_updated')); }
      else { await vaccinationApi.createVaccin(payload); toast.success(t('ts.vaccine_added')); }
      setShowVaccin(false); load();
    } catch (err: any) { toast.error(err.response?.data?.detail || t('ts.error')); }
    setSaving(false);
  };
  const deleteVaccin = async (v: any) => {
    if (!window.confirm(`${t('vac.delete_confirm')} (${v.nom})`)) return;
    try { await vaccinationApi.deleteVaccin(v.id); toast.success(t('ts.vaccine_deleted')); load(); }
    catch (err: any) { toast.error(err.response?.data?.detail || t('ts.error')); }
  };
  const openStock = (v: any) => { setStockVaccin(v); setStockQte(''); setShowStock(true); };
  const saveStock = async () => {
    if (!stockQte) return;
    try { await vaccinationApi.entreeStock(stockVaccin.id, parseFloat(stockQte)); toast.success(t('ts.stock_updated')); setShowStock(false); load(); }
    catch (err: any) { toast.error(err.response?.data?.detail || t('ts.error')); }
  };
  const vf = (k: string) => (e: any) => setVaccinForm(p => ({ ...p, [k]: e.target.value }));

  const load = useCallback(async () => {
    try {
      const [v, vac] = await Promise.all([vaccinationApi.listVaccins(), vaccinationApi.listVaccinations()]);
      setVaccins(v.data.vaccins || []);
      setVaccinations(vac.data.vaccinations || []);
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

  const administrer = async () => {
    if (!selPatient) { toast.error(t('ts.select_patient')); return; }
    if (!form.vaccin_id) { toast.error(t('ts.select_vaccine')); return; }
    setSaving(true);
    try {
      const res = await vaccinationApi.administrer({
        patient_id: selPatient.id, vaccin_id: Number(form.vaccin_id),
        numero_dose: Number(form.numero_dose), numero_lot: form.numero_lot,
        site_injection: form.site_injection, reactions: form.reactions,
        prochain_rdv: form.prochain_rdv || null,
      });
      toast.success(t('ts.vaccination_ok') + (res.data.facture_numero ? ` — ${t('ts.billed')} (${res.data.facture_numero})` : ''));
      setShowAdmin(false); setSelPatient(null); setPatientSearch('');
      setForm({ vaccin_id: '', numero_dose: '1', numero_lot: '', site_injection: SITES[0], prochain_rdv: '', reactions: '' });
      load();
    } catch (err: any) { toast.error(err.response?.data?.detail || t('ts.error')); }
    setSaving(false);
  };

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Syringe size={24} className="text-primary-500" /> {t('vac.title')}
          </h1>
          <p className="text-slate-500 text-sm">{t('vac.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          {tab === 'vaccins' && (
            <button className="btn-primary flex items-center gap-2 text-sm" onClick={openCreateVaccin}><Plus size={15} /> {t('vac.new_vaccine')}</button>
          )}
          <button className="btn-secondary flex items-center gap-2 text-sm" onClick={() => setShowAdmin(true)}><Syringe size={15} /> {t('vac.vaccinate')}</button>
          <button className="btn-outline flex items-center gap-2 text-sm" onClick={load}><RefreshCw size={14} /> {t('c.refresh')}</button>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[['vaccinations', `${t('vac.tab_vaccinations')} (${vaccinations.length})`], ['vaccins', `${t('vac.tab_vaccines')} (${vaccins.length})`]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as any)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === k ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{l}</button>
        ))}
      </div>

      {tab === 'vaccinations' && (
        <div className="card !p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-3 text-slate-500 font-medium">{t('c.patient')}</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">{t('vac.vaccine')}</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">{t('vac.dose_lot')}</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium hidden md:table-cell">{t('c.date')}</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">{t('vac.next_rdv')}</th>
              </tr>
            </thead>
            <tbody>
              {vaccinations.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-slate-400 text-sm"><Syringe size={32} className="mx-auto mb-2 text-slate-300" />{t('vac.none')}</td></tr>
              ) : vaccinations.map(v => (
                <tr key={v.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{v.patient}</td>
                  <td className="px-4 py-3"><p className="text-slate-700">{v.vaccin}</p><p className="text-xs text-slate-400">{v.maladie_ciblee}</p></td>
                  <td className="px-4 py-3 text-slate-600">Dose {v.numero_dose}/{v.nombre_doses}{v.numero_lot && <span className="text-xs text-slate-400 block">Lot: {v.numero_lot}</span>}</td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell text-xs">{format(new Date(v.date_vaccination), 'dd/MM/yy', { locale: fr })}</td>
                  <td className="px-4 py-3">
                    {v.prochain_rdv ? <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded flex items-center gap-1 w-fit"><Calendar size={11} />{format(new Date(v.prochain_rdv), 'dd/MM/yy', { locale: fr })}</span> : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'vaccins' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {vaccins.length === 0 ? (
            <div className="card py-12 text-center sm:col-span-2 lg:col-span-3"><Syringe size={32} className="mx-auto mb-2 text-slate-300" /><p className="text-slate-400 text-sm">{t('vac.none')}</p></div>
          ) : vaccins.map(v => (
            <div key={v.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800">{v.nom}</p>
                  <p className="text-xs text-slate-500">{v.maladie_ciblee}</p>
                </div>
                {v.stock_bas && <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />}
              </div>
              <div className="flex items-center justify-between mt-3 text-xs">
                <span className="text-slate-500">{v.nombre_doses} {t('vac.doses_label')}</span>
                <span className={`font-semibold ${v.stock_bas ? 'text-red-600' : 'text-green-600'}`}>{t('vac.stock')}: {v.stock}</span>
                <span className="text-slate-700 font-medium">{v.prix?.toLocaleString('fr-FR')} F</span>
              </div>
              <div className="flex items-center gap-1 justify-end mt-3 pt-2 border-t border-slate-50">
                <button onClick={() => openStock(v)} className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors" title={t('vac.add_stock')}><Boxes size={15} /></button>
                <button onClick={() => openEditVaccin(v)} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600 transition-colors" title={t('c.edit')}><Pencil size={15} /></button>
                <button onClick={() => deleteVaccin(v)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors" title={t('pha.disable')}><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showAdmin} onClose={() => setShowAdmin(false)} title={t('vac.administer_title')} size="lg">
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
            <div className="col-span-2">
              <label className="label">{t('vac.vaccine')} *</label>
              <select className="input" value={form.vaccin_id} onChange={e => setForm(p => ({ ...p, vaccin_id: e.target.value }))}>
                <option value="">{t('login.service_ph')}</option>
                {vaccins.map(v => <option key={v.id} value={v.id} disabled={v.stock < 1}>{v.nom} {v.stock < 1 ? '(rupture)' : `(stock: ${v.stock})`}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t('vac.dose_no')}</label>
              <input className="input" type="number" min="1" value={form.numero_dose} onChange={e => setForm(p => ({ ...p, numero_dose: e.target.value }))} />
            </div>
            <div>
              <label className="label">{t('vac.lot_no')}</label>
              <input className="input" value={form.numero_lot} onChange={e => setForm(p => ({ ...p, numero_lot: e.target.value }))} />
            </div>
            <div>
              <label className="label">{t('vac.site')}</label>
              <select className="input" value={form.site_injection} onChange={e => setForm(p => ({ ...p, site_injection: e.target.value }))}>
                {SITES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t('vac.next_rdv')}</label>
              <input className="input" type="date" value={form.prochain_rdv} onChange={e => setForm(p => ({ ...p, prochain_rdv: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label">{t('vac.reactions')}</label>
              <input className="input" value={form.reactions} onChange={e => setForm(p => ({ ...p, reactions: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button className="btn-outline" onClick={() => setShowAdmin(false)}>{t('c.cancel')}</button>
            <button className="btn-primary flex items-center gap-2" onClick={administrer} disabled={saving}><Syringe size={15} /> {saving ? t('c.saving') : t('vac.administer')}</button>
          </div>
        </div>
      </Modal>

      {/* Modal création / modification de vaccin */}
      <Modal open={showVaccin} onClose={() => setShowVaccin(false)} title={editVaccinId ? t('vac.edit_vaccine') : t('vac.new_vaccine')} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">{t('vac.f_name')} *</label>
              <input className="input" value={vaccinForm.nom} onChange={vf('nom')} placeholder="BCG, Pentavalent, VAR…" autoFocus />
            </div>
            <div className="col-span-2">
              <label className="label">{t('vac.f_disease')}</label>
              <input className="input" value={vaccinForm.maladie_ciblee} onChange={vf('maladie_ciblee')} />
            </div>
            <div>
              <label className="label">{t('vac.f_doses')}</label>
              <input className="input" type="number" min="1" value={vaccinForm.nombre_doses} onChange={vf('nombre_doses')} />
            </div>
            <div>
              <label className="label">{t('vac.f_interval')}</label>
              <input className="input" value={vaccinForm.intervalle_doses} onChange={vf('intervalle_doses')} placeholder="4 semaines" />
            </div>
            <div>
              <label className="label">{t('vac.f_booster')}</label>
              <input className="input" value={vaccinForm.rappel} onChange={vf('rappel')} />
            </div>
            <div>
              <label className="label">{t('vac.f_price')}</label>
              <input className="input" type="number" min="0" value={vaccinForm.prix} onChange={vf('prix')} placeholder="0" />
            </div>
            {!editVaccinId && (
              <div>
                <label className="label">{t('vac.f_stock')}</label>
                <input className="input" type="number" min="0" value={vaccinForm.stock} onChange={vf('stock')} placeholder="0" />
              </div>
            )}
          </div>
          <div className="flex gap-3 justify-end">
            <button className="btn-outline" onClick={() => setShowVaccin(false)}>{t('c.cancel')}</button>
            <button className="btn-primary" onClick={saveVaccin} disabled={saving}>{saving ? t('c.saving') : t('c.save')}</button>
          </div>
        </div>
      </Modal>

      {/* Modal entrée de stock */}
      <Modal open={showStock} onClose={() => setShowStock(false)} title={t('vac.add_stock')} size="sm">
        {stockVaccin && (
          <div className="space-y-4">
            <div className="p-3 bg-primary-50 rounded-xl border border-primary-100">
              <p className="font-semibold text-primary-800">{stockVaccin.nom}</p>
              <p className="text-sm text-primary-700 mt-1">{t('vac.stock')}: <strong>{stockVaccin.stock}</strong> {t('vac.doses_label')}</p>
            </div>
            <div>
              <label className="label">{t('vac.qty_received')}</label>
              <input className="input" type="number" min="1" value={stockQte} onChange={e => setStockQte(e.target.value)} autoFocus />
            </div>
            <div className="flex gap-3 justify-end">
              <button className="btn-outline" onClick={() => setShowStock(false)}>{t('c.cancel')}</button>
              <button className="btn-primary" onClick={saveStock} disabled={!stockQte}>{t('c.validate')}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
