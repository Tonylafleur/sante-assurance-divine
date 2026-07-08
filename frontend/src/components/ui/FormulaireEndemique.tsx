import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useT, type Lang } from '../../i18n';

/* ─── Métadonnées des maladies endémiques ─────────────────────────────── */
export const MALADIES_ENDEMIQUES = [
  { id: 'paludisme',       label: 'Paludisme',       en: 'Malaria',         code: 'B50-B54', couleur: 'orange' },
  { id: 'tuberculose',     label: 'Tuberculose',     en: 'Tuberculosis',    code: 'A15-A19', couleur: 'red'    },
  { id: 'cholera',         label: 'Choléra',         en: 'Cholera',         code: 'A00',     couleur: 'blue'   },
  { id: 'vih_sida',        label: 'VIH / SIDA',      en: 'HIV / AIDS',      code: 'B20-B24', couleur: 'purple' },
  { id: 'fievre_typhoide', label: 'Fièvre typhoïde', en: 'Typhoid fever',   code: 'A01',     couleur: 'amber'  },
  { id: 'hepatite_b',      label: 'Hépatite B',      en: 'Hepatitis B',     code: 'B16-B18', couleur: 'yellow' },
  { id: 'rougeole',        label: 'Rougeole',        en: 'Measles',         code: 'B05',     couleur: 'pink'   },
  { id: 'rage',            label: 'Rage',            en: 'Rabies',          code: 'A82',     couleur: 'slate'  },
] as const;

type MaladieId = typeof MALADIES_ENDEMIQUES[number]['id'];

/* ─── Helpers bilingues : la valeur stockée reste en FR (stabilité des données),
   seul l'affichage suit la langue active ─────────────────────────────── */
function makeHelpers(lang: Lang) {
  const L = (fr: string, en: string) => (lang === 'en' ? en : fr);
  // <option> : value = texte FR (stable en base), libellé affiché selon la langue
  const O = (fr: string, en: string) => <option value={fr}>{lang === 'en' ? en : fr}</option>;
  return { L, O };
}

/* ─── Sous-formulaires par maladie ───────────────────────────────────── */

const FormPaludisme: React.FC<{ data: any; onChange: (d: any) => void }> = ({ data, onChange }) => {
  const { lang } = useT();
  const { L, O } = makeHelpers(lang);
  const f = (k: string) => (e: any) => onChange({ ...data, [k]: e.target.value });
  const fCheck = (k: string) => (e: any) => onChange({ ...data, [k]: e.target.checked });
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div className="col-span-2">
        <p className="text-xs font-semibold text-orange-700 uppercase mb-2">{L('Classification clinique', 'Clinical classification')}</p>
      </div>
      <div>
        <label className="label text-xs">{L('Type de paludisme', 'Malaria type')}</label>
        <select className="input text-sm" value={data.type || ''} onChange={f('type')}>
          <option value="">{L('Sélectionner...', 'Select...')}</option>
          {O('Paludisme simple (non compliqué)', 'Uncomplicated malaria')}
          {O('Paludisme grave (compliqué)', 'Severe (complicated) malaria')}
          {O('Neuropaludisme (coma)', 'Cerebral malaria (coma)')}
          {O('Paludisme de la femme enceinte', 'Malaria in pregnancy')}
          {O('Paludisme du nourrisson', 'Malaria in infants')}
        </select>
      </div>
      <div>
        <label className="label text-xs">{L('Espèce plasmodiale', 'Plasmodium species')}</label>
        <select className="input text-sm" value={data.espece || ''} onChange={f('espece')}>
          <option value="">{L('Sélectionner...', 'Select...')}</option>
          {O('P. falciparum', 'P. falciparum')}
          {O('P. vivax', 'P. vivax')}
          {O('P. malariae', 'P. malariae')}
          {O('P. ovale', 'P. ovale')}
          {O('Mixte', 'Mixed')}
          {O('Non déterminé', 'Undetermined')}
        </select>
      </div>
      <div className="col-span-2">
        <p className="text-xs font-semibold text-orange-700 uppercase mb-2 mt-2">{L('Diagnostic biologique', 'Laboratory diagnosis')}</p>
      </div>
      <div>
        <label className="label text-xs">{L('TDR (Test de Diagnostic Rapide)', 'RDT (Rapid Diagnostic Test)')}</label>
        <select className="input text-sm" value={data.tdr || ''} onChange={f('tdr')}>
          <option value="">{L('Non réalisé', 'Not done')}</option>
          {O('Positif', 'Positive')}
          {O('Négatif', 'Negative')}
          {O('Douteux', 'Equivocal')}
        </select>
      </div>
      <div>
        <label className="label text-xs">{L('GE / Frottis sanguin', 'Thick smear / blood film')}</label>
        <select className="input text-sm" value={data.ge || ''} onChange={f('ge')}>
          <option value="">{L('Non réalisé', 'Not done')}</option>
          {O('Positif (+ parasitémie)', 'Positive (+ parasitemia)')}
          {O('Négatif', 'Negative')}
        </select>
      </div>
      <div>
        <label className="label text-xs">{L('Densité parasitaire (/µL)', 'Parasite density (/µL)')}</label>
        <input className="input text-sm" value={data.densite || ''} onChange={f('densite')} placeholder="12000" />
      </div>
      <div>
        <label className="label text-xs">{L('Hémoglobine (g/dL)', 'Hemoglobin (g/dL)')}</label>
        <input className="input text-sm" type="number" step="0.1" value={data.hemoglobine || ''} onChange={f('hemoglobine')} placeholder="8.5" />
      </div>
      <div className="col-span-2">
        <p className="text-xs font-semibold text-orange-700 uppercase mb-2 mt-2">{L('Complications (paludisme grave)', 'Complications (severe malaria)')}</p>
      </div>
      {[
        ['coma', 'Coma / Altération conscience', 'Coma / altered consciousness'], ['convulsions', 'Convulsions', 'Convulsions'],
        ['anemie_severe', 'Anémie sévère (Hb < 5 g/dL)', 'Severe anemia (Hb < 5 g/dL)'], ['detresse_resp', 'Détresse respiratoire', 'Respiratory distress'],
        ['hypoglycemie', 'Hypoglycémie (< 2.2 mmol/L)', 'Hypoglycemia (< 2.2 mmol/L)'], ['ictere', 'Ictère', 'Jaundice'],
        ['hyperparasitemie', 'Hyperparasitémie (>4%)', 'Hyperparasitemia (>4%)'], ['choc', 'État de choc', 'Shock'],
      ].map(([k, fr, en]) => (
        <label key={k} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
          <input type="checkbox" checked={!!data[k]} onChange={fCheck(k)} className="rounded text-orange-500" />
          {L(fr, en)}
        </label>
      ))}
      <div className="col-span-2">
        <label className="label text-xs mt-2">{L('Protocole de traitement', 'Treatment protocol')}</label>
        <select className="input text-sm" value={data.traitement || ''} onChange={f('traitement')}>
          <option value="">{L('Sélectionner...', 'Select...')}</option>
          {O('ACT (Artéméther-Luméfantrine) — 1ère ligne', 'ACT (Artemether-Lumefantrine) — 1st line')}
          {O('ACT (Dihydroartémisinine-Pipéraquine) — 2ème ligne', 'ACT (Dihydroartemisinin-Piperaquine) — 2nd line')}
          {O('Quinine IV — paludisme grave', 'IV Quinine — severe malaria')}
          {O('Artésunate IV — paludisme grave sévère', 'IV Artesunate — severe malaria')}
          {O('SP (Sulfadoxine-Pyriméthamine) — TPI grossesse', 'SP (Sulfadoxine-Pyrimethamine) — IPTp pregnancy')}
        </select>
      </div>
      <div className="col-span-2">
        <label className="label text-xs">{L('Observations cliniques', 'Clinical observations')}</label>
        <textarea className="input h-16 resize-none text-sm" value={data.observations || ''} onChange={f('observations')} />
      </div>
    </div>
  );
};

