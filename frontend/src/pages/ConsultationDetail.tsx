import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Pill, FlaskConical, Save, Bot, Plus, Trash2,
  ClipboardList, History, Stethoscope, Activity, Search, Scale, Printer
} from 'lucide-react';
import toast from 'react-hot-toast';
import { consultationsApi, pharmacieApi, aiApi, laboratoireApi } from '../services/api';
import { BadgeUrgence, BadgeStatut } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { CIM10Search } from '../components/ui/CIM10Search';
import { FormulaireEndemique } from '../components/ui/FormulaireEndemique';
import { IMCWidget } from '../components/ui/IMCWidget';
import { CompteRenduLabo } from '../components/ui/CompteRenduLabo';
import { uniteContenu } from '../utils/pharma';
import { resumeResultat } from '../utils/labResult';
import { useT } from '../i18n';

type Section = 'histoire' | 'vitaux' | 'diagnostic' | 'endemique';

const SECTION_TABS: { id: Section; tkey: string; icon: React.ReactNode }[] = [
  { id: 'histoire',    tkey: 'cd.sec_histoire', icon: <History size={14} /> },
  { id: 'vitaux',      tkey: 'cd.sec_vitaux',    icon: <Activity size={14} /> },
  { id: 'diagnostic',  tkey: 'cd.sec_diag',    icon: <Stethoscope size={14} /> },
  { id: 'endemique',   tkey: 'cd.sec_endemic',       icon: <Search size={14} /> },
];

const MODES_DEBUT = ['Brutal (quelques heures)', 'Progressif (jours)', 'Insidieux (semaines/mois)'];

