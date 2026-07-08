import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Stethoscope, Search, Clock, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { consultationsApi, patientsApi } from '../services/api';
import { Modal } from '../components/ui/Modal';
import { BadgeUrgence, BadgeStatut } from '../components/ui/Badge';
import { useNavigate } from 'react-router-dom';
import { useT } from '../i18n';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const SERVICES = [
  'Consultation Générale', 'Consultation Spécialisée', 'Gynécologie',
  'Kinésithérapie', 'Petite Chirurgie', 'Éducation Sanitaire', 'Urgence',
];
const URGENCES = [
  { v: 'vert', l: '🟢 Non urgent' },
  { v: 'jaune', l: '🟡 Semi-urgent' },
  { v: 'orange', l: '🟠 Urgent' },
  { v: 'rouge', l: '🔴 Très urgent' },
];

export const Consultations: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useT();
  const [consultations, setConsultations] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    service: 'Consultation Générale',
    niveau_urgence: 'vert',
    motif: '',
    symptomes: '',
    tension_arterielle: '',
    temperature: '',
    poids: '',
    frequence_cardiaque: '',
    saturation_o2: '',
  });

  const load = useCallback(async () => {
    try {
      const res = await consultationsApi.list({ per_page: 50 });
      setConsultations(res.data.consultations);
      setTotal(res.data.total);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const searchPatients = async (q: string) => {
    if (q.length < 2) { setPatientResults([]); return; }
    try {
      const res = await patientsApi.list({ search: q, per_page: 5 });
      setPatientResults(res.data.patients);
    } catch {}
  };

  useEffect(() => { const t = setTimeout(() => searchPatients(patientSearch), 300); return () => clearTimeout(t); }, [patientSearch]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) { toast.error(t('ts.select_patient')); return; }
    if (!form.motif) { toast.error(t('ts.motif_req')); return; }
    setSaving(true);
    try {
      await consultationsApi.create({
        patient_id: selectedPatient.id,
        ...form,
        temperature: form.temperature ? parseFloat(form.temperature) : null,
        poids: form.poids ? parseFloat(form.poids) : null,
        frequence_cardiaque: form.frequence_cardiaque ? parseInt(form.frequence_cardiaque) : null,
        saturation_o2: form.saturation_o2 ? parseFloat(form.saturation_o2) : null,
      });
      toast.success(t('ts.cons_created'));
      setShowModal(false);
      setSelectedPatient(null);
      setPatientSearch('');
      setForm({ service: 'Consultation Générale', niveau_urgence: 'vert', motif: '', symptomes: '', tension_arterielle: '', temperature: '', poids: '', frequence_cardiaque: '', saturation_o2: '' });
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('ts.error'));
    }
    setSaving(false);
  };

  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  const displayed = search
    ? consultations.filter(c => c.patient_nom?.toLowerCase().includes(search.toLowerCase()) || c.numero?.includes(search))
    : consultations;

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('cons.title')}</h1>
          <p className="text-slate-500 text-sm">{total} {t('cons.total')}</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowModal(true)}>
          <Plus size={16} /> {t('cons.new')}
        </button>
      </div>

      <div className="card !p-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder={t('cons.search_ph')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        {displayed.length === 0 ? (
          <div className="card py-12 text-center">
            <Stethoscope size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-400 text-sm">{t('cons.none')}</p>
          </div>
        ) : displayed.map((c) => (
          <div
            key={c.id}
            className={`card hover:shadow-md cursor-pointer transition-all flex items-center gap-4 ${c.niveau_urgence === 'rouge' ? 'urgence-rouge border-l-4 border-red-400' : ''}`}
            onClick={() => navigate(`/consultations/${c.id}`)}
          >
            <div className={`w-2 h-12 rounded-full flex-shrink-0 ${
              c.niveau_urgence === 'rouge' ? 'bg-red-500' :
              c.niveau_urgence === 'orange' ? 'bg-orange-500' :
              c.niveau_urgence === 'jaune' ? 'bg-yellow-500' : 'bg-green-500'
            }`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-primary-600 bg-primary-50 px-2 py-0.5 rounded">{c.numero}</span>
                <span className="font-semibold text-slate-800">{c.patient_nom}</span>
              </div>
              <p className="text-sm text-slate-500 truncate mt-0.5">{c.service} — {c.motif}</p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <BadgeUrgence urgence={c.niveau_urgence} />
              <BadgeStatut statut={c.statut} />
              <span className="text-xs text-slate-400 hidden sm:block">
                {format(new Date(c.created_at), 'HH:mm', { locale: fr })}
              </span>
              <ChevronRight size={16} className="text-slate-400" />
            </div>
          </div>
        ))}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={t('cons.new')} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          {/* Recherche patient */}
          <div>
            <label className="label">Patient *</label>
            {selectedPatient ? (
              <div className="flex items-center justify-between p-3 bg-primary-50 rounded-lg border border-primary-200">
                <div>
                  <p className="font-semibold text-primary-800">{selectedPatient.nom_complet}</p>
                  <p className="text-xs text-primary-600">{selectedPatient.numero_dossier} — {selectedPatient.age} ans</p>
                </div>
                <button type="button" onClick={() => setSelectedPatient(null)} className="text-xs text-red-500 hover:underline">{t('c.change')}</button>
              </div>
            ) : (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="input pl-8"
                  placeholder={t('c.search_patient')}
                  value={patientSearch}
                  onChange={e => setPatientSearch(e.target.value)}
                  autoComplete="off"
                />
                {patientResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-[200] overflow-hidden">
                    {patientResults.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full text-left px-4 py-3 hover:bg-primary-50 transition-colors border-b border-slate-50 last:border-0"
                        onMouseDown={e => { e.preventDefault(); setSelectedPatient(p); setPatientSearch(''); setPatientResults([]); }}
                      >
                        <p className="font-medium text-slate-800 text-sm">{p.nom_complet}</p>
                        <p className="text-xs text-slate-500">{p.numero_dossier} — {p.sexe === 'M' ? 'Homme' : 'Femme'}, {p.age ?? '?'} ans</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t('cpt.service')}</label>
              <select className="input" value={form.service} onChange={f('service')}>
                {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t('cons.urgency')}</label>
              <select className="input" value={form.niveau_urgence} onChange={f('niveau_urgence')}>
                {URGENCES.map(u => <option key={u.v} value={u.v}>{u.l}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">{t('cons.motif')} *</label>
            <input className="input" value={form.motif} onChange={f('motif')} required />
          </div>
          <div>
            <label className="label">{t('cons.symptoms')}</label>
            <textarea className="input h-16 resize-none" value={form.symptomes} onChange={f('symptomes')} />
          </div>

          {/* Signes vitaux */}
          <div className="border-t pt-4">
            <p className="text-sm font-semibold text-slate-600 mb-3">{t('cd.vitals')} ({t('cons.optional')})</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { k: 'tension_arterielle', l: 'TA (mmHg)', p: '120/80' },
                { k: 'temperature', l: 'Température (°C)', p: '37.0' },
                { k: 'poids', l: 'Poids (kg)', p: '70' },
                { k: 'frequence_cardiaque', l: 'FC (bpm)', p: '80' },
                { k: 'saturation_o2', l: 'SpO2 (%)', p: '98' },
              ].map(({ k, l, p }) => (
                <div key={k}>
                  <label className="label text-xs">{l}</label>
                  <input className="input text-sm" value={(form as any)[k]} onChange={f(k)} placeholder={p} />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" className="btn-outline" onClick={() => setShowModal(false)}>{t('c.cancel')}</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? t('c.saving') : t('cons.create')}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
