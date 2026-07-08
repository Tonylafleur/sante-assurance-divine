import { useEffect, useRef } from 'react';
import { createWebSocket } from '../services/api';
import { useNotificationStore } from '../store/notificationStore';
import toast from 'react-hot-toast';

const CHANNEL_LABELS: Record<string, string> = {
  nouvelle_prescription: '💊 Nouvelle prescription',
  prescription_dispensee: '✅ Prescription dispensée',
  nouveaux_examens: '🔬 Examens demandés',
  nouvelle_consultation: '👤 Nouveau patient',
};

export const useWebSocket = (channel: string) => {
  const wsRef = useRef<WebSocket | null>(null);
  const addNotification = useNotificationStore((s) => s.addNotification);

  useEffect(() => {
    const ws = createWebSocket(channel);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      if (event.data === 'pong') return;
      try {
        const data = JSON.parse(event.data);
        const title = CHANNEL_LABELS[data.type] || 'Notification';
        let message = '';

        switch (data.type) {
          case 'nouvelle_prescription':
            message = `Patient: ${data.patient} — ${data.medicaments?.length || 0} médicament(s)`;
            toast(`${title}\n${message}`, { icon: '💊', duration: 5000 });
            break;
          case 'prescription_dispensee':
            message = `${data.patient} — ${data.medicament} — ${data.montant?.toLocaleString('fr-FR')} FCFA`;
            toast.success(`${title}\n${message}`, { duration: 4000 });
            break;
          case 'nouveaux_examens':
            message = `Patient: ${data.patient} — ${data.examens?.join(', ')}`;
            toast(`${title}`, { icon: '🔬', duration: 4000 });
            break;
          case 'nouvelle_consultation':
            message = `${data.patient} — ${data.service}`;
            toast(`${title}\n${message}`, { icon: '👤', duration: 4000 });
            break;
        }

        addNotification({ type: data.type, title, message, data });
      } catch {}
    };

    ws.onerror = () => {};
    ws.onclose = () => {};

    return () => ws.close();
  }, [channel]);

  return wsRef;
};