const FormTuberculose: React.FC<{ data: any; onChange: (d: any) => void }> = ({ data, onChange }) => {
  const { lang } = useT();
  const { L, O } = makeHelpers(lang);
  const f = (k: string) => (e: any) => onChange({ ...data, [k]: e.target.value });
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div>
        <label className="label text-xs">{L('Forme clinique', 'Clinical form')}</label>
        <select className="input text-sm" value={data.forme || ''} onChange={f('forme')}>
          <option value="">{L('Sélectionner...', 'Select...')}</option>
          {O('TB pulmonaire à frottis positif (TPM+)', 'Smear-positive pulmonary TB')}
          {O('TB pulmonaire à frottis négatif (TPM-)', 'Smear-negative pulmonary TB')}
          {O('TB extra-pulmonaire', 'Extrapulmonary TB')}
          {O('TB miliaire', 'Miliary TB')}
          {O('TB/VIH co-infection', 'TB/HIV co-infection')}
          {O('TB multirésistante (TB-MR)', 'Multidrug-resistant TB (MDR-TB)')}
        </select>
      </div>
      <div>
        <label className="label text-xs">{L('Localisation (si extra-pulmonaire)', 'Site (if extrapulmonary)')}</label>
        <select className="input text-sm" value={data.localisation || ''} onChange={f('localisation')}>
          <option value="">{L('Non concerné', 'Not applicable')}</option>
          {O('Ganglionnaire (adénopathie)', 'Lymph node')}
          {O('Pleurale (pleurésie)', 'Pleural')}
          {O('Osseuse/articulaire', 'Bone/joint')}
          {O('Méningée', 'Meningeal')}
          {O('Abdominale/péritonéale', 'Abdominal/peritoneal')}
          {O('Urinaire/génitale', 'Urogenital')}
          {O('Cutanée', 'Cutaneous')}
        </select>
      </div>
      <div>
        <label className="label text-xs">{L('BAAR (Bacilloscopie)', 'AFB (sputum smear)')}</label>
        <select className="input text-sm" value={data.baar || ''} onChange={f('baar')}>
          <option value="">{L('Non réalisé', 'Not done')}</option>
          {O('Positif 1+ (10-99 BAAR/100 champs)', 'Positive 1+')}
          {O('Positif 2+ (1-10 BAAR/champ)', 'Positive 2+')}
          {O('Positif 3+ (> 10 BAAR/champ)', 'Positive 3+')}
          {O('Négatif', 'Negative')}
        </select>
      </div>
      <div>
        <label className="label text-xs">GeneXpert / Xpert MTB/RIF</label>
        <select className="input text-sm" value={data.genexpert || ''} onChange={f('genexpert')}>
          <option value="">{L('Non réalisé', 'Not done')}</option>
          {O('MTB détecté — sensible rifampicine', 'MTB detected — rifampicin sensitive')}
          {O('MTB détecté — résistant rifampicine', 'MTB detected — rifampicin resistant')}
          {O('MTB détecté — résistance indéterminée', 'MTB detected — resistance indeterminate')}
          {O('MTB non détecté', 'MTB not detected')}
        </select>
      </div>
      <div>
        <label className="label text-xs">{L('Radio thorax', 'Chest X-ray')}</label>
        <select className="input text-sm" value={data.radio || ''} onChange={f('radio')}>
          <option value="">{L('Non réalisé', 'Not done')}</option>
          {O('Infiltrats apicaux — TB active probable', 'Apical infiltrates — probable active TB')}
          {O('Cavernes (cavités)', 'Cavities')}
          {O('Miliaire diffuse', 'Diffuse miliary')}
          {O('Pleurésie', 'Pleural effusion')}
          {O('Normale', 'Normal')}
          {O('Séquelles TB', 'TB sequelae')}
        </select>
      </div>
      <div>
        <label className="label text-xs">{L('Statut VIH', 'HIV status')}</label>
        <select className="input text-sm" value={data.statut_vih || ''} onChange={f('statut_vih')}>
          <option value="">{L('Non connu', 'Unknown')}</option>
          {O('VIH positif', 'HIV positive')}
          {O('VIH négatif', 'HIV negative')}
          {O('Refus de test', 'Test declined')}
        </select>
      </div>
      <div>
        <label className="label text-xs">{L('Régime DOTS', 'DOTS regimen')}</label>
        <select className="input text-sm" value={data.dots || ''} onChange={f('dots')}>
          <option value="">{L('Sélectionner...', 'Select...')}</option>
          {O('2HRZE / 4HR — Nouveau cas', '2HRZE / 4HR — New case')}
          {O('2HRZES / 1HRZE / 5HRE — Retraitement', '2HRZES / 1HRZE / 5HRE — Retreatment')}
          {O('Régime TB-MR (6 mois injectable)', 'MDR-TB regimen (6-month injectable)')}
          {O('Régime TB-MR oral (18-24 mois)', 'Oral MDR-TB regimen (18-24 months)')}
        </select>
      </div>
      <div>
        <label className="label text-xs">{L('Phase de traitement', 'Treatment phase')}</label>
        <select className="input text-sm" value={data.phase || ''} onChange={f('phase')}>
          <option value="">{L('Début traitement', 'Treatment start')}</option>
          {O('Phase intensive (2 premiers mois)', 'Intensive phase (first 2 months)')}
          {O('Phase de continuation (4-6 mois)', 'Continuation phase (4-6 months)')}
          {O('Suivi post-traitement', 'Post-treatment follow-up')}
        </select>
      </div>
      <div className="col-span-2">
        <label className="label text-xs">{L('Contacts familiaux identifiés', 'Household contacts identified')}</label>
        <input className="input text-sm" value={data.contacts || ''} onChange={f('contacts')} />
      </div>
    </div>
  );
};

