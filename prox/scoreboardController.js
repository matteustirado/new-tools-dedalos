import pool from '../config/db.js';
import { getIO } from '../socket.js';
import { io as ioClient } from 'socket.io-client';
import axios from 'axios';

const CHECKIN_INTERVAL = 30000;
const SYNC_INTERVAL = 60000;

const EXTERNAL_SOCKETS = {
  SP: 'https://placar-80b3f72889ba.herokuapp.com/',
  BH: 'https://placarbh-cf51a4a5b78a.herokuapp.com/',
};

let lastCheckinCount = { SP: null, BH: null };
let isFetchingCrowd = { SP: false, BH: false };

const log = (tag, msg, data = null) => {
  const time = new Date().toISOString().split('T')[1].slice(0, 8);
  const dataStr = data ? ` | DADOS: ${JSON.stringify(data).substring(0, 200)}...` : '';
  console.log(`[📊 PLACAR ${time}] [${tag}] ${msg}${dataStr}`);
};

const getApiConfig = (unidadeUpper) => {
  if (unidadeUpper === 'SP') {
    return {
      url: process.env.VITE_API_URL_SP || process.env.API_URL_SP || 'https://dedalosadm2-3dab78314381.herokuapp.com',
      token: process.env.VITE_API_TOKEN_SP || process.env.API_TOKEN_SP || '7a9e64071564f6fee8d96cd209ed3a4e86801552'
    };
  }
  
  if (unidadeUpper === 'BH') {
    return {
      url: process.env.VITE_API_URL_BH || process.env.API_URL_BH || 'https://dedalosadm2bh-09d55dca461e.herokuapp.com',
      token: process.env.VITE_API_TOKEN_BH || process.env.API_TOKEN_BH || '919d97d7df39ecbd0036631caba657221acab99d'
    };
  }
  
  return null;
};

const getHeaders = (token, baseUrl) => {
  const cleanUrl = baseUrl.replace(/\/$/, '');
  
  return {
    'Authorization': `Token ${token}`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Origin': cleanUrl,
    'Referer': `${cleanUrl}/`,
    'Cookie': `dedalos_app.token=${token}; dedalos_app.id_user=1; dedalos_app.refresh_token=${token}`
  };
};

const extractRealBracelet = (clientObj) => {
  if (!clientObj) return null;
  
  const isValidPulseira = (val) => val && String(val).trim().match(/^\d{5,12}$/);
  const possibleKeys = ['codigo', 'cartao', 'rfid', 'codigo_barras', 'serial', 'num_pulseira', 'pulseira', 'id'];

  for (const key of possibleKeys) {
    if (isValidPulseira(clientObj[key])) return String(clientObj[key]).trim();
  }

  for (const key in clientObj) {
    if (isValidPulseira(clientObj[key])) return String(clientObj[key]).trim();
  }

  return null;
};

const fetchFromDedalos = async (unidade) => {
  const unidadeUpper = unidade.toUpperCase();
  const config = getApiConfig(unidadeUpper);

  if (!config || !config.url) {
    log('PROXY_ERR', `[${unidadeUpper}] Configuração de URL/Token não encontrada.`);
    return null;
  }

  try {
    const baseUrl = config.url.replace(/\/$/, '');
    let endpoint = `${baseUrl}/api/contador/`;
    let response;

    try {
      response = await axios.get(endpoint, { headers: getHeaders(config.token, config.url), timeout: 15000 });
    } catch (err) {
      log('PROXY_WARN', `[${unidadeUpper}] Falha no endpoint principal (${err.message}). Tentando fallback...`);
      const dataHoje = new Date().toISOString().split('T')[0];
      endpoint = `${baseUrl}/api/entradasPorData/${dataHoje}`;
      response = await axios.get(endpoint, { headers: getHeaders(config.token, config.url), timeout: 15000 });
    }

    const data = response.data;
    
    if (Array.isArray(data)) {
      if (data.length > 0 && data[0].contador !== undefined) return data[0].contador;
      return data.length;
    }
    
    if (data.results) return data.results.length;
    if (data.contador !== undefined) return data.contador;
    if (data.count !== undefined) return data.count;
    
    return 0;
  } catch (error) {
    log('PROXY_ERR', `[${unidadeUpper}] Falha total na comunicação com API Mãe: ${error.message}`);
    return null;
  }
};

