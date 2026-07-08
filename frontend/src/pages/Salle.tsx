import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Activity, Clock } from 'lucide-react';
import { teleconsultationApi } from '../services/api';
import { JitsiRoom } from '../components/JitsiRoom';
import { DocumentsPanel } from '../components/DocumentsPanel';
import { useT } from '../i18n';
import { useConfigStore } from '../store/configStore';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export const Salle: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const videoDomain = searchParams.get('v') || undefined;
  const { t } = useT();
  const { nomStructure, logo } = useConfigStore();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    teleconsultationApi.salle(token)
      .then(r => setData(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-700 via-primary-800 to-secondary-800 flex items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-6xl bg-white rounded-3xl shadow-2xl p-5 sm:p-7">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 bg-primary-50 rounded-2xl flex items-center justify-center overflow-hidden">
            {logo ? <img src={logo} alt="logo" className="w-full h-full object-contain p-1" /> : <Activity size={26} className="text-primary-500" />}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-slate-800 truncate">{nomStructure}</h1>
            <p className="text-xs text-slate-500">{t('tc.room_title')}</p>
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : error || !data ? (
          <div className="py-10 text-center text-slate-400">{t('tc.none')}</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <div className="aspect-video">
                {data.room_id
                  ? <JitsiRoom roomId={data.room_id} displayName={data.patient || 'Patient'} domain={videoDomain} />
                  : <div className="w-full h-full bg-slate-900 rounded-2xl" />}
              </div>
              <div className="bg-slate-50 rounded-xl p-4 space-y-1.5 text-sm">
                <p><span className="text-slate-400">{t('c.patient')}: </span><strong>{data.patient}</strong></p>
                {data.medecin && <p><span className="text-slate-400">{t('tc.doctor')}: </span>{data.medecin}</p>}
                <p className="flex items-center gap-1.5 text-slate-500"><Clock size={13} />{data.date_heure ? format(new Date(data.date_heure), 'dd MMMM yyyy — HH:mm', { locale: fr }) : '—'}</p>
                {data.motif && <p className="text-slate-600">{data.motif}</p>}
              </div>
            </div>
            <div className="border border-slate-100 rounded-2xl p-4 flex flex-col h-[420px] lg:h-auto">
              <DocumentsPanel mode="patient" token={token!} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
