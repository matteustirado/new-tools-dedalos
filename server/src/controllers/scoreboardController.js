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

const log = (tag, msg, data = null) => {
  const time = new Date().toISOString().split('T')[1].slice(0, 8);
  const dataStr = data ? ` | DADOS: ${JSON.stringify(data).substring(0, 200)}...` : '';
  console.log(`[📊 PLACAR ${time}] [${tag}] ${msg}${dataStr}`);
};

const fetchFromDedalos = async (unidade) => {
  const unidadeUpper = unidade.toUpperCase();

  const config = {
    SP: { url: process.env.VITE_API_URL_SP, token: process.env.VITE_API_TOKEN_SP },
    BH: { url: process.env.VITE_API_URL_BH, token: process.env.VITE_API_TOKEN_BH },
  }[unidadeUpper];

  if (!config || !config.url) {
    log('PROXY_ERR', '❌ Configuração de API não encontrada.', { unidade: unidadeUpper });
    return null;
  }

  try {
    const baseUrl = config.url.replace(/\/$/, '');
    let endpoint = `${baseUrl}/api/contador/`;
    let response;

    try {
      response = await axios.get(endpoint, {
        headers: { Authorization: `Token ${config.token}` },
        timeout: 5000,
      });
    } catch (err) {
      log('PROXY_WARN', `Falha no endpoint principal. Tentando fallback...`);

      const dataHoje = new Date().toISOString().split('T')[0];
      endpoint = `${baseUrl}/api/entradasPorData/${dataHoje}`;

      response = await axios.get(endpoint, {
        headers: { Authorization: `Token ${config.token}` },
        timeout: 5000,
      });
    }

    const data = response.data;

    if (Array.isArray(data)) {
      if (data.length > 0 && data[0].contador !== undefined) {
        return data[0].contador;
      }
      return data.length;
    }

    if (data.results) return data.results.length;
    if (data.contador !== undefined) return data.contador;
    if (data.count !== undefined) return data.count;

    return 0;
  } catch (error) {
    log('PROXY_ERR', `Erro na comunicação externa`, error.message);
    return null;
  }
};

const fetchCurrentVotes = async (unidadeUpper) => {
  const sql = `
        SELECT option_index, COUNT(*) as count 
        FROM scoreboard_votes 
        WHERE unidade = ? 
        AND status = 'DENTRO'
        AND option_index IS NOT NULL
        AND (expires_at IS NULL OR expires_at > NOW())
        GROUP BY option_index
    `;

  const [rows] = await pool.query(sql, [unidadeUpper]);
  return rows;
};

const iniciarSincronizacaoCheckout = () => {
  log('SYNC', 'Serviço de Varredura de Checkouts iniciado (Otimizado).');

  setInterval(async () => {
    for (const unidade of ['SP', 'BH']) {
      const unidadeUpper = unidade.toUpperCase();

      const config = {
        SP: { url: process.env.VITE_API_URL_SP, token: process.env.VITE_API_TOKEN_SP },
        BH: { url: process.env.VITE_API_URL_BH, token: process.env.VITE_API_TOKEN_BH },
      }[unidadeUpper];

      if (!config || !config.url) continue;

      try {
        const baseUrl = config.url.replace(/\/$/, '');
        const endpoint = `${baseUrl}/api/entradasCheckout/`;

        const response = await axios.get(endpoint, {
          headers: { Authorization: `Token ${config.token}` },
          timeout: 8000,
        });

        const data = response.data;
        if (!Array.isArray(data)) continue;

        const activeIds = data
          .map((c) => String(c.armario || c.pulseira))
          .filter((id) => id && id !== 'undefined' && id !== 'null');

        let rowsAffected = 0;

        if (activeIds.length > 0) {
          const placeholders = activeIds.map(() => '?').join(',');
          const sqlUpdate = `
                        UPDATE scoreboard_votes 
                        SET status = 'SAIU' 
                        WHERE unidade = ? 
                        AND status = 'DENTRO' 
                        AND cliente_id IS NOT NULL 
                        AND cliente_id NOT IN (${placeholders})
                    `;

          const [result] = await pool.query(sqlUpdate, [unidadeUpper, ...activeIds]);
          rowsAffected = result.affectedRows;
        } else if (data.length === 0) {
          const [result] = await pool.query(
            `UPDATE scoreboard_votes SET status = 'SAIU' WHERE unidade = ? AND status = 'DENTRO' AND cliente_id IS NOT NULL`,
            [unidadeUpper]
          );
          rowsAffected = result.affectedRows;
        }

        if (rowsAffected > 0) {
          log('SYNC', `[${unidade}] ${rowsAffected} votos reais inativados por checkout.`);

          const io = getIO();
          const currentVotes = await fetchCurrentVotes(unidadeUpper);

          io.emit('scoreboard:vote_updated', { unidade: unidadeUpper, votes: currentVotes });
        }
      } catch (error) {
        log('SYNC_ERR', `Falha ao sincronizar checkouts em ${unidade}: ${error.message}`);
      }
    }
  }, SYNC_INTERVAL);
};

