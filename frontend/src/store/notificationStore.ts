import { create } from 'zustand';

export interface Notification {
  id: string;
  type: 'nouvelle_prescription' | 'prescription_dispensee' | 'nouveaux_examens' | 'nouvelle_consultation' | 'info';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  data?: any;
}

interface NotifState {
  notifications: Notification[];
  addNotification: (n: Omit<Notification, 'id' | 'read' | 'timestamp'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  unreadCount: () => number;
}

export const useNotificationStore = create<NotifState>((set, get) => ({
  notifications: [],
  addNotification: (n) => {
    const notif: Notification = {
      ...n,
      id: `${Date.now()}-${Math.random()}`,
      read: false,
      timestamp: new Date().toISOString(),
    };
    set((s) => ({ notifications: [notif, ...s.notifications].slice(0, 50) }));
  },
  markRead: (id) => set((s) => ({
    notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n)
  })),
  markAllRead: () => set((s) => ({
    notifications: s.notifications.map(n => ({ ...n, read: true }))
  })),
  unreadCount: () => get().notifications.filter(n => !n.read).length,
}));
