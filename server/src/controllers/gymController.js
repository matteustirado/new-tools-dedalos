import pool from '../config/db.js';
import { getIO } from '../socket.js';
import bcrypt from 'bcrypt';
import axios from 'axios';

const calcularDistanciaMetros = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const deltaP = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLon = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(deltaP / 2) * Math.sin(deltaP / 2) +
            Math.cos(p1) * Math.cos(p2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

const generateUsername = (fullName, rg, cpf) => {
  const firstName = fullName.split(' ')[0].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const finalDigits = rg ? String(rg).replace(/\D/g, '').slice(-2) : String(cpf).replace(/\D/g, '').slice(-2);
  
  return `${firstName}${finalDigits}`;
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
            "INSERT INTO gym_users (cpf, nome, username, senha_hash, foto_perfil) VALUES (?, ?, ?, ?, ?)",
            [cpf, 'Atleta Anônimo', username, hashed, emp.photo || null]
          );
          addedCount++;
        } catch (insertErr) {
          console.warn(`[GYM] Aviso ao inserir:`, insertErr.message);
        }
      }
    }

    if (res) {
      res.json({ message: `Sincronização concluída. ${addedCount} novos usuários cadastrados no PWA.` });
    }
  } catch (err) {
    console.error("[GYM] Erro na sincronização de usuários:", err);
    if (res) res.status(500).json({ error: "Erro interno na sincronização." });
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
  const { code, cpf } = req.body;

  if (!code || !cpf) {
    return res.status(400).json({ error: "Código ou CPF ausentes." });
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
      `UPDATE gym_users 
       SET strava_access_token = ?, strava_refresh_token = ?, strava_expires_at = ? 
       WHERE cpf = ?`,
      [access_token, refresh_token, expires_at, cleanCpf]
    );

    res.json({ success: true, message: "Strava conectado com sucesso!" });
  } catch (error) {
    console.error("[STRAVA OAUTH ERROR]", error.response?.data || error.message);
    res.status(500).json({ error: "Falha ao conectar com o Strava." });
  }
};

export const disconnectStrava = async (req, res) => {
  const { cpf } = req.body;

  if (!cpf) return res.status(400).json({ error: "CPF obrigatório." });

  try {
    const cleanCpf = String(cpf).replace(/\D/g, '');
    await pool.query(
      `UPDATE gym_users 
       SET strava_access_token = NULL, strava_refresh_token = NULL, strava_expires_at = NULL 
       WHERE cpf = ?`,
      [cleanCpf]
    );
    res.json({ success: true, message: "Strava desconectado." });
  } catch (err) {
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
      `UPDATE gym_users SET strava_access_token = ?, strava_refresh_token = ?, strava_expires_at = ? WHERE cpf = ?`,
      [access_token, refresh_token, expires_at, cpf]
    );

    return access_token;
  } catch (err) {
    console.error("[STRAVA REFRESH ERROR]", err.response?.data || err.message);
    return null;
  }
};

export const fetchAndSaveStravaRun = async (req, res) => {
  const { cpf } = req.body;
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

    const [existing] = await pool.query("SELECT id FROM gym_checkins WHERE strava_activity_id = ?", [String(activity.id)]);
    if (existing.length > 0) {
        return res.status(400).json({ error: "Você já postou essa corrida hoje!" });
    }

    res.json({ 
        message: "Corrida encontrada! Gerando card...",
        run: activity 
    });

  } catch (err) {
    console.error("[STRAVA FETCH ERROR]", err.response?.data || err.message);
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
    const [users] = await pool.query(
      `SELECT cpf, nome, username, foto_perfil 
       FROM gym_users 
       WHERE (nome LIKE ? OR username LIKE ?) AND is_blocked = 0 
       LIMIT 10`, 
      [searchTerm, searchTerm]
    );

    res.json(users);
  } catch (err) {
    console.error("[GYM SEARCH USERS]", err);
    res.status(500).json({ error: "Erro ao buscar usuários." });
  }
};

export const approveDuoPost = async (req, res) => {
  const { post_id, amigo_cpf } = req.body;

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
      "UPDATE gym_checkins SET duo_status = 'APPROVED', pontos = 2 WHERE id = ?",
      [post_id]
    );

    const [result] = await pool.query(
      `INSERT INTO gym_checkins 
       (colaborador_cpf, unidade, academia_digitada, foto_treino_url, mensagem, pontos, is_checkin_valid, activity_type, tagged_cpf, duo_status) 
       VALUES (?, ?, ?, ?, ?, 2, 1, 'PHOTO', ?, 'APPROVED')`,
      [cleanCpf, post[0].unidade, post[0].academia_digitada, post[0].foto_treino_url, "Treino em dupla!", post[0].colaborador_cpf]
    );

    const io = getIO();
    if (io) {
      io.emit('gym:ranking_updated');
    }

    res.json({ success: true, message: "Treino aprovado! Vocês ganharam +2 pontos! 🍌🍌" });
  } catch (err) {
    console.error("[GYM DUO APPROVE ERROR]", err);
    res.status(500).json({ error: "Erro interno ao aprovar treino." });
  }
};