const fetchLatestCheckin = async (unidadeUpper) => {
  const config = getApiConfig(unidadeUpper);
  if (!config || !config.url) return null;

  try {
    const baseUrl = config.url.replace(/\/$/, '');
    const response = await axios.get(`${baseUrl}/api/entradasCheckout/`, {
      headers: getHeaders(config.token, config.url),
      timeout: 5000,
    });
    
    const data = response.data;
    if (Array.isArray(data) && data.length > 0) {
      return data.sort((a, b) => parseInt(b.id || 0) - parseInt(a.id || 0))[0];
    }
  } catch (e) {}
  
  return null;
};

const fetchExternalClientByPulseira = async (unidadeUpper, pulseira) => {
  const config = getApiConfig(unidadeUpper);
  if (!config || !config.url || !pulseira) return null;

  try {
    const baseUrl = config.url.replace(/\/$/, '');
    const response = await axios.get(`${baseUrl}/api/entradasOne/${pulseira}/`, {
      headers: getHeaders(config.token, config.url),
      timeout: 5000,
    });
    return response.data;
  } catch (err) {
    return null;
  }
};

const fetchCurrentVotes = async (unidadeUpper) => {
  const sql = `
    SELECT option_index, COUNT(*) as count 
    FROM scoreboard_votes 
    WHERE unidade = ? AND status = 'DENTRO' AND option_index IS NOT NULL AND (expires_at IS NULL OR expires_at > NOW())
    GROUP BY option_index
  `;
  const [rows] = await pool.query(sql, [unidadeUpper]);
  return rows;
};

const iniciarSincronizacaoCheckout = () => {
  setInterval(async () => {
    for (const unidade of ['SP', 'BH']) {
      const unidadeUpper = unidade.toUpperCase();
      const config = getApiConfig(unidadeUpper);

      if (!config || !config.url) continue;

      try {
        const baseUrl = config.url.replace(/\/$/, '');
        const response = await axios.get(`${baseUrl}/api/entradasCheckout/`, {
          headers: getHeaders(config.token, config.url),
          timeout: 10000,
        });

        const data = response.data;
        if (!Array.isArray(data)) continue;

        const activeIdsSet = new Set();
        data.forEach((c) => {
          if (c.armario) activeIdsSet.add(String(c.armario).trim());
          if (c.pulseira) activeIdsSet.add(String(c.pulseira).trim());
          if (c.id) activeIdsSet.add(String(c.id).trim());
        });

        const activeSystemIds = Array.from(activeIdsSet).filter(id => id && id !== 'undefined' && id !== 'null');
        let rowsAffected = 0;

        if (activeSystemIds.length > 0) {
          const placeholders = activeSystemIds.map(() => '?').join(',');
          const sqlUpdate = `UPDATE scoreboard_votes SET status = 'SAIU' WHERE unidade = ? AND status = 'DENTRO' AND cliente_id IS NOT NULL AND cliente_id NOT IN (${placeholders})`;
          const [result] = await pool.query(sqlUpdate, [unidadeUpper, ...activeSystemIds]);
          rowsAffected = result.affectedRows;
        } else if (data.length === 0) {
          const [result] = await pool.query(
            `UPDATE scoreboard_votes SET status = 'SAIU' WHERE unidade = ? AND status = 'DENTRO' AND cliente_id IS NOT NULL`,
            [unidadeUpper]
          );
          rowsAffected = result.affectedRows;
        }

        if (rowsAffected > 0) {
          getIO().emit('scoreboard:vote_updated', {
            unidade: unidadeUpper,
            votes: await fetchCurrentVotes(unidadeUpper),
          });
        }

        if (data.length > 0) {
          const connection = await pool.getConnection();
          try {
            for (const c of data) {
              const arm = c.armario ? String(c.armario).trim() : null;
              const realPulseira = extractRealBracelet(c);
              const nm = c.nome || c.cliente_nome || c.name || null;

              if (nm && (arm || realPulseira)) {
                await connection.query(
                  `UPDATE scoreboard_votes 
                   SET cliente_nome = ?, cliente_pulseira = COALESCE(?, cliente_pulseira) 
                   WHERE unidade = ? AND status = 'DENTRO' AND (cliente_id = ? OR cliente_id = ?) AND (cliente_nome IS NULL OR cliente_pulseira IS NULL)`,
                  [nm, realPulseira, unidadeUpper, arm, c.id || c.pulseira]
                );
              }
            }
          } catch (e) {
          } finally {
            connection.release();
          }
        }
      } catch (error) {}
    }
  }, SYNC_INTERVAL);
};

