import pool from '../config/db.js';
import axios from 'axios';

const LEGACY_API = {
    SP: { 
        url: 'https://dedalosadm2-3dab78314381.herokuapp.com', 
        token: '7a9e64071564f6fee8d96cd209ed3a4e86801552' 
    },
    BH: { 
        url: 'https://dedalosadm2-3dab78314381.herokuapp.com', 
        token: '7a9e64071564f6fee8d96cd209ed3a4e86801552' 
    }
};

const getHoraBrasil = () => {
    const date = new Date();
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: "America/Sao_Paulo" }));
    return utcDate;
};

const getPeriodo = (hora) => {
    if (hora >= 6 && hora < 14) return 'manha';
    if (hora >= 14 && hora < 20) return 'tarde';
    return 'noite';
};

const getTipoDia = (data) => {
    const diaSemana = data.getDay(); 
    if (diaSemana === 6 || diaSemana === 0) return 'fim_de_semana';
    return 'semana';
};

const getProximoPeriodo = (periodoAtual, tipoDiaAtual, diaSemanaAtual) => {
    if (periodoAtual === 'manha') return { periodo: 'tarde', tipo: tipoDiaAtual };
    if (periodoAtual === 'tarde') return { periodo: 'noite', tipo: tipoDiaAtual };
    
    let proximoTipo = tipoDiaAtual;
    if (diaSemanaAtual === 5) proximoTipo = 'fim_de_semana'; 
    if (diaSemanaAtual === 0) proximoTipo = 'semana';        

    return { periodo: 'manha', tipo: proximoTipo };
};

export const getPricesState = async (req, res) => {
    const { unidade } = req.params;
    const unidadeUpper = unidade.toUpperCase();
    
    try {
        const [stateRows] = await pool.query('SELECT * FROM price_live_state WHERE unidade = ?', [unidadeUpper]);
        let state = stateRows[0];
        
        if (!state) {
            await pool.query('INSERT IGNORE INTO price_live_state (unidade, party_banners) VALUES (?, ?)', [unidadeUpper, '[]']);
            state = { unidade: unidadeUpper, valor_atual: 0, modo_festa: 0, party_banners: [] };
        }

        let valorRealApi = state.valor_atual;

        try {
            const apiConfig = LEGACY_API[unidadeUpper];
            if (apiConfig) {
                const response = await axios.get(`${apiConfig.url}/regras/valor-entrada/`, {
                    headers: { 'Authorization': `Token ${apiConfig.token}` },
                    timeout: 4000
                });
                const val = parseFloat(response.data.valorEntrada);
                if (!isNaN(val)) {
                    valorRealApi = val;
                    if (valorRealApi !== parseFloat(state.valor_atual)) {
                        await pool.query('UPDATE price_live_state SET valor_atual = ? WHERE unidade = ?', [valorRealApi, unidadeUpper]);
                    }
                }
            }
        } catch (error) {
            console.error(`[Prices] Erro API Legada (${unidade}):`, error.message);
        }

        const agora = getHoraBrasil();
        const tipoDia = getTipoDia(agora);
        const periodo = getPeriodo(agora.getHours());

        const [regrasAtuais] = await pool.query(
            'SELECT valor FROM price_defaults WHERE tipo_dia = ? AND periodo = ? AND qtd_pessoas = 1',
            [tipoDia, periodo]
        );

        const valorPadraoAgora = regrasAtuais[0]?.valor || 0;
        const isPadrao = Math.abs(valorRealApi - valorPadraoAgora) < 0.50;

        let valorPadraoFuturo = null;
        if (isPadrao) {
            const next = getProximoPeriodo(periodo, tipoDia, agora.getDay());
            const [regrasFuturas] = await pool.query(
                'SELECT valor FROM price_defaults WHERE tipo_dia = ? AND periodo = ? AND qtd_pessoas = 1',
                [next.tipo, next.periodo]
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
        console.error(error);
        res.status(500).json({ error: "Erro interno" });
    }
};

export const updatePriceState = async (req, res) => {
    const { unidade } = req.params;
    const { 
        modo_festa, 
        party_banners, 
        valor_futuro, 
        texto_futuro, 
        valor_passado,
        aviso_1, aviso_2, aviso_3, aviso_4
    } = req.body;

    try {
        const bannersJson = party_banners ? JSON.stringify(party_banners) : '[]';

        await pool.query(`
            UPDATE price_live_state 
            SET 
                modo_festa = ?, 
                party_banners = ?, 
                valor_futuro = ?, 
                texto_futuro = ?, 
                valor_passado = ?,
                aviso_1 = ?, aviso_2 = ?, aviso_3 = ?, aviso_4 = ?
            WHERE unidade = ?
        `, [
            modo_festa, 
            bannersJson, 
            valor_futuro || null, 
            texto_futuro || '???', 
            valor_passado || null,
            aviso_1 || '', aviso_2 || '', aviso_3 || '', aviso_4 || '',
            unidade.toUpperCase()
        ]);

        if (req.io) {
            req.io.emit('prices:updated', { unidade: unidade.toUpperCase() });
        }

        res.json({ success: true, message: "Estado atualizado com sucesso" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getDefaults = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM price_defaults ORDER BY tipo_dia DESC, periodo, qtd_pessoas');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const updateDefault = async (req, res) => {
    const { id, valor } = req.body;
    try {
        await pool.query('UPDATE price_defaults SET valor = ? WHERE id = ?', [valor, id]);
        
        if (req.io) {
            req.io.emit('prices:updated', { unidade: 'SP' });
            req.io.emit('prices:updated', { unidade: 'BH' });
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
            if (rows.length > 0) {
                req.io.emit('prices:updated', { unidade: rows[0].unidade });
            }
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
        if (req.io) req.io.emit('prices:updated', { unidade: unidade.toUpperCase() });
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
        if (req.io) req.io.emit('prices:updated', { unidade: unidade.toUpperCase() });
        res.json({ success: true });
    } catch (error) {
        await conn.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        conn.release();
    }
};