import pool from '../config/db.js';
import axios from 'axios';
import { getIO } from '../socket.js';

const log = (tag, msg, data = null) => {
  const time = new Date().toISOString().split('T')[1].slice(0, 8);
  const dataStr = data ? ` | DADOS: ${JSON.stringify(data).substring(0, 200)}...` : '';
  
  console.log(`[💰 PREÇOS ${time}] [${tag}] ${msg}${dataStr}`);
};

const getApiConfig = (unidade) => {
  if (unidade === 'SP') {
    return {
      url: (process.env.VITE_API_URL_SP || process.env.API_URL_SP || 'https://dedalosadm2-3dab78314381.herokuapp.com').replace(/\/$/, ''),
      token: process.env.VITE_API_TOKEN_SP || process.env.API_TOKEN_SP || '7a9e64071564f6fee8d96cd209ed3a4e86801552'
    };
  }

  if (unidade === 'BH') {
    return {
      url: (process.env.VITE_API_URL_BH || process.env.API_URL_BH || 'https://dedalosadm2bh-09d55dca461e.herokuapp.com').replace(/\/$/, ''),
      token: process.env.VITE_API_TOKEN_BH || process.env.API_TOKEN_BH || '919d97d7df39ecbd0036631caba657221acab99d'
    };
  }

  return null;
};

const getHoraBrasil = () => {
  const date = new Date();
  
  return new Date(date.toLocaleString('en-US', { timeZone: "America/Sao_Paulo" }));
};

const getPeriodo = (hora) => {
  if (hora >= 6 && hora < 14) return 'manha';
  if (hora >= 14 && hora < 20) return 'tarde';
  
  return 'noite';
};

const getBhDayAndRound = (agora) => {
  const hora = agora.getHours();
  let round = "Round 3";
  
  if (hora >= 6 && hora < 14) {
    round = "Round 1";
  } else if (hora >= 14 && hora < 20) {
    round = "Round 2";
  }
  
  const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const day = dayNames[agora.getDay()];

  return { day, round };
};

const fetchLivePriceFromExternalApi = async (unidadeUpper, apiConfig, agora) => {
  try {
    if (unidadeUpper === 'SP') {
      const response = await axios.get(`${apiConfig.url}/regras/valor-entrada/`, {
        headers: { 'Authorization': `Token ${apiConfig.token}` },
        timeout: 5000
      });
      
      const data = response.data;
      let val = parseFloat(data.valorEntrada);
      
      if (isNaN(val) && data.valor !== undefined) val = parseFloat(data.valor);
      if (isNaN(val) && data.price !== undefined) val = parseFloat(data.price);
      
      return isNaN(val) ? null : val;
    } 
    
    if (unidadeUpper === 'BH') {
      const { day, round } = getBhDayAndRound(agora);
      
      const urlDay = encodeURIComponent(day);
      const urlRound = encodeURIComponent(round);
      const bhUrl = `${apiConfig.url}/recepcao/api/newcheckin/getprice/?day=${urlDay}&round=${urlRound}`;
      
      const response = await axios.get(bhUrl, {
        headers: { 'Authorization': `Token ${apiConfig.token}` },
        timeout: 5000
      });
      
      const data = response.data;
      
      if (Array.isArray(data) && data.length > 0) {
        let val = null;
        
        if (data[0].Discreto) {
          val = parseFloat(data[0].Discreto.replace(',', '.'));
        } else if (data[0].price !== undefined) {
          val = parseFloat(String(data[0].price).replace(',', '.'));
        } else if (data[0].valor !== undefined) {
          val = parseFloat(String(data[0].valor).replace(',', '.'));
        } else if (data[0].valor_atual !== undefined) {
          val = parseFloat(String(data[0].valor_atual).replace(',', '.'));
        }
        
        if (!isNaN(val) && val !== null) {
          return val;
        }
      }
      
      return null;
    }
  } catch (error) {
    return null;
  }
  
  return null;
};

const formatDateYMD = (dateObj) => {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  
  return `${y}-${m}-${d}`;
};

const getTipoDia = (data, isHoliday) => {
  if (isHoliday) return 'fim_de_semana';
  
  const diaSemana = data.getDay(); 
  
  if (diaSemana === 6 || diaSemana === 0) return 'fim_de_semana';
  
  return 'semana';
};

