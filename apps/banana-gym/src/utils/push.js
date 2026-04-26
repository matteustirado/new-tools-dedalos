import { toast } from 'react-toastify';
import api from '../services/api';

const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  
  return outputArray;
};

export const subscribeToPushNotifications = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    toast.error('Seu navegador não suporta notificações Push.');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    
    if (permission !== 'granted') {
      toast.warning('Permissão negada. Você não receberá alertas de treino.');
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY)
    });

    await api.post('/api/gym/push/subscribe', { subscription });

    toast.success('Notificações ativadas com sucesso! 🍌🔔');
    return true;

  } catch (error) {
    console.error(error);
    toast.error('Erro ao ativar notificações. Tente novamente.');
    return false;
  }
};