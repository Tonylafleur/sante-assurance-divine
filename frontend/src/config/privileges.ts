/**
 * Matrice de privilèges par rôle — Centre de Santé Assurance Divine
 *
 * Logique métier MINSANTÉ / bonnes pratiques médicales :
 * - Séparation prescription (médecin) / dispensation (pharmacien) / encaissement (caissier)
 * - Le médecin n'accède pas à la comptabilité (conflit d'intérêt)
 * - Le pharmacien ne peut pas créer de prescriptions (sécurité médicamenteuse)
 * - L'accueil enregistre mais ne consulte pas les données cliniques sensibles
 * - Le superadministrateur supervise les comptes et le journal confidentiel
 */

export type Role =
  | 'superadmin'
  | 'admin'
  | 'medecin'
  | 'infirmier'
  | 'sage_femme'
  | 'laborantin'
  | 'pharmacien'
  | 'caissier'
  | 'accueil'
  | 'kinesitherapeute';

export type NavRoute =
  | '/dashboard'
  | '/patients'
  | '/consultations'
  | '/laboratoire'
  | '/pharmacie'
  | '/caisse'
  | '/hospitalisation'
  | '/vaccination'
  | '/cpn'
  | '/teleconsultation'
  | '/assistant'
  | '/comptes'
  | '/journal';

export const ALL_ROUTES: NavRoute[] = [
  '/dashboard', '/patients', '/consultations', '/laboratoire', '/pharmacie',
  '/caisse', '/hospitalisation', '/vaccination', '/cpn', '/teleconsultation', '/assistant',
  '/comptes', '/journal',
];

/**
 * Routes CONFIDENTIELLES : totalement masquées (et non simplement grisées)
 * pour les rôles qui n'y ont pas accès.
 */
export const CONFIDENTIAL_ROUTES = new Set<NavRoute>(['/journal', '/comptes']);

/**
 * Pour chaque rôle, la liste des routes AUTORISÉES.
 * Toute route absente de la liste est refusée (grisée, ou masquée si confidentielle).
 */
const GRANTS: Record<Role, NavRoute[]> = {
  // Accès total
  superadmin: [...ALL_ROUTES],
  admin: [...ALL_ROUTES],

  medecin: ['/dashboard', '/patients', '/consultations', '/laboratoire', '/hospitalisation', '/vaccination', '/cpn', '/teleconsultation', '/assistant'],
  infirmier: ['/dashboard', '/patients', '/consultations', '/laboratoire', '/hospitalisation', '/vaccination', '/cpn', '/teleconsultation'],
  sage_femme: ['/dashboard', '/patients', '/consultations', '/laboratoire', '/hospitalisation', '/vaccination', '/cpn', '/teleconsultation', '/assistant'],
  laborantin: ['/dashboard', '/laboratoire'],
  pharmacien: ['/dashboard', '/pharmacie'],
  caissier: ['/dashboard', '/caisse'],
  accueil: ['/dashboard', '/patients', '/teleconsultation'],
  kinesitherapeute: ['/dashboard', '/patients', '/consultations', '/hospitalisation', '/teleconsultation', '/assistant'],
};

function buildPrivileges(): Record<Role, Record<NavRoute, boolean>> {
  const result = {} as Record<Role, Record<NavRoute, boolean>>;
  (Object.keys(GRANTS) as Role[]).forEach((role) => {
    const granted = new Set(GRANTS[role]);
    const map = {} as Record<NavRoute, boolean>;
    ALL_ROUTES.forEach((route) => { map[route] = granted.has(route); });
    result[role] = map;
  });
  return result;
}

const PRIVILEGES = buildPrivileges();

export function canAccess(role: string | undefined, route: NavRoute): boolean {
  if (!role) return false;
  const rolePrivileges = PRIVILEGES[role as Role];
  if (!rolePrivileges) return false;
  return rolePrivileges[route] ?? false;
}

export function getPrivileges(role: string | undefined): Record<NavRoute, boolean> {
  if (!role) return {} as Record<NavRoute, boolean>;
  return PRIVILEGES[role as Role] ?? ({} as Record<NavRoute, boolean>);
}

/** true si la route doit être masquée (et non grisée) pour ce rôle. */
export function isHidden(role: string | undefined, route: NavRoute): boolean {
  return CONFIDENTIAL_ROUTES.has(route) && !canAccess(role, route);
}

/** Libellé du rôle en français */
export const ROLE_LABELS: Record<Role, string> = {
  superadmin: 'Superadministrateur',
  admin: 'Administrateur',
  medecin: 'Médecin',
  infirmier: 'Infirmier(e)',
  sage_femme: 'Sage-femme',
  laborantin: 'Laborantin(e)',
  pharmacien: 'Pharmacien(ne)',
  caissier: 'Caissier(e)',
  accueil: 'Accueil',
  kinesitherapeute: 'Kinésithérapeute',
};

/** Rôles qu'un utilisateur peut choisir lui-même à l'inscription */
export const ROLES_INSCRIPTION: Role[] = [
  'medecin', 'infirmier', 'sage_femme', 'laborantin',
  'pharmacien', 'caissier', 'accueil', 'kinesitherapeute', 'admin',
];

/** Raison du refus d'accès (pour le tooltip) */
export const ACCESS_DENIED_REASON: Partial<Record<Role, Partial<Record<NavRoute, string>>>> = {
  medecin: {
    '/pharmacie': 'Réservé au pharmacien — gestion du stock médicamenteux',
    '/caisse': 'Réservé au caissier — séparation prescription/facturation',
  },
  pharmacien: {
    '/consultations': 'Réservé au personnel médical',
    '/patients': 'Accès aux dossiers réservé au personnel médical',
    '/caisse': 'Séparation dispensation / encaissement',
    '/laboratoire': 'Réservé au laborantin',
    '/hospitalisation': 'Réservé au personnel médical',
    '/vaccination': 'Réservé au personnel médical',
    '/cpn': 'Réservé au personnel médical',
  },
  caissier: {
    '/patients': 'Accès aux dossiers réservé au personnel médical',
    '/consultations': 'Réservé au personnel médical',
    '/pharmacie': 'Séparation dispensation / encaissement',
    '/laboratoire': 'Réservé au laborantin',
    '/hospitalisation': 'Réservé au personnel médical',
    '/vaccination': 'Réservé au personnel médical',
    '/cpn': 'Réservé au personnel médical',
  },
  laborantin: {
    '/patients': 'Accès via les demandes d\'examens uniquement',
    '/consultations': 'Réservé au personnel médical',
    '/pharmacie': 'Réservé au pharmacien',
    '/caisse': 'Réservé au caissier',
    '/hospitalisation': 'Réservé au personnel médical',
    '/vaccination': 'Réservé au personnel médical',
    '/cpn': 'Réservé au personnel médical',
  },
  accueil: {
    '/consultations': 'Création par le médecin uniquement',
    '/laboratoire': 'Réservé au laborantin',
    '/pharmacie': 'Réservé au pharmacien',
    '/caisse': 'Réservé au caissier',
    '/hospitalisation': 'Réservé au personnel médical',
    '/vaccination': 'Réservé au personnel médical',
    '/cpn': 'Réservé au personnel médical',
  },
};
