import React from 'react';
import { useT } from '../../i18n';

interface Props {
  urgence: 'vert' | 'jaune' | 'orange' | 'rouge';
  label?: string;
}

const URGENCE_CLS: Record<string, string> = {
  vert: 'badge-vert', jaune: 'badge-jaune', orange: 'badge-orange', rouge: 'badge-rouge',
};

export const BadgeUrgence: React.FC<Props> = ({ urgence, label }) => {
  const { t } = useT();
  const cls = URGENCE_CLS[urgence] || 'badge-vert';
  return <span className={cls}>{label || t(`badge.${urgence}`)}</span>;
};

interface StatutProps {
  statut: string;
}

const STATUT_CLS: Record<string, string> = {
  en_attente: 'badge-jaune', en_cours: 'badge-orange', terminee: 'badge-vert',
  annulee: 'badge-rouge', dispensee: 'badge-vert', partiellement_dispensee: 'badge-orange',
  validee: 'badge-vert', valide: 'badge-vert', prescrit: 'badge-jaune',
  resultat_disponible: 'badge-orange', payee: 'badge-vert', partiellement_payee: 'badge-orange',
};

export const BadgeStatut: React.FC<StatutProps> = ({ statut }) => {
  const { t } = useT();
  const cls = STATUT_CLS[statut] || 'badge-jaune';
  return <span className={cls}>{t(`st.${statut}`, statut)}</span>;
};