const FormCholera: React.FC<{ data: any; onChange: (d: any) => void }> = ({ data, onChange }) => {
  const { lang } = useT();
  const { L, O } = makeHelpers(lang);
  const f = (k: string) => (e: any) => onChange({ ...data, [k]: e.target.value });
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div>
        <label className="label text-xs">{L('Degré de déshydratation', 'Dehydration level')}</label>
        <select className="input text-sm" value={data.deshydratation || ''} onChange={f('deshydratation')}>
          <option value="">{L('Évaluer...', 'Assess...')}</option>
          {O('Pas de déshydratation', 'No dehydration')}
          {O('Déshydratation légère/modérée (Plan B)', 'Mild/moderate dehydration (Plan B)')}
          {O('Déshydratation sévère (Plan C)', 'Severe dehydration (Plan C)')}
          {O('Choc hypovolémique', 'Hypovolemic shock')}
        </select>
      </div>
      <div>
        <label className="label text-xs">{L('Fréquence des selles/24h', 'Stool frequency/24h')}</label>
        <input className="input text-sm" type="number" value={data.frequence_selles || ''} onChange={f('frequence_selles')} placeholder="15" />
      </div>
      <div>
        <label className="label text-xs">{L('Aspect des selles', 'Stool appearance')}</label>
        <select className="input text-sm" value={data.aspect_selles || ''} onChange={f('aspect_selles')}>
          <option value="">{L('Sélectionner...', 'Select...')}</option>
          {O('Eau de riz (typique choléra)', 'Rice-water (typical cholera)')}
          {O('Liquides abondantes', 'Profuse watery')}
          {O('Normales', 'Normal')}
        </select>
      </div>
      <div>
        <label className="label text-xs">{L('Confirmation biologique', 'Laboratory confirmation')}</label>
        <select className="input text-sm" value={data.biologie || ''} onChange={f('biologie')}>
          <option value="">{L('Non réalisé', 'Not done')}</option>
          {O('Coproculture positive — V. cholerae O1', 'Stool culture positive — V. cholerae O1')}
          {O('Coproculture positive — V. cholerae O139', 'Stool culture positive — V. cholerae O139')}
          {O('Coproculture négative', 'Stool culture negative')}
          {O('TDR choléra positif', 'Cholera RDT positive')}
        </select>
      </div>
      <div>
        <label className="label text-xs">{L('Plan de réhydratation OMS', 'WHO rehydration plan')}</label>
        <select className="input text-sm" value={data.plan_rehydratation || ''} onChange={f('plan_rehydratation')}>
          <option value="">{L('Sélectionner...', 'Select...')}</option>
          {O('Plan A — SRO à domicile', 'Plan A — ORS at home')}
          {O('Plan B — SRO en centre (75ml/kg en 4h)', 'Plan B — ORS in facility (75ml/kg in 4h)')}
          {O('Plan C — Ringer Lactate IV (100ml/kg en 3h)', 'Plan C — IV Ringer Lactate (100ml/kg in 3h)')}
        </select>
      </div>
      <div>
        <label className="label text-xs">{L('Antibiothérapie', 'Antibiotic therapy')}</label>
        <select className="input text-sm" value={data.antibiotique || ''} onChange={f('antibiotique')}>
          <option value="">{L('Sélectionner...', 'Select...')}</option>
          {O('Doxycycline 300mg dose unique (adulte)', 'Doxycycline 300mg single dose (adult)')}
          {O('Cotrimoxazole — enfant', 'Cotrimoxazole — child')}
          {O('Azithromycine — grossesse/enfant', 'Azithromycin — pregnancy/child')}
          {O('Non indiquée (forme légère)', 'Not indicated (mild form)')}
        </select>
      </div>
      <div className="col-span-2">
        <label className="label text-xs">{L('Source probable de contamination', 'Probable source of contamination')}</label>
        <input className="input text-sm" value={data.source || ''} onChange={f('source')} />
      </div>
      <div className="col-span-2">
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-xs font-bold text-blue-700 mb-1">⚠️ {L('DÉCLARATION OBLIGATOIRE', 'MANDATORY NOTIFICATION')}</p>
          <p className="text-xs text-blue-600">{L('Le choléra est une maladie à notification immédiate. Déclarer au MINSANTÉ et à la délégation régionale sous 24h.', 'Cholera is an immediately notifiable disease. Report to MINSANTÉ and the regional delegation within 24h.')}</p>
        </div>
      </div>
    </div>
  );
};

