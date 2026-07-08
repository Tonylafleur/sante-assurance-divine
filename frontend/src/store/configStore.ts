import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ConfigState {
  nomStructure: string;
  logo: string | null;       // image encodée en dataURL (base64)
  jitsiDomain: string;       // serveur Jitsi pour la vidéo (meet.jit.si par défaut)
  configured: boolean;       // true une fois la configuration initiale enregistrée
  setConfig: (nomStructure: string, logo: string | null, jitsiDomain?: string) => void;
  setJitsiDomain: (domain: string) => void;
  reset: () => void;
}

const DEFAULT_JITSI = 'meet.jit.si';

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      nomStructure: 'Assurance Divine',
      logo: null,
      jitsiDomain: DEFAULT_JITSI,
      configured: false,
      setConfig: (nomStructure, logo, jitsiDomain) =>
        set({ nomStructure, logo, ...(jitsiDomain ? { jitsiDomain } : {}), configured: true }),
      setJitsiDomain: (domain) => set({ jitsiDomain: domain || DEFAULT_JITSI }),
      reset: () => set({ nomStructure: 'Assurance Divine', logo: null, jitsiDomain: DEFAULT_JITSI, configured: false }),
    }),
    { name: 'sad-config' }
  )
);
