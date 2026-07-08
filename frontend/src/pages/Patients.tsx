import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, User, ChevronRight, Scale, Baby } from 'lucide-react';
import toast from 'react-hot-toast';
import { patientsApi } from '../services/api';
import { Modal } from '../components/ui/Modal';
import { IMCWidget } from '../components/ui/IMCWidget';
import { useNavigate } from 'react-router-dom';
import { useT } from '../i18n';

const SEXE_OPTIONS = [{ v: 'M', l: 'Masculin' }, { v: 'F', l: 'Féminin' }];
const GROUPE_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Inconnu'];

const FORM_INITIAL = {
  nom: '', prenom: '', sexe: 'M', date_naissance: '', telephone: '',
  telephone_urgence: '', contact_urgence: '', adresse: '', quartier: '',
  ville: 'Yaoundé', profession: '', groupe_sanguin: 'Inconnu',
  poids_kg: '', taille_cm: '', perimetre_brachial_cm: '', perimetre_cranien_cm: '',
  glycemie: '', glycemie_note: '',
  allergies: '',
  antecedents_medicaux: '', antecedents_chirurgicaux: '',
  antecedents_familiaux: '', antecedents_obstetricaux: '',
  mode_de_vie: '',
};

// Calcul de l'âge en mois depuis la date de naissance
function getAgeMois(dateStr: string): number | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 30));
}

function getAgeAns(dateStr: string): number | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365));
}

function evalMUAC(muac: number, ageMois: number): { statut: string; couleur: string } {
  if (ageMois < 6 || ageMois > 59) return { statut: 'Hors tranche MUAC', couleur: 'slate' };
  if (muac < 11.5) return { statut: 'Malnutrition Sévère (SAM) ⚠️', couleur: 'red' };
  if (muac < 12.5) return { statut: 'Malnutrition Modérée (MAM)', couleur: 'orange' };
  if (muac < 13.5) return { statut: 'Risque malnutrition', couleur: 'yellow' };
  return { statut: 'Normal', couleur: 'green' };
}

const MUAC_COLOR: Record<string, string> = {
  red: 'text-red-600 bg-red-50',
  orange: 'text-orange-600 bg-orange-50',
  yellow: 'text-yellow-700 bg-yellow-50',
  green: 'text-emerald-600 bg-emerald-50',
  slate: 'text-slate-500 bg-slate-50',
};