/** Somme des prises journalières depuis une posologie type "1-0-1" → 2 unités/jour. */
function unitesParJour(posologie: string): number | null {
  if (!posologie) return null;
  // On isole la partie "x-x-x..." en tête (avant tout espace/parenthèse)
  const tete = posologie.trim().split(/[\s(]/)[0];
  const morceaux = tete.split('-').map(s => s.replace(',', '.').trim());
  if (morceaux.length < 2) return null;
  let somme = 0;
  for (const m of morceaux) {
    const n = parseFloat(m);
    if (isNaN(n)) return null;
    somme += n;
  }
  return somme > 0 ? somme : null;
}

/** Extrait le nombre de jours d'une durée commençant par un nombre et finissant par j/jr/jrs/jour(s). */
function dureeEnJours(duree: string): number | null {
  if (!duree) return null;
  const m = duree.trim().match(/^(\d+(?:[.,]\d+)?)\s*(j|jr|jrs|jour|jours)\b/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(',', '.'));
  return n > 0 ? n : null;
}

/**
 * Calcule la quantité à dispenser EN CONDITIONNEMENTS (plaquettes, flacons...).
 * total unités = prises/jour × jours ; puis conversion via nb_par_conditionnement.
 * Renvoie null si la posologie ou la durée ne sont pas exploitables.
 */
function calculerQuantite(posologie: string, duree: string, medicament: any): { conditionnements: number; unites: number; parJour: number; jours: number } | null {
  const parJour = unitesParJour(posologie);
  const jours = dureeEnJours(duree);
  if (parJour == null || jours == null) return null;
  const unites = parJour * jours;
  const nbParCond = Math.max(1, Number(medicament?.nb_par_conditionnement) || 1);
  const conditionnements = Math.max(1, Math.ceil(unites / nbParCond));
  return { conditionnements, unites, parJour, jours };
}

export const ConsultationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useT();
  const [consultation, setConsultation] = useState<any>(null);
  const [medicaments, setMedicaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>('histoire');
  const [showPrescModal, setShowPrescModal] = useState(false);
  const [prescItems, setPrescItems] = useState<any[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<any>(null);
  // Examens de laboratoire
  const [showExamModal, setShowExamModal] = useState(false);
  const [catalogue, setCatalogue] = useState<any[]>([]);
  const [examSel, setExamSel] = useState<Record<number, boolean>>({});
  const [examCustom, setExamCustom] = useState('');
  const [showLaboPrint, setShowLaboPrint] = useState(false);

  const [form, setForm] = useState({
    // Histoire de la maladie
    histoire_maladie: '',
    duree_symptomes: '',
    mode_debut: '',
    facteurs_declenchants: '',
    facteurs_calmants: '',
    signes_associes: '',
    antecedents_pertinents: '',
    // Signes vitaux
    tension_arterielle: '',
    temperature: '',
    poids: '',
    taille: '',
    frequence_cardiaque: '',
    saturation_o2: '',
    frequence_respiratoire: '',
    glycemie: '',
    glycemie_jeun: '',
    glycemie_post_prandiale: '',
    perimetre_brachial: '',
    perimetre_cranien: '',
    // Diagnostic
    examen_clinique: '',
    diagnostic_principal: '',
    diagnostics_secondaires: '',
    traitement: '',
    notes: '',
    statut: 'en_cours',
    // CIM-10
    code_cim10_principal: '',
    libelle_cim10_principal: '',
    codes_cim10_secondaires: '',
    // Maladie endémique
    maladie_endemique_type: '',
    maladie_endemique_data: '',
  });

  const [cim10Principal, setCim10Principal] = useState<{ code: string; libelle: string } | null>(null);
  const [formEndemic, setFormEndemic] = useState<{ type: string; data: any } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [c, m] = await Promise.all([
          consultationsApi.get(Number(id)),
          pharmacieApi.listMedicaments(),
        ]);
        const data = c.data;
        setConsultation(data);
        setMedicaments(m.data.medicaments || m.data || []);
        laboratoireApi.catalogue().then(r => setCatalogue(r.data || [])).catch(() => {});
        setForm({
          histoire_maladie: data.histoire_maladie || '',
          duree_symptomes: data.duree_symptomes || '',
          mode_debut: data.mode_debut || '',
          facteurs_declenchants: data.facteurs_declenchants || '',
          facteurs_calmants: data.facteurs_calmants || '',
          signes_associes: data.signes_associes || '',
          antecedents_pertinents: data.antecedents_pertinents || (buildAntecedents(data.patient) || ''),
          tension_arterielle: data.tension_arterielle || '',
          temperature: data.temperature ? String(data.temperature) : '',
          poids: data.poids ? String(data.poids) : '',
          taille: data.taille ? String(data.taille) : '',
          frequence_cardiaque: data.frequence_cardiaque ? String(data.frequence_cardiaque) : '',
          saturation_o2: data.saturation_o2 ? String(data.saturation_o2) : '',
          frequence_respiratoire: data.frequence_respiratoire ? String(data.frequence_respiratoire) : '',
          glycemie: data.glycemie ? String(data.glycemie) : '',
          glycemie_jeun: data.glycemie_jeun ? String(data.glycemie_jeun) : '',
          glycemie_post_prandiale: data.glycemie_post_prandiale ? String(data.glycemie_post_prandiale) : '',
          perimetre_brachial: data.perimetre_brachial ? String(data.perimetre_brachial) : '',
          perimetre_cranien: data.perimetre_cranien ? String(data.perimetre_cranien) : '',
          examen_clinique: data.examen_clinique || '',
          diagnostic_principal: data.diagnostic_principal || '',
          diagnostics_secondaires: data.diagnostics_secondaires || '',
          traitement: data.traitement || '',
          notes: data.notes || '',
          statut: data.statut || 'en_cours',
          code_cim10_principal: data.code_cim10_principal || '',
          libelle_cim10_principal: data.libelle_cim10_principal || '',
          codes_cim10_secondaires: data.codes_cim10_secondaires || '',
          maladie_endemique_type: data.maladie_endemique_type || '',
          maladie_endemique_data: data.maladie_endemique_data || '',
        });
        if (data.code_cim10_principal) {
          setCim10Principal({ code: data.code_cim10_principal, libelle: data.libelle_cim10_principal || '' });
        }
        if (data.maladie_endemique_type) {
          let emed: any = {};
          try { emed = JSON.parse(data.maladie_endemique_data || '{}'); } catch {}
          setFormEndemic({ type: data.maladie_endemique_type, data: emed });
        }
      } catch { toast.error(t('ts.cons_notfound')); navigate('/consultations'); }
      setLoading(false);
    };
    load();
  }, [id]);

  function buildAntecedents(patient: any): string {
    if (!patient) return '';
    const parts: string[] = [];
    if (patient.antecedents_medicaux) parts.push(`Médicaux: ${patient.antecedents_medicaux}`);
    if (patient.antecedents_chirurgicaux) parts.push(`Chirurgicaux: ${patient.antecedents_chirurgicaux}`);
    if (patient.antecedents_familiaux) parts.push(`Familiaux: ${patient.antecedents_familiaux}`);
    if (patient.antecedents_obstetricaux) parts.push(`Obstétricaux: ${patient.antecedents_obstetricaux}`);
    if (patient.allergies) parts.push(`Allergies: ${patient.allergies}`);
    return parts.join('\n');
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        ...form,
        temperature: form.temperature ? parseFloat(form.temperature) : null,
        poids: form.poids ? parseFloat(form.poids) : null,
        taille: form.taille ? parseFloat(form.taille) : null,
        frequence_cardiaque: form.frequence_cardiaque ? parseInt(form.frequence_cardiaque) : null,
        saturation_o2: form.saturation_o2 ? parseFloat(form.saturation_o2) : null,
        frequence_respiratoire: form.frequence_respiratoire ? parseInt(form.frequence_respiratoire) : null,
        glycemie: form.glycemie ? parseFloat(form.glycemie) : null,
        glycemie_jeun: form.glycemie_jeun ? parseFloat(form.glycemie_jeun) : null,
        glycemie_post_prandiale: form.glycemie_post_prandiale ? parseFloat(form.glycemie_post_prandiale) : null,
        perimetre_brachial: form.perimetre_brachial ? parseFloat(form.perimetre_brachial) : null,
        perimetre_cranien: form.perimetre_cranien ? parseFloat(form.perimetre_cranien) : null,
        code_cim10_principal: cim10Principal?.code || '',
        libelle_cim10_principal: cim10Principal?.libelle || '',
        maladie_endemique_type: formEndemic?.type || '',
        maladie_endemique_data: formEndemic ? JSON.stringify(formEndemic.data) : '',
      };
      if (payload.poids && payload.taille) {
        const imc = payload.poids / ((payload.taille / 100) ** 2);
        payload.imc = Math.round(imc * 100) / 100;
      }
      await consultationsApi.update(Number(id), payload);
      toast.success(t('ts.cons_saved'));
    } catch { toast.error(t('ts.error')); }
    setSaving(false);
  };

  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  const addPrescItem = () => setPrescItems(prev => [...prev, { medicament_id: '', posologie: '', quantite_prescrite: 1, duree_traitement: '', quantite_manuelle: false, calc: null }]);
  const removePrescItem = (i: number) => setPrescItems(prev => prev.filter((_, idx) => idx !== i));
  const updatePrescItem = (i: number, key: string, val: any) => setPrescItems(prev => prev.map((p, idx) => {
    if (idx !== i) return p;
    const next = { ...p, [key]: val };
    // Saisie manuelle de la quantité → on désactive le calcul auto pour cette ligne
    if (key === 'quantite_prescrite') {
      return { ...next, quantite_manuelle: true };
    }
    // Recalcul auto quand on modifie posologie / durée / médicament (sauf si l'utilisateur a saisi manuellement)
    if (['posologie', 'duree_traitement', 'medicament_id'].includes(key)) {
      const med = medicaments.find(m => String(m.id) === String(next.medicament_id));
      const calc = calculerQuantite(next.posologie, next.duree_traitement, med);
      next.calc = calc;
      if (calc && !next.quantite_manuelle) {
        next.quantite_prescrite = calc.conditionnements;
      }
    }
    return next;
  }));

  const handlePrescriptions = async () => {
    const valid = prescItems.filter(p => p.medicament_id && p.posologie);
    if (!valid.length) { toast.error(t('ts.presc_req')); return; }
    try {
      await consultationsApi.addPrescriptions(Number(id), valid.map(p => ({
        medicament_id: Number(p.medicament_id),
        posologie: p.posologie,
        quantite_prescrite: Number(p.quantite_prescrite),
        duree_traitement: p.duree_traitement || '',
      })));
      toast.success(t('ts.presc_sent'));
      setShowPrescModal(false);
      setPrescItems([]);
      const res = await consultationsApi.get(Number(id));
      setConsultation(res.data);
    } catch (err: any) { toast.error(err.response?.data?.detail || t('ts.error')); }
  };

  const reloadConsultation = async () => {
    const res = await consultationsApi.get(Number(id));
    setConsultation(res.data);
  };

  const handleExamens = async () => {
    const items = catalogue.filter((_, i) => examSel[i]).map(e => ({
      libelle: e.libelle, type_examen: e.type_examen, prix: e.prix,
    }));
    const custom = examCustom.trim();
    if (custom) items.push({ libelle: custom, type_examen: 'Autre', prix: 0 });
    if (!items.length) { toast.error(t('ts.exam_req')); return; }
    try {
      await consultationsApi.addExamens(Number(id), items);
      toast.success(`${items.length} ${t('ts.exam_sent')}`);
      setShowExamModal(false);
      setExamSel({});
      setExamCustom('');
      reloadConsultation();
    } catch (err: any) { toast.error(err.response?.data?.detail || t('ts.error')); }
  };

  const handleAISuggestion = async () => {
    if (!form.diagnostic_principal && !consultation?.symptomes) {
      toast.error(t('ts.diag_first'));
      return;
    }
    setAiLoading(true);
    try {
      const res = await aiApi.suggererPrescription({
        diagnostic: form.diagnostic_principal || cim10Principal?.libelle || 'Non précisé',
        patient_info: { age: consultation?.patient?.age || 'adulte', allergies: consultation?.patient?.allergies, sexe: consultation?.patient?.sexe },
        symptomes: consultation?.symptomes || form.histoire_maladie || '',
        antecedents: form.antecedents_pertinents || '',
        maladie_endemique: formEndemic?.type || '',
      });
      setAiSuggestion(res.data);
    } catch { toast.error(t('ts.ai_unavail')); }
    setAiLoading(false);
  };

  const poids = parseFloat(form.poids) || null;
  const taille = parseFloat(form.taille) || null;

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!consultation) return null;

  const c = consultation;

  return (
    <div className="space-y-5 fade-in max-w-6xl">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/consultations')} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-slate-800">{c.numero}</h1>
            <BadgeUrgence urgence={c.niveau_urgence} />
            <BadgeStatut statut={c.statut} />
            {cim10Principal && (
              <span className="font-mono text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg border border-emerald-200">
                CIM-10: {cim10Principal.code}
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm">{c.patient?.nom} {c.patient?.prenom} — {c.service}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setExamSel({}); setExamCustom(''); setShowExamModal(true); }} className="btn-outline flex items-center gap-2 text-sm">
            <FlaskConical size={15} /> {t('cons.exams')}
          </button>
          <button onClick={() => { addPrescItem(); setShowPrescModal(true); }} className="btn-secondary flex items-center gap-2 text-sm">
            <Pill size={15} /> {t('cons.prescribe')}
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
            <Save size={15} /> {saving ? t('c.saving') : t('cd.save')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* ─── Colonne gauche : résumé patient + prescriptions ─── */}
        <div className="space-y-4">
          {/* Carte patient */}
          <div className="card">
            <h3 className="font-semibold text-slate-700 mb-3 text-xs uppercase tracking-wide">{t('c.patient')}</h3>
            <div className="space-y-1 text-sm">
              <p><span className="font-mono text-xs text-primary-600">{c.patient?.numero_dossier}</span></p>
              <p className="text-slate-500">{t('pf.blood')}: <strong>{c.patient?.groupe_sanguin || '?'}</strong></p>
              <p className="text-slate-500">{t('cons.motif')}: <span className="text-slate-700">{c.motif}</span></p>
            </div>
            {c.patient?.allergies && (
              <div className="mt-2 p-2 bg-red-50 rounded-lg">
                <p className="text-xs font-semibold text-red-600">⚠️ {t('pf.allergies')}</p>
                <p className="text-xs text-red-600">{c.patient.allergies}</p>
              </div>
            )}
          </div>

          {/* IMC consultation */}
          {(poids && taille) && (
            <div className="card !p-3">
              <h3 className="font-semibold text-slate-700 mb-2 text-xs uppercase tracking-wide flex items-center gap-1">
                <Scale size={12} /> IMC
              </h3>
              <IMCWidget poids={poids} taille={taille} />
            </div>
          )}

          {/* Signes vitaux résumés */}
          {(form.tension_arterielle || form.temperature || form.poids) && (
            <div className="card !p-3">
              <h3 className="font-semibold text-slate-700 mb-2 text-xs uppercase tracking-wide">{t('cd.vitals')}</h3>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {form.tension_arterielle && <div className="bg-slate-50 p-2 rounded-lg"><p className="text-slate-400">TA</p><p className="font-bold">{form.tension_arterielle}</p></div>}
                {form.temperature && (
                  <div className={`p-2 rounded-lg ${parseFloat(form.temperature) >= 38 ? 'bg-orange-50' : 'bg-slate-50'}`}>
                    <p className="text-slate-400">Temp.</p><p className="font-bold">{form.temperature}°C</p>
                    {parseFloat(form.temperature) >= 38 && <p className="text-orange-600 text-xs">Fièvre</p>}
                  </div>
                )}
                {form.poids && <div className="bg-slate-50 p-2 rounded-lg"><p className="text-slate-400">Poids</p><p className="font-bold">{form.poids}kg</p></div>}
                {form.frequence_cardiaque && <div className="bg-slate-50 p-2 rounded-lg"><p className="text-slate-400">FC</p><p className="font-bold">{form.frequence_cardiaque}/min</p></div>}
                {form.saturation_o2 && (
                  <div className={`p-2 rounded-lg ${parseFloat(form.saturation_o2) < 95 ? 'bg-red-50' : 'bg-slate-50'}`}>
                    <p className="text-slate-400">SpO2</p><p className="font-bold">{form.saturation_o2}%</p>
                  </div>
                )}
                {form.glycemie && <div className="bg-slate-50 p-2 rounded-lg"><p className="text-slate-400">Glyc. aléat.</p><p className="font-bold">{form.glycemie} mmol/L</p></div>}
                {form.glycemie_jeun && (
                  <div className={`p-2 rounded-lg ${parseFloat(form.glycemie_jeun) >= 7.0 ? 'bg-red-50' : parseFloat(form.glycemie_jeun) >= 6.1 ? 'bg-amber-50' : 'bg-slate-50'}`}>
                    <p className="text-slate-400">Glyc. jeûn</p>
                    <p className="font-bold">{form.glycemie_jeun} mmol/L</p>
                    {parseFloat(form.glycemie_jeun) >= 7.0 && <p className="text-red-600 text-xs">Diabète</p>}
                    {parseFloat(form.glycemie_jeun) >= 6.1 && parseFloat(form.glycemie_jeun) < 7.0 && <p className="text-amber-600 text-xs">Prédiabète</p>}
                  </div>
                )}
                {form.glycemie_post_prandiale && (
                  <div className={`p-2 rounded-lg ${parseFloat(form.glycemie_post_prandiale) >= 11.1 ? 'bg-red-50' : parseFloat(form.glycemie_post_prandiale) >= 7.8 ? 'bg-amber-50' : 'bg-slate-50'}`}>
                    <p className="text-slate-400">Glyc. PP 2h</p>
                    <p className="font-bold">{form.glycemie_post_prandiale} mmol/L</p>
                    {parseFloat(form.glycemie_post_prandiale) >= 11.1 && <p className="text-red-600 text-xs">Diabète</p>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Prescriptions existantes */}
          {c.prescriptions?.length > 0 && (
            <div className="card !p-3">
              <h3 className="font-semibold text-slate-700 mb-2 text-xs uppercase tracking-wide">{t('cd.prescriptions')}</h3>
              <div className="space-y-1.5">
                {c.prescriptions.map((p: any) => (
                  <div key={p.id} className="text-xs p-2 bg-slate-50 rounded-lg">
                    <p className="font-medium">{p.medicament}</p>
                    <p className="text-slate-400">{p.posologie}</p>
                    <BadgeStatut statut={p.statut} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Examens de laboratoire */}
          {c.examens_labo?.length > 0 && (
            <div className="card !p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-slate-700 text-xs uppercase tracking-wide flex items-center gap-1">
                  <FlaskConical size={12} /> {t('cd.lab_exams')}
                </h3>
                {c.examens_labo.some((e: any) => e.resultat) && (
                  <button onClick={() => setShowLaboPrint(true)} className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                    <Printer size={12} /> Imprimer
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {c.examens_labo.map((e: any) => (
                  <div key={e.id} className="text-xs p-2 bg-slate-50 rounded-lg">
                    <p className="font-medium text-slate-700">{e.libelle}</p>
                    {e.resultat ? (
                      <p className="text-slate-600">→ <strong>{resumeResultat(e.resultat, e.unite)}</strong></p>
                    ) : <p className="text-slate-400">En attente de résultat</p>}
                    <BadgeStatut statut={e.statut} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggestion IA */}
          <button onClick={handleAISuggestion} disabled={aiLoading} className="w-full btn-outline flex items-center justify-center gap-2 text-sm">
            <Bot size={15} /> {aiLoading ? '...' : t('cd.ai_suggest')}
          </button>

          {aiSuggestion && (
            <div className="card border border-primary-200 bg-primary-50/30 fade-in text-sm">
              <div className="flex items-center gap-2 mb-2">
                <Bot size={14} className="text-primary-500" />
                <h4 className="font-semibold text-primary-800 text-xs">Suggestion IA — MINSANTÉ</h4>
              </div>
              {aiSuggestion.medicaments?.map((m: any, i: number) => (
                <div key={i} className="mb-1.5 p-2 bg-white rounded-lg border border-primary-100">
                  <p className="font-semibold text-slate-800 text-xs">{m.dci}</p>
                  <p className="text-slate-500 text-xs">{m.posologie} — {m.duree}</p>
                </div>
              ))}
              {aiSuggestion.signes_alarme?.length > 0 && (
                <div className="mt-2 p-2 bg-red-50 rounded-lg">
                  <p className="text-xs font-semibold text-red-600 mb-1">⚠️ Signes d'alarme</p>
                  {aiSuggestion.signes_alarme.map((s: string, i: number) => <p key={i} className="text-xs text-red-600">• {s}</p>)}
                </div>
              )}
              <p className="text-xs text-slate-400 mt-2 italic">Validation médicale obligatoire</p>
            </div>
          )}
        </div>

        {/* ─── Colonne principale ─── */}
        <div className="lg:col-span-3 space-y-4">
          {/* Navigation sections */}
          <div className="card !p-2">
            <div className="flex gap-1 flex-wrap">
              {SECTION_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeSection === tab.id ? 'bg-primary-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                  {tab.icon} {t(tab.tkey)}
                </button>
              ))}
            </div>
          </div>

          {/* ── Section : Histoire de la maladie ── */}
          {activeSection === 'histoire' && (
            <div className="card space-y-4">
              <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide flex items-center gap-2">
                <History size={15} /> {t('cd.h_title')}
              </h3>

              <div>
                <label className="label">{t('cd.h_recit')} *</label>
                <textarea
                  className="input h-28 resize-none"
                  value={form.histoire_maladie}
                  onChange={f('histoire_maladie')}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('cd.h_duree')}</label>
                  <input className="input" value={form.duree_symptomes} onChange={f('duree_symptomes')} />
                </div>
                <div>
                  <label className="label">{t('cd.h_mode')}</label>
                  <select className="input" value={form.mode_debut} onChange={f('mode_debut')}>
                    <option value="">{t('c.select')}</option>
                    {MODES_DEBUT.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{t('cd.h_decl')}</label>
                  <textarea className="input h-14 resize-none" value={form.facteurs_declenchants} onChange={f('facteurs_declenchants')} />
                </div>
                <div>
                  <label className="label">{t('cd.h_calm')}</label>
                  <textarea className="input h-14 resize-none" value={form.facteurs_calmants} onChange={f('facteurs_calmants')} />
                </div>
                <div className="col-span-2">
                  <label className="label">{t('cd.h_signes')}</label>
                  <textarea className="input h-14 resize-none" value={form.signes_associes} onChange={f('signes_associes')} />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <label className="label flex items-center gap-2">
                  <ClipboardList size={14} /> {t('cd.h_atcd')}
                </label>
                <textarea
                  className="input h-24 resize-none"
                  value={form.antecedents_pertinents}
                  onChange={f('antecedents_pertinents')}
                />
                {c.patient?.antecedents_medicaux && !form.antecedents_pertinents && (
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, antecedents_pertinents: buildAntecedents(c.patient) }))}
                    className="text-xs text-primary-600 mt-1 hover:underline"
                  >
                    ↗ {t('cd.h_import')}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Section : Signes vitaux & IMC ── */}
          {activeSection === 'vitaux' && (
            <div className="card space-y-4">
              <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide flex items-center gap-2">
                <Activity size={15} /> {t('cd.v_title')}
              </h3>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">{t('cd.v_ta')}</label>
                  <input className="input" value={form.tension_arterielle} onChange={f('tension_arterielle')} placeholder="Ex: 120/80" />
                  {form.tension_arterielle && (() => {
                    const [sys] = form.tension_arterielle.split('/').map(Number);
                    if (sys >= 180) return <p className="text-xs text-red-600 mt-1">⚠️ HTA grade 3 — Urgence</p>;
                    if (sys >= 160) return <p className="text-xs text-orange-600 mt-1">⚠️ HTA grade 2</p>;
                    if (sys >= 140) return <p className="text-xs text-yellow-600 mt-1">HTA grade 1</p>;
                    return null;
                  })()}
                </div>
                <div>
                  <label className="label">{t('cd.v_temp')}</label>
                  <input className="input" type="number" step="0.1" value={form.temperature} onChange={f('temperature')} placeholder="Ex: 37.5" />
                  {form.temperature && (() => {
                    const t = parseFloat(form.temperature);
                    if (t >= 40) return <p className="text-xs text-red-600 mt-1">⚠️ Hyperthermie sévère</p>;
                    if (t >= 38) return <p className="text-xs text-orange-500 mt-1">Fièvre</p>;
                    if (t < 36) return <p className="text-xs text-blue-500 mt-1">Hypothermie</p>;
                    return null;
                  })()}
                </div>
                <div>
                  <label className="label">{t('cd.v_fc')}</label>
                  <input className="input" type="number" value={form.frequence_cardiaque} onChange={f('frequence_cardiaque')} placeholder="Ex: 80" />
                  {form.frequence_cardiaque && (() => {
                    const fc = parseInt(form.frequence_cardiaque);
                    if (fc > 120) return <p className="text-xs text-orange-500 mt-1">Tachycardie</p>;
                    if (fc < 60) return <p className="text-xs text-blue-500 mt-1">Bradycardie</p>;
                    return null;
                  })()}
                </div>
                <div>
                  <label className="label">SpO2 (%)</label>
                  <input className="input" type="number" step="0.1" min="0" max="100" value={form.saturation_o2} onChange={f('saturation_o2')} placeholder="Ex: 98" />
                  {form.saturation_o2 && parseFloat(form.saturation_o2) < 95 && (
                    <p className="text-xs text-red-600 mt-1">⚠️ Désaturation — O2 requis</p>
                  )}
                </div>
                <div>
                  <label className="label">{t('cd.v_fr')}</label>
                  <input className="input" type="number" value={form.frequence_respiratoire} onChange={f('frequence_respiratoire')} placeholder="Ex: 18" />
                  {form.frequence_respiratoire && (() => {
                    const fr = parseInt(form.frequence_respiratoire);
                    if (fr > 30) return <p className="text-xs text-red-600 mt-1">⚠️ Tachypnée sévère</p>;
                    if (fr > 20) return <p className="text-xs text-orange-500 mt-1">Tachypnée</p>;
                    return null;
                  })()}
                </div>
              </div>

              {/* ── Bloc glycémie ── */}
              <div className="border border-amber-100 bg-amber-50/40 rounded-xl p-3 space-y-3">
                <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">{t('pf.glycemia')}</p>
                <div className="grid grid-cols-3 gap-3">
                  {/* Aléatoire / capillaire */}
                  <div>
                    <label className="label text-xs">{t('cd.v_gly_rand')} <span className="text-slate-400 font-normal">(mmol/L)</span></label>
                    <input className="input text-sm" type="number" step="0.1" min="0" value={form.glycemie} onChange={f('glycemie')} placeholder="Ex: 6.2" />
                    {form.glycemie && (() => {
                      const g = parseFloat(form.glycemie);
                      if (g < 2.2)  return <p className="text-xs text-red-600 mt-1 font-semibold">⚠️ Hypoglycémie sévère</p>;
                      if (g < 3.9)  return <p className="text-xs text-orange-500 mt-1">↓ Hypoglycémie</p>;
                      if (g > 11.1) return <p className="text-xs text-red-500 mt-1">↑ Diabète probable</p>;
                      if (g > 7.8)  return <p className="text-xs text-yellow-700 mt-1">↑ Hyperglycémie</p>;
                      return <p className="text-xs text-emerald-600 mt-1">Normal</p>;
                    })()}
                  </div>

                  {/* À jeûn */}
                  <div>
                    <label className="label text-xs">{t('cd.v_gly_jeun')} <span className="text-slate-400 font-normal">(mmol/L)</span></label>
                    <input className="input text-sm" type="number" step="0.1" min="0" value={form.glycemie_jeun} onChange={f('glycemie_jeun')} placeholder="Ex: 5.1" />
                    {form.glycemie_jeun && (() => {
                      const g = parseFloat(form.glycemie_jeun);
                      // Seuils OMS / ADA
                      if (g < 2.2)  return <p className="text-xs text-red-600 mt-1 font-semibold">⚠️ Hypoglycémie sévère</p>;
                      if (g < 3.9)  return <p className="text-xs text-orange-500 mt-1">↓ Hypoglycémie</p>;
                      if (g >= 7.0) return <p className="text-xs text-red-600 mt-1 font-semibold">🔴 Diabète (≥ 7.0)</p>;
                      if (g >= 6.1) return <p className="text-xs text-orange-600 mt-1">🟠 Prédiabète (6.1–6.9)</p>;
                      return <p className="text-xs text-emerald-600 mt-1">✓ Normal (&lt; 6.1)</p>;
                    })()}
                  </div>

                  {/* Post-prandiale */}
                  <div>
                    <label className="label text-xs">{t('cd.v_gly_pp')} <span className="text-slate-400 font-normal">(mmol/L)</span></label>
                    <input className="input text-sm" type="number" step="0.1" min="0" value={form.glycemie_post_prandiale} onChange={f('glycemie_post_prandiale')} placeholder="Ex: 7.8" />
                    {form.glycemie_post_prandiale && (() => {
                      const g = parseFloat(form.glycemie_post_prandiale);
                      // Seuils OMS post-prandiale 2h
                      if (g >= 11.1) return <p className="text-xs text-red-600 mt-1 font-semibold">🔴 Diabète (≥ 11.1)</p>;
                      if (g >= 7.8)  return <p className="text-xs text-orange-600 mt-1">🟠 Prédiabète (7.8–11.0)</p>;
                      return <p className="text-xs text-emerald-600 mt-1">✓ Normal (&lt; 7.8)</p>;
                    })()}
                  </div>
                </div>

                {/* Interprétation combinée */}
                {(form.glycemie_jeun || form.glycemie_post_prandiale) && (() => {
                  const gj = form.glycemie_jeun ? parseFloat(form.glycemie_jeun) : null;
                  const gpp = form.glycemie_post_prandiale ? parseFloat(form.glycemie_post_prandiale) : null;
                  const isDiab = (gj !== null && gj >= 7.0) || (gpp !== null && gpp >= 11.1);
                  const isPrediab = !isDiab && ((gj !== null && gj >= 6.1) || (gpp !== null && gpp >= 7.8));
                  if (isDiab) return (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                      <strong>Critères diagnostiques OMS : Diabète sucré confirmé</strong>
                      <br />Recontrôler à jeûn un autre jour pour confirmation si asymptomatique. Référer en consultation spécialisée.
                    </div>
                  );
                  if (isPrediab) return (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                      <strong>Prédiabète / Intolérance au glucose</strong>
                      <br />Conseils hygiéno-diététiques : activité physique 30 min/j, réduction glucides raffinés. Contrôle à 3 mois.
                    </div>
                  );
                  return null;
                })()}

                <p className="text-xs text-slate-400">
                  Référence OMS : Jeûn normal &lt; 6.1 mmol/L (110 mg/dL) · Post-prandiale 2h normale &lt; 7.8 mmol/L (140 mg/dL)
                </p>
              </div>

              {/* Poids & Taille avec IMC */}
              <div className="border-t border-slate-100 pt-4">
                <h4 className="text-xs font-semibold text-slate-600 uppercase mb-3 flex items-center gap-2">
                  <Scale size={13} /> {t('cd.v_anthropo')}
                </h4>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="label">{t('pf.weight')}</label>
                    <input className="input" type="number" step="0.1" value={form.poids} onChange={f('poids')} />
                  </div>
                  <div>
                    <label className="label">{t('pf.height')}</label>
                    <input className="input" type="number" step="0.1" value={form.taille} onChange={f('taille')} />
                  </div>
                  <div>
                    <label className="label">{t('pf.muac')}</label>
                    <input className="input" type="number" step="0.1" value={form.perimetre_brachial} onChange={f('perimetre_brachial')} />
                  </div>
                  <div>
                    <label className="label">{t('pf.head')}</label>
                    <input className="input" type="number" step="0.1" value={form.perimetre_cranien} onChange={f('perimetre_cranien')} />
                  </div>
                </div>
                {poids && taille && (
                  <IMCWidget poids={poids} taille={taille} />
                )}
              </div>

              {/* Examen clinique */}
              <div className="border-t border-slate-100 pt-4">
                <label className="label">{t('cd.v_exam_clin')}</label>
                <textarea className="input h-24 resize-none" value={form.examen_clinique} onChange={f('examen_clinique')} />
              </div>
            </div>
          )}

          {/* ── Section : Diagnostic & CIM-10 ── */}
          {activeSection === 'diagnostic' && (
            <div className="card space-y-4">
              <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide flex items-center gap-2">
                <Stethoscope size={15} /> {t('cd.d_title')}
              </h3>

              {/* CIM-10 principal */}
              <CIM10Search
                label={t('cd.d_cim')}
                value={cim10Principal}
                onChange={v => {
                  setCim10Principal(v);
                  setForm(p => ({
                    ...p,
                    diagnostic_principal: v ? `[${v.code}] ${v.libelle}` : p.diagnostic_principal,
                  }));
                }}
              />

              <div>
                <label className="label">{t('cd.d_principal')}</label>
                <input
                  className="input"
                  value={form.diagnostic_principal}
                  onChange={f('diagnostic_principal')}
                />
              </div>

              <div>
                <label className="label">{t('cd.d_secondaires')}</label>
                <textarea
                  className="input h-14 resize-none"
                  value={form.diagnostics_secondaires}
                  onChange={f('diagnostics_secondaires')}
                />
              </div>

              <div>
                <label className="label">{t('cd.d_traitement')}</label>
                <textarea
                  className="input h-24 resize-none"
                  value={form.traitement}
                  onChange={f('traitement')}
                />
              </div>

              <div>
                <label className="label">{t('cd.d_notes')}</label>
                <textarea
                  className="input h-16 resize-none"
                  value={form.notes}
                  onChange={f('notes')}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('cd.d_statut')}</label>
                  <select className="input" value={form.statut} onChange={f('statut')}>
                    <option value="en_attente">{t('st.en_attente')}</option>
                    <option value="en_cours">{t('st.en_cours')}</option>
                    <option value="terminee">{t('st.terminee')}</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ── Section : Maladie endémique ── */}
          {activeSection === 'endemique' && (
            <div className="card space-y-4">
              <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide flex items-center gap-2">
                <Search size={15} /> {t('cd.e_title')}
              </h3>
              <p className="text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2">
                {t('cd.e_hint')}
              </p>
              <FormulaireEndemique
                value={formEndemic}
                onChange={setFormEndemic}
              />
            </div>
          )}
        </div>
      </div>

      {/* Modal prescription */}
      <Modal open={showPrescModal} onClose={() => setShowPrescModal(false)} title={t('cd.presc_title')} size="xl">
        <div className="space-y-4">
          {prescItems.map((item, i) => {
            const med = medicaments.find(m => String(m.id) === String(item.medicament_id));
            const uniteCond = med?.unite_stock || 'plaquette';
            const uContenu = uniteContenu(med?.forme);
            const indispo = med && med.est_disponible === false;
            return (
            <div key={i} className="grid grid-cols-12 gap-3 items-start border border-slate-100 rounded-xl p-3">
              <div className="col-span-4">
                <label className="label text-xs">{t('cd.medicament')}</label>
                <select className={`input text-sm ${indispo ? 'border-red-300 text-red-700' : ''}`} value={item.medicament_id} onChange={e => updatePrescItem(i, 'medicament_id', e.target.value)}>
                  <option value="">{t('c.select')}</option>
                  {medicaments.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.nom_commercial} ({m.stock_actuel} {t('cd.in_stock')}){m.est_disponible === false ? ` — ${t('pha.unavailable')}` : ''}
                    </option>
                  ))}
                </select>
                {med && med.nb_par_conditionnement > 1 && (
                  <p className="text-[10px] text-slate-400 mt-1">{med.nb_par_conditionnement}{uContenu} / {uniteCond}</p>
                )}
                {indispo && (
                  <p className="text-[10px] text-red-600 mt-1 leading-tight">
                    ⚠ {t('pha.unavailable')}{med.motif_indisponibilite ? ` (${med.motif_indisponibilite})` : ''}
                  </p>
                )}
              </div>
              <div className="col-span-3">
                <label className="label text-xs">{t('cd.posologie')}</label>
                <input className="input text-sm" value={item.posologie} onChange={e => updatePrescItem(i, 'posologie', e.target.value)} placeholder="0-0-0 (Matin-Midi-Soir)" />
              </div>
              <div className="col-span-2">
                <label className="label text-xs">{t('cd.duree')}</label>
                <input className="input text-sm" value={item.duree_traitement} onChange={e => updatePrescItem(i, 'duree_traitement', e.target.value)} placeholder="7j / 5 jrs" />
              </div>
              <div className="col-span-2">
                <label className="label text-xs flex items-center gap-1">
                  {t('cd.quantite')}
                  {item.calc && !item.quantite_manuelle && (
                    <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1 rounded font-medium">auto</span>
                  )}
                </label>
                <input className="input text-sm" type="number" min="1" value={item.quantite_prescrite} onChange={e => updatePrescItem(i, 'quantite_prescrite', e.target.value)} />
                {item.calc ? (
                  <p className="text-[10px] text-slate-500 mt-1 leading-tight">
                    {item.calc.parJour}{uContenu}/j × {item.calc.jours}j = {item.calc.unites}{uContenu} → <strong>{item.calc.conditionnements} {uniteCond}(s)</strong>
                    {item.quantite_manuelle && <span className="text-amber-500"> · manuel</span>}
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-300 mt-1">{uniteCond}(s)</p>
                )}
              </div>
              <div className="col-span-1 flex justify-center pt-6">
                <button onClick={() => removePrescItem(i)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );})}
          <button onClick={addPrescItem} className="btn-outline text-sm flex items-center gap-2 w-full justify-center py-3 border-dashed">
            <Plus size={16} /> {t('cd.add_med')}
          </button>
          <div className="flex gap-3 justify-end pt-2">
            <button className="btn-outline" onClick={() => setShowPrescModal(false)}>{t('c.cancel')}</button>
            <button className="btn-secondary flex items-center gap-2" onClick={handlePrescriptions} disabled={!prescItems.some(p => p.medicament_id)}>
              <Pill size={16} /> {t('cd.send_pharma')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal prescription d'examens */}
      <Modal open={showExamModal} onClose={() => setShowExamModal(false)} title={t('cd.exam_title')} size="lg">
        <div className="space-y-4">
          <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
            {t('cd.exam_hint')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-auto">
            {catalogue.map((e, i) => (
              <label key={i} className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${examSel[i] ? 'border-primary-400 bg-primary-50' : 'border-slate-150 hover:bg-slate-50'}`}>
                <input type="checkbox" checked={!!examSel[i]} onChange={e2 => setExamSel(p => ({ ...p, [i]: e2.target.checked }))} className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700">{e.libelle}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-primary-600">{e.type_examen}</span>
                    <span className="text-[11px] text-slate-500">{e.prix?.toLocaleString('fr-FR')} F</span>
                  </div>
                </div>
              </label>
            ))}
          </div>
          <div>
            <label className="label text-xs">{t('cd.other_exam')}</label>
            <input className="input text-sm" value={examCustom} onChange={e => setExamCustom(e.target.value)} />
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button className="btn-outline" onClick={() => setShowExamModal(false)}>{t('c.cancel')}</button>
            <button className="btn-secondary flex items-center gap-2" onClick={handleExamens}>
              <FlaskConical size={16} /> {t('cd.send_lab')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal impression compte-rendu */}
      <Modal open={showLaboPrint} onClose={() => setShowLaboPrint(false)} title={t('cd.report_print')} size="lg">
        <CompteRenduLabo
          patient={c.patient}
          consultation={{ numero: c.numero }}
          examens={c.examens_labo || []}
          onClose={() => setShowLaboPrint(false)}
        />
      </Modal>
    </div>
  );
};
