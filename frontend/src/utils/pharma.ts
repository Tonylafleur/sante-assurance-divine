/** Abréviation de l'unité contenue dans un conditionnement, selon la forme galénique. */
export function uniteContenu(forme?: string): string {
  switch (forme) {
    case 'Comprimé': return 'cp';
    case 'Gélule': return 'gél';
    case 'Sachet': return 'sachet';
    case 'Suppositoire': return 'supp';
    case 'Injectable':
    case 'Ampoule': return 'amp';
    case 'Sirop':
    case 'Solution':
    case 'Suspension buvable':
    case 'Collyre': return 'mL';
    case 'Pommade':
    case 'Crème': return 'g';
    default: return 'u';
  }
}
