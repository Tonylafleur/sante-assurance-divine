import React, { useEffect, useRef, useState } from 'react';
import { VideoOff } from 'lucide-react';
import { useConfigStore } from '../store/configStore';
import { useT } from '../i18n';

declare global {
  interface Window { JitsiMeetExternalAPI?: any; }
}

interface Props {
  roomId: string;
  displayName: string;
  /** domaine Jitsi forcé (sinon celui de la configuration locale) */
  domain?: string;
  /** sera appelé quand l'utilisateur quitte la salle vidéo */
  onLeave?: () => void;
}

// Charge le script external_api.js une seule fois, depuis le domaine Jitsi configuré.
function loadJitsiScript(domain: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.JitsiMeetExternalAPI) return resolve();
    const existing = document.getElementById('jitsi-external-api') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject());
      return;
    }
    const s = document.createElement('script');
    s.id = 'jitsi-external-api';
    s.src = `https://${domain}/external_api.js`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject();
    document.body.appendChild(s);
  });
}

export const JitsiRoom: React.FC<Props> = ({ roomId, displayName, domain, onLeave }) => {
  const { jitsiDomain: storeDomain } = useConfigStore();
  const jitsiDomain = domain || storeDomain;
  const { t } = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let disposed = false;
    if (!roomId) return;
    loadJitsiScript(jitsiDomain)
      .then(() => {
        if (disposed || !containerRef.current || !window.JitsiMeetExternalAPI) return;
        apiRef.current = new window.JitsiMeetExternalAPI(jitsiDomain, {
          roomName: roomId,
          parentNode: containerRef.current,
          width: '100%',
          height: '100%',
          userInfo: { displayName },
          configOverwrite: {
            prejoinPageEnabled: false,
            disableDeepLinking: true,
            startWithAudioMuted: false,
            startWithVideoMuted: false,
          },
          interfaceConfigOverwrite: {
            MOBILE_APP_PROMO: false,
            SHOW_JITSI_WATERMARK: false,
            TOOLBAR_BUTTONS: [
              'microphone', 'camera', 'desktop', 'chat', 'raisehand',
              'tileview', 'fullscreen', 'settings', 'hangup',
            ],
          },
        });
        if (onLeave) apiRef.current.addEventListener('readyToClose', onLeave);
      })
      .catch(() => setError(true));

    return () => {
      disposed = true;
      try { apiRef.current?.dispose(); } catch { /* noop */ }
      apiRef.current = null;
    };
  }, [roomId, jitsiDomain, displayName]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="w-full h-full bg-slate-900 rounded-2xl flex flex-col items-center justify-center text-white/70 gap-2 p-6 text-center">
        <VideoOff size={36} className="opacity-60" />
        <p className="text-sm">{t('tc.video_error')}</p>
        <p className="text-xs font-mono opacity-60">{jitsiDomain}</p>
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-full rounded-2xl overflow-hidden bg-slate-900" />;
};