export const rejectDuoPost = async (req, res) => {
  const { post_id, amigo_cpf } = req.body;

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
    console.error("[GYM DUO REJECT ERROR]", err);
    res.status(500).json({ error: "Erro interno ao recusar treino." });
  }
};

export const getPendingDuos = async (req, res) => {
  const { cpf } = req.params;
  const cleanCpf = String(cpf).replace(/\D/g, '');

  try {
    const [pending] = await pool.query(
      `SELECT c.id as post_id, c.foto_treino_url, c.created_at, 
              u.nome as amigo_nome, u.foto_perfil as amigo_foto
       FROM gym_checkins c
       JOIN gym_users u ON c.colaborador_cpf = u.cpf
       WHERE c.tagged_cpf = ? AND c.duo_status = 'PENDING'`,
      [cleanCpf]
    );

    res.json(pending);
  } catch (err) {
    console.error("[GYM PENDING DUOS]", err);
    res.status(500).json({ error: "Erro ao buscar convites pendentes." });
  }
};

export const postCheckin = async (req, res) => {
  const { 
    colaborador_cpf, academia_digitada, mensagem, latitude, longitude, is_real_time,
    is_run, strava_activity_id, run_distance_km, run_duration_seconds, run_timestamp, run_polyline,
    tagged_cpf
  } = req.body;
  
  const pontos = parseFloat(req.body.pontos) || 1;
  const foto_treino_url = req.file ? `/uploads/${req.file.filename}` : null;

  if (!colaborador_cpf) {
    return res.status(400).json({ error: "Colaborador é obrigatório." });
  }

  if (is_run !== 'true' && !foto_treino_url) {
      return res.status(400).json({ error: "A Foto é obrigatória." });
  }

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  let gym_location_id = null;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [user] = await connection.query("SELECT is_blocked FROM gym_users WHERE cpf = ?", [colaborador_cpf]);

    if (user.length === 0 || user[0].is_blocked) {
      await connection.rollback();
      return res.status(403).json({ error: "Acesso negado. Conta bloqueada ou inexistente." });
    }

    if (!isNaN(lat) && !isNaN(lng)) {
      const [locations] = await connection.query("SELECT * FROM gym_locations");
      for (const loc of locations) {
        const dist = calcularDistanciaMetros(lat, lng, loc.latitude, loc.longitude);
        if (dist <= loc.raio_metros) {
          gym_location_id = loc.id;
          break;
        }
      }
    }

    let is_checkin_valid = 0;
    const [validPostsToday] = await connection.query(
      "SELECT id FROM gym_checkins WHERE colaborador_cpf = ? AND DATE(created_at) = CURRENT_DATE() AND is_checkin_valid = 1",
      [colaborador_cpf]
    );
    
    if ((is_real_time === 'true' || is_real_time === true || is_run === 'true') && validPostsToday.length === 0) {
      is_checkin_valid = 1;
    }

    const duoStatus = tagged_cpf ? 'PENDING' : null;
    let result;

    if (is_run === 'true') {
        [result] = await connection.query(
          `INSERT INTO gym_checkins 
           (colaborador_cpf, unidade, academia_digitada, gym_location_id, foto_treino_url, mensagem, latitude, longitude, pontos, is_checkin_valid, activity_type, strava_activity_id, run_distance_km, run_duration_seconds, run_timestamp, run_polyline, tagged_cpf, duo_status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RUN', ?, ?, ?, ?, ?, ?, ?)`,
          [
            colaborador_cpf, 'SP', academia_digitada || 'Corrida Outdoor', gym_location_id, foto_treino_url, mensagem || '', 
            lat || null, lng || null, pontos, is_checkin_valid, 
            strava_activity_id, run_distance_km, run_duration_seconds, run_timestamp, run_polyline,
            tagged_cpf || null, duoStatus
          ]
        );
    } else {
        [result] = await connection.query(
          `INSERT INTO gym_checkins 
           (colaborador_cpf, unidade, academia_digitada, gym_location_id, foto_treino_url, mensagem, latitude, longitude, pontos, is_checkin_valid, activity_type, tagged_cpf, duo_status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PHOTO', ?, ?)`,
          [colaborador_cpf, 'SP', academia_digitada || 'Não informada', gym_location_id, foto_treino_url, mensagem || '', lat || null, lng || null, pontos, is_checkin_valid, tagged_cpf || null, duoStatus]
        );
    }

    await connection.commit();

    const io = getIO();
    if (io) {
      io.emit('gym:new_post', {
        id: result.insertId,
        colaborador_cpf,
        unidade: 'SP'
      });
      if (is_checkin_valid === 1) {
        io.emit('gym:ranking_updated');
      }
    }

    res.status(201).json({ message: "Check-in publicado com sucesso!", checkin_id: result.insertId });
  } catch (err) {
    await connection.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
       return res.status(400).json({ error: "Esta corrida já foi registrada no sistema!" });
    }
    console.error("[GYM] Erro ao salvar check-in:", err);
    res.status(500).json({ error: "Erro interno ao processar o check-in." });
  } finally {
    connection.release();
  }
};

