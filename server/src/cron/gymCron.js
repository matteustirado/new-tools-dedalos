import cron from 'node-cron';
import pool from '../config/db.js';
import { getIO } from '../socket.js';
import { 
  NOTIFICATION_MORNING, 
  NOTIFICATION_AFTERNOON, 
  NOTIFICATION_NIGHT, 
  NOTIFICATION_STRAVA, 
  NOTIFICATION_2FA, 
  NOTIFICATION_WELLNESS,
  NOTIFICATION_DUO
} from '../constants/phrases.js';

const getRandomPhrase = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const initCronJobs = () => {
  // CRON: 09:00 AM - Lembrete Matinal
  cron.schedule('0 9 * * *', async () => {
    console.log("[CRON] Rodando Lembrete Matinal...");
    await sendCheckinReminder(NOTIFICATION_MORNING);
  });

  // CRON: 15:00 PM - Lembrete da Tarde
  cron.schedule('0 15 * * *', async () => {
    console.log("[CRON] Rodando Lembrete da Tarde...");
    await sendCheckinReminder(NOTIFICATION_AFTERNOON);
  });

  // CRON: 21:00 PM - Alerta Final do Dia
  cron.schedule('0 21 * * *', async () => {
    console.log("[CRON] Rodando Alerta Noturno...");
    await sendCheckinReminder(NOTIFICATION_NIGHT);
  });

  // CRON: 16:30 PM - Nudge de Engajamento (Roda todo dia, mas filtra os usuários que estão há 5 dias sem nudge)
  cron.schedule('30 16 * * *', async () => {
    console.log("[CRON] Rodando Scheduler de Engajamento (Anti-Spam)...");
    await sendEngagementNudges();
  });
};

const sendCheckinReminder = async (phrasesArray) => {
  try {
    // Busca usuários ativos que AINDA NÃO têm um check-in válido hoje
    const [users] = await pool.query(`
      SELECT cpf FROM gym_users 
      WHERE is_blocked = 0 
        AND must_change_password = 0
        AND cpf NOT IN (
            SELECT colaborador_cpf FROM gym_checkins 
            WHERE DATE(created_at) = CURRENT_DATE() AND is_checkin_valid = 1
        )
    `);

    for (const user of users) {
      const phrase = getRandomPhrase(phrasesArray);
      
      // Inserir notificação
      await pool.query(
        "INSERT INTO gym_notifications (receiver_cpf, type, content) VALUES (?, 'SYSTEM', ?)",
        [user.cpf, phrase]
      );

      // Acender o sininho no app em tempo real
      const io = getIO();
      if (io) io.emit('gym:new_notification', { receiverCpf: user.cpf });
    }
  } catch (err) {
    console.error("[CRON] Erro ao enviar lembretes:", err);
  }
};

const sendEngagementNudges = async () => {
  try {
    // Busca usuários em que last_nudge_at é NULL ou faz MAIS DE 5 DIAS desde o último aviso
    const [users] = await pool.query(`
      SELECT cpf, two_factor_enabled, strava_access_token 
      FROM gym_users 
      WHERE is_blocked = 0 
        AND must_change_password = 0
        AND (last_nudge_at IS NULL OR last_nudge_at <= DATE_SUB(NOW(), INTERVAL 5 DAY))
    `);

    for (const user of users) {
      let phrase = "";
      let type = "SYSTEM";
      
      // Lógica probabilística para não mandar a mesma coisa sempre
      const dice = Math.random();

      if (!user.two_factor_enabled && dice < 0.33) {
        phrase = getRandomPhrase(NOTIFICATION_2FA);
        type = "SECURITY";
      } else if (!user.strava_access_token && dice >= 0.33 && dice < 0.66) {
        phrase = getRandomPhrase(NOTIFICATION_STRAVA);
        type = "STRAVA";
      } else if (dice >= 0.66 && dice < 0.85) {
        phrase = getRandomPhrase(NOTIFICATION_WELLNESS);
      } else {
        phrase = getRandomPhrase(NOTIFICATION_DUO);
        type = "INVITE";
      }

      // Salva a notificação
      await pool.query(
        "INSERT INTO gym_notifications (receiver_cpf, type, content) VALUES (?, ?, ?)",
        [user.cpf, type, phrase]
      );

      // MARCA A DATA DE HOJE COMO O ÚLTIMO NUDGE (Para ele ficar em paz pelos próximos 5 dias)
      await pool.query("UPDATE gym_users SET last_nudge_at = NOW() WHERE cpf = ?", [user.cpf]);

      const io = getIO();
      if (io) io.emit('gym:new_notification', { receiverCpf: user.cpf });
    }
  } catch(err) {
    console.error("[CRON] Erro ao enviar nudges de engajamento:", err);
  }
};