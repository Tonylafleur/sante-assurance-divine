import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  login: (matricule: string, password: string) => {
    const form = new FormData();
    form.append('username', matricule);
    form.append('password', password);
    return api.post('/auth/login', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  me: () => api.get('/auth/me'),
  createUser: (data: any) => api.post('/auth/users', data),
  listPersonnel: (role?: string) => api.get('/auth/personnel', { params: role ? { role } : {} }),
  register: (data: any) => api.post('/auth/register', data),
  listComptes: (params?: any) => api.get('/auth/comptes', { params }),
  validerCompte: (id: number) => api.post(`/auth/comptes/${id}/valider`),
  revoquerCompte: (id: number) => api.post(`/auth/comptes/${id}/revoquer`),
};

// Journal d'activité confidentiel (superadmin)
export const journalApi = {
  list: (params?: any) => api.get('/journal', { params }),
  stats: () => api.get('/journal/stats'),
};

// Patients
export const patientsApi = {
  list: (params?: any) => api.get('/patients', { params }),
  get: (id: number) => api.get(`/patients/${id}`),
  create: (data: any) => api.post('/patients', data),
  update: (id: number, data: any) => api.put(`/patients/${id}`, data),
  calculerIMC: (data: { poids_kg: number; taille_cm: number; date_naissance: string; sexe: string }) =>
    api.post('/patients/imc/calculer', data),
  getConsultations: (id: number, params?: any) => api.get(`/patients/${id}/consultations`, { params }),
};

// CIM-10
export const cim10Api = {
  search: (q: string, limit = 20) => api.get('/cim10/search', { params: { q, limit } }),
  getByCode: (code: string) => api.get(`/cim10/code/${code}`),
};

// Consultations
export const consultationsApi = {
  list: (params?: any) => api.get('/consultations', { params }),
  get: (id: number) => api.get(`/consultations/${id}`),
  create: (data: any) => api.post('/consultations', data),
  update: (id: number, data: any) => api.put(`/consultations/${id}`, data),
  addPrescriptions: (id: number, items: any[]) => api.post(`/consultations/${id}/prescriptions`, items),
  addExamens: (id: number, items: any[]) => api.post(`/consultations/${id}/examens`, items),
  getHistorique: (id: number) => api.get(`/consultations/${id}/historique`),
};

// Pharmacie
export const pharmacieApi = {
  listMedicaments: (params?: any) => api.get('/pharmacie/medicaments', { params }),
  getMedicament: (id: number) => api.get(`/pharmacie/medicaments/${id}`),
  createMedicament: (data: any) => api.post('/pharmacie/medicaments', data),
  updateMedicament: (id: number, data: any) => api.put(`/pharmacie/medicaments/${id}`, data),
  deleteMedicament: (id: number) => api.delete(`/pharmacie/medicaments/${id}`),
  setDisponibilite: (id: number, est_disponible: boolean, motif?: string) =>
    api.post(`/pharmacie/medicaments/${id}/disponibilite`, { est_disponible, motif }),
  entreeStock: (data: any) => api.post('/pharmacie/stock/entree', data),
  listMouvements: (params?: any) => api.get('/pharmacie/stock/mouvements', { params }),
  listPrescriptions: (params?: any) => api.get('/pharmacie/prescriptions', { params }),
  dispenser: (id: number, data?: { quantite?: number }) => api.post(`/pharmacie/prescriptions/${id}/dispenser`, data || {}),
  annulerPrescription: (id: number) => api.post(`/pharmacie/prescriptions/${id}/annuler`),
};

// Caisse
export const caisseApi = {
  createFacture: (data: any) => api.post('/caisse/factures', data),
  updateFacture: (id: number, data: any) => api.put(`/caisse/factures/${id}`, data),
  annulerFacture: (id: number, motif: string) => api.post(`/caisse/factures/${id}/annuler`, { motif }),
  deleteFacture: (id: number) => api.delete(`/caisse/factures/${id}`),
  listFactures: (params?: any) => api.get('/caisse/factures', { params }),
  paiement: (data: any) => api.post('/caisse/paiements', data),
  statJournalier: () => api.get('/caisse/stats/journalier'),
  statParService: (jour = false) => api.get('/caisse/stats/par-service', { params: { jour } }),
  tarifs: () => api.get('/caisse/tarifs'),
  getTicket: (factureId: number) => api.get(`/caisse/factures/${factureId}/ticket`),
};

// Laboratoire
export const laboratoireApi = {
  catalogue: () => api.get('/laboratoire/catalogue'),
  listExamens: (params?: any) => api.get('/laboratoire/examens', { params }),
  createExamen: (data: any) => api.post('/laboratoire/examens', data),
  prelevement: (id: number) => api.post(`/laboratoire/examens/${id}/prelevement`),
  saisirResultat: (id: number, data: any) => api.put(`/laboratoire/examens/${id}/resultat`, data),
  valider: (id: number) => api.post(`/laboratoire/examens/${id}/valider`),
};

// Hospitalisation
export const hospitalisationApi = {
  listLits: () => api.get('/hospitalisation/lits'),
  createLit: (data: any) => api.post('/hospitalisation/lits', data),
  listAdmissions: (params?: any) => api.get('/hospitalisation/admissions', { params }),
  admettre: (data: any) => api.post('/hospitalisation/admissions', data),
  evolution: (id: number, data: any) => api.put(`/hospitalisation/admissions/${id}/evolution`, data),
  sortie: (id: number, data: any) => api.post(`/hospitalisation/admissions/${id}/sortie`, data),
};

// Vaccination
export const vaccinationApi = {
  listVaccins: () => api.get('/vaccination/vaccins'),
  createVaccin: (data: any) => api.post('/vaccination/vaccins', data),
  updateVaccin: (id: number, data: any) => api.put(`/vaccination/vaccins/${id}`, data),
  deleteVaccin: (id: number) => api.delete(`/vaccination/vaccins/${id}`),
  entreeStock: (id: number, quantite: number) => api.post(`/vaccination/vaccins/${id}/stock?quantite=${quantite}`),
  listVaccinations: (params?: any) => api.get('/vaccination/vaccinations', { params }),
  administrer: (data: any) => api.post('/vaccination/vaccinations', data),
};

// CPN & Maternité
export const cpnApi = {
  listSuivis: (params?: any) => api.get('/cpn/suivis', { params }),
  createSuivi: (data: any) => api.post('/cpn/suivis', data),
  listAccouchements: (params?: any) => api.get('/cpn/accouchements', { params }),
  createAccouchement: (data: any) => api.post('/cpn/accouchements', data),
};

// Téléconsultation / Rendez-vous
export const teleconsultationApi = {
  list: (params?: any) => api.get('/teleconsultations', { params }),
  get: (id: number) => api.get(`/teleconsultations/${id}`),
  create: (data: any) => api.post('/teleconsultations', data),
  update: (id: number, data: any) => api.put(`/teleconsultations/${id}`, data),
  annuler: (id: number) => api.post(`/teleconsultations/${id}/annuler`),
  demarrer: (id: number) => api.post(`/teleconsultations/${id}/demarrer`),
  terminer: (id: number) => api.post(`/teleconsultations/${id}/terminer`),
  salle: (token: string) => api.get(`/teleconsultations/salle/${token}`),
  // Documents — côté personnel
  listDocuments: (id: number) => api.get(`/teleconsultations/${id}/documents`),
  uploadDocument: (id: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/teleconsultations/${id}/documents`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  downloadDocument: (id: number, docId: number) => api.get(`/teleconsultations/${id}/documents/${docId}`, { responseType: 'blob' }),
  // Documents — côté patient (jeton public)
  listDocumentsPatient: (token: string) => api.get(`/teleconsultations/salle/${token}/documents`),
  uploadDocumentPatient: (token: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/teleconsultations/salle/${token}/documents`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  downloadDocumentPatient: (token: string, docId: number) => api.get(`/teleconsultations/salle/${token}/documents/${docId}`, { responseType: 'blob' }),
};

// Dashboard
export const dashboardApi = {
  stats: () => api.get('/dashboard/stats'),
  parService: () => api.get('/dashboard/consultations/par-service'),
};

// IA
export const aiApi = {
  status: () => api.get('/ai/status'),
  chat: (messages: any[], context?: any) => api.post('/ai/chat', { messages, context }),
  triage: (symptomes: string, signes_vitaux?: any) => api.post('/ai/triage', { symptomes, signes_vitaux }),
  suggererPrescription: (data: any) => api.post('/ai/prescription/suggerer', data),
};

// WebSocket
export const createWebSocket = (channel: string): WebSocket => {
  const wsUrl = (API_URL || 'http://localhost:8000').replace('http', 'ws');
  const ws = new WebSocket(`${wsUrl}/ws/${channel}`);
  const ping = setInterval(() => { if (ws.readyState === 1) ws.send('ping'); }, 25000);
  ws.addEventListener('close', () => clearInterval(ping));
  return ws;
};