const FormVIH: React.FC<{ data: any; onChange: (d: any) => void }> = ({ data, onChange }) => {
  const { lang } = useT();
  const { L, O } = makeHelpers(lang);
  const f = (k: string) => (e: any) => onChange({ ...data, [k]: e.target.value });
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div>
        <label className="label text-xs">{L('Stade OMS', 'WHO stage')}</label>
        <select className="input text-sm" value={data.stade_oms || ''} onChange={f('stade_oms')}>
          <option value="">{L('Sélectionner...', 'Select...')}</option>
          {O('Stade 1 — Asymptomatique', 'Stage 1 — Asymptomatic')}
          {O('Stade 2 — Maladie légère', 'Stage 2 — Mild disease')}
          {O('Stade 3 — Maladie avancée', 'Stage 3 — Advanced disease')}
          {O('Stade 4 — Maladie grave (SIDA)', 'Stage 4 — Severe disease (AIDS)')}
        </select>
      </div>
      <div>
        <label className="label text-xs">{L('Type de VIH', 'HIV type')}</label>
        <select className="input text-sm" value={data.type_vih || ''} onChange={f('type_vih')}>
          <option value="">{L('Non précisé', 'Unspecified')}</option>
          {O('VIH-1', 'HIV-1')}
          {O('VIH-2', 'HIV-2')}
          {O('VIH-1 + VIH-2', 'HIV-1 + HIV-2')}
        </select>
      </div>
      <div>
        <label className="label text-xs">{L('CD4 (cellules/mm³)', 'CD4 (cells/mm³)')}</label>
        <input className="input text-sm" type="number" value={data.cd4 || ''} onChange={f('cd4')} placeholder="350" />
      </div>
      <div>
        <label className="label text-xs">{L('Charge virale (copies/mL)', 'Viral load (copies/mL)')}</label>
        <input className="input text-sm" value={data.charge_virale || ''} onChange={f('charge_virale')} />
      </div>
      <div>
        <label className="label text-xs">{L('Schéma ARV en cours', 'Current ART regimen')}</label>
        <select className="input text-sm" value={data.arv || ''} onChange={f('arv')}>
          <option value="">{L('Pas sous ARV', 'Not on ART')}</option>
          {O('TDF + 3TC + DTG (1ère ligne préférentielle)', 'TDF + 3TC + DTG (preferred 1st line)')}
          {O('TDF + 3TC + EFV (1ère ligne alternative)', 'TDF + 3TC + EFV (alternative 1st line)')}
          {O('AZT + 3TC + NVP (ancienne 1ère ligne)', 'AZT + 3TC + NVP (former 1st line)')}
          {O('ATV/r + TDF + 3TC (2ème ligne)', 'ATV/r + TDF + 3TC (2nd line)')}
          {O('LPV/r + ABC + 3TC (enfant 2ème ligne)', 'LPV/r + ABC + 3TC (child 2nd line)')}
          {O('Autre (préciser en notes)', 'Other (specify in notes)')}
        </select>
      </div>
      <div>
        <label className="label text-xs">{L('Observance ARV', 'ART adherence')}</label>
        <select className="input text-sm" value={data.observance || ''} onChange={f('observance')}>
          <option value="">{L('À évaluer', 'To assess')}</option>
          {O('Bonne (≥ 95%)', 'Good (≥ 95%)')}
          {O('Moyenne (80-94%)', 'Fair (80-94%)')}
          {O('Mauvaise (< 80%)', 'Poor (< 80%)')}
        </select>
      </div>
      <div>
        <label className="label text-xs">{L('Prophylaxie cotrimoxazole', 'Cotrimoxazole prophylaxis')}</label>
        <select className="input text-sm" value={data.cotrim || ''} onChange={f('cotrim')}>
          <option value="">{L('Non précisé', 'Unspecified')}</option>
          {O('Oui — en cours', 'Yes — ongoing')}
          {O('Non — indiquée', 'No — indicated')}
          {O('Non — non indiquée (CD4 > 350)', 'No — not indicated (CD4 > 350)')}
          {O('Arrêtée (allergie)', 'Stopped (allergy)')}
        </select>
      </div>
      <div>
        <label className="label text-xs">{L('Dépistage TB associée', 'TB screening')}</label>
        <select className="input text-sm" value={data.tb_screening || ''} onChange={f('tb_screening')}>
          <option value="">{L('Non réalisé', 'Not done')}</option>
          {O('Négatif — TPT isoniazide indiqué', 'Negative — isoniazid TPT indicated')}
          {O('Positif — traitement TB initié', 'Positive — TB treatment started')}
          {O("En cours d'investigation", 'Under investigation')}
        </select>
      </div>
      <div className="col-span-2">
        <label className="label text-xs">{L('Infections opportunistes', 'Opportunistic infections')}</label>
        <input className="input text-sm" value={data.io || ''} onChange={f('io')} />
      </div>
      <div className="col-span-2">
        <label className="label text-xs">{L('Conseil et soutien psychosocial', 'Counseling & psychosocial support')}</label>
        <select className="input text-sm" value={data.conseil || ''} onChange={f('conseil')}>
          <option value="">{L('Non effectué', 'Not done')}</option>
          {O('Conseil individuel effectué', 'Individual counseling done')}
          {O('Conseil de couple effectué', 'Couple counseling done')}
          {O('Référé psychologue/assistant social', 'Referred to psychologist/social worker')}
          {O('Groupe de soutien — participant', 'Support group — member')}
        </select>
      </div>
    </div>
  );
};

