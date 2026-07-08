import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Stethoscope, Calendar, AlertTriangle,
  ChevronRight, Heart, Thermometer, Activity, Clock, FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { patientsApi, caisseApi } from '../services/api';
import { BadgeUrgence, BadgeStatut } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { TicketCaisse } from '../components/ui/TicketCaisse';
import { Printer, Receipt } from 'lucide-react';
import { useT } from '../i18n';

const URGENCE_COLOR: Record<string, string> = {
  rouge: 'bg-red-500',
  orange: 'bg-orange-400',
  jaune: 'bg-yellow-400',
  vert: 'bg-green-500',
};

const IMC_COLOR = (statut: string) => {
  if (!statut) return 'text-slate-500';
  if (statut.includes('Obésité')) return 'text-red-600';
  if (statut.includes('Surpoids')) return 'text-orange-500';
  if (statut.includes('Normal') || statut.includes('Normale')) return 'text-green-600';
  return 'text-yellow-600';
};

export const PatientDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useT();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dossier' | 'consultations' | 'factures'>('dossier');
  const [factures, setFactures] = useState<any[]>([]);
  const [showTicket, setShowTicket] = useState(false);
  const [ticketData, setTicketData] = useState<any>(null);

  const load = useCallback(async () => {
    const pid = id ? parseInt(id, 10) : NaN;
    // Réinitialisation immédiate : ne jamais conserver le dossier du patient précédent
    setData(null);
    setFactures([]);
    setActiveTab('dossier');
    if (!pid || Number.isNaN(pid)) { setLoading(false); return; }
    try {
      setLoading(true);
      const [res, fRes] = await Promise.all([
        patientsApi.getConsultations(pid),
        caisseApi.listFactures({ patient_id: pid }),
      ]);
      // Sécurité : vérifier que la réponse concerne bien le patient demandé
      if (res.data?.patient?.id && res.data.patient.id !== pid) {
        setData(null);
      } else {
        setData(res.data);
        setFactures(fRes.data || []);
      }
    } catch {
      setData(null);
      toast.error(t('ts.record_error'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  const openTicket = async (factureId: number) => {
    try {
      const res = await caisseApi.getTicket(factureId);
      setTicketData(res.data);
      setShowTicket(true);
    } catch {
      toast.error(t('ts.ticket_error'));
    }
  };

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!data) return (
    <div className="text-center py-16 text-slate-400">{t('pat.none')}</div>
  );

  const { patient, consultations, total } = data;
  const derniere = consultations?.[0];

  const SECTIONS = [
    { label: t('pd.tab_record'), key: 'dossier' },
    { label: `${t('cons.title')} (${total})`, key: 'consultations' },
    { label: `${t('cai.invoice')}s (${factures.length})`, key: 'factures' },
  ] as const;
  type TabKey = typeof SECTIONS[number]['key'];

  return (
    <div className="space-y-5 fade-in max-w-5xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/patients')}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800">{patient.nom_complet}</h1>
          <p className="text-slate-500 text-sm">{t('pd.file_no')} {patient.numero_dossier}</p>
        </div>
        <button
          className="btn-primary flex items-center gap-2"
          onClick={() => navigate('/consultations')}
        >
          <Stethoscope size={16} /> {t('cons.new')}
        </button>
      </div>

      {/* Carte identité */}
      <div className="card">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center flex-shrink-0">
            <User size={28} className="text-white" />
          </div>
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">{t('pf.sexe')}</p>
              <p className="font-medium text-slate-700">{patient.sexe === 'M' ? t('pf.sexe_m') : patient.sexe === 'F' ? t('pf.sexe_f') : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">{t('pf.dob')}</p>
              <p className="font-medium text-slate-700">
                {patient.date_naissance ? format(new Date(patient.date_naissance), 'dd/MM/yyyy', { locale: fr }) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">{t('pf.blood')}</p>
              <p className="font-medium text-slate-700">{patient.groupe_sanguin || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">{t('pd.last_cons')}</p>
              <p className="font-medium text-slate-700">
                {derniere ? format(new Date(derniere.date), 'dd/MM/yyyy', { locale: fr }) : t('c.none')}
              </p>
            </div>
          </div>
        </div>

        {/* Allergies */}
        {patient.allergies && (
          <div className="mt-4 flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
            <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-red-700 mb-0.5">{t('pf.allergies').toUpperCase()}</p>
              <p className="text-sm text-red-700">{patient.allergies}</p>
            </div>
          </div>
        )}
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {SECTIONS.map(s => (
          <button
            key={s.key}
            onClick={() => setActiveTab(s.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === s.key
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Dossier médical */}
      {activeTab === 'dossier' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: t('pf.hist_med'), value: patient.antecedents_medicaux, icon: Heart },
            { label: t('pf.hist_surg'), value: patient.antecedents_chirurgicaux, icon: Activity },
            { label: t('pf.hist_fam'), value: patient.antecedents_familiaux, icon: User },
            { label: t('pf.hist_obst'), value: patient.antecedents_obstetricaux, icon: FileText },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="card">
              <div className="flex items-center gap-2 mb-3">
                <Icon size={16} className="text-primary-500" />
                <h3 className="text-sm font-semibold text-slate-600">{label}</h3>
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                {value || <span className="text-slate-400 italic">{t('pd.not_filled')}</span>}
              </p>
            </div>
          ))}

          {/* Résumé dernière consultation */}
          {derniere && (
            <div className="card sm:col-span-2 bg-gradient-to-r from-primary-50 to-secondary-50 border border-primary-100">
              <div className="flex items-center gap-2 mb-3">
                <Stethoscope size={16} className="text-primary-600" />
                <h3 className="text-sm font-semibold text-primary-700">{t('pd.last_cons')}</h3>
                <span className="ml-auto text-xs text-primary-500">
                  {format(new Date(derniere.date), 'dd MMMM yyyy', { locale: fr })}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div><span className="text-slate-400 text-xs">{t('pd.motif')}</span><p className="text-slate-700 font-medium">{derniere.motif || '—'}</p></div>
                <div><span className="text-slate-400 text-xs">{t('pd.service')}</span><p className="text-slate-700 font-medium">{derniere.service || '—'}</p></div>
                <div><span className="text-slate-400 text-xs">{t('pd.diagnosis')}</span><p className="text-slate-700 font-medium truncate">{derniere.diagnostic_principal || '—'}</p></div>
                <div>
                  <span className="text-slate-400 text-xs">IMC</span>
                  <p className={`font-semibold ${IMC_COLOR(derniere.statut_imc)}`}>
                    {derniere.imc ? `${derniere.imc.toFixed(1)} — ${derniere.statut_imc}` : '—'}
                  </p>
                </div>
              </div>
              {derniere.code_cim10_principal && (
                <div className="mt-2 text-xs">
                  <span className="font-mono bg-primary-100 text-primary-700 px-2 py-0.5 rounded mr-2">{derniere.code_cim10_principal}</span>
                  <span className="text-slate-600">{derniere.libelle_cim10_principal}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Historique consultations */}
      {activeTab === 'consultations' && (
        <div className="space-y-2">
          {consultations.length === 0 ? (
            <div className="card py-12 text-center">
              <Stethoscope size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-400 text-sm">{t('pd.none_cons')}</p>
            </div>
          ) : consultations.map((c: any) => (
            <div
              key={c.id}
              className="card hover:shadow-md cursor-pointer transition-all flex items-center gap-4"
              onClick={() => navigate(`/consultations/${c.id}`)}
            >
              <div className={`w-2 h-14 rounded-full flex-shrink-0 ${URGENCE_COLOR[c.niveau_urgence] || 'bg-green-400'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-primary-600 bg-primary-50 px-2 py-0.5 rounded">{c.numero}</span>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Calendar size={12} />
                    {format(new Date(c.date), 'dd MMM yyyy — HH:mm', { locale: fr })}
                  </span>
                </div>
                <p className="font-medium text-slate-700 mt-0.5">{c.motif}</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  <span className="text-xs text-slate-500">{c.service}</span>
                  {c.diagnostic_principal && (
                    <span className="text-xs text-slate-600 truncate max-w-xs">→ {c.diagnostic_principal}</span>
                  )}
                  {c.code_cim10_principal && (
                    <span className="text-xs font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{c.code_cim10_principal}</span>
                  )}
                  {c.maladie_endemique_type && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">{c.maladie_endemique_type}</span>
                  )}
                </div>
                {/* Signes vitaux résumés */}
                <div className="flex gap-3 mt-1 text-xs text-slate-400">
                  {c.tension_arterielle && <span className="flex items-center gap-1"><Activity size={10} />{c.tension_arterielle}</span>}
                  {c.temperature && <span className="flex items-center gap-1"><Thermometer size={10} />{c.temperature}°C</span>}
                  {c.imc && <span className={IMC_COLOR(c.statut_imc)}>IMC {c.imc.toFixed(1)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <BadgeStatut statut={c.statut} />
                <ChevronRight size={16} className="text-slate-300" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Onglet Factures */}
      {activeTab === 'factures' && (
        <div className="space-y-3">
          {factures.length === 0 ? (
            <div className="card py-12 text-center">
              <Receipt size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-400 text-sm">{t('pd.none_invoice')}</p>
            </div>
          ) : factures.map((f: any) => (
            <div key={f.id} className="card flex items-center gap-4">
              <div className={`w-2 h-12 rounded-full flex-shrink-0 ${
                f.statut === 'payee' ? 'bg-green-500' :
                f.statut === 'partiellement_payee' ? 'bg-blue-400' :
                f.statut === 'annulee' ? 'bg-slate-300' : 'bg-yellow-400'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{f.numero}</span>
                  <span className="text-xs text-slate-400">
                    {f.created_at ? format(new Date(f.created_at), 'dd MMM yyyy — HH:mm', { locale: fr }) : '—'}
                  </span>
                </div>
                <div className="flex gap-4 mt-1 text-sm">
                  <span className="text-slate-600">{t('pd.net')}: <strong>{(f.montant_net || 0).toLocaleString('fr-FR')} F</strong></span>
                  <span className="text-green-600">{t('pd.paid')}: {(f.montant_paye || 0).toLocaleString('fr-FR')} F</span>
                  {f.montant_restant > 0 && (
                    <span className="text-red-500">{t('pd.remaining')}: {(f.montant_restant || 0).toLocaleString('fr-FR')} F</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <BadgeStatut statut={f.statut} />
                <button
                  onClick={() => openTicket(f.id)}
                  className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600 transition-colors"
                  title={t('c.print')}
                >
                  <Printer size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal ticket */}
      <Modal open={showTicket} onClose={() => setShowTicket(false)} title={t('cai.ticket_title')} size="md">
        {ticketData && (
          <TicketCaisse data={ticketData} onClose={() => setShowTicket(false)} />
        )}
      </Modal>
    </div>
  );
};