const getProximoPeriodo = (periodoAtual, tipoDiaAtual, diaSemanaAtual, isHolidayAmanha) => {
  if (periodoAtual === 'manha') return { periodo: 'tarde', tipo: tipoDiaAtual };
  if (periodoAtual === 'tarde') return { periodo: 'noite', tipo: tipoDiaAtual };
  
  let proximoTipo = 'semana';
  const diaSemanaAmanha = (diaSemanaAtual + 1) % 7;
  
  if (diaSemanaAmanha === 6 || diaSemanaAmanha === 0 || isHolidayAmanha) {
    proximoTipo = 'fim_de_semana';
  }

  return { periodo: 'manha', tipo: proximoTipo };
};

export const getPricesState = async (req, res) => {
  const { unidade } = req.params;
  const unidadeUpper = unidade.toUpperCase();
  const agora = getHoraBrasil();
  
  try {
    const hojeStr = formatDateYMD(agora);
    const amanhã = new Date(agora);
    amanhã.setDate(amanhã.getDate() + 1);
    const amanhãStr = formatDateYMD(amanhã);

    const [holidaysRows] = await pool.query(
      'SELECT data_feriado FROM holidays WHERE unidade = ? AND (data_feriado = ? OR data_feriado = ?)', 
      [unidadeUpper, hojeStr, amanhãStr]
    );

    const holidayDates = holidaysRows.map(h => {
      if (h.data_feriado instanceof Date) return formatDateYMD(h.data_feriado);
      return String(h.data_feriado).substring(0, 10);
    });

    const isHolidayHoje = holidayDates.includes(hojeStr);
    const isHolidayAmanha = holidayDates.includes(amanhãStr);

    const tipoDia = getTipoDia(agora, isHolidayHoje);
    const periodo = getPeriodo(agora.getHours());

    const [stateRows] = await pool.query('SELECT * FROM price_live_state WHERE unidade = ?', [unidadeUpper]);
    let state = stateRows[0];
    
    if (!state) {
      await pool.query('INSERT IGNORE INTO price_live_state (unidade, party_banners) VALUES (?, ?)', [unidadeUpper, '[]']);
      state = { unidade: unidadeUpper, valor_atual: 0, modo_festa: 0, party_banners: [] };
    }

    let valorRealApi = state.valor_atual;

    const [regrasAtuais] = await pool.query(
      'SELECT valor FROM price_defaults WHERE tipo_dia = ? AND periodo = ? AND qtd_pessoas = 1 AND unidade = ?',
      [tipoDia, periodo, unidadeUpper]
    );
    
    const valorPadraoAgora = regrasAtuais[0]?.valor || 0;
    const apiConfig = getApiConfig(unidadeUpper);
    
    if (apiConfig && apiConfig.url && apiConfig.token) {
      const externalPrice = await fetchLivePriceFromExternalApi(unidadeUpper, apiConfig, agora);
      
      if (externalPrice !== null) {
        valorRealApi = externalPrice;
      } else {
        if (valorPadraoAgora > 0) {
          valorRealApi = valorPadraoAgora;
        }
      }

      if (valorRealApi !== parseFloat(state.valor_atual)) {
        await pool.query('UPDATE price_live_state SET valor_atual = ? WHERE unidade = ?', [valorRealApi, unidadeUpper]);
      }
    }

    const isPadrao = Math.abs(valorRealApi - valorPadraoAgora) < 0.50;
    let valorPadraoFuturo = null;
    
    if (isPadrao) {
      const next = getProximoPeriodo(periodo, tipoDia, agora.getDay(), isHolidayAmanha);
      
      const [regrasFuturas] = await pool.query(
        'SELECT valor FROM price_defaults WHERE tipo_dia = ? AND periodo = ? AND qtd_pessoas = 1 AND unidade = ?',
        [next.tipo, next.periodo, unidadeUpper]
      );
      
      valorPadraoFuturo = regrasFuturas[0]?.valor;
    } 

    res.json({
      ...state,
      valor_atual: valorRealApi,
      valor_padrao_agora: valorPadraoAgora,
      valor_padrao_futuro: valorPadraoFuturo,
      is_padrao: isPadrao,
      periodo_atual: periodo,
      tipo_dia: tipoDia
    });

  } catch (error) {
    log('SYS_ERR', `Falha geral no carregamento: ${error.message}`);
    res.status(500).json({ error: "Erro interno" });
  }
};