const FormFievreTyphoide: React.FC<{ data: any; onChange: (d: any) => void }> = ({ data, onChange }) => {
  const { lang } = useT();
  const { L, O } = makeHelpers(lang);
  const f = (k: string) => (e: any) => onChange({ ...data, [k]: e.target.value });
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div>
        <label className="label text-xs">{L('Durée de la fièvre', 'Fever duration')}</label>
        <input className="input text-sm" value={data.duree_fievre || ''} onChange={f('duree_fievre')} />
      </div>
      <div>
        <label className="label text-xs">{L('Widal (diagnostic sérologique)', 'Widal (serology)')}</label>
        <select className="input text-sm" value={data.widal || ''} onChange={f('widal')}>
          <option value="">{L('Non réalisé', 'Not done')}</option>
          {O('TO ≥ 1/160 + TH ≥ 1/160 (positif)', 'TO ≥ 1/160 + TH ≥ 1/160 (positive)')}
          {O('TO isolé positif', 'TO positive alone')}
          {O('Négatif', 'Negative')}
          {O('Non contributif', 'Non-contributory')}
        </select>
      </div>
      <div>
        <label className="label text-xs">{L('Hémoculture', 'Blood culture')}</label>
        <select className="input text-sm" value={data.hemoculture || ''} onChange={f('hemoculture')}>
          <option value="">{L('Non réalisée', 'Not done')}</option>
          {O('Positive — S. typhi', 'Positive — S. typhi')}
          {O('Positive — S. paratyphi A', 'Positive — S. paratyphi A')}
          {O('Positive — S. paratyphi B', 'Positive — S. paratyphi B')}
          {O('Négative', 'Negative')}
          {O('En attente', 'Pending')}
        </select>
      </div>
      <div>
        <label className="label text-xs">{L('Test Typhidot / TDR', 'Typhidot / RDT test')}</label>
        <select className="input text-sm" value={data.typhidot || ''} onChange={f('typhidot')}>
          <option value="">{L('Non réalisé', 'Not done')}</option>
          {O('IgM positif (infection récente)', 'IgM positive (recent infection)')}
          {O('IgG positif (infection ancienne)', 'IgG positive (past infection)')}
          {O('IgM + IgG positifs', 'IgM + IgG positive')}
          {O('Négatif', 'Negative')}
        </select>
      </div>
      <div>
        <label className="label text-xs">{L('Antibiothérapie', 'Antibiotic therapy')}</label>
        <select className="input text-sm" value={data.antibiotique || ''} onChange={f('antibiotique')}>
          <option value="">{L('Sélectionner...', 'Select...')}</option>
          {O('Ciprofloxacine 500mg × 2/j × 10-14j (1ère ligne adulte)', 'Ciprofloxacin 500mg ×2/d ×10-14d (1st line adult)')}
          {O('Ceftriaxone 2g/j IV × 7-10j (forme grave)', 'Ceftriaxone 2g/d IV ×7-10d (severe form)')}
          {O('Azithromycine 1g/j × 5j (souche résistante)', 'Azithromycin 1g/d ×5d (resistant strain)')}
          {O('Amoxicilline 3g/j × 14j (enfant, si sensible)', 'Amoxicillin 3g/d ×14d (child, if sensitive)')}
          {O('Cotrimoxazole (si sensible)', 'Cotrimoxazole (if sensitive)')}
        </select>
      </div>
      <div>
        <label className="label text-xs">{L('Complications', 'Complications')}</label>
        <select className="input text-sm" value={data.complications || ''} onChange={f('complications')}>
          <option value="">{L('Aucune', 'None')}</option>
          {O('Perforation intestinale', 'Intestinal perforation')}
          {O('Hémorragie digestive', 'GI bleeding')}
          {O('Encéphalite typhoïdique', 'Typhoid encephalitis')}
          {O('Myocardite', 'Myocarditis')}
          {O('Hépatite', 'Hepatitis')}
        </select>
      </div>
    </div>
  );
};

