import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Upload, Building2, ImageIcon, Check, X, Video } from 'lucide-react';
import toast from 'react-hot-toast';
import { useConfigStore } from '../store/configStore';
import { useT } from '../i18n';

export const Setup: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useT();
  const { nomStructure: nomActuel, logo: logoActuel, jitsiDomain: jitsiActuel, setConfig } = useConfigStore();
  const [nom, setNom] = useState(nomActuel === 'Assurance Divine' ? '' : nomActuel);
  const [logo, setLogo] = useState<string | null>(logoActuel);
  const [jitsi, setJitsi] = useState(jitsiActuel || 'meet.jit.si');
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error(t('setup.img_only')); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error(t('setup.too_big')); return; }
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result as string);
    reader.readAsDataURL(file);
  };

  const save = () => {
    if (!nom.trim()) { toast.error(t('setup.name_required')); return; }
    setConfig(nom.trim(), logo, (jitsi.trim() || 'meet.jit.si').replace(/^https?:\/\//, '').replace(/\/+$/, ''));
    toast.success(t('setup.saved'));
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-700 flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent-400 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg">
        {/* Titre */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Activity size={34} className="text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">{t('setup.title')}</h1>
          <p className="text-white/80 text-sm mt-2">{t('setup.subtitle')}</p>
        </div>

        {/* Carte de configuration */}
        <div className="bg-white rounded-3xl shadow-2xl p-7 sm:p-9 space-y-6">
          {/* Nom de la structure */}
          <div>
            <label className="label flex items-center gap-1.5"><Building2 size={15} /> {t('setup.struct_name')}</label>
            <input
              className="input text-base"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder={t('setup.struct_ph')}
              autoFocus
            />
          </div>

          {/* Logo */}
          <div>
            <label className="label flex items-center gap-1.5"><ImageIcon size={15} /> {t('setup.logo')}</label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50 flex-shrink-0">
                {logo ? (
                  <img src={logo} alt="logo" className="w-full h-full object-contain" />
                ) : (
                  <ImageIcon size={26} className="text-slate-300" />
                )}
              </div>
              <div className="flex-1">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
                <button type="button" onClick={() => fileRef.current?.click()} className="btn-outline flex items-center gap-2 text-sm">
                  <Upload size={15} /> {t('setup.choose_logo')}
                </button>
                {logo && (
                  <button type="button" onClick={() => setLogo(null)} className="ml-2 text-xs text-red-500 hover:underline inline-flex items-center gap-1">
                    <X size={12} /> {t('setup.remove')}
                  </button>
                )}
                <p className="text-xs text-slate-400 mt-1.5">{t('setup.logo_hint')}</p>
              </div>
            </div>
          </div>

          {/* Serveur vidéo (téléconsultation) */}
          <div>
            <label className="label flex items-center gap-1.5"><Video size={15} /> {t('tc.jitsi_server')}</label>
            <input
              className="input text-base"
              value={jitsi}
              onChange={(e) => setJitsi(e.target.value)}
              placeholder="meet.jit.si"
            />
            <p className="text-xs text-slate-400 mt-1.5">{t('tc.jitsi_hint')}</p>
          </div>

          <button onClick={save} className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2">
            <Check size={18} /> {t('setup.save')}
          </button>
        </div>

        <p className="text-center text-white/50 text-xs mt-6">{t('app.norm')}</p>
      </div>
    </div>
  );
};