const iniciarPonteRealTime = () => {
  log('PONTE', 'Iniciando Ponte Real-Time com servidores externos...');

  Object.entries(EXTERNAL_SOCKETS).forEach(([unidade, url]) => {
    try {
      const socket = ioClient(url, { transports: ['websocket', 'polling'] });

      socket.on('connect', () => {
        log('PONTE', `✅ [${unidade}] Conectado ao servidor externo!`);
      });

      socket.on('disconnect', () => {});

      socket.on('new_id', async (data) => {
        log('PONTE', `⚡ [${unidade}] CHECK-IN DETECTADO!`);

        const clienteId = data?.armario || data?.pulseira || data?.id || String(Date.now());
        const clienteNome = data?.nome || data?.cliente_nome || data?.name || null;
        const unidadeUpper = unidade.toUpperCase();

        try {
          await pool.query(
            'INSERT INTO scoreboard_votes (unidade, cliente_id, cliente_nome, option_index, status) VALUES (?, ?, ?, NULL, "DENTRO")',
            [unidadeUpper, String(clienteId), clienteNome]
          );
        } catch (e) {
          console.error(`[Ponte ${unidade}] Erro ao inserir voto sombra:`, e);
        }

        const totalAtual = await fetchFromDedalos(unidade);

        if (totalAtual !== null) {
          const io = getIO();
          io.emit('checkin:novo', {
            unidade: unidadeUpper,
            total: totalAtual,
            cliente_id: clienteId,
            origem: 'websocket_externo',
            timestamp: new Date(),
          });
        }
      });
    } catch (error) {
      console.error(`[Ponte ${unidade}] Erro ao inicializar socket:`, error);
    }
  });
};