const FormHepatiteB: React.FC<{ data: any; onChange: (d: any) => void }> = ({ data, onChange }) => {
  const { lang } = useT();
  const { L, O } = makeHelpers(lang);
  const f = (k: string) => (e: any) => onChange({ ...data, [k]: e.target.value });
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div>
        <label className="label text-xs">{L('Phase clinique', 'Clinical phase')}</label>
        <select className="input text-sm" value={data.phase || ''} onChange={f('phase')}>
          <option value="">{L('Sélectionner...', 'Select...')}</option>
          {O('Hépatite B aiguë', 'Acute hepatitis B')}
          {O('Hépatite B chronique — phase immuno-tolérante', 'Chronic hepatitis B — immune-tolerant phase')}
          {O('Hépatite B chronique — phase active (HBeAg+)', 'Chronic hepatitis B — active phase (HBeAg+)')}
          {O('Hépatite B chronique — phase inactive (HBeAg-)', 'Chronic hepatitis B — inactive phase (HBeAg-)')}
          {O('Cirrhose hépatique B', 'Hepatitis B cirrhosis')}
          {O('Carcinome hépatocellulaire sur VHB', 'HBV-related hepatocellular carcinoma')}
        </select>
      </div>
      <div>
        <label className="label text-xs">AgHBs</label>
        <select className="input text-sm" value={data.aghbs || ''} onChange={f('aghbs')}>
          <option value="">{L('Non testé', 'Not tested')}</option>
          {O('Positif', 'Positive')}
          {O('Négatif', 'Negative')}
        </select>
      </div>
      <div>
        <label className="label text-xs">AgHBe</label>
        <select className="input text-sm" value={data.aghbe || ''} onChange={f('aghbe')}>
          <option value="">{L('Non testé', 'Not tested')}</option>
          {O('Positif (réplication active)', 'Positive (active replication)')}
          {O('Négatif', 'Negative')}
        </select>
      </div>
      <div>
        <label className="label text-xs">{L('Anti-HBs (anticorps)', 'Anti-HBs (antibodies)')}</label>
        <select className="input text-sm" value={data.anti_hbs || ''} onChange={f('anti_hbs')}>
          <option value="">{L('Non testé', 'Not tested')}</option>
          {O('Positif (immunité)', 'Positive (immunity)')}
          {O('Négatif', 'Negative')}
        </select>
      </div>
      <div>
        <label className="label text-xs">{L('ADN VHB (charge virale)', 'HBV DNA (viral load)')}</label>
        <input className="input text-sm" value={data.adn_vhb || ''} onChange={f('adn_vhb')} />
      </div>
      <div>
        <label className="label text-xs">ALAT/ASAT</label>
        <input className="input text-sm" value={data.alat || ''} onChange={f('alat')} />
      </div>
      <div>
        <label className="label text-xs">{L('Fibrose (FibroScan/FIB-4)', 'Fibrosis (FibroScan/FIB-4)')}</label>
        <select className="input text-sm" value={data.fibrose || ''} onChange={f('fibrose')}>
          <option value="">{L('Non évalué', 'Not assessed')}</option>
          {O('F0-F1 (fibrose absente/minimale)', 'F0-F1 (no/minimal fibrosis)')}
          {O('F2 (fibrose significative)', 'F2 (significant fibrosis)')}
          {O('F3 (fibrose sévère)', 'F3 (severe fibrosis)')}
          {O('F4 (cirrhose)', 'F4 (cirrhosis)')}
        </select>
      </div>
      <div>
        <label className="label text-xs">{L('Traitement antiviral', 'Antiviral treatment')}</label>
        <select className="input text-sm" value={data.traitement || ''} onChange={f('traitement')}>
          <option value="">{L('Non indiqué / en évaluation', 'Not indicated / under assessment')}</option>
          {O('Ténofovir (TDF) 300mg/j — 1ère ligne', 'Tenofovir (TDF) 300mg/d — 1st line')}
          {O('Entécavir 0.5mg/j', 'Entecavir 0.5mg/d')}
          {O('Entécavir 1mg/j (si résistance lamivudine)', 'Entecavir 1mg/d (if lamivudine resistance)')}
          {O('Interféron-alpha pégylé', 'Pegylated interferon-alpha')}
        </select>
      </div>
      <div className="col-span-2">
        <label className="label text-xs">{L('Statut vaccinal contacts', 'Contacts vaccination status')}</label>
        <input className="input text-sm" value={data.contacts_vaccination || ''} onChange={f('contacts_vaccination')} />
      </div>
    </div>
  );
};

