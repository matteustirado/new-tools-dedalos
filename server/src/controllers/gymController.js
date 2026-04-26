import pool from '../config/db.js';
import { getIO } from '../socket.js';
import bcrypt from 'bcrypt';
import axios from 'axios';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import jwt from 'jsonwebtoken';
import { sendPushNotification, formatEventName } from './notificationController.js';

const calcularDistanciaMetros = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const deltaP = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLon = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(deltaP / 2) * Math.sin(deltaP / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const generateUsername = (fullName, rg, cpf) => {
  const firstName = fullName.split(' ')[0].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const finalDigits = rg ? String(rg).replace(/\D/g, '').slice(-2) : String(cpf).replace(/\D/g, '').slice(-2);
  return `${firstName}${finalDigits}`;
};

const generatePostSlug = () => {
  const datePart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `${datePart}-${randomPart}`;
};

export const checkUserExists = async (req, res) => {
  const { cpf, username } = req.query;

  if (!cpf && !username) {
    return res.status(400).json({ error: "Forneça um CPF ou Username para checagem." });
  }

  try {
    let query = "SELECT cpf FROM gym_users WHERE ";
    let params = [];

    if (cpf) {
      const cleanCpf = String(cpf).replace(/\D/g, '');
      query += "cpf = ?";
      params.push(cleanCpf);
    } else if (username) {
      query += "username = ?";
      params.push(username);
    }

    const [existing] = await pool.query(query, params);
    
    res.json({ exists: existing.length > 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno na validação." });
  }
};

export const syncEmployeesToGym = async (req, res) => {
  try {
    const [employees] = await pool.query("SELECT * FROM employees");
    let addedCount = 0;

    for (const emp of employees) {
      const cpf = emp.cpf ? String(emp.cpf).replace(/\D/g, '') : null;
      if (!cpf || cpf.length !== 11) continue;

      const [existing] = await pool.query("SELECT cpf FROM gym_users WHERE cpf = ?", [cpf]);

      if (existing.length === 0) {
        const last5Cpf = cpf.slice(-5);
        const defaultPassword = `atleta${last5Cpf}`;
        const username = generateUsername(emp.name, emp.rg, cpf);
        const salt = await bcrypt.genSalt(10);
        const hashed = await bcrypt.hash(defaultPassword, salt);

        try {
          await pool.query(
            "INSERT INTO gym_users (cpf, nome, username, senha_hash, foto_perfil, is_approved) VALUES (?, ?, ?, ?, ?, 1)", 
            [cpf, 'Atleta Anônimo', username, hashed, emp.photo || null]
          );
          addedCount++;
        } catch (insertErr) {
          console.error(insertErr);
        }
      }
    }

    if (res) {
      res.json({ message: `Sincronização concluída. ${addedCount} novos usuários cadastrados.` });
    }
  } catch (err) {
    console.error(err);
    if (res) res.status(500).json({ error: "Erro interno na sincronização." });
  }
};

export const registerUser = async (req, res) => {
  const { cpf, nome, username, email, telefone, senha } = req.body;
  
  if (!cpf || !nome || !username || !senha) {
    return res.status(400).json({ error: "Campos obrigatórios ausentes." });
  }

  try {
    const cleanCpf = String(cpf).replace(/\D/g, '');
    
    const [existing] = await pool.query(
      "SELECT cpf, username, email FROM gym_users WHERE cpf = ? OR username = ? OR (email = ? AND email IS NOT NULL)", 
      [cleanCpf, username, email]
    );
    
    if (existing.length > 0) {
      const conflict = existing[0];
      if (conflict.cpf === cleanCpf) return res.status(400).json({ error: "CPF já cadastrado." });
      if (conflict.username === username) return res.status(400).json({ error: "Username já em uso." });
      if (conflict.email === email) return res.status(400).json({ error: "E-mail já cadastrado." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(senha, salt);

    await pool.query(
      "INSERT INTO gym_users (cpf, nome, username, email, telefone, senha_hash, is_approved, must_change_password) VALUES (?, ?, ?, ?, ?, ?, 0, 0)",
      [cleanCpf, nome, username, email || null, telefone || null, hashed]
    );

    res.status(201).json({ success: true, message: "Solicitação enviada ao RH." });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno ao cadastrar." });
  }
};

export const loginGymUser = async (req, res) => {
  const { cpf, senha } = req.body;
  if (!cpf || !senha) {
    return res.status(400).json({ error: "CPF e senha são obrigatórios." });
  }
  
  try {
    const cleanCpf = String(cpf).replace(/\D/g, '');
    const [users] = await pool.query("SELECT * FROM gym_users WHERE cpf = ?", [cleanCpf]);
    
    if (users.length === 0) {
      return res.status(401).json({ error: "CPF não encontrado no sistema." });
    }

    const user = users[0];

    if (user.is_approved === 0) {
      return res.status(403).json({ error: "Seu cadastro está em análise pelo RH. Aguarde a liberação." });
    }

    if (user.is_blocked) {
      return res.status(403).json({ error: "Acesso bloqueado. Procure o RH." });
    }

    const validPassword = await bcrypt.compare(senha, user.senha_hash);
    if (!validPassword) {
      return res.status(401).json({ error: "Senha incorreta." });
    }

    const token = jwt.sign(
      { cpf: user.cpf },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ 
      message: "Login efetuado com sucesso.",
      token,
      user: { 
        cpf: user.cpf, 
        nome: user.nome, 
        username: user.username, 
        email: user.email,
        foto_perfil: user.foto_perfil, 
        must_change_password: user.must_change_password, 
        has_strava: !!user.strava_access_token,
        termos_aceitos: user.termos_aceitos,
        two_factor_enabled: !!user.two_factor_enabled
      } 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
};

export const check2FA = async (req, res) => {
  const { cpf } = req.body;
  try {
    const cleanCpf = String(cpf).replace(/\D/g, '');
    const [users] = await pool.query("SELECT two_factor_enabled FROM gym_users WHERE cpf = ?", [cleanCpf]);
    if (users.length === 0) return res.status(404).json({ error: "Usuário não encontrado." });
    res.json({ has2FA: !!users[0].two_factor_enabled });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno." });
  }
};

export const requestReset = async (req, res) => {
  const { cpf } = req.body;
  try {
    const cleanCpf = String(cpf).replace(/\D/g, '');
    await pool.query("UPDATE gym_users SET reset_requested = 1 WHERE cpf = ?", [cleanCpf]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno." });
  }
};

export const verify2FAReset = async (req, res) => {
  const { cpf, token } = req.body;
  try {
    const cleanCpf = String(cpf).replace(/\D/g, '');
    const [users] = await pool.query("SELECT * FROM gym_users WHERE cpf = ?", [cleanCpf]);
    if (users.length === 0) return res.status(404).json({ error: "Usuário não encontrado." });
    
    const user = users[0];
    const isValid = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token: token,
      window: 1
    });

    if (!isValid) return res.status(401).json({ error: "Código 2FA inválido." });

    await pool.query("UPDATE gym_users SET must_change_password = 1, reset_requested = 0 WHERE cpf = ?", [cleanCpf]);

    const authToken = jwt.sign(
      { cpf: user.cpf },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ 
      success: true,
      token: authToken,
      user: { 
        cpf: user.cpf, 
        nome: user.nome, 
        username: user.username, 
        foto_perfil: user.foto_perfil, 
        must_change_password: 1, 
        has_strava: !!user.strava_access_token,
        termos_aceitos: user.termos_aceitos,
        two_factor_enabled: !!user.two_factor_enabled
      } 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno." });
  }
};

export const changePasswordForce = async (req, res) => {
  const { cpf, nova_senha } = req.body;
  try {
    const cleanCpf = String(cpf).replace(/\D/g, '');
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(nova_senha, salt);
    await pool.query("UPDATE gym_users SET senha_hash = ?, must_change_password = 0, reset_requested = 0 WHERE cpf = ?", [hashed, cleanCpf]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno." });
  }
};

export const generate2FA = async (req, res) => {
  const cpf = req.user.cpf;
  try {
    const cleanCpf = String(cpf).replace(/\D/g, '');
    const [users] = await pool.query("SELECT email, username FROM gym_users WHERE cpf = ?", [cleanCpf]);
    if (users.length === 0) return res.status(404).json({ error: "Usuário não encontrado." });
    
    const user = users[0];
    const identifier = user.email || user.username || cleanCpf;
    
    const secret = speakeasy.generateSecret({
      name: `Banana's Gym (${identifier})`
    });
    
    const qrCodeDataUrl = await qrcode.toDataURL(secret.otpauth_url);
    
    await pool.query("UPDATE gym_users SET two_factor_secret = ? WHERE cpf = ?", [secret.base32, cleanCpf]);
    
    res.json({ qrCode: qrCodeDataUrl, secret: secret.base32 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno ao gerar A2F." });
  }
};

export const verifyAndEnable2FA = async (req, res) => {
  const { token } = req.body;
  const cpf = req.user.cpf;
  try {
    const cleanCpf = String(cpf).replace(/\D/g, '');
    const [users] = await pool.query("SELECT two_factor_secret FROM gym_users WHERE cpf = ?", [cleanCpf]);
    if (users.length === 0) return res.status(404).json({ error: "Usuário não encontrado." });

    const user = users[0];
    const isValid = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token: token,
      window: 1
    });
    
    if (!isValid) return res.status(401).json({ error: "Código inválido." });
    
    await pool.query("UPDATE gym_users SET two_factor_enabled = 1 WHERE cpf = ?", [cleanCpf]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno ao ativar A2F." });
  }
};

export const changeUserPassword = async (req, res) => {
  const { senha_atual, nova_senha } = req.body;
  const cpf = req.user.cpf;

  if (!senha_atual || !nova_senha) {
    return res.status(400).json({ error: "Senha atual e nova senha são obrigatórios." });
  }
  
  try {
    const cleanCpf = String(cpf).replace(/\D/g, '');
    const [users] = await pool.query("SELECT * FROM gym_users WHERE cpf = ?", [cleanCpf]);
    
    if (users.length === 0) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(senha_atual, user.senha_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: "Senha atual incorreta." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(nova_senha, salt);
    await pool.query(
      "UPDATE gym_users SET senha_hash = ?, must_change_password = 0 WHERE cpf = ?", 
      [hashed, cleanCpf]
    );

    res.json({ message: "Senha atualizada com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno ao atualizar a senha." });
  }
};

export const getStravaAuthUrl = (req, res) => {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const redirectUri = process.env.STRAVA_REDIRECT_URI;
  
  if (!clientId || !redirectUri) {
    return res.status(500).json({ error: "Servidor não configurado para o Strava." });
  }
  
  const url = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&approval_prompt=force&scope=activity:read_all`;
  res.json({ url });
};

export const handleStravaCallback = async (req, res) => {
  const { code } = req.body;
  const cpf = req.user.cpf;

  if (!code) {
    return res.status(400).json({ error: "Código ausente." });
  }

  try {
    const response = await axios.post('https://www.strava.com/oauth/token', {
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code'
    });

    const { access_token, refresh_token, expires_at } = response.data;
    const cleanCpf = String(cpf).replace(/\D/g, '');

    await pool.query(
      "UPDATE gym_users SET strava_access_token = ?, strava_refresh_token = ?, strava_expires_at = ? WHERE cpf = ?", 
      [access_token, refresh_token, expires_at, cleanCpf]
    );

    res.json({ success: true, message: "Strava conectado com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao conectar com o Strava." });
  }
};

export const disconnectStrava = async (req, res) => {
  const cpf = req.user.cpf;

  try {
    const cleanCpf = String(cpf).replace(/\D/g, '');
    await pool.query(
      "UPDATE gym_users SET strava_access_token = NULL, strava_refresh_token = NULL, strava_expires_at = NULL WHERE cpf = ?", 
      [cleanCpf]
    );
    res.json({ success: true, message: "Strava desconectado." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao desconectar." });
  }
};

const getValidStravaToken = async (cpf) => {
  const [users] = await pool.query(
    "SELECT strava_access_token, strava_refresh_token, strava_expires_at FROM gym_users WHERE cpf = ?", 
    [cpf]
  );
  if (users.length === 0 || !users[0].strava_access_token) return null;

  const user = users[0];
  const now = Math.floor(Date.now() / 1000);

  if (user.strava_expires_at > now) {
    return user.strava_access_token;
  }

  try {
    const response = await axios.post('https://www.strava.com/oauth/token', {
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: user.strava_refresh_token,
      grant_type: 'refresh_token'
    });

    const { access_token, refresh_token, expires_at } = response.data;
    
    await pool.query(
      "UPDATE gym_users SET strava_access_token = ?, strava_refresh_token = ?, strava_expires_at = ? WHERE cpf = ?", 
      [access_token, refresh_token, expires_at, cpf]
    );

    return access_token;
  } catch (err) {
    console.error(err);
    return null;
  }
};

export const fetchAndSaveStravaRun = async (req, res) => {
  const cpf = req.user.cpf;
  const cleanCpf = String(cpf).replace(/\D/g, '');

  try {
    const token = await getValidStravaToken(cleanCpf);
    if (!token) {
      return res.status(401).json({ error: "Strava não conectado ou autorização expirada." });
    }

    const stravaRes = await axios.get('https://www.strava.com/api/v3/athlete/activities?per_page=1', { 
      headers: { Authorization: `Bearer ${token}` } 
    });

    if (stravaRes.data.length === 0) {
      return res.status(404).json({ error: "Nenhuma atividade encontrada no seu Strava." });
    }

    const activity = stravaRes.data[0];
    const distanceKm = activity.distance / 1000;
    const isRun = activity.type === 'Run';
    const isToday = new Date(activity.start_date_local).toDateString() === new Date().toDateString();
    const activityEndTime = new Date(activity.start_date_local).getTime() + (activity.elapsed_time * 1000);
    const minutesSinceEnd = (Date.now() - activityEndTime) / (1000 * 60);

    if (!isRun) return res.status(400).json({ error: "A última atividade não é uma corrida." });
    if (!isToday) return res.status(400).json({ error: "A última corrida não foi feita hoje." });
    if (distanceKm < 5.0) return res.status(400).json({ error: `Corrida muito curta: ${distanceKm.toFixed(2)}km. Mínimo de 5km exigido.` });
    if (minutesSinceEnd > 60) return res.status(400).json({ error: "O tempo limite de 1 hora para registrar essa corrida já passou." });

    const [existing] = await pool.query(
      "SELECT id FROM gym_checkins WHERE strava_activity_id = ?", 
      [String(activity.id)]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ error: "Você já postou essa corrida hoje!" });
    }

    res.json({ message: "Corrida encontrada! Gerando card...", run: activity });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno ao validar corrida." });
  }
};

export const searchUsersForDuo = async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) {
    return res.json([]);
  }

  try {
    const searchTerm = `%${q}%`;
    const query = `
      SELECT cpf, nome, username, foto_perfil 
      FROM gym_users 
      WHERE (nome LIKE ? OR username LIKE ?) 
        AND is_blocked = 0 
        AND must_change_password = 0 
      LIMIT 10
    `;
    const [users] = await pool.query(query, [searchTerm, searchTerm]);
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar usuários." });
  }
};

export const approveDuoPost = async (req, res) => {
  const { post_id } = req.body;
  const amigo_cpf = req.user.cpf;
  
  try {
    const cleanCpf = String(amigo_cpf).replace(/\D/g, '');
    const [post] = await pool.query(
      "SELECT * FROM gym_checkins WHERE id = ? AND tagged_cpf = ? AND duo_status = 'PENDING'", 
      [post_id, cleanCpf]
    );

    if (post.length === 0) {
      return res.status(404).json({ error: "Post não encontrado ou já processado." });
    }

    const isSocial = post[0].activity_type && post[0].activity_type.startsWith('SOCIAL');
    const pontosRecebidos = isSocial ? 0 : 2;
    const isCheckinValid = isSocial ? 0 : 1;

    await pool.query(
      "UPDATE gym_checkins SET duo_status = 'APPROVED', pontos = ? WHERE id = ?", 
      [pontosRecebidos, post_id]
    );
    
    const cloneSlug = generatePostSlug();

    const insertQuery = `
      INSERT INTO gym_checkins 
      (post_slug, colaborador_cpf, unidade, academia_digitada, foto_treino_url, mensagem, pontos, is_checkin_valid, activity_type, tagged_cpf, duo_status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED')
    `;

    await pool.query(insertQuery, [
      cloneSlug, 
      cleanCpf, 
      post[0].unidade, 
      post[0].academia_digitada, 
      post[0].foto_treino_url, 
      post[0].mensagem, 
      pontosRecebidos, 
      isCheckinValid, 
      post[0].activity_type, 
      post[0].colaborador_cpf
    ]);

    const postOwnerCpf = post[0].colaborador_cpf;
    
    let notifContent = 'aceitou seu convite de treino em dupla!';
    if (isSocial) {
        const theme = formatEventName(post[0].activity_type);
        notifContent = `aceitou seu convite para ${theme}!`;
    }
    
    await pool.query(
      "INSERT INTO gym_notifications (sender_cpf, receiver_cpf, type, post_id, content) VALUES (?, ?, 'DUO', ?, ?)", 
      [cleanCpf, postOwnerCpf, post_id, notifContent]
    );

    const [sender] = await pool.query("SELECT username FROM gym_users WHERE cpf = ?", [cleanCpf]);
    const senderUsername = sender.length > 0 ? `@${sender[0].username}` : 'Alguém';

    sendPushNotification(postOwnerCpf, `${senderUsername} aceitou seu convite! 🤝`, "Toque para ver os detalhes no app...");

    const io = getIO();
    if (io) {
      io.emit('gym:ranking_updated');
      io.emit('gym:new_notification', { receiverCpf: postOwnerCpf });
      io.emit('gym:new_post', { colaborador_cpf: cleanCpf });
      io.emit('gym:new_post', { colaborador_cpf: postOwnerCpf });
    }
    
    res.json({ success: true, message: isSocial ? "Foto aprovada! 🔥" : "Treino aprovado! Vocês ganharam +2 pontos! 🍌🍌" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno ao aprovar treino." });
  }
};

export const rejectDuoPost = async (req, res) => {
  const { post_id } = req.body;
  const amigo_cpf = req.user.cpf;
  try {
    const cleanCpf = String(amigo_cpf).replace(/\D/g, '');
    const [post] = await pool.query(
      "SELECT * FROM gym_checkins WHERE id = ? AND tagged_cpf = ? AND duo_status = 'PENDING'", 
      [post_id, cleanCpf]
    );

    if (post.length === 0) {
      return res.status(404).json({ error: "Post não encontrado ou já processado." });
    }

    await pool.query(
      "UPDATE gym_checkins SET duo_status = 'REJECTED' WHERE id = ?", 
      [post_id]
    );
    
    res.json({ success: true, message: "Convite recusado." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno ao recusar treino." });
  }
};

export const sendSocialInvite = async (req, res) => {
  const { receiver_username, invite_type, event_date } = req.body;
  const sender_cpf = req.user.cpf;

  if (!receiver_username || !invite_type || !event_date) {
    return res.status(400).json({ error: "Dados incompletos para o convite." });
  }

  const cleanSenderCpf = String(sender_cpf).replace(/\D/g, '');

  try {
    const [receiver] = await pool.query(
      "SELECT cpf FROM gym_users WHERE username = ?", 
      [receiver_username]
    );
    
    if (receiver.length === 0) {
      return res.status(404).json({ error: "Usuário destinatário não encontrado." });
    }

    const receiverCpf = receiver[0].cpf;

    const [result] = await pool.query(
      `INSERT INTO gym_invites (sender_cpf, receiver_cpf, invite_type, event_date, status) VALUES (?, ?, ?, ?, 'PENDING')`,
      [cleanSenderCpf, receiverCpf, invite_type, new Date(event_date)]
    );

    const inviteId = result.insertId;
    const eventName = formatEventName(invite_type);

    await pool.query(
      "INSERT INTO gym_notifications (sender_cpf, receiver_cpf, type, invite_id, content) VALUES (?, ?, 'INVITE', ?, ?)", 
      [cleanSenderCpf, receiverCpf, inviteId, `convidou você para ${eventName}`]
    );

    const [sender] = await pool.query("SELECT username FROM gym_users WHERE cpf = ?", [cleanSenderCpf]);
    const senderUsername = sender.length > 0 ? `@${sender[0].username}` : 'Alguém';

    sendPushNotification(receiverCpf, `${senderUsername} enviou um convite! 🎉`, `Você foi convidado para ${eventName}. Toque para abrir...`);

    const io = getIO();
    if (io) {
      io.emit('gym:new_notification', { receiverCpf }); 
    }

    res.status(201).json({ success: true, message: "Convite enviado com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno ao enviar o convite." });
  }
};

export const answerSocialInvite = async (req, res) => {
  const { invite_id, action } = req.body;
  const receiver_cpf = req.user.cpf;
  try {
    const cleanCpf = String(receiver_cpf).replace(/\D/g, '');
    const newStatus = action === 'approve' ? 'ACCEPTED' : 'REJECTED';
    
    const [result] = await pool.query(
      "UPDATE gym_invites SET status = ? WHERE id = ? AND receiver_cpf = ? AND status = 'PENDING'",
      [newStatus, invite_id, cleanCpf]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Convite não encontrado ou já processado." });
    }

    const [inviteData] = await pool.query("SELECT sender_cpf, invite_type FROM gym_invites WHERE id = ?", [invite_id]);
    if(inviteData.length > 0) {
       const senderOriginal = inviteData[0].sender_cpf;
       const theme = formatEventName(inviteData[0].invite_type);
       const msg = action === 'approve' ? `aceitou seu convite para ${theme}!` : `recusou seu convite para ${theme}.`;
       
       await pool.query(
         "INSERT INTO gym_notifications (sender_cpf, receiver_cpf, type, invite_id, content) VALUES (?, ?, 'INVITE', ?, ?)", 
         [cleanCpf, senderOriginal, invite_id, msg]
       );

       const [sender] = await pool.query("SELECT username FROM gym_users WHERE cpf = ?", [cleanCpf]);
       const senderUsername = sender.length > 0 ? `@${sender[0].username}` : 'Alguém';
       const emoji = action === 'approve' ? '✅' : '❌';

       sendPushNotification(senderOriginal, `${senderUsername} ${msg} ${emoji}`, "Toque para ver as atualizações no app...");

       const io = getIO();
       if(io) io.emit('gym:new_notification', { receiverCpf: senderOriginal });
    }

    res.json({ success: true, message: action === 'approve' ? "Convite aceito!" : "Convite recusado." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno ao responder convite." });
  }
};

export const getPendingDuos = async (req, res) => {
  const { page = 1, limit = 15 } = req.query;
  const cpf = req.user.cpf;
  const cleanCpf = String(cpf).replace(/\D/g, '');
  const offset = (Number(page) - 1) * Number(limit);

  try {
    const query = `
      SELECT 
        c.id as post_id, 
        c.post_slug as linked_post_slug,
        u.username as linked_post_username,
        'treino_dupla' as tipo, 
        c.foto_treino_url, 
        c.created_at, 
        CASE 
           WHEN c.duo_status = 'PENDING' THEN 'PHOTO_PENDING'
           WHEN c.duo_status = 'REJECTED' THEN 'PHOTO_REJECTED'
           WHEN c.duo_status = 'APPROVED' THEN 'PHOTO_APPROVED'
        END as statusLocal, 
        NULL as invite_type,
        NULL as event_date,
        u.cpf as amigo_cpf,
        u.nome as amigo_nome, 
        u.username as amigo_username,
        u.foto_perfil as amigo_foto,
        0 as is_sender,
        0 as is_photo_uploader,
        c.id as linked_checkin_id
      FROM gym_checkins c
      JOIN gym_users u ON c.colaborador_cpf = u.cpf
      WHERE c.tagged_cpf = ? 
        AND c.duo_status IS NOT NULL 
        AND (c.activity_type NOT LIKE 'SOCIAL%' OR c.activity_type IS NULL)

      UNION ALL

      SELECT 
        i.id as post_id, 
        c.post_slug as linked_post_slug,
        u_c.username as linked_post_username,
        'social_invite' as tipo, 
        c.foto_treino_url, 
        COALESCE(c.created_at, i.created_at) as created_at, 
        CASE 
           WHEN c.id IS NOT NULL AND c.duo_status = 'PENDING' THEN 'PHOTO_PENDING'
           WHEN c.id IS NOT NULL AND c.duo_status = 'REJECTED' THEN 'PHOTO_REJECTED'
           WHEN c.id IS NOT NULL AND c.duo_status = 'APPROVED' THEN 'PHOTO_APPROVED'
           WHEN COALESCE(i.status, 'PENDING') = 'PENDING' THEN 'INVITE_PENDING'
           WHEN i.status = 'REJECTED' THEN 'INVITE_REJECTED'
           WHEN i.status = 'ACCEPTED' THEN 'INVITE_ACCEPTED'
           WHEN i.status = 'COMPLETED' THEN 'PHOTO_APPROVED' 
           ELSE i.status
        END as statusLocal, 
        i.invite_type,
        i.event_date,
        u.cpf as amigo_cpf,
        u.nome as amigo_nome, 
        u.username as amigo_username,
        u.foto_perfil as amigo_foto,
        IF(i.sender_cpf = ?, 1, 0) as is_sender,
        IF(c.id IS NOT NULL AND c.colaborador_cpf = ?, 1, 0) as is_photo_uploader,
        c.id as linked_checkin_id
      FROM gym_invites i
      LEFT JOIN gym_checkins c ON c.id = (
         SELECT id FROM gym_checkins 
         WHERE activity_type LIKE CONCAT('SOCIAL_', i.invite_type) 
         AND ( 
             (colaborador_cpf = i.sender_cpf AND tagged_cpf = i.receiver_cpf) OR 
             (colaborador_cpf = i.receiver_cpf AND tagged_cpf = i.sender_cpf) 
         ) 
         AND created_at >= i.created_at 
         ORDER BY created_at ASC LIMIT 1
      )
      LEFT JOIN gym_users u_c ON c.colaborador_cpf = u_c.cpf
      JOIN gym_users u ON u.cpf = IF(i.sender_cpf = ?, i.receiver_cpf, i.sender_cpf)
      WHERE i.receiver_cpf = ? OR i.sender_cpf = ?

      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [notifications] = await pool.query(query, [cleanCpf, cleanCpf, cleanCpf, cleanCpf, cleanCpf, cleanCpf, Number(limit), Number(offset)]);
    res.json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar notificações." });
  }
};

export const postCheckin = async (req, res) => {
  const { 
    academia_digitada, mensagem, latitude, longitude, 
    is_real_time, is_run, strava_activity_id, run_distance_km, 
    run_duration_seconds, run_timestamp, run_polyline, tagged_cpf, 
    activity_type, social_invite_id 
  } = req.body;
  const colaborador_cpf = req.user.cpf;

  const pontos = parseFloat(req.body.pontos) || 0; 
  const foto_treino_url = req.file ? `/uploads/${req.file.filename}` : null;

  if (is_run !== 'true' && !foto_treino_url) {
    return res.status(400).json({ error: "A Foto é obrigatória." });
  }

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  let gym_location_id = null;

  if (!isNaN(lat) && !isNaN(lng)) {
    const [locations] = await pool.query("SELECT * FROM gym_locations");
    for (const loc of locations) {
      const dist = calcularDistanciaMetros(lat, lng, loc.latitude, loc.longitude);
      if (dist <= loc.raio_metros) {
        gym_location_id = loc.id;
        break;
      }
    }
  }

  let connection;
  
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [user] = await connection.query("SELECT is_blocked FROM gym_users WHERE cpf = ?", [colaborador_cpf]);
    if (user.length === 0 || user[0].is_blocked) {
      await connection.rollback();
      return res.status(403).json({ error: "Acesso negado. Conta bloqueada ou inexistente." });
    }

    let is_checkin_valid = 0;
    const [validPostsToday] = await connection.query(
      "SELECT id FROM gym_checkins WHERE colaborador_cpf = ? AND DATE(created_at) = CURRENT_DATE() AND is_checkin_valid = 1", 
      [colaborador_cpf]
    );
    
    if ((is_real_time === 'true' || is_real_time === true || is_run === 'true') && validPostsToday.length === 0) {
      is_checkin_valid = 1;
    }

    if (activity_type && activity_type.startsWith('SOCIAL')) {
      is_checkin_valid = 0;
    }

    const duoStatus = tagged_cpf ? 'PENDING' : null;
    const finalActivityType = is_run === 'true' ? 'RUN' : (activity_type || 'PHOTO');
    const post_slug = generatePostSlug();
    
    let result;

    if (is_run === 'true') {
      const insertRunQuery = `
        INSERT INTO gym_checkins 
        (post_slug, colaborador_cpf, unidade, academia_digitada, gym_location_id, foto_treino_url, mensagem, latitude, longitude, pontos, is_checkin_valid, activity_type, strava_activity_id, run_distance_km, run_duration_seconds, run_timestamp, run_polyline, tagged_cpf, duo_status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      [result] = await connection.query(insertRunQuery, [post_slug, colaborador_cpf, 'SP', academia_digitada || 'Corrida Outdoor', gym_location_id, foto_treino_url, mensagem || '', lat || null, lng || null, pontos, is_checkin_valid, finalActivityType, strava_activity_id, run_distance_km, run_duration_seconds, run_timestamp, run_polyline, tagged_cpf || null, duoStatus]);
    } else {
      const insertPhotoQuery = `
        INSERT INTO gym_checkins 
        (post_slug, colaborador_cpf, unidade, academia_digitada, gym_location_id, foto_treino_url, mensagem, latitude, longitude, pontos, is_checkin_valid, activity_type, tagged_cpf, duo_status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      [result] = await connection.query(insertPhotoQuery, [post_slug, colaborador_cpf, 'SP', academia_digitada || 'Não informada', gym_location_id, foto_treino_url, mensagem || '', lat || null, lng || null, pontos, is_checkin_valid, finalActivityType, tagged_cpf || null, duoStatus]);
    }

    if (social_invite_id) {
       await connection.query("UPDATE gym_invites SET status = 'COMPLETED' WHERE id = ?", [social_invite_id]);
    }

    await connection.commit();

    const io = getIO();
    if (io) {
      io.emit('gym:new_post', { id: result.insertId, colaborador_cpf, unidade: 'SP' });
      if (is_checkin_valid === 1) {
        io.emit('gym:ranking_updated');
      }
    }
    
    if (tagged_cpf) {
        const isSocialCheckin = activity_type && activity_type.startsWith('SOCIAL');
        const theme = isSocialCheckin ? formatEventName(activity_type) : 'um Treino em Dupla';
        const notifContent = `marcou você na foto de ${theme}`;

        await pool.query(
            "INSERT INTO gym_notifications (sender_cpf, receiver_cpf, type, post_id, content) VALUES (?, ?, 'DUO', ?, ?)", 
            [colaborador_cpf, tagged_cpf, result.insertId, notifContent]
        );

        const [sender] = await pool.query("SELECT username FROM gym_users WHERE cpf = ?", [colaborador_cpf]);
        const senderUsername = sender.length > 0 ? `@${sender[0].username}` : 'Alguém';

        sendPushNotification(tagged_cpf, `${senderUsername} marcou você! 📸`, `Você foi marcado em uma foto de ${theme}. Toque para ver...`);
        
        if (io) {
            io.emit('gym:new_notification', { receiverCpf: tagged_cpf }); 
        }
    }

    res.status(201).json({ message: "Check-in publicado com sucesso!", checkin_id: result.insertId });
  } catch (err) {
    console.error(err);
    if (connection) await connection.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
       return res.status(400).json({ error: "Esta corrida já foi registrada no sistema!" });
    }
    res.status(500).json({ error: "Erro interno ao processar o check-in." });
  } finally {
    if (connection) connection.release();
  }
};

export const getTodayActivity = async (req, res) => {
  const cpf = req.user.cpf;
  try {
    const cleanCpf = String(cpf).replace(/\D/g, '');
    const query = `
      SELECT id, post_slug, foto_treino_url, pontos, is_checkin_valid, created_at, activity_type, run_distance_km 
      FROM gym_checkins 
      WHERE colaborador_cpf = ? 
        AND DATE(created_at) = CURRENT_DATE() 
        AND activity_type NOT LIKE 'SOCIAL%' 
      ORDER BY created_at ASC
    `;
    const [posts] = await pool.query(query, [cleanCpf]);
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const selectCheckin = async (req, res) => {
  const { post_id } = req.body;
  const colaborador_cpf = req.user.cpf;

  if (!post_id) {
    return res.status(400).json({ error: "Dados insuficientes." });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const cleanCpf = String(colaborador_cpf).replace(/\D/g, '');

    const [currentPost] = await connection.query(
      "SELECT is_checkin_valid FROM gym_checkins WHERE id = ? AND colaborador_cpf = ?", 
      [post_id, cleanCpf]
    );
    const isAlreadyChecked = currentPost.length > 0 && currentPost[0].is_checkin_valid === 1;

    await connection.query(
      "UPDATE gym_checkins SET is_checkin_valid = 0 WHERE colaborador_cpf = ? AND DATE(created_at) = CURRENT_DATE()", 
      [cleanCpf]
    );

    if (!isAlreadyChecked) {
      await connection.query(
        "UPDATE gym_checkins SET is_checkin_valid = 1 WHERE id = ? AND colaborador_cpf = ? AND DATE(created_at) = CURRENT_DATE()", 
        [post_id, cleanCpf]
      );
    }

    await connection.commit();

    const io = getIO();
    if (io) {
      io.emit('gym:ranking_updated');
      io.emit('gym:profile_updated', { cpf: cleanCpf });
    }

    res.json({ success: true, message: isAlreadyChecked ? "Check-in desmarcado." : "Check-in do dia atualizado!", isNowChecked: !isAlreadyChecked });
  } catch (err) {
    console.error(err);
    if (connection) await connection.rollback();
    res.status(500).json({ error: "Erro ao alterar o check-in do dia." });
  } finally {
    if (connection) connection.release();
  }
};

export const getFeed = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const cpf = req.user.cpf;
  const offset = (page - 1) * limit;
  const cleanCpf = cpf ? String(cpf).replace(/\D/g, '') : null;

  try {
    let query = `
      SELECT 
        c.id, c.post_slug, c.colaborador_cpf, c.academia_digitada as unidade, 
        c.foto_treino_url, c.mensagem, c.created_at, c.pontos, c.imagem_valida, 
        c.localizacao_valida, c.is_checkin_valid, c.activity_type, c.run_distance_km, 
        c.run_duration_seconds, c.run_polyline, c.tagged_cpf, c.duo_status, 
        u.nome AS colaborador_nome, u.username AS colaborador_username, u.foto_perfil AS colaborador_foto, 
        t.nome AS tagged_nome, t.username AS tagged_username, t.foto_perfil AS tagged_foto, 
        l.nome AS academia_nome, 
        (SELECT COUNT(*) FROM gym_likes WHERE checkin_id = c.id) AS likes_count, 
        (SELECT COUNT(*) FROM gym_bananas WHERE checkin_id = c.id) AS bananas_count, 
        (SELECT COUNT(*) FROM gym_comments WHERE checkin_id = c.id) AS comments_count
        ${cleanCpf ? `, EXISTS(SELECT 1 FROM gym_likes WHERE checkin_id = c.id AND colaborador_id = ?) AS likedByMe, EXISTS(SELECT 1 FROM gym_bananas WHERE checkin_id = c.id AND colaborador_cpf = ?) AS bananadByMe` : ''}
      FROM gym_checkins c 
      LEFT JOIN gym_users u ON c.colaborador_cpf = u.cpf 
      LEFT JOIN gym_users t ON c.tagged_cpf = t.cpf 
      LEFT JOIN gym_locations l ON c.gym_location_id = l.id 
      WHERE (c.imagem_valida IS NULL OR c.imagem_valida = 1) 
        AND (c.arquivado IS NULL OR c.arquivado = 0) 
        AND (c.foto_treino_url IS NULL OR c.id = (SELECT MIN(id) FROM gym_checkins c2 WHERE c2.foto_treino_url = c.foto_treino_url)) 
      ORDER BY c.created_at DESC 
      LIMIT ? OFFSET ?
    `;

    let params = [];
    if (cleanCpf) params.push(cleanCpf, cleanCpf);
    params.push(Number(limit), Number(offset));

    const [feed] = await pool.query(query, params);

    const formattedFeed = feed.map(post => ({ 
      ...post, 
      likedByMe: post.likedByMe === 1, 
      bananadByMe: post.bananadByMe === 1 
    }));
    res.json(formattedFeed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const toggleLike = async (req, res) => {
  const { checkin_id } = req.body;
  const colaborador_cpf = req.user.cpf;
  if (!checkin_id) {
    return res.status(400).json({ error: "Dados inválidos." });
  }

  try {
    const [existing] = await pool.query(
      "SELECT id FROM gym_likes WHERE checkin_id = ? AND colaborador_id = ?", 
      [checkin_id, colaborador_cpf]
    );
    let action = 'liked';

    if (existing.length > 0) {
      await pool.query("DELETE FROM gym_likes WHERE id = ?", [existing[0].id]);
      action = 'unliked';
    } else {
      await pool.query("INSERT INTO gym_likes (checkin_id, colaborador_id) VALUES (?, ?)", [checkin_id, colaborador_cpf]);
      
      const [postOwner] = await pool.query("SELECT colaborador_cpf FROM gym_checkins WHERE id = ?", [checkin_id]);
      
      if (postOwner.length > 0 && postOwner[0].colaborador_cpf !== colaborador_cpf) {
        const receiverCpf = postOwner[0].colaborador_cpf;
        const [existingNotif] = await pool.query(
          "SELECT id FROM gym_notifications WHERE receiver_cpf = ? AND type = 'LIKE' AND post_id = ? AND is_read = 0",
          [receiverCpf, checkin_id]
        );
        
        if (existingNotif.length > 0) {
          await pool.query("UPDATE gym_notifications SET group_count = group_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [existingNotif[0].id]);
        } else {
          await pool.query(
            "INSERT INTO gym_notifications (sender_cpf, receiver_cpf, type, post_id, content) VALUES (?, ?, 'LIKE', ?, 'curtiu sua publicação')", 
            [colaborador_cpf, receiverCpf, checkin_id]
          );

          const [sender] = await pool.query("SELECT username FROM gym_users WHERE cpf = ?", [colaborador_cpf]);
          const senderUsername = sender.length > 0 ? `@${sender[0].username}` : 'Alguém';

          sendPushNotification(receiverCpf, `${senderUsername} curtiu sua publicação! ❤️`, "Toque para abrir a foto...");
        }
        
        const io = getIO();
        if (io) io.emit('gym:new_notification', { receiverCpf });
      }
    }

    const io = getIO();
    if (io) {
      io.emit('gym:new_like', { checkin_id, action, colaborador_cpf });
    }
    
    res.json({ success: true, action });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const toggleBanana = async (req, res) => {
  const { checkin_id } = req.body;
  const colaborador_cpf = req.user.cpf;
  if (!checkin_id) {
    return res.status(400).json({ error: "Dados inválidos." });
  }

  try {
    const [existing] = await pool.query(
      "SELECT id FROM gym_bananas WHERE checkin_id = ? AND colaborador_cpf = ?", 
      [checkin_id, colaborador_cpf]
    );
    let action = 'bananad';

    if (existing.length > 0) {
      await pool.query("DELETE FROM gym_bananas WHERE id = ?", [existing[0].id]);
      action = 'unbananad';
    } else {
      await pool.query("INSERT INTO gym_bananas (checkin_id, colaborador_cpf) VALUES (?, ?)", [checkin_id, colaborador_cpf]);
      
      const [postOwner] = await pool.query("SELECT colaborador_cpf FROM gym_checkins WHERE id = ?", [checkin_id]);
      
      if (postOwner.length > 0 && postOwner[0].colaborador_cpf !== colaborador_cpf) {
        const receiverCpf = postOwner[0].colaborador_cpf;
        const [existingNotif] = await pool.query(
          "SELECT id FROM gym_notifications WHERE receiver_cpf = ? AND type = 'BANANA' AND post_id = ? AND is_read = 0",
          [receiverCpf, checkin_id]
        );
        
        if (existingNotif.length > 0) {
          await pool.query("UPDATE gym_notifications SET group_count = group_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [existingNotif[0].id]);
        } else {
          await pool.query(
            "INSERT INTO gym_notifications (sender_cpf, receiver_cpf, type, post_id, content) VALUES (?, ?, 'BANANA', ?, 'deu uma banana 🍌 na sua publicação')", 
            [colaborador_cpf, receiverCpf, checkin_id]
          );

          const [sender] = await pool.query("SELECT username FROM gym_users WHERE cpf = ?", [colaborador_cpf]);
          const senderUsername = sender.length > 0 ? `@${sender[0].username}` : 'Alguém';

          sendPushNotification(receiverCpf, `${senderUsername} te deu uma banana! 🍌`, "Toque para abrir a publicação...");
        }
        
        const io = getIO();
        if (io) io.emit('gym:new_notification', { receiverCpf });
      }
    }
    
    const io = getIO();
    if (io) {
      io.emit('gym:new_banana', { checkin_id, action, colaborador_cpf });
    }
    
    res.json({ success: true, action });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao processar banana." });
  }
};

export const getPostInteractions = async (req, res) => {
  const { id } = req.params;
  const { type } = req.query; 

  try {
    let query = '';
    if (type === 'likes') {
      query = "SELECT u.cpf, u.nome, u.username, u.foto_perfil FROM gym_likes l JOIN gym_users u ON l.colaborador_id = u.cpf WHERE l.checkin_id = ?";
    } else {
      query = "SELECT u.cpf, u.nome, u.username, u.foto_perfil FROM gym_bananas b JOIN gym_users u ON b.colaborador_cpf = u.cpf WHERE b.checkin_id = ?";
    }
    const [users] = await pool.query(query, [id]);
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar interações." });
  }
};

export const postComment = async (req, res) => {
  const { checkin_id, texto, parent_id } = req.body;
  const colaborador_cpf = req.user.cpf;
  if (!checkin_id || !texto) {
    return res.status(400).json({ error: "Dados inválidos." });
  }

  try {
    const [result] = await pool.query(
      "INSERT INTO gym_comments (checkin_id, colaborador_id, texto, parent_id) VALUES (?, ?, ?, ?)", 
      [checkin_id, colaborador_cpf, texto, parent_id || null]
    );

    const [postInfo] = await pool.query("SELECT colaborador_cpf FROM gym_checkins WHERE id = ?", [checkin_id]);
    let receiverCpf = postInfo[0]?.colaborador_cpf;
    let notifType = 'COMMENT';
    let content = 'comentou na sua publicação';

    if (parent_id) {
       const [parentComment] = await pool.query("SELECT colaborador_id FROM gym_comments WHERE id = ?", [parent_id]);
       if (parentComment.length > 0) {
          receiverCpf = parentComment[0].colaborador_id;
          notifType = 'COMMENT_REPLY';
          content = 'respondeu ao seu comentário';
       }
    }

    if (receiverCpf && receiverCpf !== colaborador_cpf) {
         const [existingNotif] = await pool.query(
           "SELECT id FROM gym_notifications WHERE receiver_cpf = ? AND type = ? AND post_id = ? AND is_read = 0", 
           [receiverCpf, notifType, checkin_id]
         );
         
         if(existingNotif.length > 0) {
            await pool.query("UPDATE gym_notifications SET group_count = group_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [existingNotif[0].id]);
         } else {
            await pool.query(
              "INSERT INTO gym_notifications (sender_cpf, receiver_cpf, type, post_id, content) VALUES (?, ?, ?, ?, ?)", 
              [colaborador_cpf, receiverCpf, notifType, checkin_id, content]
            );

            const [sender] = await pool.query("SELECT username FROM gym_users WHERE cpf = ?", [colaborador_cpf]);
            const senderUsername = sender.length > 0 ? `@${sender[0].username}` : 'Alguém';

            sendPushNotification(receiverCpf, `${senderUsername} ${content}! 💬`, "Toque para ver e responder...");
         }
         
         const io = getIO();
         if(io) io.emit('gym:new_notification', { receiverCpf });
    }
    
    const io = getIO();
    if (io) {
      io.emit('gym:new_comment', { checkin_id, comment_id: result.insertId, parent_id: parent_id || null, colaborador_cpf });
    }
    
    res.status(201).json({ success: true, comment_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const getRankings = async (req, res) => {
  try {
    const baseQuery = `
      SELECT c.colaborador_cpf as colaborador_id, u.nome, u.username, u.foto_perfil, 
             COUNT(*) as total_checkins, COALESCE(SUM(c.pontos), 0) as total_pontos 
      FROM gym_checkins c 
      LEFT JOIN gym_users u ON c.colaborador_cpf = u.cpf 
      WHERE (c.imagem_valida IS NULL OR c.imagem_valida = 1) 
        AND c.is_checkin_valid = 1 
        AND u.must_change_password = 0
    `;

    const [topAnual] = await pool.query(`
      ${baseQuery} AND YEAR(c.created_at) = YEAR(CURRENT_DATE) 
      GROUP BY c.colaborador_cpf, u.nome, u.username, u.foto_perfil 
      ORDER BY total_pontos DESC LIMIT 3
    `);
    
    const [topMensalSP] = await pool.query(`
      ${baseQuery} AND MONTH(c.created_at) = MONTH(CURRENT_DATE) 
        AND YEAR(c.created_at) = YEAR(CURRENT_DATE) AND c.unidade = 'SP' 
      GROUP BY c.colaborador_cpf, u.nome, u.username, u.foto_perfil 
      ORDER BY total_pontos DESC LIMIT 3
    `);
    
    const [topMensalBH] = await pool.query(`
      ${baseQuery} AND MONTH(c.created_at) = MONTH(CURRENT_DATE) 
        AND YEAR(c.created_at) = YEAR(CURRENT_DATE) AND c.unidade = 'BH' 
      GROUP BY c.colaborador_cpf, u.nome, u.username, u.foto_perfil 
      ORDER BY total_pontos DESC LIMIT 3
    `);
    
    const [rankingGeral] = await pool.query(`
      SELECT c.colaborador_cpf as colaborador_id, u.nome, u.username, u.foto_perfil, 
             MAX(c.unidade) as unidade, COUNT(*) as total_checkins, 
             COALESCE(SUM(c.pontos), 0) as total_pontos, MAX(c.created_at) as ultimo_checkin 
      FROM gym_checkins c 
      LEFT JOIN gym_users u ON c.colaborador_cpf = u.cpf 
      WHERE MONTH(c.created_at) = MONTH(CURRENT_DATE) 
        AND YEAR(c.created_at) = YEAR(CURRENT_DATE) 
        AND (c.imagem_valida IS NULL OR c.imagem_valida = 1) 
        AND c.is_checkin_valid = 1 
        AND u.must_change_password = 0 
      GROUP BY c.colaborador_cpf, u.nome, u.username, u.foto_perfil 
      ORDER BY total_pontos DESC
    `);

    res.json({ topAnual, topMensalSP, topMensalBH, rankingGeral });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const getPendingModeration = async (req, res) => {
  try {
    const query = `
      SELECT c.id, c.colaborador_cpf, u.nome AS colaborador_nome, u.foto_perfil AS colaborador_foto, 
             c.foto_treino_url, c.latitude, c.longitude, c.imagem_valida, c.localizacao_valida, c.created_at 
      FROM gym_checkins c 
      INNER JOIN gym_users u ON c.colaborador_cpf = u.cpf 
      WHERE (c.imagem_valida IS NULL OR c.localizacao_valida IS NULL) 
        AND c.is_checkin_valid = 1 
        AND c.activity_type = 'PHOTO' 
      ORDER BY c.created_at ASC
    `;
    const [pending] = await pool.query(query);
    res.json(pending);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const moderateCheckin = async (req, res) => {
  const { id } = req.params;
  const { imagem_valida, localizacao_valida, gym_location_id } = req.body;

  try {
    let updateQuery = "UPDATE gym_checkins SET ";
    let queryParams = [];

    if (imagem_valida !== undefined) {
      updateQuery += "imagem_valida = ?, ";
      queryParams.push(imagem_valida);
    }
    if (localizacao_valida !== undefined) {
      updateQuery += "localizacao_valida = ?, ";
      queryParams.push(localizacao_valida);
    }
    if (gym_location_id !== undefined) {
      updateQuery += "gym_location_id = ?, ";
      queryParams.push(gym_location_id);
    }

    updateQuery = updateQuery.slice(0, -2) + " WHERE id = ?";
    queryParams.push(id);

    await pool.query(updateQuery, queryParams);

    const io = getIO();
    if (io) {
      io.emit('gym:ranking_updated');
    }
    res.json({ message: "Check-in moderado com sucesso." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const getGymLocations = async (req, res) => {
  try {
    const [locations] = await pool.query("SELECT * FROM gym_locations");
    res.json(locations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const addGymLocation = async (req, res) => {
  const { nome, unidade, latitude, longitude, raio_metros } = req.body;
  try {
    const [result] = await pool.query(
      "INSERT INTO gym_locations (nome, unidade, latitude, longitude, raio_metros) VALUES (?, ?, ?, ?, ?)", 
      [nome, unidade || 'SP', latitude, longitude, raio_metros || 100]
    );
    res.status(201).json({ message: "Localização cadastrada!", location_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const getGymUsers = async (req, res) => {
  try {
    const query = `
      SELECT cpf, nome, username, foto_perfil, is_blocked, must_change_password, created_at, 
             (strava_access_token IS NOT NULL) as has_strava 
      FROM gym_users ORDER BY nome ASC
    `;
    const [users] = await pool.query(query);
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const toggleBlockUser = async (req, res) => {
  const { cpf } = req.params;
  const { is_blocked } = req.body;
  try {
    await pool.query("UPDATE gym_users SET is_blocked = ? WHERE cpf = ?", [is_blocked, cpf]);
    res.json({ message: `Status de bloqueio alterado.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const resetPassword = async (req, res) => {
  const { cpf } = req.params;
  try {
    const [users] = await pool.query("SELECT nome FROM gym_users WHERE cpf = ?", [cpf]);
    if (users.length === 0) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }
    
    const firstName = users[0].nome.split(' ')[0].toLowerCase();
    const last5Cpf = String(cpf).slice(-5);
    const defaultPassword = `${firstName}${last5Cpf}`;
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(defaultPassword, salt);

    await pool.query(
      "UPDATE gym_users SET senha_hash = ?, must_change_password = 1 WHERE cpf = ?", 
      [hashed, cpf]
    );
    res.json({ message: "Senha redefinida com sucesso.", defaultPassword });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const addManualUser = async (req, res) => {
  const { cpf, nome } = req.body;
  if (!cpf || !nome) {
    return res.status(400).json({ error: "CPF e Nome são obrigatórios." });
  }
  
  try {
    const cleanCpf = String(cpf).replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      return res.status(400).json({ error: "CPF inválido." });
    }

    const [existing] = await pool.query("SELECT cpf FROM gym_users WHERE cpf = ?", [cleanCpf]);
    if (existing.length > 0) {
      return res.status(400).json({ error: "Este CPF já está cadastrado no sistema." });
    }

    const last5Cpf = cleanCpf.slice(-5);
    const defaultPassword = `atleta${last5Cpf}`;
    const username = generateUsername(nome, null, cleanCpf);
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(defaultPassword, salt);

    await pool.query(
      "INSERT INTO gym_users (cpf, nome, username, senha_hash, must_change_password) VALUES (?, 'Atleta Anônimo', ?, ?, 1)", 
      [cleanCpf, username, hashed]
    );
    res.status(201).json({ message: "Convidado adicionado com sucesso!", defaultPassword });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno ao adicionar usuário." });
  }
};

export const acceptTerms = async (req, res) => {
  const cpf = req.user.cpf;

  try {
    const cleanCpf = String(cpf).replace(/\D/g, '');
    await pool.query("UPDATE gym_users SET termos_aceitos = 1 WHERE cpf = ?", [cleanCpf]);
    res.json({ success: true, message: "Termos aceitos com sucesso." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao registrar o aceite dos termos." });
  }
};

export const getUserProfile = async (req, res) => {
  const identifier = req.params.cpf;
  const { type, page = 1, limit = 15 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  if (!identifier) {
    return res.status(400).json({ error: 'Identificador é obrigatório.' });
  }

  try {
    let userQuery = "";
    let queryParams = [];

    if (type === 'username') {
      userQuery = `
        SELECT cpf, nome, username, email, foto_perfil, bio, instagram, telefone, 
               departamento, contato_emergencia, two_factor_enabled, (strava_access_token IS NOT NULL) as has_strava 
        FROM gym_users WHERE username = ? AND must_change_password = 0
      `;
      queryParams = [identifier];
    } else {
      const cleanCpf = String(identifier).replace(/\D/g, '');
      userQuery = `
        SELECT cpf, nome, username, email, foto_perfil, bio, instagram, telefone, 
               departamento, contato_emergencia, two_factor_enabled, (strava_access_token IS NOT NULL) as has_strava 
        FROM gym_users WHERE cpf = ? AND must_change_password = 0
      `;
      queryParams = [cleanCpf];
    }

    const [users] = await pool.query(userQuery, queryParams);
    if (users.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado ou inativo.' });
    }

    const user = users[0];
    const userCpf = user.cpf;

    const postsQuery = `
      SELECT id, post_slug, foto_treino_url, created_at, pontos, activity_type, 
             run_distance_km, run_duration_seconds, run_polyline 
      FROM gym_checkins 
      WHERE colaborador_cpf = ? 
        AND (imagem_valida IS NULL OR imagem_valida = 1) 
        AND (arquivado IS NULL OR arquivado = 0) 
      ORDER BY created_at DESC LIMIT ? OFFSET ?
    `;

    const archivedQuery = `
      SELECT id, post_slug, foto_treino_url, created_at, pontos, arquivado, activity_type, 
             run_distance_km, run_duration_seconds, run_polyline 
      FROM gym_checkins 
      WHERE colaborador_cpf = ? 
        AND (imagem_valida IS NULL OR imagem_valida = 1) 
        AND arquivado = 1 
      ORDER BY created_at DESC LIMIT ? OFFSET ?
    `;

    if (Number(page) > 1) {
      const [posts] = await pool.query(postsQuery, [userCpf, Number(limit), Number(offset)]);
      const [archivedPosts] = await pool.query(archivedQuery, [userCpf, Number(limit), Number(offset)]);
      return res.json({ posts, archivedPosts });
    }

    const [ranking] = await pool.query(`
      SELECT colaborador_cpf, COALESCE(SUM(pontos), 0) as total_pontos 
      FROM gym_checkins 
      WHERE MONTH(created_at) = MONTH(CURRENT_DATE) 
        AND YEAR(created_at) = YEAR(CURRENT_DATE) 
        AND (imagem_valida IS NULL OR imagem_valida = 1) 
        AND is_checkin_valid = 1 
      GROUP BY colaborador_cpf ORDER BY total_pontos DESC
    `);

    let posicaoNum = ranking.findIndex(r => r.colaborador_cpf === userCpf) + 1;
    let posicaoStr = posicaoNum > 0 ? `${posicaoNum}º` : '-';

    const [allTimeStats] = await pool.query(
      "SELECT COUNT(*) as total_all_time FROM gym_checkins WHERE colaborador_cpf = ? AND (imagem_valida IS NULL OR imagem_valida = 1)", 
      [userCpf]
    );
    
    const totalCheckins = allTimeStats[0].total_all_time || 0;

    let classificacao = 'Iniciante';
    if (totalCheckins >= 30) classificacao = 'Diamante';
    else if (totalCheckins >= 20) classificacao = 'Platina';
    else if (totalCheckins >= 15) classificacao = 'Ouro';
    else if (totalCheckins >= 8) classificacao = 'Prata';
    else if (totalCheckins >= 4) classificacao = 'Bronze';

    const [posts] = await pool.query(postsQuery, [userCpf, Number(limit), Number(offset)]);
    const [archivedPosts] = await pool.query(archivedQuery, [userCpf, Number(limit), Number(offset)]);

    res.json({ 
      cpf: userCpf,
      nome: user.nome, 
      username: user.username, 
      email: user.email || '',
      foto_perfil: user.foto_perfil, 
      telefone: user.telefone || '', 
      departamento: user.departamento || '', 
      contato_emergencia: user.contato_emergencia || '', 
      has_strava: !!user.has_strava, 
      two_factor_enabled: !!user.two_factor_enabled,
      totalCheckins, 
      posicao: posicaoStr, 
      classificacao, 
      bio: user.bio || 'Focado nos treinos! 💪', 
      instagram: user.instagram || null, 
      posts, 
      archivedPosts 
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno ao buscar perfil." });
  }
};

export const getCommunity = async (req, res) => {
  try {
    const [users] = await pool.query(
      "SELECT cpf, nome, username, foto_perfil FROM gym_users WHERE is_blocked = 0 AND must_change_password = 0 ORDER BY nome ASC"
    );
    
    const [ranking] = await pool.query(`
      SELECT colaborador_cpf, COALESCE(SUM(pontos), 0) as total_pontos 
      FROM gym_checkins 
      WHERE MONTH(created_at) = MONTH(CURRENT_DATE) 
        AND YEAR(created_at) = YEAR(CURRENT_DATE) 
        AND (imagem_valida IS NULL OR imagem_valida = 1) 
        AND is_checkin_valid = 1 
      GROUP BY colaborador_cpf ORDER BY total_pontos DESC
    `);

    const community = users.map(user => {
      const rankIndex = ranking.findIndex(r => r.colaborador_cpf === user.cpf);
      const posicaoStr = rankIndex !== -1 ? `${rankIndex + 1}º` : '-';
      return { ...user, posicao: posicaoStr };
    });

    res.json(community);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno ao buscar a comunidade." });
  }
};

export const editUserProfile = async (req, res) => {
  const { nome, username, email, bio, instagram, telefone, departamento, contato_emergencia, remover_foto } = req.body;
  const cpf = req.user.cpf;

  const cleanCpf = String(cpf).replace(/\D/g, '');

  try {
    const [users] = await pool.query("SELECT * FROM gym_users WHERE cpf = ?", [cleanCpf]);
    if (users.length === 0) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }
    
    const user = users[0];

    if (username && username !== user.username) {
      const [existingUsername] = await pool.query("SELECT cpf FROM gym_users WHERE username = ?", [username]);
      if (existingUsername.length > 0) {
        return res.status(400).json({ error: "Este username já está em uso por outro atleta." });
      }
    }

    let updateQuery = "UPDATE gym_users SET nome = ?, username = ?, email = ?, bio = ?, instagram = ?, telefone = ?, departamento = ?, contato_emergencia = ?";
    let queryParams = [nome || user.nome, username || user.username, email || user.email, bio || null, instagram || null, telefone || null, departamento || null, contato_emergencia || null];

    let novaFotoUrl = user.foto_perfil;
    
    if (req.file) {
      novaFotoUrl = `/uploads/${req.file.filename}`;
      updateQuery += ", foto_perfil = ?";
      queryParams.push(novaFotoUrl);
    } else if (remover_foto === 'true') {
      novaFotoUrl = null;
      updateQuery += ", foto_perfil = NULL"; 
    }

    updateQuery += " WHERE cpf = ?";
    queryParams.push(cleanCpf);

    await pool.query(updateQuery, queryParams);

    const io = getIO();
    if (io) {
      io.emit('gym:profile_updated', { cpf: cleanCpf });
    }

    res.json({ message: "Perfil atualizado com sucesso!", nova_foto_url: novaFotoUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno ao atualizar perfil." });
  }
};

export const backfillUsernames = async (req, res) => {
  try {
    const [users] = await pool.query("SELECT cpf, nome, username FROM gym_users");
    let updatedCount = 0;

    for (const user of users) {
      const cleanCpf = String(user.cpf).replace(/\D/g, '');
      const newUsername = generateUsername(user.nome, null, cleanCpf);
      await pool.query("UPDATE gym_users SET username = ? WHERE cpf = ?", [newUsername, user.cpf]);
      updatedCount++;
    }
    res.json({ message: `Sucesso! ${updatedCount} usernames foram gerados/atualizados para o novo padrão em massa.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno ao atualizar usernames." });
  }
};

export const getPostById = async (req, res) => {
  const { id: slug } = req.params;
  const cpf = req.user?.cpf;

  try {
    const postQuery = `
      SELECT c.id, c.post_slug, c.colaborador_cpf, c.arquivado, c.academia_digitada as unidade, 
             c.foto_treino_url, c.mensagem, c.created_at, c.pontos, c.activity_type, 
             c.run_distance_km, c.run_duration_seconds, c.run_timestamp, c.strava_activity_id, 
             c.run_polyline, c.tagged_cpf, c.duo_status, 
             u.nome AS colaborador_nome, u.username AS colaborador_username, u.foto_perfil AS colaborador_foto, 
             t.nome AS tagged_nome, t.username AS tagged_username, t.foto_perfil AS tagged_foto, 
             (SELECT COUNT(*) FROM gym_likes WHERE checkin_id = c.id) AS likes_count, 
             (SELECT COUNT(*) FROM gym_comments WHERE checkin_id = c.id) AS comments_count, 
             (SELECT COUNT(*) FROM gym_bananas WHERE checkin_id = c.id) AS bananas_count 
      FROM gym_checkins c 
      LEFT JOIN gym_users u ON c.colaborador_cpf = u.cpf 
      LEFT JOIN gym_users t ON c.tagged_cpf = t.cpf 
      WHERE c.post_slug = ? AND (c.imagem_valida IS NULL OR c.imagem_valida = 1)
    `;
    const [posts] = await pool.query(postQuery, [slug]);

    if (posts.length === 0) {
      return res.status(404).json({ error: "Post não encontrado." });
    }

    const post = posts[0];
    post.likedByMe = false;
    post.bananadByMe = false;

    if (cpf) {
      const cleanCpf = String(cpf).replace(/\D/g, '');
      const [likes] = await pool.query("SELECT id FROM gym_likes WHERE checkin_id = ? AND colaborador_id = ?", [post.id, cleanCpf]);
      post.likedByMe = likes.length > 0;
      
      const [bananas] = await pool.query("SELECT id FROM gym_bananas WHERE checkin_id = ? AND colaborador_cpf = ?", [post.id, cleanCpf]);
      post.bananadByMe = bananas.length > 0;
    }

    const commentsQuery = `
      SELECT gc.id, gc.colaborador_id as colaborador_cpf, gc.texto, gc.created_at, gc.parent_id, 
             u.username, u.foto_perfil 
      FROM gym_comments gc 
      LEFT JOIN gym_users u ON gc.colaborador_id = u.cpf 
      WHERE gc.checkin_id = ? 
      ORDER BY gc.created_at ASC
    `;
    const [comments] = await pool.query(commentsQuery, [post.id]);

    res.json({ post, comments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno ao buscar post." });
  }
};

export const updatePost = async (req, res) => {
  const { id } = req.params; 
  const { mensagem, academia_digitada } = req.body;
  const colaborador_cpf = req.user.cpf;

  try {
    const cleanCpf = String(colaborador_cpf).replace(/\D/g, '');
    const [result] = await pool.query(
      "UPDATE gym_checkins SET mensagem = ?, academia_digitada = ?, unidade = ? WHERE id = ? AND colaborador_cpf = ?", 
      [mensagem || '', academia_digitada || 'Não informada', academia_digitada || 'Não informada', id, cleanCpf]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Post não encontrado ou você não tem permissão para editá-lo." });
    }

    const io = getIO();
    if (io) {
      io.emit('gym:new_post', { id: parseInt(id), colaborador_cpf: cleanCpf });
      io.emit('gym:profile_updated', { cpf: cleanCpf });
    }

    res.json({ message: "Post atualizado com sucesso." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno ao atualizar post." });
  }
};

export const archivePost = async (req, res) => {
  const { id } = req.params;
  const colaborador_cpf = req.user.cpf;

  try {
    const cleanCpf = String(colaborador_cpf).replace(/\D/g, '');
    const [result] = await pool.query(
      "UPDATE gym_checkins SET arquivado = 1 WHERE id = ? AND colaborador_cpf = ?", 
      [id, cleanCpf]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Post não encontrado ou você não tem permissão para arquivá-lo." });
    }

    const io = getIO();
    if (io) {
      io.emit('gym:new_post', { id: parseInt(id), colaborador_cpf: cleanCpf });
      io.emit('gym:profile_updated', { cpf: cleanCpf });
    }

    res.json({ message: "Post arquivado com sucesso." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno ao arquivar post." });
  }
};

export const unarchivePost = async (req, res) => {
  const { id } = req.params;
  const colaborador_cpf = req.user.cpf;

  try {
    const cleanCpf = String(colaborador_cpf).replace(/\D/g, '');
    const [result] = await pool.query(
      "UPDATE gym_checkins SET arquivado = 0 WHERE id = ? AND colaborador_cpf = ?", 
      [id, cleanCpf]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Post não encontrado." });
    }

    const io = getIO();
    if (io) {
      io.emit('gym:new_post', { id: parseInt(id), colaborador_cpf: cleanCpf });
      io.emit('gym:profile_updated', { cpf: cleanCpf });
    }

    res.json({ message: "Post desarquivado com sucesso." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao desarquivar post." });
  }
};

export const deleteComment = async (req, res) => {
  const { id } = req.params;
  const colaborador_cpf = req.user.cpf; 

  try {
    const cleanCpf = String(colaborador_cpf).replace(/\D/g, '');
    const [comments] = await pool.query(
      "SELECT c.id, c.checkin_id, c.colaborador_id, p.colaborador_cpf as post_owner FROM gym_comments c JOIN gym_checkins p ON c.checkin_id = p.id WHERE c.id = ?", 
      [id]
    );

    if (comments.length === 0) {
      return res.status(404).json({ error: "Comentário não encontrado." });
    }

    const comment = comments[0];

    if (comment.colaborador_id !== cleanCpf && comment.post_owner !== cleanCpf) {
      return res.status(403).json({ error: "Você não tem permissão para apagar este comentário." });
    }

    await pool.query("DELETE FROM gym_comments WHERE parent_id = ?", [id]);
    await pool.query("DELETE FROM gym_comments WHERE id = ?", [id]);

    const io = getIO();
    if (io) {
      io.emit('gym:new_comment', { checkin_id: comment.checkin_id, isDelete: true, comment_id: id, colaborador_cpf: cleanCpf });
    }

    res.json({ success: true, message: "Comentário apagado com sucesso." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno ao apagar comentário." });
  }
};