const iniciarSentinela = () => {
  log('SENTINELA', 'Serviço de Backup HTTP iniciado.');

  setInterval(async () => {
    for (const unidade of ['SP', 'BH']) {
      const totalAtual = await fetchFromDedalos(unidade);

      if (totalAtual !== null) {
        if (lastCheckinCount[unidade] === null) {
          lastCheckinCount[unidade] = totalAtual;
          continue;
        }

        if (totalAtual > lastCheckinCount[unidade]) {
          log('SENTINELA', `🚨 Diferença detectada em ${unidade}. Total: ${totalAtual}`);

          const io = getIO();
          io.emit('checkin:novo', {
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
    log('MIGRAÇÃO', 'Iniciando Marco Zero. Apagando banco de votos...');

    await pool.query('TRUNCATE TABLE scoreboard_votes');

    let relatorio = {};

    for (const unidade of ['SP', 'BH']) {
      const config = {
        SP: { url: process.env.VITE_API_URL_SP, token: process.env.VITE_API_TOKEN_SP },
        BH: { url: process.env.VITE_API_URL_BH, token: process.env.VITE_API_TOKEN_BH },
      }[unidade];

      if (!config || !config.url) continue;

      try {
        const endpoint = `${config.url.replace(/\/$/, '')}/api/entradasCheckout/`;
        const response = await axios.get(endpoint, {
          headers: { Authorization: `Token ${config.token}` },
          timeout: 10000,
        });

        if (Array.isArray(response.data)) {
          const activeIds = response.data
            .map((c) => String(c.armario || c.pulseira))
            .filter((id) => id && id !== 'undefined' && id !== 'null');

          if (activeIds.length > 0) {
            for (const id of activeIds) {
              await pool.query(
                'INSERT INTO scoreboard_votes (unidade, cliente_id, option_index, status) VALUES (?, ?, NULL, "DENTRO")',
                [unidade, id]
              );
            }
          }

          relatorio[unidade] = `${activeIds.length} clientes sincronizados.`;
          log('MIGRAÇÃO', `[${unidade}] ${activeIds.length} clientes populados como sombras.`);
        }
      } catch (e) {
        relatorio[unidade] = `Erro ao puxar dados: ${e.message}`;
        log('MIGRAÇÃO_ERR', `[${unidade}] Falha na sincronização: ${e.message}`);
      }
    }

    const io = getIO();
    io.emit('scoreboard:vote_updated', { unidade: 'SP', votes: [] });
    io.emit('scoreboard:vote_updated', { unidade: 'BH', votes: [] });

    res.json({ message: 'Marco Zero executado com sucesso!', detalhes: relatorio });
  } catch (error) {
    log('MIGRAÇÃO_ERR', `Falha global: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

export const getCrowdCount = async (req, res) => {
  const { unidade } = req.params;

  log('API', `Frontend solicitou contagem para ${unidade}`);

  const count = await fetchFromDedalos(unidade);

  if (count !== null) return res.json({ count });

  log('API_ERR', `Falha ao obter contagem para ${unidade}`);
  res.status(502).json({ error: 'Falha na comunicação com API Externa' });
};

export const testarTrigger = async (req, res) => {
  const { unidade } = req.params;
  const unidadeUpper = unidade ? unidade.toUpperCase() : 'SP';
  const fakeId = 'TESTE-' + Math.floor(Math.random() * 1000);

  try {
    await pool.query(
      'INSERT INTO scoreboard_votes (unidade, cliente_id, option_index, status, expires_at) VALUES (?, ?, NULL, "DENTRO", DATE_ADD(NOW(), INTERVAL 30 MINUTE))',
      [unidadeUpper, fakeId]
    );

    const io = getIO();
    log('TESTE', `Disparo manual para ${unidadeUpper} / ID: ${fakeId}`);

    io.emit('checkin:novo', {
      unidade: unidadeUpper,
      total: 999,
      novos: 1,
      cliente_id: fakeId,
      timestamp: new Date(),
    });

    res.json({ message: `Teste enviado para ${unidadeUpper}` });
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

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Configuração não encontrada.' });
    }

    const config = rows[0];

    if (typeof config.opcoes === 'string') {
      config.opcoes = JSON.parse(config.opcoes);
    }

    res.json(config);
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

    const sql = `
            INSERT INTO scoreboard_active (unidade, titulo, layout, opcoes, status)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            titulo = VALUES(titulo), layout = VALUES(layout), opcoes = VALUES(opcoes), status = VALUES(status)
        `;

    await connection.query(sql, [unidadeUpper, titulo, layout, opcoesString, status]);
    await connection.query(
      `UPDATE scoreboard_votes SET status = 'SAIU' WHERE unidade = ? AND status = 'DENTRO'`,
      [unidadeUpper]
    );

    await connection.commit();

    const io = getIO();
    io.emit('scoreboard:config_updated', { unidade: unidadeUpper });
    io.emit('scoreboard:vote_updated', { unidade: unidadeUpper, votes: [] });

    res.json({ message: 'Placar atualizado!' });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
};

export const castVote = async (req, res) => {
  const { unidade, optionIndex, cliente_id } = req.body;

  if (!unidade || optionIndex === undefined) {
    return res.status(400).json({ error: 'Voto inválido.' });
  }

  try {
    const unidadeUpper = unidade.toUpperCase();

    if (cliente_id) {
      const [result] = await pool.query(
        `UPDATE scoreboard_votes SET option_index = ? WHERE unidade = ? AND cliente_id = ? AND status = 'DENTRO' ORDER BY id DESC LIMIT 1`,
        [optionIndex, unidadeUpper, cliente_id]
      );

      if (result.affectedRows === 0) {
        await pool.query(
          'INSERT INTO scoreboard_votes (unidade, cliente_id, option_index, status) VALUES (?, ?, ?, "DENTRO")',
          [unidadeUpper, cliente_id, optionIndex]
        );
      }
    } else {
      await pool.query(
        'INSERT INTO scoreboard_votes (unidade, option_index, status, expires_at) VALUES (?, ?, "DENTRO", DATE_ADD(NOW(), INTERVAL 30 MINUTE))',
        [unidadeUpper, optionIndex]
      );
    }

    const io = getIO();
    const rows = await fetchCurrentVotes(unidadeUpper);

    io.emit('scoreboard:vote_updated', { unidade: unidadeUpper, votes: rows });

    res.json({ message: 'Voto computado.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getVotes = async (req, res) => {
  const { unidade } = req.params;

  try {
    const rows = await fetchCurrentVotes(unidade.toUpperCase());
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const resetVotes = async (req, res) => {
  const { unidade } = req.body;

  try {
    const unidadeUpper = unidade.toUpperCase();

    await pool.query(
      `UPDATE scoreboard_votes SET status = 'SAIU' WHERE unidade = ? AND status = 'DENTRO'`,
      [unidadeUpper]
    );

    const io = getIO();
    io.emit('scoreboard:vote_updated', { unidade: unidadeUpper, votes: [] });

    res.json({ message: 'Votos zerados e sessão renovada.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const savePreset = async (req, res) => {
  const { unidade, titulo_preset, titulo_placar, layout, opcoes } = req.body;
  const unidadeUpper = unidade ? unidade.toUpperCase() : 'SP';

  try {
    await pool.query(
      'INSERT INTO scoreboard_presets (unidade, titulo_preset, titulo_placar, layout, opcoes) VALUES (?, ?, ?, ?, ?)',
      [unidadeUpper, titulo_preset, titulo_placar, layout, JSON.stringify(opcoes)]
    );
    res.json({ message: 'Preset salvo.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getPresets = async (req, res) => {
  const { unidade } = req.params;
  const unidadeUpper = unidade ? unidade.toUpperCase() : 'SP';

  try {
    const [rows] = await pool.query(
      'SELECT * FROM scoreboard_presets WHERE unidade = ? ORDER BY id DESC',
      [unidadeUpper]
    );

    const formatted = rows.map((r) => ({
      ...r,
      opcoes: typeof r.opcoes === 'string' ? JSON.parse(r.opcoes) : r.opcoes,
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deletePreset = async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM scoreboard_presets WHERE id = ?', [id]);
    res.json({ message: 'Preset excluído.' });
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
            SELECT 
                id, cliente_id, cliente_nome, option_index, status, created_at, updated_at, expires_at
            FROM scoreboard_votes 
            WHERE unidade = ? 
            AND MONTH(created_at) = ? 
            AND YEAR(created_at) = ?
            ORDER BY created_at DESC
        `;
    const [rows] = await pool.query(sql, [unidade.toUpperCase(), month, year]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};