const FormRougeole: React.FC<{ data: any; onChange: (d: any) => void }> = ({ data, onChange }) => {
  const { lang } = useT();
  const { L, O } = makeHelpers(lang);
  const f = (k: string) => (e: any) => onChange({ ...data, [k]: e.target.value });
  const fCheck = (k: string) => (e: any) => onChange({ ...data, [k]: e.target.checked });
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div>
        <label className="label text-xs">{L('Statut vaccinal', 'Vaccination status')}</label>
        <select className="input text-sm" value={data.vaccination || ''} onChange={f('vaccination')}>
          <option value="">{L('Non connu', 'Unknown')}</option>
          {O('Non vacciné', 'Unvaccinated')}
          {O('1 dose (incomplet)', '1 dose (incomplete)')}
          {O('2 doses (complet)', '2 doses (complete)')}
          {O('Statut inconnu', 'Status unknown')}
        </select>
      </div>
      <div>
        <label className="label text-xs">{L('Confirmation', 'Confirmation')}</label>
        <select className="input text-sm" value={data.confirmation || ''} onChange={f('confirmation')}>
          <option value="">{L('Clinique seulement', 'Clinical only')}</option>
          {O('Sérologie IgM positive', 'IgM serology positive')}
          {O('PCR positive', 'PCR positive')}
          {O('Cas lié épidémio (contact confirmé)', 'Epi-linked case (confirmed contact)')}
        </select>
      </div>
      <div className="col-span-2">
        <p className="text-xs font-semibold text-pink-700 uppercase mb-2">{L('Complications recherchées', 'Complications screened')}</p>
      </div>
      {[
        ['pneumonie', 'Pneumonie (cause principale de décès)', 'Pneumonia (leading cause of death)'],
        ['encephalite', 'Encéphalite / convulsions', 'Encephalitis / convulsions'],
        ['otite', 'Otite moyenne aiguë', 'Acute otitis media'],
        ['diarrhee', 'Diarrhée sévère / déshydratation', 'Severe diarrhea / dehydration'],
        ['keratite', 'Kératite / atteinte oculaire', 'Keratitis / eye involvement'],
        ['malnutrition', 'Malnutrition sévère aggravée', 'Worsened severe malnutrition'],
        ['croup', 'Croup (laryngotrachéite)', 'Croup (laryngotracheitis)'],
      ].map(([k, fr, en]) => (
        <label key={k} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
          <input type="checkbox" checked={!!data[k]} onChange={fCheck(k)} className="rounded text-pink-500" />
          {L(fr, en)}
        </label>
      ))}
      <div className="col-span-2">
        <label className="label text-xs mt-2">{L('Vitamine A (traitement systématique OMS)', 'Vitamin A (routine WHO treatment)')}</label>
        <select className="input text-sm" value={data.vitamine_a || ''} onChange={f('vitamine_a')}>
          <option value="">{L('Sélectionner...', 'Select...')}</option>
          {O('200 000 UI/j × 2j (enfant > 12 mois)', '200,000 IU/d ×2d (child > 12 months)')}
          {O('100 000 UI/j × 2j (enfant 6-12 mois)', '100,000 IU/d ×2d (child 6-12 months)')}
          {O('50 000 UI/j × 2j (enfant < 6 mois)', '50,000 IU/d ×2d (child < 6 months)')}
          {O('Déjà administrée', 'Already given')}
        </select>
      </div>
      <div className="col-span-2">
        <div className="p-3 bg-pink-50 border border-pink-200 rounded-xl">
          <p className="text-xs font-bold text-pink-700 mb-1">⚠️ {L('DÉCLARATION OBLIGATOIRE', 'MANDATORY NOTIFICATION')}</p>
          <p className="text-xs text-pink-600">{L('Déclarer tout cas suspect au MINSANTÉ. Notifier les contacts non vaccinés. Vaccination en urgence dans les 72h post-exposition.', 'Report any suspected case to MINSANTÉ. Notify unvaccinated contacts. Emergency vaccination within 72h post-exposure.')}</p>
        </div>
      </div>
    </div>
  );
};

const FormRage: React.FC<{ data: any; onChange: (d: any) => void }> = ({ data, onChange }) => {
  const { lang } = useT();
  const { L, O } = makeHelpers(lang);
  const f = (k: string) => (e: any) => onChange({ ...data, [k]: e.target.value });
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div>
        <label className="label text-xs">{L('Animal responsable', 'Animal involved')}</label>
        <select className="input text-sm" value={data.animal || ''} onChange={f('animal')}>
          <option value="">{L('Sélectionner...', 'Select...')}</option>
          {O('Chien (principal vecteur Cameroun)', 'Dog (main vector in Cameroon)')}
          {O('Chat', 'Cat')}
          {O('Chauve-souris', 'Bat')}
          {O('Singe', 'Monkey')}
          {O('Autre mammifère', 'Other mammal')}
          {O('Animal non identifié', 'Unidentified animal')}
        </select>
      </div>
      <div>
        <label className="label text-xs">{L('Statut animal', 'Animal status')}</label>
        <select className="input text-sm" value={data.statut_animal || ''} onChange={f('statut_animal')}>
          <option value="">{L('Non connu', 'Unknown')}</option>
          {O('Non vacciné', 'Unvaccinated')}
          {O('Vacciné (carnet valide)', 'Vaccinated (valid record)')}
          {O('Animal errant', 'Stray animal')}
          {O('Animal abattu/disparu', 'Animal killed/missing')}
          {O('Comportement anormal (rage probable)', 'Abnormal behavior (probable rabies)')}
        </select>
      </div>
      <div>
        <label className="label text-xs">{L('Catégorie OMS (gravité exposition)', 'WHO category (exposure severity)')}</label>
        <select className="input text-sm" value={data.categorie_oms || ''} onChange={f('categorie_oms')}>
          <option value="">{L('Sélectionner...', 'Select...')}</option>
          {O('Catégorie I — Contact sans lésion (lavage simple)', 'Category I — Contact without lesion (washing)')}
          {O('Catégorie II — Griffures/morsures légères superficielles', 'Category II — Minor superficial scratches/bites')}
          {O('Catégorie III — Morsures profondes, muqueuses, chauves-souris', 'Category III — Deep bites, mucosa, bats')}
        </select>
      </div>
      <div>
        <label className="label text-xs">{L('Localisation de la blessure', 'Wound location')}</label>
        <input className="input text-sm" value={data.localisation || ''} onChange={f('localisation')} />
      </div>
      <div>
        <label className="label text-xs">{L('Délai depuis morsure', 'Time since bite')}</label>
        <input className="input text-sm" value={data.delai || ''} onChange={f('delai')} />
      </div>
      <div>
        <label className="label text-xs">{L('Prophylaxie post-exposition (PPE)', 'Post-exposure prophylaxis (PEP)')}</label>
        <select className="input text-sm" value={data.ppe || ''} onChange={f('ppe')}>
          <option value="">{L('Sélectionner...', 'Select...')}</option>
          {O('Lavage plaie eau+savon 15min (TOUJOURS en 1er)', 'Wash wound with soap+water 15min (ALWAYS first)')}
          {O('Vaccin antirabique seul — Cat. II', 'Rabies vaccine alone — Cat. II')}
          {O('Vaccin + Immunoglobulines antirabiques — Cat. III', 'Vaccine + rabies immunoglobulin — Cat. III')}
          {O('PPE en cours (rappel)', 'PEP ongoing (booster)')}
          {O('Refus du patient', 'Patient refusal')}
        </select>
      </div>
      <div>
        <label className="label text-xs">{L('Schéma vaccinal (ESSEN modifié)', 'Vaccination schedule (modified Essen)')}</label>
        <select className="input text-sm" value={data.schema_vaccinal || ''} onChange={f('schema_vaccinal')}>
          <option value="">{L('Sélectionner...', 'Select...')}</option>
          {O('J0, J3, J7, J14, J28 (schéma standard)', 'D0, D3, D7, D14, D28 (standard schedule)')}
          {O('J0 (× 2 sites), J7, J21 (Zagreb — économique)', 'D0 (×2 sites), D7, D21 (Zagreb — dose-sparing)')}
          {O('Déjà vacciné antérieurement (rappel J0 + J3)', 'Previously vaccinated (booster D0 + D3)')}
        </select>
      </div>
      <div>
        <label className="label text-xs">{L('Dose actuelle (J...)', 'Current dose (D...)')}</label>
        <input className="input text-sm" value={data.dose_actuelle || ''} onChange={f('dose_actuelle')} />
      </div>
      <div className="col-span-2">
        <div className="p-3 bg-red-50 border border-red-300 rounded-xl">
          <p className="text-xs font-bold text-red-700 mb-1">🚨 {L('URGENCE MÉDICALE', 'MEDICAL EMERGENCY')}</p>
          <p className="text-xs text-red-600">{L('La rage est mortelle une fois les symptômes apparus. La PPE est 100% efficace si initiée rapidement. Ne jamais différer.', 'Rabies is fatal once symptoms appear. PEP is 100% effective if started promptly. Never delay.')}</p>
        </div>
      </div>
    </div>
  );
};