const iniciarPonteRealTime = () => {
  Object.entries(EXTERNAL_SOCKETS).forEach(([unidade, url]) => {
    try {
      const socket = ioClient(url, { transports: ['websocket', 'polling'] });
      socket.on('disconnect', () => {});

      socket.on('new_id', async (data) => {
        const unidadeUpper = unidade.toUpperCase();
        let armario = data?.armario ? String(data.armario).trim() : null;
        let realPulseira = extractRealBracelet(data);
        let clienteNome = data?.nome || data?.cliente_nome || data?.name || null;

        if (!realPulseira && !armario) {
          const latest = await fetchLatestCheckin(unidadeUpper);
          if (latest) {
            armario = latest.armario ? String(latest.armario).trim() : armario;
            realPulseira = extractRealBracelet(latest) || realPulseira;
            clienteNome = latest.nome || latest.cliente_nome || latest.name || clienteNome;
          }
        }

        const systemId = armario || String(data?.id) || String(Date.now());

        try {
          await pool.query(
            `INSERT INTO scoreboard_votes (unidade, cliente_id, cliente_pulseira, cliente_nome, option_index, status) VALUES (?, ?, ?, ?, NULL, "DENTRO")`,
            [unidadeUpper, systemId, realPulseira, clienteNome]
          );
        } catch (e) {}

        const totalAtual = await fetchFromDedalos(unidade);
        if (totalAtual !== null) {
          lastCheckinCount[unidadeUpper] = totalAtual;
          getIO().emit('checkin:novo', {
            unidade: unidadeUpper,
            total: totalAtual,
            cliente_id: systemId,
            origem: 'websocket_externo',
            timestamp: new Date(),
          });
        }
      });
    } catch (error) {}
  });
};

const iniciarSentinela = () => {
  setInterval(async () => {
    for (const unidade of ['SP', 'BH']) {
      const totalAtual = await fetchFromDedalos(unidade);
      if (totalAtual !== null) {
        if (lastCheckinCount[unidade] !== totalAtual) {
          getIO().emit('checkin:novo', {
            unidade: unidade,
            total: totalAtual,
            origem: 'sentinela_http',
            timestamp: new Date(),
          });
          lastCheckinCount[unidade] = totalAtual;
        }
      }
    }
  }, CHECKIN_INTERVAL);
};

iniciarPonteRealTime();
iniciarSentinela();
iniciarSincronizacaoCheckout();