export const updatePriceState = async (req, res) => {
  const { unidade } = req.params;
  const { 
    modo_festa, party_banners, valor_futuro, texto_futuro, valor_passado,
    aviso_1, aviso_2, aviso_3, aviso_4 
  } = req.body;

  try {
    const bannersJson = party_banners ? JSON.stringify(party_banners) : '[]';

    await pool.query(`
      UPDATE price_live_state 
      SET modo_festa = ?, party_banners = ?, valor_futuro = ?, texto_futuro = ?, valor_passado = ?,
          aviso_1 = ?, aviso_2 = ?, aviso_3 = ?, aviso_4 = ?
      WHERE unidade = ?
    `, [
      modo_festa, 
      bannersJson, 
      valor_futuro || null, 
      texto_futuro || '???', 
      valor_passado || null,
      aviso_1 || '', 
      aviso_2 || '', 
      aviso_3 || '', 
      aviso_4 || '', 
      unidade.toUpperCase()
    ]);

    if (req.io) {
      req.io.emit('prices:updated', { unidade: unidade.toUpperCase() });
    }
    
    res.json({ success: true, message: "Estado atualizado" });
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
};

export const getDefaults = async (req, res) => {
  const unidade = (req.query.unidade || 'SP').toUpperCase();
  
  try {
    const [rows] = await pool.query('SELECT * FROM price_defaults WHERE unidade = ? ORDER BY tipo_dia DESC, periodo, qtd_pessoas', [unidade]);
    
    res.json(rows);
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
};

export const updateDefault = async (req, res) => {
  const { id, valor } = req.body;
  
  try {
    const [rows] = await pool.query('SELECT unidade FROM price_defaults WHERE id = ?', [id]);
    await pool.query('UPDATE price_defaults SET valor = ? WHERE id = ?', [valor, id]);
    
    if (req.io && rows.length > 0) {
      req.io.emit('prices:updated', { unidade: rows[0].unidade });
    }
    
    res.json({ success: true });
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
};

export const getCategoryMedia = async (req, res) => {
  const { unidade } = req.params;
  
  try {
    const [rows] = await pool.query('SELECT * FROM price_category_media WHERE unidade = ? ORDER BY qtd_pessoas', [unidade.toUpperCase()]);
    
    res.json(rows);
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
};

export const updateCategoryMedia = async (req, res) => {
  const { id, media_url, titulo, aviso_categoria } = req.body;
  
  try {
    if (media_url !== undefined) await pool.query('UPDATE price_category_media SET media_url = ? WHERE id = ?', [media_url, id]);
    if (titulo !== undefined) await pool.query('UPDATE price_category_media SET titulo = ? WHERE id = ?', [titulo, id]);
    if (aviso_categoria !== undefined) await pool.query('UPDATE price_category_media SET aviso_categoria = ? WHERE id = ?', [aviso_categoria, id]);
    
    if (req.io) {
      const [rows] = await pool.query('SELECT unidade FROM price_category_media WHERE id = ?', [id]);
      if (rows.length > 0) req.io.emit('prices:updated', { unidade: rows[0].unidade });
    }
    
    res.json({ success: true });
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
};

export const getHolidays = async (req, res) => {
  const { unidade } = req.params;
  
  try {
    const [rows] = await pool.query('SELECT * FROM holidays WHERE unidade = ? ORDER BY data_feriado', [unidade.toUpperCase()]);
    
    res.json(rows);
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
};

export const addHoliday = async (req, res) => {
  const { unidade, nome, data_feriado } = req.body;
  
  try {
    await pool.query('INSERT INTO holidays (unidade, nome, data_feriado) VALUES (?, ?, ?)', [unidade.toUpperCase(), nome, data_feriado]);
    
    if (req.io) {
      req.io.emit('prices:updated', { unidade: unidade.toUpperCase() });
    }
    
    res.json({ success: true });
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
};

export const deleteHoliday = async (req, res) => {
  const { id } = req.params;
  
  try {
    const [rows] = await pool.query('SELECT unidade FROM holidays WHERE id = ?', [id]);
    await pool.query('DELETE FROM holidays WHERE id = ?', [id]);
    
    if (req.io && rows.length > 0) {
      req.io.emit('prices:updated', { unidade: rows[0].unidade });
    }
    
    res.json({ success: true });
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
};

export const getPromotions = async (req, res) => {
  const { unidade } = req.params;
  
  try {
    const [rows] = await pool.query('SELECT * FROM price_promotions WHERE unidade = ? ORDER BY created_at DESC', [unidade.toUpperCase()]);
    
    res.json(rows);
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
};

export const addPromotion = async (req, res) => {
  const { unidade, promotions } = req.body;
  const conn = await pool.getConnection();
  
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM price_promotions WHERE unidade = ?', [unidade.toUpperCase()]);

    if (promotions && promotions.length > 0) {
      for (const p of promotions) {
        const diasAtivos = Array.isArray(p.dias_ativos) ? JSON.stringify(p.dias_ativos) : p.dias_ativos;
        
        await conn.query(
          'INSERT INTO price_promotions (unidade, image_url, dias_ativos) VALUES (?, ?, ?)',
          [unidade.toUpperCase(), p.image_url, diasAtivos]
        );
      }
    }

    await conn.commit();
    
    if (req.io) {
      req.io.emit('prices:updated', { unidade: unidade.toUpperCase() });
    }
    
    res.json({ success: true });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ error: error.message });
  } finally { 
    conn.release(); 
  }
};

let lastKnownState = {
  SP: { valor: null, periodo: null, tipo_dia: null },
  BH: { valor: null, periodo: null, tipo_dia: null }
};

const runPriceMonitor = async () => {
  try {
    let io;
    try {
      io = getIO();
    } catch(e) { 
      return;
    }

    const agora = getHoraBrasil();
    const unidades = ['SP', 'BH'];

    for (const und of unidades) {
      const hojeStr = formatDateYMD(agora);
      const [holidaysRows] = await pool.query(
        'SELECT data_feriado FROM holidays WHERE unidade = ? AND data_feriado = ?',
        [und, hojeStr]
      );

      const isHolidayHoje = holidaysRows.length > 0;
      const tipoDiaAtual = getTipoDia(agora, isHolidayHoje);
      const periodoAtual = getPeriodo(agora.getHours());

      const apiConfig = getApiConfig(und);
      let valorRealApi = null;

      const [stateRows] = await pool.query('SELECT valor_atual FROM price_live_state WHERE unidade = ?', [und]);
      let dbValorAtual = stateRows.length > 0 ? parseFloat(stateRows[0].valor_atual) : 0;

      if (apiConfig && apiConfig.url && apiConfig.token) {
        const externalPrice = await fetchLivePriceFromExternalApi(und, apiConfig, agora);
        if (externalPrice !== null) {
          valorRealApi = externalPrice;
        }
      }

      if (valorRealApi === null) {
        const [regrasAtuais] = await pool.query(
          'SELECT valor FROM price_defaults WHERE tipo_dia = ? AND periodo = ? AND qtd_pessoas = 1 AND unidade = ?',
          [tipoDiaAtual, periodoAtual, und]
        );
        
        if (regrasAtuais.length > 0 && regrasAtuais[0].valor > 0) {
          valorRealApi = regrasAtuais[0].valor;
        } else {
          valorRealApi = dbValorAtual; 
        }
      }

      const currentState = lastKnownState[und];

      if (
        currentState.valor !== valorRealApi ||
        currentState.periodo !== periodoAtual ||
        currentState.tipo_dia !== tipoDiaAtual
      ) {
        
        if (valorRealApi !== dbValorAtual) {
          await pool.query('UPDATE price_live_state SET valor_atual = ? WHERE unidade = ?', [valorRealApi, und]);
        }

        if (currentState.valor !== null) {
          log('MONITOR', `Gatilho acionado em ${und}! Preço Real: R$${valorRealApi} | Período: ${periodoAtual} | Dia: ${tipoDiaAtual}`);
          io.emit('prices:updated', { unidade: und });
        }

        lastKnownState[und] = {
          valor: valorRealApi,
          periodo: periodoAtual,
          tipo_dia: tipoDiaAtual
        };
      }
    }
  } catch (error) {
    console.error("Erro no Monitor Ativo de Preços:", error.message);
  }
};

setInterval(runPriceMonitor, 30000);