import pool from '../config/db.js';
import webpush from 'web-push';

export const formatEventName = (inviteType) => {
  const dictionary = {
    'park': 'um Passeio no parque',
    'lunch': 'um Almoço especial',
    'dinner': 'um Jantar de negócios',
    'bike': 'uma Pedalada ao ar livre',
    'gym': 'um Treino na academia',
    'bananada': 'uma Bananada 🔥'
  };
  
  if (!inviteType) return 'um evento social';
  const key = inviteType.replace('SOCIAL_', '').toLowerCase();
  return dictionary[key] || 'um evento social';
};

export const subscribePush = async (req, res) => {
  const { subscription } = req.body;
  const cpf = req.user.cpf;

  if (!subscription) {
    return res.status(400).json({ error: "Dados de inscrição incompletos." });
  }

  try {
    const cleanCpf = String(cpf).replace(/\D/g, '');
    const { endpoint, keys } = subscription;

    await pool.query(
      `INSERT INTO gym_push_subscriptions (user_cpf, endpoint, p256dh, auth) 
       VALUES (?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE endpoint = VALUES(endpoint), p256dh = VALUES(p256dh), auth = VALUES(auth)`,
      [cleanCpf, endpoint, keys.p256dh, keys.auth]
    );

    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao salvar inscrição." });
  }
};

export const getInboxNotifications = async (req, res) => {
  const cpf = req.user.cpf;

  try {
    const cleanCpf = String(cpf).replace(/\D/g, '');
    const query = `
      SELECT n.*, u.username as sender_username, u.foto_perfil as sender_foto, c.post_slug, c.foto_treino_url as post_thumbnail
      FROM gym_notifications n
      LEFT JOIN gym_users u ON n.sender_cpf = u.cpf
      LEFT JOIN gym_checkins c ON n.post_id = c.id
      WHERE n.receiver_cpf = ?
      ORDER BY n.created_at DESC
      LIMIT 50
    `;
    const [notifications] = await pool.query(query, [cleanCpf]);
    res.json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao carregar notificações." });
  }
};

export const getUnreadNotificationCount = async (req, res) => {
  const cpf = req.user.cpf;

  try {
    const cleanCpf = String(cpf).replace(/\D/g, '');
    const [rows] = await pool.query(
      "SELECT COUNT(*) as count FROM gym_notifications WHERE receiver_cpf = ? AND is_read = 0",
      [cleanCpf]
    );
    res.json({ count: rows[0].count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar contador." });
  }
};

export const markNotificationAsRead = async (req, res) => {
  const { id } = req.params;
  const cpf = req.user.cpf;

  try {
    const cleanCpf = String(cpf).replace(/\D/g, '');
    await pool.query("UPDATE gym_notifications SET is_read = 1 WHERE id = ? AND receiver_cpf = ?", [id, cleanCpf]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao marcar como lida." });
  }
};

export const markAllNotificationsAsRead = async (req, res) => {
  const cpf = req.user.cpf;

  try {
    const cleanCpf = String(cpf).replace(/\D/g, '');
    await pool.query("UPDATE gym_notifications SET is_read = 1 WHERE receiver_cpf = ? AND is_read = 0", [cleanCpf]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao marcar notificações como lidas." });
  }
};

export const sendPushNotification = async (receiverCpf, title, body, data = {}) => {
  try {
    const [subscriptions] = await pool.query(
      "SELECT endpoint, p256dh, auth FROM gym_push_subscriptions WHERE user_cpf = ?",
      [receiverCpf]
    );

    const payload = JSON.stringify({
      notification: {
        title,
        body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        data
      }
    });

    const promises = subscriptions.map(sub => {
      const pushConfig = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };
      return webpush.sendNotification(pushConfig, payload);
    });

    await Promise.all(promises);
  } catch (err) {
    console.error(err);
  }
};