export const getTodayActivity = async (req, res) => {
  const { cpf } = req.params;
  
  try {
    const cleanCpf = String(cpf).replace(/\D/g, '');
    const [posts] = await pool.query(
      `SELECT id, foto_treino_url, pontos, is_checkin_valid, created_at, activity_type, run_distance_km
       FROM gym_checkins
       WHERE colaborador_cpf = ? AND DATE(created_at) = CURRENT_DATE()
       ORDER BY created_at ASC`,
      [cleanCpf]
    );
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 👈 Lógica de Alternância (Toggle) do Check-in
export const selectCheckin = async (req, res) => {
  const { colaborador_cpf, post_id } = req.body;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const cleanCpf = String(colaborador_cpf).replace(/\D/g, '');

    const [currentPost] = await connection.query(
      "SELECT is_checkin_valid FROM gym_checkins WHERE id = ? AND colaborador_cpf = ?",
      [post_id, cleanCpf]
    );

    const isAlreadyChecked = currentPost.length > 0 && currentPost[0].is_checkin_valid === 1;

    await connection.query(
      `UPDATE gym_checkins SET is_checkin_valid = 0 
       WHERE colaborador_cpf = ? AND DATE(created_at) = CURRENT_DATE()`,
      [cleanCpf]
    );

    if (!isAlreadyChecked) {
      await connection.query(
        `UPDATE gym_checkins SET is_checkin_valid = 1 
         WHERE id = ? AND colaborador_cpf = ? AND DATE(created_at) = CURRENT_DATE()`,
        [post_id, cleanCpf]
      );
    }

    await connection.commit();

    const io = getIO();
    if (io) {
      io.emit('gym:ranking_updated');
    }

    res.json({ 
      success: true, 
      message: isAlreadyChecked ? "Check-in desmarcado." : "Check-in do dia atualizado!",
      isNowChecked: !isAlreadyChecked
    });
  } catch (err) {
    await connection.rollback();
    console.error("[GYM SELECT CHECKIN]", err);
    res.status(500).json({ error: "Erro ao alterar o check-in do dia." });
  } finally {
    connection.release();
  }
};

export const getFeed = async (req, res) => {
  const { page = 1, limit = 20, cpf } = req.query;
  const offset = (page - 1) * limit;
  const cleanCpf = cpf ? String(cpf).replace(/\D/g, '') : null;

  try {
    const query = `
      SELECT 
        c.id, c.colaborador_cpf, c.academia_digitada as unidade, c.foto_treino_url, c.mensagem, c.created_at, c.pontos,
        c.imagem_valida, c.localizacao_valida, c.is_checkin_valid, c.activity_type, c.run_distance_km, c.run_duration_seconds, c.run_polyline,
        c.tagged_cpf, c.duo_status,
        u.nome AS colaborador_nome, u.username AS colaborador_username, u.foto_perfil AS colaborador_foto,
        t.nome AS tagged_nome, t.username AS tagged_username, t.foto_perfil AS tagged_foto,
        l.nome AS academia_nome,
        (SELECT COUNT(*) FROM gym_likes WHERE checkin_id = c.id) AS likes_count,
        (SELECT COUNT(*) FROM gym_bananas WHERE checkin_id = c.id) AS bananas_count,
        (SELECT COUNT(*) FROM gym_comments WHERE checkin_id = c.id) AS comments_count
        ${cleanCpf ? `, EXISTS(SELECT 1 FROM gym_likes WHERE checkin_id = c.id AND colaborador_id = ?) AS likedByMe` : ''}
        ${cleanCpf ? `, EXISTS(SELECT 1 FROM gym_bananas WHERE checkin_id = c.id AND colaborador_cpf = ?) AS bananadByMe` : ''}
      FROM gym_checkins c
      LEFT JOIN gym_users u ON c.colaborador_cpf = u.cpf
      LEFT JOIN gym_users t ON c.tagged_cpf = t.cpf
      LEFT JOIN gym_locations l ON c.gym_location_id = l.id
      WHERE (c.imagem_valida IS NULL OR c.imagem_valida = 1) 
        AND (c.arquivado IS NULL OR c.arquivado = 0)
        AND (
          c.foto_treino_url IS NULL 
          OR c.id = (SELECT MIN(id) FROM gym_checkins c2 WHERE c2.foto_treino_url = c.foto_treino_url)
        )
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
    console.error("[GYM] Erro ao buscar feed:", err);
    res.status(500).json({ error: err.message });
  }
};

export const toggleLike = async (req, res) => {
  const { checkin_id, colaborador_cpf } = req.body;

  if (!checkin_id || !colaborador_cpf) {
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
      await pool.query(
        "INSERT INTO gym_likes (checkin_id, colaborador_id) VALUES (?, ?)",
        [checkin_id, colaborador_cpf]
      );
    }

    const io = getIO();

    if (io) {
      io.emit('gym:new_like', { checkin_id, action, colaborador_cpf });
    }

    res.json({ success: true, action });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const toggleBanana = async (req, res) => {
  const { checkin_id, colaborador_cpf } = req.body;

  if (!checkin_id || !colaborador_cpf) {
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
      await pool.query(
        "INSERT INTO gym_bananas (checkin_id, colaborador_cpf) VALUES (?, ?)",
        [checkin_id, colaborador_cpf]
      );
    }

    res.json({ success: true, action });
  } catch (err) {
    console.error("[GYM BANANA ERROR]", err);
    res.status(500).json({ error: "Erro ao processar banana." });
  }
};

export const getPostInteractions = async (req, res) => {
  const { id } = req.params;
  const { type } = req.query; 

  try {
    let query = '';
    
    if (type === 'likes') {
      query = `
        SELECT u.cpf, u.nome, u.username, u.foto_perfil 
        FROM gym_likes l
        JOIN gym_users u ON l.colaborador_id = u.cpf
        WHERE l.checkin_id = ?
      `;
    } else {
      query = `
        SELECT u.cpf, u.nome, u.username, u.foto_perfil 
        FROM gym_bananas b
        JOIN gym_users u ON b.colaborador_cpf = u.cpf
        WHERE b.checkin_id = ?
      `;
    }

    const [users] = await pool.query(query, [id]);
    res.json(users);
  } catch (err) {
    console.error("[GYM INTERACTIONS ERROR]", err);
    res.status(500).json({ error: "Erro ao buscar interações." });
  }
};

export const postComment = async (req, res) => {
  const { checkin_id, colaborador_cpf, texto, parent_id } = req.body;

  if (!checkin_id || !colaborador_cpf || !texto) {
    return res.status(400).json({ error: "Dados inválidos." });
  }

  try {
    const [result] = await pool.query(
      "INSERT INTO gym_comments (checkin_id, colaborador_id, texto, parent_id) VALUES (?, ?, ?, ?)",
      [checkin_id, colaborador_cpf, texto, parent_id || null]
    );

    const io = getIO();

    if (io) {
      io.emit('gym:new_comment', { checkin_id, comment_id: result.insertId, parent_id: parent_id || null });
    }

    res.status(201).json({ success: true, comment_id: result.insertId });
  } catch (err) {
    console.error("[GYM POST COMMENT ERROR]", err);
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
      WHERE (c.imagem_valida IS NULL OR c.imagem_valida = 1) AND c.is_checkin_valid = 1
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
      SELECT c.colaborador_cpf as colaborador_id, u.nome, u.username, u.foto_perfil, MAX(c.unidade) as unidade, 
             COUNT(*) as total_checkins, COALESCE(SUM(c.pontos), 0) as total_pontos, MAX(c.created_at) as ultimo_checkin
      FROM gym_checkins c
      LEFT JOIN gym_users u ON c.colaborador_cpf = u.cpf
      WHERE MONTH(c.created_at) = MONTH(CURRENT_DATE) AND YEAR(c.created_at) = YEAR(CURRENT_DATE) 
        AND (c.imagem_valida IS NULL OR c.imagem_valida = 1) AND c.is_checkin_valid = 1
      GROUP BY c.colaborador_cpf, u.nome, u.username, u.foto_perfil
      ORDER BY total_pontos DESC
    `);

    res.json({ topAnual, topMensalSP, topMensalBH, rankingGeral });
  } catch (err) {
    console.error("[GYM] Erro ao gerar rankings:", err);
    res.status(500).json({ error: err.message });
  }
};