export const executarMarcoZero = async (req, res) => {
  try {
    await pool.query('TRUNCATE TABLE scoreboard_votes');
    let relatorio = {};

    for (const unidade of ['SP', 'BH']) {
      const config = getApiConfig(unidade);
      if (!config || !config.url) continue;

      try {
        const baseUrl = config.url.replace(/\/$/, '');
        const response = await axios.get(`${baseUrl}/api/entradasCheckout/`, {
          headers: getHeaders(config.token, config.url),
          timeout: 10000,
        });

        if (Array.isArray(response.data)) {
          const activeData = response.data.filter((c) => c.armario || c.pulseira);
          if (activeData.length > 0) {
            for (const c of activeData) {
              const armario = c.armario ? String(c.armario).trim() : null;
              const realPulseira = extractRealBracelet(c);
              const nome = c.nome || c.cliente_nome || c.name || null;
              const systemId = armario || String(c.id || Date.now());

              await pool.query(
                `INSERT INTO scoreboard_votes (unidade, cliente_id, cliente_pulseira, cliente_nome, option_index, status) VALUES (?, ?, ?, ?, NULL, "DENTRO")`,
                [unidade, systemId, realPulseira, nome]
              );
            }
          }
          relatorio[unidade] = `${activeData.length} clientes inseridos.`;
        }
      } catch (e) {
        relatorio[unidade] = `Erro: ${e.message}`;
      }
    }

    getIO().emit('scoreboard:vote_updated', { unidade: 'SP', votes: [] });
    getIO().emit('scoreboard:vote_updated', { unidade: 'BH', votes: [] });
    
    res.json({ message: 'Marco Zero executado!', detalhes: relatorio });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getCrowdCount = async (req, res) => {
  const { unidade } = req.params;
  const unidadeUpper = unidade.toUpperCase();

  if (lastCheckinCount[unidadeUpper] !== null) {
    return res.status(200).json({ count: lastCheckinCount[unidadeUpper] });
  }

  if (!isFetchingCrowd[unidadeUpper]) {
    isFetchingCrowd[unidadeUpper] = true;
    log('API', `Cache vazio para ${unidadeUpper}. Iniciando procura em background...`);
    
    fetchFromDedalos(unidadeUpper).then(count => {
      if (count !== null) {
          lastCheckinCount[unidadeUpper] = count;
          log('API_SUCCESS', `[${unidadeUpper}] Sucesso! Cache preenchido com: ${count} pessoas.`);
      }
      isFetchingCrowd[unidadeUpper] = false;
    }).catch(() => {
      isFetchingCrowd[unidadeUpper] = false;
    });
  }

  return res.status(200).json({ count: 0 });
};

export const testarTrigger = async (req, res) => {
  const { unidade } = req.params;
  const unidadeUpper = unidade ? unidade.toUpperCase() : 'SP';
  const fakeId = 'TESTE-' + Math.floor(Math.random() * 1000);
  
  try {
    await pool.query(
      `INSERT INTO scoreboard_votes (unidade, cliente_id, cliente_pulseira, option_index, status, expires_at) VALUES (?, ?, NULL, NULL, "DENTRO", DATE_ADD(NOW(), INTERVAL 30 MINUTE))`,
      [unidadeUpper, fakeId]
    );
    
    getIO().emit('checkin:novo', {
      unidade: unidadeUpper,
      total: 999,
      novos: 1,
      cliente_id: fakeId,
      timestamp: new Date(),
    });
    
    res.status(200).json({ message: `Teste enviado` });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno.' });
  }
};

export const getActiveConfig = async (req, res) => {
  const { unidade } = req.params;
  
  try {
    const [rows] = await pool.query('SELECT * FROM scoreboard_active WHERE unidade = ?', [
      unidade.toUpperCase(),
    ]);
    
    if (rows.length === 0) return res.status(404).json({ error: 'Não encontrada.' });
    
    const config = rows[0];
    if (typeof config.opcoes === 'string') config.opcoes = JSON.parse(config.opcoes);
    
    res.status(200).json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateActiveConfig = async (req, res) => {
  const { unidade, titulo, layout, opcoes, status } = req.body;
  
  if (!unidade || !titulo || !opcoes) {
    return res.status(400).json({ error: 'Dados incompletos.' });
  }

  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    const opcoesString = JSON.stringify(opcoes);
    const unidadeUpper = unidade.toUpperCase();

    await connection.query(
      `INSERT INTO scoreboard_active (unidade, titulo, layout, opcoes, status) VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE titulo = VALUES(titulo), layout = VALUES(layout), opcoes = VALUES(opcoes), status = VALUES(status)`,
      [unidadeUpper, titulo, layout, opcoesString, status]
    );
    
    await connection.query(
      `UPDATE scoreboard_votes SET status = 'SAIU' WHERE unidade = ? AND status = 'DENTRO'`,
      [unidadeUpper]
    );
    
    await connection.commit();

    getIO().emit('scoreboard:config_updated', { unidade: unidadeUpper });
    getIO().emit('scoreboard:vote_updated', { unidade: unidadeUpper, votes: [] });
    
    res.status(200).json({ message: 'Placar atualizado!' });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
};

export const castVote = async (req, res) => {
  const { unidade, optionIndex, cliente_id } = req.body;
  if (!unidade || optionIndex === undefined) return res.status(400).json({ error: 'Voto inválido.' });

  try {
    const unidadeUpper = unidade.toUpperCase();

    if (cliente_id) {
      const typedString = String(cliente_id).trim();

      let fetchedArmario = null;
      let fetchedNome = null;
      let finalPulseiraToSave = null;

      const clientData = await fetchExternalClientByPulseira(unidadeUpper, typedString);

      if (clientData) {
        fetchedArmario = clientData.armario ? String(clientData.armario).trim() : null;
        fetchedNome = clientData.nome || clientData.cliente_nome || clientData.name || null;
        finalPulseiraToSave = extractRealBracelet(clientData);
      }

      const isPulseiraValida = typedString.match(/^\d{5,12}$/);
      const pulseiraValidaParaSalvar = finalPulseiraToSave || (isPulseiraValida ? typedString : null);

      const systemId = fetchedArmario || typedString;

      const [result] = await pool.query(
        `UPDATE scoreboard_votes 
         SET option_index = ?, cliente_pulseira = COALESCE(?, cliente_pulseira), cliente_nome = COALESCE(?, cliente_nome) 
         WHERE unidade = ? AND status = 'DENTRO' AND (cliente_pulseira = ? OR cliente_id = ? OR cliente_id = ?) 
         ORDER BY id DESC LIMIT 1`,
        [optionIndex, pulseiraValidaParaSalvar, fetchedNome, unidadeUpper, typedString, typedString, fetchedArmario]
      );

      if (result.affectedRows === 0) {
        await pool.query(
          `INSERT INTO scoreboard_votes (unidade, cliente_id, cliente_pulseira, cliente_nome, option_index, status) 
           VALUES (?, ?, ?, ?, ?, "DENTRO")`,
          [unidadeUpper, systemId, pulseiraValidaParaSalvar, fetchedNome, optionIndex]
        );
      }
    } else {
      await pool.query(
        `INSERT INTO scoreboard_votes (unidade, option_index, status, expires_at) 
         VALUES (?, ?, "DENTRO", DATE_ADD(NOW(), INTERVAL 30 MINUTE))`,
        [unidadeUpper, optionIndex]
      );
    }

    const io = getIO();
    const rows = await fetchCurrentVotes(unidadeUpper);
    
    io.emit('scoreboard:vote_updated', { unidade: unidadeUpper, votes: rows });
    res.status(200).json({ message: 'Voto computado.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getVotes = async (req, res) => {
  const { unidade } = req.params;
  
  try {
    const rows = await fetchCurrentVotes(unidade.toUpperCase());
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const resetVotes = async (req, res) => {
  const { unidade } = req.body;
  
  try {
    await pool.query(
      `UPDATE scoreboard_votes SET status = 'SAIU' WHERE unidade = ? AND status = 'DENTRO'`,
      [unidade.toUpperCase()]
    );
    
    getIO().emit('scoreboard:vote_updated', { unidade: unidade.toUpperCase(), votes: [] });
    res.status(200).json({ message: 'Votos zerados e sessão renovada.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const savePreset = async (req, res) => {
  const { unidade, titulo_preset, titulo_placar, layout, opcoes } = req.body;
  
  if (!titulo_preset || !titulo_placar || !opcoes) {
    return res.status(400).json({ error: 'Dados incompletos para salvar o preset.' });
  }

  try {
    const opcoesString = JSON.stringify(opcoes);
    const unidadeUpper = unidade ? unidade.toUpperCase() : 'SP';
    
    await pool.query(
      `INSERT INTO scoreboard_presets (unidade, titulo_preset, titulo_placar, layout, opcoes) 
       VALUES (?, ?, ?, ?, ?)`,
      [unidadeUpper, titulo_preset, titulo_placar, layout, opcoesString]
    );
    
    res.status(201).json({ message: 'Predefinição salva com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getPresets = async (req, res) => {
  const { unidade } = req.params;
  const unidadeUpper = unidade ? unidade.toUpperCase() : 'SP';

  try {
    const [rows] = await pool.query(
      `SELECT * FROM scoreboard_presets WHERE unidade = ? ORDER BY created_at DESC`,
      [unidadeUpper]
    );
    
    const presetsFormatados = rows.map(preset => {
      try {
        preset.opcoes = JSON.parse(preset.opcoes);
      } catch(e) {
        preset.opcoes = [];
      }
      return preset;
    });

    res.status(200).json(presetsFormatados);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deletePreset = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query(`DELETE FROM scoreboard_presets WHERE id = ?`, [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Predefinição não encontrada.' });
    }
    
    res.status(200).json({ message: 'Predefinição removida com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getScoreboardHistory = async (req, res) => {
  const { unidade } = req.params;
  const { month, year } = req.query;
  
  if (!month || !year) return res.status(400).json({ error: 'Mês e Ano obrigatórios.' });

  try {
    const sql = `
      SELECT id, cliente_id, cliente_pulseira, cliente_nome, option_index, status, created_at, updated_at, expires_at
      FROM scoreboard_votes 
      WHERE unidade = ? AND MONTH(created_at) = ? AND YEAR(created_at) = ?
      ORDER BY created_at DESC
    `;
    const [rows] = await pool.query(sql, [unidade.toUpperCase(), month, year]);
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};