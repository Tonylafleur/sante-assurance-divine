import React from 'react';
import { Construction } from 'lucide-react';

interface Props {
  title: string;
  icon: React.ReactNode;
  description?: string;
}

export const PlaceholderPage: React.FC<Props> = ({ title, icon, description }) => (
  <div className="space-y-5 fade-in">
    <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
    <div className="card py-20 text-center">
      <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
        {icon}
      </div>
      <h2 className="text-lg font-semibold text-slate-700 mb-2">{title}</h2>
      <p className="text-slate-400 text-sm max-w-xs mx-auto">
        {description || 'Ce module est en cours de développement pour la phase 2.'}
      </p>
      <div className="mt-4 flex items-center justify-center gap-2 text-accent-600 text-sm">
        <Construction size={16} />
        <span>Phase 2 — Disponible prochainement</span>
      </div>
    </div>
  </div>
);
