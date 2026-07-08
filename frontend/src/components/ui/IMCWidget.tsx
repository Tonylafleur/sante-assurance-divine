import React from 'react';
import { Scale } from 'lucide-react';

interface IMCResult {
  imc: number;
  statut_imc: string;
  categorie: string;
  couleur?: string;
  age_ans?: number;
}

interface Props {
  poids?: number | null;
  taille?: number | null;
  dateNaissance?: string | null;
  sexe?: string;
  result?: IMCResult | null;
  compact?: boolean;
}

const COLOR_MAP: Record<string, { bg: string; text: string; bar: string }> = {
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-700',   bar: 'bg-blue-400' },
  green:  { bg: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-500' },
  yellow: { bg: 'bg-yellow-50', text: 'text-yellow-700', bar: 'bg-yellow-400' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-700', bar: 'bg-orange-500' },
  red:    { bg: 'bg-red-50',    text: 'text-red-700',    bar: 'bg-red-500' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', bar: 'bg-purple-400' },
};

// Calcul local rapide pour affichage immédiat (adulte seulement)
function computeIMCLocal(poids: number, taille: number): { imc: number; statut: string; couleur: string } {
  const imc = poids / ((taille / 100) ** 2);
  let statut = '', couleur = '';
  if (imc < 16.0)      { statut = 'Maigreur sévère';    couleur = 'blue'; }
  else if (imc < 17.0) { statut = 'Maigreur modérée';   couleur = 'blue'; }
  else if (imc < 18.5) { statut = 'Maigreur légère';    couleur = 'blue'; }
  else if (imc < 25.0) { statut = 'Poids normal';       couleur = 'green'; }
  else if (imc < 30.0) { statut = 'Surpoids';           couleur = 'yellow'; }
  else if (imc < 35.0) { statut = 'Obésité modérée';    couleur = 'orange'; }
  else if (imc < 40.0) { statut = 'Obésité sévère';     couleur = 'red'; }
  else                  { statut = 'Obésité morbide';    couleur = 'red'; }
  return { imc: Math.round(imc * 100) / 100, statut, couleur };
}

// Pourcentage de la barre de progression (0-100)
function imcToPercent(imc: number): number {
  // Plage affichée : 10 - 45 kg/m²
  return Math.min(100, Math.max(0, ((imc - 10) / 35) * 100));
}

export const IMCWidget: React.FC<Props> = ({ poids, taille, result, compact = false }) => {
  let imc: number | null = null;
  let statut = '';
  let couleur = 'green';

  if (result?.imc) {
    imc = result.imc;
    statut = result.statut_imc || '';
    couleur = result.couleur || 'green';
  } else if (poids && taille && poids > 0 && taille > 0) {
    const local = computeIMCLocal(poids, taille);
    imc = local.imc;
    statut = local.statut;
    couleur = local.couleur;
  }

  if (!imc) {
    return compact ? null : (
      <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
        <Scale size={14} />
        <span>Renseigner poids et taille pour calculer l'IMC</span>
      </div>
    );
  }

  const colors = COLOR_MAP[couleur] || COLOR_MAP.green;
  const pct = imcToPercent(imc);

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg ${colors.bg}`}>
        <Scale size={12} className={colors.text} />
        <span className={`font-bold text-sm ${colors.text}`}>{imc}</span>
        <span className={`text-xs ${colors.text} opacity-80`}>{statut}</span>
      </div>
    );
  }

  return (
    <div className={`rounded-xl p-3 ${colors.bg}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Scale size={15} className={colors.text} />
          <span className={`text-xs font-semibold uppercase tracking-wide ${colors.text}`}>IMC</span>
        </div>
        <span className={`text-xl font-bold ${colors.text}`}>{imc} <span className="text-xs font-normal">kg/m²</span></span>
      </div>
      {/* Barre colorée */}
      <div className="relative h-2 bg-white bg-opacity-60 rounded-full overflow-hidden mb-2">
        {/* Zones colorées */}
        <div className="absolute inset-0 flex">
          <div className="bg-blue-300 opacity-60" style={{ width: '24%' }} />
          <div className="bg-emerald-400 opacity-60" style={{ width: '22%' }} />
          <div className="bg-yellow-400 opacity-60" style={{ width: '18%' }} />
          <div className="bg-orange-400 opacity-60" style={{ width: '16%' }} />
          <div className="bg-red-500 opacity-60" style={{ width: '20%' }} />
        </div>
        {/* Curseur */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-white rounded-full shadow-md transition-all duration-500"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>10</span><span>18.5</span><span>25</span><span>30</span><span>40+</span>
      </div>
      <p className={`text-sm font-semibold ${colors.text} text-center`}>{statut}</p>
    </div>
  );
};
