import React, { useState, useEffect, useCallback } from 'react';
import { Receipt, Search, CheckCircle, RefreshCw, Printer, Plus, Pencil, Ban, Trash2, Lock, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { caisseApi, patientsApi } from '../services/api';
import { Modal } from '../components/ui/Modal';
import { TicketCaisse } from '../components/ui/TicketCaisse';
import { BadgeStatut } from '../components/ui/Badge';
import { useAuthStore } from '../store/authStore';
import { useT } from '../i18n';
import { useWebSocket } from '../hooks/useWebSocket';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type Ligne = { type_acte: string; description: string; quantite: number; prix_unitaire: number; verrouille: boolean };

export const Caisse: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const { t } = useT();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const [factures, setFactures] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [parService, setParService] = useState<any>(null);
  const [tarifs, setTarifs] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  // Paiement
  const [showPaiement, setShowPaiement] = useState(false);
  const [selectedFacture, setSelectedFacture] = useState<any>(null);
  const [montantPaiement, setMontantPaiement] = useState('');
  const [modePaiement, setModePaiement] = useState('Espèces');

  // Ticket
  const [showTicket, setShowTicket] = useState(false);
  const [ticketData, setTicketData] = useState<any>(null);

  // Éditeur facture (création / modification)
  const [showEditor, setShowEditor] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [edPatient, setEdPatient] = useState('');
  const [edPatientId, setEdPatientId] = useState<number | null>(null);
  const [edLignes, setEdLignes] = useState<Ligne[]>([]);
  const [edRemise, setEdRemise] = useState('0');
  const [edNotes, setEdNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Annulation
  const [showAnnul, setShowAnnul] = useState(false);
  const [annulFacture, setAnnulFacture] = useState<any>(null);
  const [motifAnnul, setMotifAnnul] = useState('');

  useWebSocket('caisse');

  const load = useCallback(async () => {
    try {
      const [f, s, ps] = await Promise.all([
        caisseApi.listFactures(), caisseApi.statJournalier(), caisseApi.statParService(false),
      ]);
      setFactures(f.data);
      setStats(s.data);
      setParService(ps.data);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    caisseApi.tarifs().then(r => setTarifs(r.data || [])).catch(() => {});
    patientsApi.list().then(r => setPatients(r.data?.patients || r.data || [])).catch(() => {});
  }, [load]);

  const tarifPour = (type: string) => tarifs.find(t => t.type_acte === type);

  // ── Paiement ───────────────────────────────────────────────
  const handlePaiement = async () => {
    if (!selectedFacture || !montantPaiement) return;
    try {
      await caisseApi.paiement({ facture_id: selectedFacture.id, montant: parseFloat(montantPaiement), mode_paiement: modePaiement });
      toast.success(t('ts.payment_ok'));
      setShowPaiement(false);
      setMontantPaiement('');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('ts.error'));
    }
  };

  const openTicket = async (facture: any) => {
    try {
      const res = await caisseApi.getTicket(facture.id);
      setTicketData(res.data);
      setShowTicket(true);
    } catch { toast.error(t('ts.ticket_error')); }
  };

  // ── Éditeur facture ────────────────────────────────────────
  const openCreate = () => {
    setEditId(null);
    setEdPatient(''); setEdPatientId(null);
    const t = tarifs[0];
    setEdLignes([{ type_acte: t?.type_acte || 'Consultation', description: t?.libelle || '', quantite: 1, prix_unitaire: t?.montant || 0, verrouille: !!t }]);
    setEdRemise('0'); setEdNotes('');
    setShowEditor(true);
  };

  const openEdit = async (facture: any) => {
    try {
      const res = await caisseApi.getTicket(facture.id);
      const d = res.data;
      setEditId(facture.id);
      setEdPatient(d.patient ? `${d.patient.nom} ${d.patient.prenom}` : '');
      setEdPatientId(d.patient?.id || facture.patient_id);
      setEdLignes((d.lignes || []).map((l: any) => ({
        type_acte: l.type_acte, description: l.description, quantite: l.quantite,
        prix_unitaire: l.prix_unitaire, verrouille: !!tarifPour(l.type_acte),
      })));
      setEdRemise(String(d.facture.montant_remise || 0));
      setEdNotes(d.facture.notes || '');
      setShowEditor(true);
    } catch { toast.error(t('ts.invoice_error')); }
  };

  const setLigne = (i: number, patch: Partial<Ligne>) =>
    setEdLignes(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));

  const changeType = (i: number, type: string) => {
    const t = tarifPour(type);
    setLigne(i, { type_acte: type, description: t?.libelle || edLignes[i].description, prix_unitaire: t ? t.montant : edLignes[i].prix_unitaire, verrouille: !!t });
  };

  const addLigne = () => {
    const t = tarifs[0];
    setEdLignes(prev => [...prev, { type_acte: t?.type_acte || 'Consultation', description: t?.libelle || '', quantite: 1, prix_unitaire: t?.montant || 0, verrouille: !!t }]);
  };
  const removeLigne = (i: number) => setEdLignes(prev => prev.filter((_, idx) => idx !== i));

  const totalBrut = edLignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0);
  const remiseNum = parseFloat(edRemise) || 0;
  const totalNet = Math.max(0, totalBrut - remiseNum);

  const saveFacture = async () => {
    if (!editId && !edPatientId) { toast.error(t('ts.select_patient')); return; }
    if (edLignes.length === 0) { toast.error(t('ts.line_req')); return; }
    setSaving(true);
    try {
      const payload = {
        patient_id: edPatientId,
        lignes: edLignes.map(l => ({ type_acte: l.type_acte, description: l.description, quantite: Number(l.quantite), prix_unitaire: Number(l.prix_unitaire) })),
        montant_remise: remiseNum,
        notes: edNotes,
      };
      if (editId) await caisseApi.updateFacture(editId, payload);
      else await caisseApi.createFacture(payload);
      toast.success(editId ? t('cai.save_changes') : t('cai.create'));
      setShowEditor(false);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Erreur enregistrement');
    } finally { setSaving(false); }
  };

  // ── Annulation / suppression ───────────────────────────────
  const confirmAnnul = (f: any) => { setAnnulFacture(f); setMotifAnnul(''); setShowAnnul(true); };
  const doAnnul = async () => {
    if (!motifAnnul.trim()) { toast.error(t('cai.reason_required')); return; }
    try {
      await caisseApi.annulerFacture(annulFacture.id, motifAnnul.trim());
      toast.success(t('ts.invoice_cancelled'));
      setShowAnnul(false);
      load();
    } catch (err: any) { toast.error(err.response?.data?.detail || t('ts.error')); }
  };

  const doDelete = async (f: any) => {
    if (!window.confirm(`${t('c.delete')} — ${f.numero} ?`)) return;
    try {
      await caisseApi.deleteFacture(f.id);
      toast.success(t('ts.invoice_deleted'));
      load();
    } catch (err: any) { toast.error(err.response?.data?.detail || t('ts.error')); }
  };

  const filtered = search
    ? factures.filter(f => f.patient?.toLowerCase().includes(search.toLowerCase()) || f.numero?.includes(search))
    : factures;

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('cai.title')}</h1>
          <p className="text-slate-500 text-sm">{format(new Date(), 'd MMMM yyyy', { locale: fr })}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary flex items-center gap-2 text-sm" onClick={openCreate}>
            <Plus size={15} /> {t('cai.new_invoice')}
          </button>
          <button className="btn-outline flex items-center gap-2 text-sm" onClick={load}>
            <RefreshCw size={14} /> {t('c.refresh')}
          </button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { l: t('cai.invoices_today'), v: stats.nombre_factures },
            { l: t('cai.total_billed'), v: `${stats.total_facture_fcfa?.toLocaleString('fr-FR')} F` },
            { l: t('cai.collected'), v: `${stats.total_encaisse_fcfa?.toLocaleString('fr-FR')} F` },
            { l: t('cai.recovery_rate'), v: `${stats.taux_recouvrement}%` },
          ].map(({ l, v }) => (
            <div key={l} className="card">
              <p className="text-xs text-slate-500 mb-1">{l}</p>
              <p className="text-xl font-bold text-slate-800">{v}</p>
            </div>
          ))}
        </div>
      )}

      {/* Facturation par service */}
      {parService?.services?.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">{t('cai.by_service')}</h3>
            <span className="text-xs text-slate-400">{t('cai.col_net')} : <strong className="text-slate-700">{parService.total_net?.toLocaleString('fr-FR')} F</strong> · {t('cai.collected')} : <strong className="text-green-600">{parService.total_paye?.toLocaleString('fr-FR')} F</strong></span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {parService.services.map((s: any) => {
              const pct = parService.total_net > 0 ? Math.round((s.total_net / parService.total_net) * 100) : 0;
              return (
                <div key={s.service} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-700">{s.libelle}</p>
                    <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">{s.nombre}</span>
                  </div>
                  <p className="text-lg font-bold text-slate-800 mt-1">{s.total_net?.toLocaleString('fr-FR')} F</p>
                  <div className="flex items-center justify-between text-[11px] mt-1">
                    <span className="text-green-600">Payé {s.total_paye?.toLocaleString('fr-FR')}</span>
                    {s.restant > 0 && <span className="text-red-500">{t('cai.col_remaining')}: {s.restant?.toLocaleString('fr-FR')}</span>}
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-primary-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card !p-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-8 text-sm" placeholder={t('cai.search_ph')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-3 text-slate-500 font-medium">{t('cai.col_invoice')}</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">{t('c.patient')}</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium hidden lg:table-cell">{t('cai.col_issuer')}</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium hidden md:table-cell">{t('c.date')}</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">{t('cai.col_net')}</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium hidden md:table-cell">{t('cai.col_remaining')}</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">{t('c.status')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-400 text-sm">
                  <Receipt size={32} className="mx-auto mb-2 text-slate-300" />
                  {t('cai.none')}
                </td></tr>
              ) : filtered.map((f) => {
                const annulee = f.statut === 'annulee';
                const payee = f.statut === 'payee';
                const aPaiement = (f.montant_paye || 0) > 0;
                const peutModifier = !annulee && (!payee || isAdmin) && (!aPaiement || isAdmin);
                const peutAnnuler = !annulee && (!aPaiement || isAdmin);
                return (
                  <tr key={f.id} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${annulee ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">{f.numero}</span>
                      {f.type_source === 'mixte' && <span className="ml-1 text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">Mixte</span>}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{f.patient}</td>
                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell text-xs">
                      {f.emis_par ? <span className="inline-flex items-center gap-1"><User size={11} />{f.emis_par}</span> : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell text-xs">
                      {f.created_at ? format(new Date(f.created_at), 'dd/MM/yy HH:mm', { locale: fr }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{(f.montant_net || 0).toLocaleString('fr-FR')} F</td>
                    <td className={`px-4 py-3 text-right font-semibold hidden md:table-cell ${f.montant_restant > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                      {(f.montant_restant || 0).toLocaleString('fr-FR')} F
                    </td>
                    <td className="px-4 py-3"><BadgeStatut statut={f.statut} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openTicket(f)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors" title="Imprimer le ticket">
                          <Printer size={15} />
                        </button>
                        {peutModifier ? (
                          <button onClick={() => openEdit(f)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors" title="Modifier">
                            <Pencil size={15} />
                          </button>
                        ) : !annulee && (
                          <span className="p-1.5 text-slate-300" title="Verrouillée (soldée)"><Lock size={15} /></span>
                        )}
                        {peutAnnuler && (
                          <button onClick={() => confirmAnnul(f)} className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-500 transition-colors" title="Annuler (avec motif)">
                            <Ban size={15} />
                          </button>
                        )}
                        {isAdmin && (
                          <button onClick={() => doDelete(f)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors" title="Supprimer (admin)">
                            <Trash2 size={15} />
                          </button>
                        )}
                        {f.statut !== 'payee' && !annulee && (
                          <button onClick={() => { setSelectedFacture(f); setMontantPaiement(String(f.montant_restant)); setShowPaiement(true); }} className="btn-secondary text-xs py-1 px-2 ml-1">
                            {t('cai.collect')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal éditeur facture */}
      <Modal open={showEditor} onClose={() => setShowEditor(false)} title={editId ? t('c.edit') : t('cai.new_invoice')} size="xl">
        <div className="space-y-4">
          {/* Patient */}
          <div>
            <label className="label">{t('c.patient')}</label>
            {editId ? (
              <input className="input bg-slate-50" value={edPatient} disabled />
            ) : (
              <>
                <input className="input" list="liste-patients" value={edPatient}
                  onChange={e => {
                    setEdPatient(e.target.value);
                    const p = patients.find(x => `${x.nom} ${x.prenom}` === e.target.value || x.numero_dossier === e.target.value);
                    setEdPatientId(p?.id || null);
                  }}
                  placeholder={t('c.search_patient')} />
                <datalist id="liste-patients">
                  {patients.map(p => <option key={p.id} value={`${p.nom} ${p.prenom}`}>{p.numero_dossier}</option>)}
                </datalist>
              </>
            )}
          </div>

          {/* Lignes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="label !mb-0">{t('cai.acts')}</label>
              <span className="text-xs text-slate-400 flex items-center gap-1"><Lock size={11} /> {t('cai.locked')}</span>
            </div>
            {edLignes.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center border border-slate-100 rounded-lg p-2">
                <div className="col-span-4">
                  <select className="input text-sm" value={l.type_acte} onChange={e => changeType(i, e.target.value)}>
                    {tarifs.map(t => <option key={t.type_acte} value={t.type_acte}>{t.type_acte}</option>)}
                  </select>
                </div>
                <div className="col-span-4">
                  <input className="input text-sm" value={l.description} onChange={e => setLigne(i, { description: e.target.value })} placeholder={t('cai.desc')} />
                </div>
                <div className="col-span-1">
                  <input className="input text-sm" type="number" min="1" value={l.quantite} onChange={e => setLigne(i, { quantite: parseFloat(e.target.value) || 1 })} title="Quantité" />
                </div>
                <div className="col-span-2">
                  <div className="relative">
                    <input className={`input text-sm ${l.verrouille ? 'bg-slate-50' : ''}`} type="number" min="0" value={l.prix_unitaire}
                      onChange={e => setLigne(i, { prix_unitaire: parseFloat(e.target.value) || 0 })}
                      disabled={l.verrouille} title={l.verrouille ? 'Prix officiel verrouillé' : 'Prix libre (acte hors catalogue)'} />
                    {l.verrouille && <Lock size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300" />}
                  </div>
                </div>
                <div className="col-span-1 flex justify-center">
                  <button onClick={() => removeLigne(i)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
            <button onClick={addLigne} className="btn-outline text-sm flex items-center gap-2 w-full justify-center py-2 border-dashed">
              <Plus size={15} /> {t('cai.add_act')}
            </button>
          </div>

          {/* Remise + notes */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label flex items-center gap-1">
                {t('cai.discount')}{!isAdmin && <Lock size={11} className="text-slate-400" />}
              </label>
              <input className={`input ${!isAdmin ? 'bg-slate-50' : ''}`} type="number" min="0" value={edRemise}
                onChange={e => setEdRemise(e.target.value)} disabled={!isAdmin}
                title={isAdmin ? '' : t('cai.discount_admin')} />
              {!isAdmin && <p className="text-[10px] text-slate-400 mt-1">{t('cai.discount_admin')}</p>}
            </div>
            <div>
              <label className="label">{t('cai.notes')}</label>
              <input className="input" value={edNotes} onChange={e => setEdNotes(e.target.value)} />
            </div>
          </div>

          {/* Totaux */}
          <div className="bg-slate-50 rounded-xl p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">{t('cai.total_gross')}</span><span className="font-medium">{totalBrut.toLocaleString('fr-FR')} F</span></div>
            {remiseNum > 0 && <div className="flex justify-between text-slate-500"><span>{t('cai.discount')}</span><span>-{remiseNum.toLocaleString('fr-FR')} F</span></div>}
            <div className="flex justify-between text-base font-bold text-slate-800"><span>{t('cai.col_net')}</span><span>{totalNet.toLocaleString('fr-FR')} FCFA</span></div>
          </div>

          <div className="flex gap-3 justify-end">
            <button className="btn-outline" onClick={() => setShowEditor(false)}>{t('c.cancel')}</button>
            <button className="btn-primary flex items-center gap-2" onClick={saveFacture} disabled={saving}>
              <CheckCircle size={16} /> {saving ? t('c.saving') : editId ? t('cai.save_changes') : t('cai.create')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal paiement */}
      <Modal open={showPaiement} onClose={() => setShowPaiement(false)} title={t('cai.payment_title')} size="sm">
        <div className="space-y-4">
          {selectedFacture && (
            <div className="p-3 bg-slate-50 rounded-lg space-y-1">
              <p className="font-semibold text-slate-800">{selectedFacture.patient}</p>
              <p className="text-sm text-slate-500">{t('cai.invoice')}: {selectedFacture.numero}</p>
              <p className="text-sm text-slate-600">{t('cai.remaining_amt')}: <strong className="text-red-600">{selectedFacture.montant_restant?.toLocaleString('fr-FR')} FCFA</strong></p>
            </div>
          )}
          <div>
            <label className="label">{t('cai.amount')}</label>
            <input className="input text-lg font-semibold" type="number" value={montantPaiement} onChange={e => setMontantPaiement(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">{t('cai.payment_mode')}</label>
            <select className="input" value={modePaiement} onChange={e => setModePaiement(e.target.value)}>
              {['Espèces', 'Mobile Money', 'Carte bancaire', 'Chèque', 'Assurance'].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex gap-3 justify-end">
            <button className="btn-outline" onClick={() => setShowPaiement(false)}>{t('c.cancel')}</button>
            <button className="btn-primary flex items-center gap-2" onClick={handlePaiement}><CheckCircle size={16} /> {t('c.validate')}</button>
          </div>
        </div>
      </Modal>

      {/* Modal annulation */}
      <Modal open={showAnnul} onClose={() => setShowAnnul(false)} title={t('cai.cancel_title')} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            <strong>{annulFacture?.numero}</strong> — {t('cai.cancel_info')}
          </p>
          <div>
            <label className="label">{t('cai.cancel_reason')}</label>
            <textarea className="input h-20 resize-none" value={motifAnnul} onChange={e => setMotifAnnul(e.target.value)} autoFocus />
          </div>
          <div className="flex gap-3 justify-end">
            <button className="btn-outline" onClick={() => setShowAnnul(false)}>{t('c.back')}</button>
            <button className="btn-primary !bg-amber-500 hover:!bg-amber-600 flex items-center gap-2" onClick={doAnnul}>
              <Ban size={16} /> {t('cai.cancel_confirm')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal ticket */}
      <Modal open={showTicket} onClose={() => setShowTicket(false)} title={t('cai.ticket_title')} size="md">
        {ticketData && <TicketCaisse data={ticketData} onClose={() => setShowTicket(false)} />}
      </Modal>
    </div>
  );
};
