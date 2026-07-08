import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: number;
  matricule: string;
  nom: string;
  prenom: string;
  role: string;
  service: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  serviceActif: string | null;
  setAuth: (token: string, user: User, service?: string | null) => void;
  setServiceActif: (service: string | null) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      serviceActif: null,
      setAuth: (token, user, service = null) => {
        localStorage.setItem('token', token);
        set({ token, user, serviceActif: service });
      },
      setServiceActif: (service) => set({ serviceActif: service }),
      logout: () => {
        localStorage.removeItem('token');
        set({ token: null, user: null, serviceActif: null });
      },
      isAuthenticated: () => !!get().token,
    }),
    { name: 'sad-auth' }
  )
);