/* ─── Composant principal ─────────────────────────────────────────────── */

interface Props {
  value: { type: string; data: any } | null;
  onChange: (val: { type: string; data: any } | null) => void;
}

const COULEUR_CLASSES: Record<string, string> = {
  orange: 'bg-orange-50 border-orange-300 text-orange-800',
  red: 'bg-red-50 border-red-300 text-red-800',
  blue: 'bg-blue-50 border-blue-300 text-blue-800',
  purple: 'bg-purple-50 border-purple-300 text-purple-800',
  amber: 'bg-amber-50 border-amber-300 text-amber-800',
  yellow: 'bg-yellow-50 border-yellow-300 text-yellow-800',
  pink: 'bg-pink-50 border-pink-300 text-pink-800',
  slate: 'bg-slate-100 border-slate-300 text-slate-800',
};

export const FormulaireEndemique: React.FC<Props> = ({ value, onChange }) => {
  const { lang } = useT();
  const L = (fr: string, en: string) => (lang === 'en' ? en : fr);
  const [expanded, setExpanded] = useState(true);

  const selectedMaladie = MALADIES_ENDEMIQUES.find(m => m.id === value?.type);
  const maladieLabel = (m: typeof MALADIES_ENDEMIQUES[number]) => (lang === 'en' ? m.en : m.label);

  const handleSelectMaladie = (id: MaladieId | '') => {
    if (!id) { onChange(null); return; }
    onChange({ type: id, data: {} });
    setExpanded(true);
  };

  const handleDataChange = (data: any) => {
    if (!value) return;
    onChange({ ...value, data });
  };

  const renderForm = () => {
    if (!value) return null;
    const props = { data: value.data, onChange: handleDataChange };
    switch (value.type) {
      case 'paludisme': return <FormPaludisme {...props} />;
      case 'tuberculose': return <FormTuberculose {...props} />;
      case 'cholera': return <FormCholera {...props} />;
      case 'vih_sida': return <FormVIH {...props} />;
      case 'fievre_typhoide': return <FormFievreTyphoide {...props} />;
      case 'hepatite_b': return <FormHepatiteB {...props} />;
      case 'rougeole': return <FormRougeole {...props} />;
      case 'rage': return <FormRage {...props} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="label">{L('Maladie endémique associée (si applicable)', 'Associated endemic disease (if applicable)')}</label>
        <select
          className="input"
          value={value?.type || ''}
          onChange={e => handleSelectMaladie(e.target.value as MaladieId | '')}
        >
          <option value="">{L('— Aucune maladie endémique —', '— No endemic disease —')}</option>
          {MALADIES_ENDEMIQUES.map(m => (
            <option key={m.id} value={m.id}>{maladieLabel(m)} ({m.code})</option>
          ))}
        </select>
      </div>

      {value && selectedMaladie && (
        <div className={`border rounded-xl overflow-hidden`}>
          <button
            type="button"
            className={`w-full flex items-center justify-between px-4 py-3 font-semibold text-sm ${COULEUR_CLASSES[selectedMaladie.couleur]}`}
            onClick={() => setExpanded(!expanded)}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} />
              {L('Formulaire clinique', 'Clinical form')} — {maladieLabel(selectedMaladie)}
              <span className="font-mono text-xs opacity-70">({selectedMaladie.code})</span>
            </div>
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          {expanded && (
            <div className="p-4 bg-white">
              {renderForm()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