export const getPendingModeration = async (req, res) => {
  try {
    const [pending] = await pool.query(`
      SELECT c.id, c.colaborador_cpf, u.nome AS colaborador_nome, u.foto_perfil AS colaborador_foto, 
             c.foto_treino_url, c.latitude, c.longitude, c.imagem_valida, c.localizacao_valida, c.created_at 
      FROM gym_checkins c
      INNER JOIN gym_users u ON c.colaborador_cpf = u.cpf
      WHERE (c.imagem_valida IS NULL OR c.localizacao_valida IS NULL) AND c.is_checkin_valid = 1 AND c.activity_type = 'PHOTO'
      ORDER BY c.created_at ASC
    `);

    res.json(pending);
  } catch (err) {
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
    res.status(500).json({ error: err.message });
  }
};

export const getGymLocations = async (req, res) => {
  try {
    const [locations] = await pool.query("SELECT * FROM gym_locations");

    res.json(locations);
  } catch (err) {
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
    res.status(500).json({ error: err.message });
  }
};

export const getGymUsers = async (req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT cpf, nome, username, foto_perfil, is_blocked, must_change_password, created_at, 
      (strava_access_token IS NOT NULL) as has_strava 
      FROM gym_users ORDER BY nome ASC`
    );

    res.json(users);
  } catch (err) {
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

    await pool.query("UPDATE gym_users SET senha_hash = ?, must_change_password = 1 WHERE cpf = ?", [hashed, cpf]);

    res.json({ message: "Senha redefinida com sucesso.", defaultPassword });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

    if (user.is_blocked) {
      return res.status(403).json({ error: "Acesso bloqueado. Procure o RH." });
    }

    const validPassword = await bcrypt.compare(senha, user.senha_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: "Senha incorreta." });
    }

    res.json({
      message: "Login efetuado com sucesso.",
      user: {
        cpf: user.cpf,
        nome: user.nome,
        username: user.username,
        foto_perfil: user.foto_perfil,
        must_change_password: user.must_change_password,
        has_strava: !!user.strava_access_token
      }
    });
  } catch (err) {
    console.error("[GYM LOGIN]", err);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
};

export const changeUserPassword = async (req, res) => {
  const { cpf, senha_atual, nova_senha } = req.body;

  if (!cpf || !senha_atual || !nova_senha) {
    return res.status(400).json({ error: "CPF, senha atual e nova senha são obrigatórios." });
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
    console.error("[GYM CHANGE PASSWORD]", err);
    res.status(500).json({ error: "Erro interno ao atualizar a senha." });
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

    const firstName = nome.split(' ')[0].toLowerCase();
    const last5Cpf = cleanCpf.slice(-5);
    const defaultPassword = `atleta${last5Cpf}`;
    const username = generateUsername(nome, null, cleanCpf);
    
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(defaultPassword, salt);

    await pool.query(
      "INSERT INTO gym_users (cpf, nome, username, senha_hash, must_change_password) VALUES (?, 'Atleta Anônimo', ?, ?, 1)",
      [cleanCpf, username, hashed]
    );

    res.status(201).json({
      message: "Convidado adicionado com sucesso!",
      defaultPassword
    });
  } catch (err) {
    console.error("[GYM ADD MANUAL USER]", err);
    res.status(500).json({ error: "Erro interno ao adicionar usuário." });
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
      userQuery = "SELECT cpf, nome, username, foto_perfil, bio, instagram, telefone, departamento, contato_emergencia, (strava_access_token IS NOT NULL) as has_strava FROM gym_users WHERE username = ?";
      queryParams = [identifier];
    } else {
      const cleanCpf = String(identifier).replace(/\D/g, '');
      userQuery = "SELECT cpf, nome, username, foto_perfil, bio, instagram, telefone, departamento, contato_emergencia, (strava_access_token IS NOT NULL) as has_strava FROM gym_users WHERE cpf = ?";
      queryParams = [cleanCpf];
    }

    const [users] = await pool.query(userQuery, queryParams);

    if (users.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const user = users[0];
    const userCpf = user.cpf;

    if (Number(page) > 1) {
      const [posts] = await pool.query(`
        SELECT id, foto_treino_url, created_at, pontos, activity_type, run_distance_km, run_duration_seconds, run_polyline 
        FROM gym_checkins 
        WHERE colaborador_cpf = ? 
          AND (imagem_valida IS NULL OR imagem_valida = 1) 
          AND (arquivado IS NULL OR arquivado = 0)
          AND (
            foto_treino_url IS NULL 
            OR id = (SELECT MIN(id) FROM gym_checkins c2 WHERE c2.foto_treino_url = gym_checkins.foto_treino_url)
          )
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `, [userCpf, Number(limit), Number(offset)]);

      const [archivedPosts] = await pool.query(`
        SELECT id, foto_treino_url, created_at, pontos, arquivado, activity_type, run_distance_km, run_polyline 
        FROM gym_checkins 
        WHERE colaborador_cpf = ? 
          AND (imagem_valida IS NULL OR imagem_valida = 1) 
          AND arquivado = 1
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `, [userCpf, Number(limit), Number(offset)]);

      return res.json({ posts, archivedPosts });
    }

    const [ranking] = await pool.query(`
      SELECT colaborador_cpf, COALESCE(SUM(pontos), 0) as total_pontos
      FROM gym_checkins
      WHERE MONTH(created_at) = MONTH(CURRENT_DATE) 
        AND YEAR(created_at) = YEAR(CURRENT_DATE)
        AND (imagem_valida IS NULL OR imagem_valida = 1) AND is_checkin_valid = 1
      GROUP BY colaborador_cpf
      ORDER BY total_pontos DESC
    `);

    let posicaoNum = ranking.findIndex(r => r.colaborador_cpf === userCpf) + 1;
    let posicaoStr = posicaoNum > 0 ? `${posicaoNum}º` : '-';

    const [allTimeStats] = await pool.query(`
      SELECT COUNT(*) as total_all_time
      FROM gym_checkins
      WHERE colaborador_cpf = ?
        AND (imagem_valida IS NULL OR imagem_valida = 1)
    `, [userCpf]);

    const totalCheckins = allTimeStats[0].total_all_time || 0;

    let classificacao = 'Iniciante';
    if (totalCheckins >= 30) classificacao = 'Diamante';
    else if (totalCheckins >= 20) classificacao = 'Platina';
    else if (totalCheckins >= 15) classificacao = 'Ouro';
    else if (totalCheckins >= 8) classificacao = 'Prata';
    else if (totalCheckins >= 4) classificacao = 'Bronze';

    const [posts] = await pool.query(`
      SELECT id, foto_treino_url, created_at, pontos, activity_type, run_distance_km, run_duration_seconds, run_polyline 
      FROM gym_checkins 
      WHERE colaborador_cpf = ? 
        AND (imagem_valida IS NULL OR imagem_valida = 1) 
        AND (arquivado IS NULL OR arquivado = 0)
        AND (
          foto_treino_url IS NULL 
          OR id = (SELECT MIN(id) FROM gym_checkins c2 WHERE c2.foto_treino_url = gym_checkins.foto_treino_url)
        )
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [userCpf, Number(limit), Number(offset)]);

    const [archivedPosts] = await pool.query(`
      SELECT id, foto_treino_url, created_at, pontos, arquivado, activity_type, run_distance_km, run_polyline 
      FROM gym_checkins 
      WHERE colaborador_cpf = ? 
        AND (imagem_valida IS NULL OR imagem_valida = 1) 
        AND arquivado = 1
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [userCpf, Number(limit), Number(offset)]);

    res.json({
      nome: user.nome,
      username: user.username,
      foto_perfil: user.foto_perfil,
      telefone: user.telefone || '', 
      departamento: user.departamento || '',
      contato_emergencia: user.contato_emergencia || '',
      has_strava: !!user.has_strava,
      totalCheckins,
      posicao: posicaoStr,
      classificacao,
      bio: user.bio || 'Focado nos treinos! 💪',
      instagram: user.instagram || null,
      posts,
      archivedPosts
    });

  } catch (err) {
    console.error("[GYM PROFILE ERROR]", err);
    res.status(500).json({ error: "Erro interno ao buscar perfil." });
  }
};

export const getCommunity = async (req, res) => {
  try {
    const [users] = await pool.query(
      "SELECT cpf, nome, username, foto_perfil FROM gym_users WHERE is_blocked = 0 ORDER BY nome ASC"
    );

    const [ranking] = await pool.query(`
      SELECT colaborador_cpf, COALESCE(SUM(pontos), 0) as total_pontos
      FROM gym_checkins
      WHERE MONTH(created_at) = MONTH(CURRENT_DATE) 
        AND YEAR(created_at) = YEAR(CURRENT_DATE)
        AND (imagem_valida IS NULL OR imagem_valida = 1) AND is_checkin_valid = 1
      GROUP BY colaborador_cpf
      ORDER BY total_pontos DESC
    `);

    const community = users.map(user => {
      const rankIndex = ranking.findIndex(r => r.colaborador_cpf === user.cpf);
      const posicaoStr = rankIndex !== -1 ? `${rankIndex + 1}º` : '-';
      
      return {
        ...user,
        posicao: posicaoStr
      };
    });

    res.json(community);
  } catch (err) {
    console.error("[GYM COMMUNITY ERROR]", err);
    res.status(500).json({ error: "Erro interno ao buscar a comunidade." });
  }
};

export const editUserProfile = async (req, res) => {
  const { cpf, nome, username, bio, instagram, telefone, departamento, contato_emergencia, senha_atual, nova_senha, remover_foto } = req.body;
  
  if (!cpf) {
    return res.status(400).json({ error: "CPF é obrigatório para atualização." });
  }

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

    let updateQuery = "UPDATE gym_users SET nome = ?, username = ?, bio = ?, instagram = ?, telefone = ?, departamento = ?, contato_emergencia = ?";
    let queryParams = [
      nome || user.nome,
      username || user.username,
      bio || null,
      instagram || null,
      telefone || null,
      departamento || null,
      contato_emergencia || null
    ];

    let novaFotoUrl = user.foto_perfil;
    
    if (req.file) {
      novaFotoUrl = `/uploads/${req.file.filename}`;
      updateQuery += ", foto_perfil = ?";
      queryParams.push(novaFotoUrl);
    } else if (remover_foto === 'true') {
      novaFotoUrl = null;
      updateQuery += ", foto_perfil = NULL"; 
    }

    if (nova_senha && nova_senha.trim() !== '') {
      if (!senha_atual) {
        return res.status(400).json({ error: "A senha atual é obrigatória para definir uma nova senha." });
      }
      
      const validPassword = await bcrypt.compare(senha_atual, user.senha_hash);
      
      if (!validPassword) {
        return res.status(401).json({ error: "A senha atual está incorreta." });
      }

      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(nova_senha, salt);
      updateQuery += ", senha_hash = ?, must_change_password = 0";
      queryParams.push(hashed);
    }

    updateQuery += " WHERE cpf = ?";
    queryParams.push(cleanCpf);

    await pool.query(updateQuery, queryParams);

    res.json({ message: "Perfil atualizado com sucesso!", nova_foto_url: novaFotoUrl });
  } catch (err) {
    console.error("[GYM EDIT PROFILE]", err);
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
    console.error("[GYM BACKFILL USERS]", err);
    res.status(500).json({ error: "Erro interno ao atualizar usernames." });
  }
};

export const getPostById = async (req, res) => {
  const { id } = req.params;
  const { cpf } = req.query;

  try {
    const postQuery = `
      SELECT 
        c.id, c.colaborador_cpf, c.arquivado, c.academia_digitada as unidade, c.foto_treino_url, c.mensagem, c.created_at, c.pontos,
        c.activity_type, c.run_distance_km, c.run_duration_seconds, c.run_timestamp, c.strava_activity_id, c.run_polyline,
        c.tagged_cpf, c.duo_status,
        u.nome AS colaborador_nome, u.username AS colaborador_username, u.foto_perfil AS colaborador_foto,
        t.nome AS tagged_nome, t.username AS tagged_username, t.foto_perfil AS tagged_foto,
        (SELECT COUNT(*) FROM gym_likes WHERE checkin_id = c.id) AS likes_count,
        (SELECT COUNT(*) FROM gym_comments WHERE checkin_id = c.id) AS comments_count,
        (SELECT COUNT(*) FROM gym_bananas WHERE checkin_id = c.id) AS bananas_count
      FROM gym_checkins c
      LEFT JOIN gym_users u ON c.colaborador_cpf = u.cpf
      LEFT JOIN gym_users t ON c.tagged_cpf = t.cpf
      WHERE c.id = ? AND (c.imagem_valida IS NULL OR c.imagem_valida = 1)
    `;
    const [posts] = await pool.query(postQuery, [id]);

    if (posts.length === 0) {
      return res.status(404).json({ error: "Post não encontrado." });
    }

    const post = posts[0];
    post.likedByMe = false;
    post.bananadByMe = false;

    if (cpf) {
      const cleanCpf = String(cpf).replace(/\D/g, '');
      const [likes] = await pool.query("SELECT id FROM gym_likes WHERE checkin_id = ? AND colaborador_id = ?", [id, cleanCpf]);
      post.likedByMe = likes.length > 0;
      
      const [bananas] = await pool.query("SELECT id FROM gym_bananas WHERE checkin_id = ? AND colaborador_cpf = ?", [id, cleanCpf]);
      post.bananadByMe = bananas.length > 0;
    }

    const commentsQuery = `
      SELECT 
        gc.id, gc.colaborador_id as colaborador_cpf, gc.texto, gc.created_at, gc.parent_id,
        u.username, u.foto_perfil
      FROM gym_comments gc
      LEFT JOIN gym_users u ON gc.colaborador_id = u.cpf
      WHERE gc.checkin_id = ?
      ORDER BY gc.created_at ASC
    `;
    const [comments] = await pool.query(commentsQuery, [id]);

    res.json({ post, comments });
  } catch (err) {
    console.error("[GYM POST GET]", err);
    res.status(500).json({ error: "Erro interno ao buscar post." });
  }
};

export const updatePost = async (req, res) => {
  const { id } = req.params;
  const { colaborador_cpf, mensagem, academia_digitada } = req.body;

  if (!colaborador_cpf) {
    return res.status(400).json({ error: "CPF é obrigatório." });
  }

  try {
    const cleanCpf = String(colaborador_cpf).replace(/\D/g, '');
    
    const [result] = await pool.query(
      "UPDATE gym_checkins SET mensagem = ?, academia_digitada = ?, unidade = ? WHERE id = ? AND colaborador_cpf = ?",
      [mensagem || '', academia_digitada || 'Não informada', academia_digitada || 'Não informada', id, cleanCpf]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Post não encontrado ou você não tem permissão para editá-lo." });
    }

    res.json({ message: "Post atualizado com sucesso." });
  } catch (err) {
    console.error("[GYM UPDATE POST]", err);
    res.status(500).json({ error: "Erro interno ao atualizar post." });
  }
};

export const archivePost = async (req, res) => {
  const { id } = req.params;
  const { colaborador_cpf } = req.body;

  if (!colaborador_cpf) {
    return res.status(400).json({ error: "CPF é obrigatório." });
  }

  try {
    const cleanCpf = String(colaborador_cpf).replace(/\D/g, '');
    
    const [result] = await pool.query(
      "UPDATE gym_checkins SET arquivado = 1 WHERE id = ? AND colaborador_cpf = ?",
      [id, cleanCpf]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Post não encontrado ou você não tem permissão para arquivá-lo." });
    }

    res.json({ message: "Post arquivado com sucesso." });
  } catch (err) {
    console.error("[GYM ARCHIVE POST]", err);
    res.status(500).json({ error: "Erro interno ao arquivar post." });
  }
};

export const unarchivePost = async (req, res) => {
  const { id } = req.params;
  const { colaborador_cpf } = req.body;

  if (!colaborador_cpf) {
    return res.status(400).json({ error: "CPF é obrigatório." });
  }

  try {
    const cleanCpf = String(colaborador_cpf).replace(/\D/g, '');
    
    const [result] = await pool.query(
      "UPDATE gym_checkins SET arquivado = 0 WHERE id = ? AND colaborador_cpf = ?",
      [id, cleanCpf]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Post não encontrado." });
    }

    res.json({ message: "Post desarquivado com sucesso." });
  } catch (err) {
    console.error("[GYM UNARCHIVE POST]", err);
    res.status(500).json({ error: "Erro ao desarquivar post." });
  }
};

export const deleteComment = async (req, res) => {
  const { id } = req.params;
  const { colaborador_cpf } = req.body; 

  if (!colaborador_cpf) {
    return res.status(400).json({ error: "CPF é obrigatório." });
  }

  try {
    const cleanCpf = String(colaborador_cpf).replace(/\D/g, '');

    const [comments] = await pool.query(`
      SELECT c.id, c.colaborador_id, p.colaborador_cpf as post_owner
      FROM gym_comments c
      JOIN gym_checkins p ON c.checkin_id = p.id
      WHERE c.id = ?
    `, [id]);

    if (comments.length === 0) {
      return res.status(404).json({ error: "Comentário não encontrado." });
    }

    const comment = comments[0];

    if (comment.colaborador_id !== cleanCpf && comment.post_owner !== cleanCpf) {
      return res.status(403).json({ error: "Você não tem permissão para apagar este comentário." });
    }

    await pool.query("DELETE FROM gym_comments WHERE parent_id = ?", [id]);
    await pool.query("DELETE FROM gym_comments WHERE id = ?", [id]);

    res.json({ success: true, message: "Comentário apagado com sucesso." });
  } catch (err) {
    console.error("[GYM DELETE COMMENT ERROR]", err);
    res.status(500).json({ error: "Erro interno ao apagar comentário." });
  }
};