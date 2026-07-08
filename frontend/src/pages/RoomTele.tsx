import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Stethoscope, CheckCircle, Link2, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { teleconsultationApi } from '../services/api';
import { JitsiRoom } from '../components/JitsiRoom';
import { DocumentsPanel } from '../components/DocumentsPanel';
import { useAuthStore } from '../store/authStore';
import { useConfigStore } from '../store/configStore';
import { useT } from '../i18n';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export const RoomTele: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const rdvId = Number(id);
  const navigate = useNavigate();
  const { t } = useT();
  const user = useAuthStore(s => s.user);
  const { jitsiDomain } = useConfigStore();
  const [rdv, setRdv] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    teleconsultationApi.get(rdvId)
      .then(r => setRdv(r.data))
      .catch(() => toast.error(t('ts.load_error')))
      .finally(() => setLoading(false));
  }, [rdvId]); // eslint-disable-line react-hooks/exhaustive-deps

  const terminer = async () => {
    try {
      const res = await teleconsultationApi.terminer(rdvId);
      toast.success(t('tc.finished') + (res.data.facture_numero ? ` — ${t('ts.billed')} (${res.data.facture_numero})` : ''));
      navigate('/teleconsultation');
    } catch (err: any) { toast.error(err.response?.data?.detail || t('ts.error')); }
  };

  const copyLink = () => {
    const v = jitsiDomain && jitsiDomain !== 'meet.jit.si' ? `?v=${encodeURIComponent(jitsiDomain)}` : '';
    const url = `${window.location.origin}/salle/${rdv.token_patient}${v}`;
    navigator.clipboard.writeText(url).then(() => toast.success(t('tc.link_copied'))).catch(() => toast(url));
  };

  if (loading) return <div className="py-20 flex justify-center"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!rdv) return <div className="py-20 text-center text-slate-400">{t('tc.none')}</div>;

  return (
    <div className="fade-in h-[calc(100vh-7rem)] flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate('/teleconsultation')} className="btn-outline p-2"><ArrowLeft size={16} /></button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-800 truncate">{rdv.patient}</h1>
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <Clock size={11} />{rdv.date_heure ? format(new Date(rdv.date_heure), 'dd MMM yyyy — HH:mm', { locale: fr }) : '—'}
              {rdv.motif && <span>· {rdv.motif}</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={copyLink} className="btn-outline text-xs py-1.5 px-3 flex items-center gap-1.5"><Link2 size={13} /> {t('tc.copy_link')}</button>
          {rdv.consultation_id && (
            <button onClick={() => navigate(`/consultations/${rdv.consultation_id}`)} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"><Stethoscope size={13} /> {t('tc.open_consult')}</button>
          )}
          {rdv.statut !== 'termine' && (
            <button onClick={terminer} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"><CheckCircle size={13} /> {t('tc.finish')}</button>
          )}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        <div className="lg:col-span-2 min-h-[320px]">
          {rdv.room_id
            ? <JitsiRoom roomId={rdv.room_id} displayName={user ? `${user.prenom} ${user.nom}` : 'Médecin'} onLeave={() => navigate('/teleconsultation')} />
            : <div className="w-full h-full bg-slate-900 rounded-2xl flex items-center justify-center text-white/60 text-sm">{t('tc.type_presentiel')}</div>}
        </div>
        <div className="card flex flex-col min-h-[320px]">
          <DocumentsPanel mode="staff" rdvId={rdvId} />
        </div>
      </div>
    </div>
  );
};