export const Patients: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useT();
  const [patients, setPatients] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'identite' | 'anthropo' | 'antecedents'>('identite');
  const [form, setForm] = useState(FORM_INITIAL);
  const [ageInput, setAgeInput] = useState('');

  const ageMois = getAgeMois(form.date_naissance);
  const ageAns = getAgeAns(form.date_naissance);

  // Saisie de l'âge → calcule la date de naissance à partir d'aujourd'hui (DDN inconnue)
  const handleAgeChange = (val: string) => {
    setAgeInput(val);
    const a = parseInt(val);
    if (val === '' || isNaN(a) || a < 0 || a > 130) return;
    const t = new Date();
    const d = new Date(t.getFullYear() - a, t.getMonth(), t.getDate());
    setForm(prev => ({ ...prev, date_naissance: d.toISOString().slice(0, 10) }));
  };
  // Saisie d'une vraie date → on efface l'âge manuel (l'âge calculé s'affiche)
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, date_naissance: e.target.value }));
    setAgeInput('');
  };
  const estEnfantMUAC = ageMois !== null && ageMois >= 6 && ageMois <= 59;
  const estNourrisson = ageAns !== null && ageAns < 2;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await patientsApi.list({ search: search || undefined, page, per_page: 20 });
      setPatients(res.data.patients);
      setTotal(res.data.total);
    } catch { toast.error(t('ts.patients_error')); }
    setLoading(false);
  }, [search, page]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nom || !form.prenom || !form.sexe) { toast.error(t('ts.patient_req')); return; }
    setSaving(true);
    try {
      const payload: any = {
        ...form,
        date_naissance: form.date_naissance || null,
        poids_kg: form.poids_kg ? parseFloat(form.poids_kg) : null,
        taille_cm: form.taille_cm ? parseFloat(form.taille_cm) : null,
        perimetre_brachial_cm: form.perimetre_brachial_cm ? parseFloat(form.perimetre_brachial_cm) : null,
        perimetre_cranien_cm: form.perimetre_cranien_cm ? parseFloat(form.perimetre_cranien_cm) : null,
        glycemie: form.glycemie ? parseFloat(form.glycemie) : null,
        glycemie_note: form.glycemie_note || null,
      };
      await patientsApi.create(payload);
      toast.success(t('ts.patient_saved'));
      setShowModal(false);
      setForm(FORM_INITIAL);
      setAgeInput('');
      setActiveTab('identite');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('ts.error'));
    }
    setSaving(false);
  };

  const f = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const TAB_CLS = (t: string) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === t ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`;

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('pat.title')}</h1>
          <p className="text-slate-500 text-sm">{total} {t('pat.registered')}</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowModal(true)}>
          <Plus size={16} /> {t('pat.new')}
        </button>
      </div>

      {/* Recherche */}
      <div className="card !p-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder={t('pat.search_ph')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card !p-0 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-sm">Chargement...</div>
        ) : patients.length === 0 ? (
          <div className="py-12 text-center">
            <User size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-400 text-sm">{t('pat.none')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-3 text-slate-500 font-medium">{t('pat.file')}</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">{t('pat.fullname')}</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">{t('pat.sex_age')}</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">{t('pat.phone')}</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">{t('pat.imc_nutri')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/patients/${p.id}`)}
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded-md">{p.numero_dossier}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{p.nom_complet}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <span className={`text-xs px-2 py-0.5 rounded-full mr-2 ${p.sexe === 'M' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>{p.sexe}</span>
                    {p.age !== null ? `${p.age} ans` : '—'}
                    {p.age !== null && p.age < 5 && <Baby size={12} className="inline ml-1 text-purple-400" />}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.telephone || '—'}</td>
                  <td className="px-4 py-3">
                    {p.muac_statut ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${MUAC_COLOR[p.muac_statut.includes('Sévère') ? 'red' : p.muac_statut.includes('Modérée') ? 'orange' : p.muac_statut.includes('Risque') ? 'yellow' : 'green']}`}>
                        MUAC: {p.perimetre_brachial_cm}cm
                      </span>
                    ) : p.imc ? (
                      <IMCWidget poids={p.poids_kg} taille={p.taille_cm} compact />
                    ) : (
                      <span className="text-xs text-slate-300 flex items-center gap-1"><Scale size={11} /> Non mesuré</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400"><ChevronRight size={16} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-center gap-2">
          <button className="btn-outline py-1.5 px-3 text-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Précédent</button>
          <span className="text-sm text-slate-500">Page {page} / {Math.ceil(total / 20)}</span>
          <button className="btn-outline py-1.5 px-3 text-sm" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>Suivant</button>
        </div>
      )}

      {/* Modal enregistrement */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setActiveTab('identite'); }} title={t('pat.register_title')} size="xl">
        <form onSubmit={handleSave}>
          {/* Onglets */}
          <div className="flex gap-2 mb-5 p-1 bg-slate-100 rounded-xl">
            <button type="button" className={TAB_CLS('identite')} onClick={() => setActiveTab('identite')}>{t('pat.tab_identite')}</button>
            <button type="button" className={TAB_CLS('anthropo')} onClick={() => setActiveTab('anthropo')}>
              <Scale size={13} className="inline mr-1" />{t('pat.tab_anthropo')}
            </button>
            <button type="button" className={TAB_CLS('antecedents')} onClick={() => setActiveTab('antecedents')}>{t('pat.tab_antecedents')}</button>
          </div>

          {/* ── Onglet Identité ── */}
          {activeTab === 'identite' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">{t('reg.nom')} *</label>
                <input className="input" value={form.nom} onChange={f('nom')} required />
              </div>
              <div>
                <label className="label">{t('reg.prenom')} *</label>
                <input className="input" value={form.prenom} onChange={f('prenom')} required />
              </div>
              <div>
                <label className="label">{t('pf.sexe')} *</label>
                <select className="input" value={form.sexe} onChange={f('sexe')} required>
                  <option value="M">{t('pf.sexe_m')}</option>
                  <option value="F">{t('pf.sexe_f')}</option>
                </select>
              </div>
              <div>
                <label className="label">{t('pf.dob')}</label>
                <input className="input" type="date" value={form.date_naissance} onChange={handleDateChange} />
                {ageAns !== null && (
                  <p className="text-xs text-slate-400 mt-1">
                    {ageAns < 2 ? `${ageMois} ${t('pf.months', 'mois')}` : `${ageAns} ${t('pf.years')}`}
                  </p>
                )}
              </div>
              <div>
                <label className="label">{t('pf.age_unknown')}</label>
                <div className="flex items-center gap-2">
                  <input
                    className="input"
                    type="number"
                    min="0"
                    max="130"
                    value={ageInput !== '' ? ageInput : (ageAns ?? '')}
                    onChange={(e) => handleAgeChange(e.target.value)}
                    placeholder="35"
                  />
                  <span className="text-sm text-slate-400">{t('pf.years')}</span>
                </div>
              </div>
              <div>
                <label className="label">{t('pat.phone')}</label>
                <input className="input" value={form.telephone} onChange={f('telephone')} placeholder="6XX XX XX XX" />
              </div>
              <div>
                <label className="label">{t('pf.blood')}</label>
                <select className="input" value={form.groupe_sanguin} onChange={f('groupe_sanguin')}>
                  {GROUPE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="label">{t('pf.contact_urg')}</label>
                <input className="input" value={form.contact_urgence} onChange={f('contact_urgence')} />
              </div>
              <div>
                <label className="label">{t('pf.tel_urg')}</label>
                <input className="input" value={form.telephone_urgence} onChange={f('telephone_urgence')} placeholder="6XX XX XX XX" />
              </div>
              <div>
                <label className="label">{t('pf.quartier')}</label>
                <input className="input" value={form.quartier} onChange={f('quartier')} />
              </div>
              <div>
                <label className="label">{t('pf.ville')}</label>
                <input className="input" value={form.ville} onChange={f('ville')} />
              </div>
              <div className="col-span-2">
                <label className="label">{t('pf.profession')}</label>
                <input className="input" value={form.profession} onChange={f('profession')} />
              </div>
            </div>
          )}

          {/* ── Onglet Anthropométrie ── */}
          {activeTab === 'anthropo' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3">
                Ces mesures serviront de référence pour le patient. L'IMC est recalculé à chaque consultation.
                {estEnfantMUAC && <strong className="text-purple-600 ml-1">Pour enfant 6-59 mois : le périmètre brachial (MUAC) est l'indicateur principal.</strong>}
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('pf.weight')}</label>
                  <input
                    className="input"
                    type="number"
                    step="0.1"
                    min="0"
                    value={form.poids_kg}
                    onChange={f('poids_kg')}
                    placeholder="Ex: 65.5"
                  />
                </div>
                <div>
                  <label className="label">{t('pf.height')}</label>
                  <input
                    className="input"
                    type="number"
                    step="0.1"
                    min="0"
                    value={form.taille_cm}
                    onChange={f('taille_cm')}
                    placeholder="Ex: 170"
                  />
                </div>

                {/* IMC temps réel */}
                {form.poids_kg && form.taille_cm && (
                  <div className="col-span-2">
                    <IMCWidget
                      poids={parseFloat(form.poids_kg)}
                      taille={parseFloat(form.taille_cm)}
                      dateNaissance={form.date_naissance || undefined}
                    />
                    {ageAns !== null && ageAns < 18 && (
                      <p className="text-xs text-amber-600 mt-2 bg-amber-50 px-3 py-2 rounded-lg">
                        ⚠️ Pour les enfants, l'IMC doit être interprété avec les courbes de croissance OMS (percentiles). L'affichage est indicatif.
                      </p>
                    )}
                  </div>
                )}

                {/* MUAC — enfants 6-59 mois */}
                <div>
                  <label className="label">
                    {t('pf.muac')}
                    {estEnfantMUAC && <span className="ml-2 text-purple-600 font-bold">★</span>}
                  </label>
                  <input
                    className={`input ${estEnfantMUAC ? 'border-purple-400 focus:ring-purple-400' : ''}`}
                    type="number"
                    step="0.1"
                    min="0"
                    value={form.perimetre_brachial_cm}
                    onChange={f('perimetre_brachial_cm')}
                    placeholder="Ex: 13.5"
                  />
                  {form.perimetre_brachial_cm && estEnfantMUAC && ageMois !== null && (
                    <div className={`mt-1 text-xs font-medium px-2 py-1 rounded-lg ${MUAC_COLOR[evalMUAC(parseFloat(form.perimetre_brachial_cm), ageMois).couleur]}`}>
                      {evalMUAC(parseFloat(form.perimetre_brachial_cm), ageMois).statut}
                    </div>
                  )}
                  <p className="text-xs text-slate-400 mt-1">Bras gauche, mi-hauteur acromion-olécrane</p>
                </div>

                {/* Périmètre crânien — nourrissons */}
                <div>
                  <label className="label">
                    {t('pf.head')}
                  </label>
                  <input
                    className="input"
                    type="number"
                    step="0.1"
                    min="0"
                    value={form.perimetre_cranien_cm}
                    onChange={f('perimetre_cranien_cm')}
                    placeholder="Ex: 46.5"
                  />
                  {form.perimetre_cranien_cm && estNourrisson && ageMois !== null && (
                    <p className="text-xs text-slate-500 mt-1">
                      Référence OMS ({form.sexe === 'M' ? 'Garçon' : 'Fille'} {ageMois} mois): vérifier courbe de croissance
                    </p>
                  )}
                </div>
              </div>

              {/* Glycémie */}
              <div className="border border-amber-100 bg-amber-50/40 rounded-xl p-3 space-y-3">
                <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">{t('pf.glycemia')}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">{t('pf.glycemia')}</label>
                    <input
                      className="input"
                      type="number"
                      step="0.1"
                      min="0"
                      value={form.glycemie}
                      onChange={f('glycemie')}
                      placeholder="Ex: 5.4"
                    />
                    {form.glycemie && (() => {
                      const g = parseFloat(form.glycemie);
                      const ajeun = form.glycemie_note?.toLowerCase().includes('jeûn') && !form.glycemie_note?.toLowerCase().includes('non');
                      if (g < 3.9) return <p className="text-xs text-orange-500 mt-1">↓ Hypoglycémie</p>;
                      if (ajeun && g >= 7.0) return <p className="text-xs text-red-600 mt-1 font-semibold">🔴 Diabète (à jeûn ≥ 7.0)</p>;
                      if (ajeun && g >= 6.1) return <p className="text-xs text-orange-600 mt-1">🟠 Prédiabète (à jeûn 6.1–6.9)</p>;
                      if (!ajeun && g >= 11.1) return <p className="text-xs text-red-600 mt-1 font-semibold">🔴 Diabète probable (≥ 11.1)</p>;
                      return <p className="text-xs text-emerald-600 mt-1">Valeur de référence enregistrée</p>;
                    })()}
                  </div>
                  <div>
                    <label className="label">{t('pf.gly_note')}</label>
                    <select className="input" value={form.glycemie_note} onChange={f('glycemie_note')}>
                      <option value="">—</option>
                      <option value="À jeûn (≥ 8h)">{t('pf.fasting')}</option>
                      <option value="Non à jeûn (post-prandial)">{t('pf.non_fasting')}</option>
                      <option value="Aléatoire">{t('pf.random')}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Guide rapide */}
              <div className="border border-slate-100 rounded-xl p-3 text-xs text-slate-500">
                <p className="font-semibold mb-2 text-slate-700">Guide classification IMC adulte (OMS)</p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { l: '< 18.5', s: 'Maigreur', c: 'blue' },
                    { l: '18.5–24.9', s: 'Normal', c: 'green' },
                    { l: '25–29.9', s: 'Surpoids', c: 'yellow' },
                    { l: '≥ 30', s: 'Obésité', c: 'red' },
                  ].map(x => (
                    <div key={x.l} className={`px-2 py-1 rounded-lg text-center bg-${x.c}-50 text-${x.c}-700`}>
                      <p className="font-bold">{x.l}</p>
                      <p>{x.s}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Onglet Antécédents ── */}
          {activeTab === 'antecedents' && (
            <div className="space-y-4">
              <div>
                <label className="label">{t('pf.allergies')}</label>
                <textarea className="input h-16 resize-none" value={form.allergies} onChange={f('allergies')} />
              </div>
              <div>
                <label className="label">{t('pf.hist_med')}</label>
                <textarea className="input h-16 resize-none" value={form.antecedents_medicaux} onChange={f('antecedents_medicaux')} />
              </div>
              <div>
                <label className="label">{t('pf.hist_surg')}</label>
                <textarea className="input h-14 resize-none" value={form.antecedents_chirurgicaux} onChange={f('antecedents_chirurgicaux')} />
              </div>
              <div>
                <label className="label">{t('pf.hist_fam')}</label>
                <textarea className="input h-14 resize-none" value={form.antecedents_familiaux} onChange={f('antecedents_familiaux')} />
              </div>
              {form.sexe === 'F' && (
                <div>
                  <label className="label">{t('pf.hist_obst')}</label>
                  <textarea className="input h-14 resize-none" value={form.antecedents_obstetricaux} onChange={f('antecedents_obstetricaux')} />
                </div>
              )}
              <div>
                <label className="label">{t('pf.lifestyle')}</label>
                <textarea className="input h-14 resize-none" value={form.mode_de_vie} onChange={f('mode_de_vie')} />
              </div>
            </div>
          )}

          {/* Boutons */}
          <div className="flex gap-3 justify-between pt-4 mt-4 border-t border-slate-100">
            <div className="flex gap-2">
              {activeTab !== 'identite' && (
                <button type="button" className="btn-outline text-sm" onClick={() =>
                  setActiveTab(activeTab === 'antecedents' ? 'anthropo' : 'identite')
                }>← {t('pat.prev')}</button>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-outline" onClick={() => { setShowModal(false); setActiveTab('identite'); }}>{t('c.cancel')}</button>
              {activeTab !== 'antecedents' ? (
                <button type="button" className="btn-primary" onClick={() =>
                  setActiveTab(activeTab === 'identite' ? 'anthropo' : 'antecedents')
                }>{t('pat.next')} →</button>
              ) : (
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? t('c.saving') : t('pat.save')}
                </button>
              )}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
