export interface ParamResultat {
  nom: string;
  valeur: string;
  unite?: string;
  valeur_normale?: string;
}

/** Renvoie les paramètres d'un panel si le résultat est structuré (JSON), sinon null. */
export function parseResultat(resultat?: string | null): ParamResultat[] | null {
  if (!resultat) return null;
  const s = resultat.trim();
  if (!s.startsWith('[')) return null;
  try {
    const arr = JSON.parse(s);
    if (Array.isArray(arr) && arr.length && typeof arr[0] === 'object' && 'nom' in arr[0]) {
      return arr as ParamResultat[];
    }
  } catch { /* texte simple */ }
  return null;
}

/** Résumé lisible court d'un résultat (texte simple ou panel). */
export function resumeResultat(resultat?: string | null, unite?: string): string {
  const params = parseResultat(resultat);
  if (params) {
    const remplis = params.filter(p => p.valeur && p.valeur.trim());
    if (remplis.length === 0) return 'Panel — en attente';
    const apercu = remplis.slice(0, 2).map(p => `${p.nom}: ${p.valeur}${p.unite ? ' ' + p.unite : ''}`).join(' · ');
    return remplis.length > 2 ? `${apercu} · +${remplis.length - 2}` : apercu;
  }
  if (!resultat) return '';
  return `${resultat}${unite ? ' ' + unite : ''}`;
}
