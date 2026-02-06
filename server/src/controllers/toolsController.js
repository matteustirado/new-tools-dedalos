import pool from '../config/db.js';
import axios from 'axios';

// ==========================================
// CONFIGURAÇÃO DE FALLBACK (PLANO B)
// ==========================================
// Caso a API externa não tenha o endpoint de configuração, usamos isso:
const FALLBACK_CONFIG = {
    sp: {
        total: 210,
        broken: [209], // Armários quebrados/manutenção
        ranges: {
            M: [1, 2, 3, 4, 5, 6, 21, 22, 23, 24, 25, 26, 41, 42, 43, 44, 45, 46, 61, 62, 63, 64, 65, 66, 81, 82, 83, 84, 85, 86, 191, 192, 193, 194, 195, 196],
            G: [19, 20, 39, 40, 59, 60, 79, 80, 99, 100, 210],
            PP: { start: 101, end: 160 }
        }
    },
    bh: {
        total: 160,
        broken: [17, 30, 36, 61],
        ranges: {
            M: [1, 2, 3, 4, 5, 6, 21, 22, 23, 24, 25, 26],
            G: [19, 20, 39, 40],
            PP: { start: 131, end: 160 }
        }
    }
};

const generateFallbackLockers = (unidade) => {
    const config = FALLBACK_CONFIG[unidade.toLowerCase()];
    if (!config) return [];

    const lockers = [];
    for (let i = 1; i <= config.total; i++) {
        let size = 'P'; // Padrão
        if (config.ranges.M.includes(i)) size = 'M';
        else if (config.ranges.G.includes(i)) size = 'G';
        else if (i >= config.ranges.PP.start && i <= config.ranges.PP.end) size = 'PP';

        let status = 'ativo';
        if (config.broken.includes(i)) status = 'manutencao';

        lockers.push({
            numero: i,
            tamanho: size,
            status: status
        });
    }
    return lockers;
};

// ==========================================
// FUNÇÕES DE HISTÓRICO E GERAIS
// ==========================================

export const salvarHistorico = async (req, res) => {
    try {
        const { tipo, unidade, total_sorteados, total_resgatados, detalhes } = req.body;

        if (!tipo || !unidade) {
            return res.status(400).json({ error: "Campos obrigatórios: tipo e unidade" });
        }

        const detalhesString = JSON.stringify(detalhes || []);

        const query = `
            INSERT INTO historico_promocoes 
            (tipo, unidade, total_sorteados, total_resgatados, detalhes)
            VALUES (?, ?, ?, ?, ?)
        `;

        await pool.query(query, [
            tipo,
            unidade,
            total_sorteados || 0,
            total_resgatados || 0,
            detalhesString
        ]);

        res.status(201).json({ message: "Histórico salvo com sucesso!" });
    } catch (error) {
        console.error("❌ Erro ao salvar histórico:", error);
        res.status(500).json({ error: "Erro interno ao salvar no banco." });
    }
};

export const listarHistorico = async (req, res) => {
    try {
        const { unidade, tipo } = req.params;

        const query = `
            SELECT * FROM historico_promocoes
            WHERE unidade = ? AND tipo = ?
            ORDER BY data_hora DESC
            LIMIT 50
        `;

        const [rows] = await pool.query(query, [unidade, tipo]);

        const historicoFormatado = rows.map(row => ({
            ...row,
            detalhes: typeof row.detalhes === 'string' ? JSON.parse(row.detalhes) : row.detalhes
        }));

        res.json(historicoFormatado);
    } catch (error) {
        console.error("❌ Erro ao listar histórico:", error);
        res.status(500).json({ error: "Erro interno ao buscar histórico." });
    }
};

export const buscarClientePorPulseira = async (req, res) => {
    const { pulseira } = req.params;

    const TOKEN = process.env.DEDALOS_API_TOKEN || "7a9e64071564f6fee8d96cd209ed3a4e86801552";
    const BASE_URL = "https://dedalosadm2-3dab78314381.herokuapp.com/";

    try {
        const endpoint = `${BASE_URL}api/entradasOne/${pulseira}/`;
        console.log(`[BACKEND] Proxy consultando pulseira ${pulseira}`);

        const response = await axios.get(endpoint, {
            headers: {
                "Authorization": `Token ${TOKEN}`,
                "Content-Type": "application/json"
            }
        });

        return res.status(200).json(response.data);
    } catch (error) {
        console.error("Erro na API Externa:", error.message);

        if (error.response) {
            return res.status(error.response.status).json(error.response.data);
        }

        return res.status(500).json({ message: "Erro interno ao conectar com API Dedalos." });
    }
};

// ==========================================
// FUNÇÕES QUINTA PREMIADA (SORTEIO ATIVO)
// ==========================================

export const saveGoldenWinner = async (req, res) => {
    const { unidade, type, data } = req.body;

    try {
        // Remove sorteio anterior ativo para evitar duplicidade
        await pool.query("DELETE FROM historico_promocoes WHERE unidade = ? AND tipo = 'QUINTA_PREMIADA_WINNER'", [unidade]);

        const query = `
            INSERT INTO historico_promocoes (tipo, unidade, detalhes, data_hora) 
            VALUES (?, ?, ?, NOW())
        `;

        const dbType = 'QUINTA_PREMIADA_WINNER';

        await pool.query(query, [dbType, unidade, JSON.stringify(data)]);

        const io = req.app.get('io');

        if (io) {
            io.emit('golden:winner_update', {
                unidade: unidade,
                winner: data
            });
            console.log(`[SOCKET] Novo ganhador Quinta Premiada emitido para: ${unidade}`);
        }

        res.json({ success: true, message: "Ganhador salvo e transmitido!" });

    } catch (error) {
        console.error("❌ Erro saveGoldenWinner:", error);
        res.status(500).json({ error: "Erro ao processar sorteio." });
    }
};

export const getLastGoldenWinner = async (req, res) => {
    const { unidade } = req.params;
    try {
        const query = `
            SELECT detalhes FROM historico_promocoes 
            WHERE unidade = ? AND tipo = 'QUINTA_PREMIADA_WINNER' 
            ORDER BY id DESC LIMIT 1
        `;

        const [rows] = await pool.query(query, [unidade]);

        if (rows.length > 0) {
            const winnerData = typeof rows[0].detalhes === 'string'
                ? JSON.parse(rows[0].detalhes)
                : rows[0].detalhes;

            res.json(winnerData);
        } else {
            res.json(null);
        }
    } catch (error) {
        console.error("❌ Erro getLastGoldenWinner:", error);
        res.status(500).json({ error: "Erro ao buscar último ganhador." });
    }
};

// [NOVO] Limpar sorteio ativo
export const clearGoldenWinner = async (req, res) => {
    const { unidade } = req.params;
    try {
        const query = `
            DELETE FROM historico_promocoes 
            WHERE unidade = ? AND tipo = 'QUINTA_PREMIADA_WINNER'
        `;
        await pool.query(query, [unidade]);
        
        const io = req.app.get('io');
        if (io) {
            io.emit('golden:winner_update', { unidade, winner: null });
        }

        res.json({ success: true, message: "Sorteio ativo encerrado." });
    } catch (error) {
        console.error("Erro clearGoldenWinner:", error);
        res.status(500).json({ error: "Erro ao limpar sorteio." });
    }
};

// ==========================================
// CONFIGURAÇÃO E INFRAESTRUTURA
// ==========================================

export const saveCardConfig = async (req, res) => {
    const { unidade, cards } = req.body;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const query = `
            INSERT INTO golden_card_config (unidade, card_index, prize_type, prize_details)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                prize_type = VALUES(prize_type), 
                prize_details = VALUES(prize_details)
        `;

        for (const card of cards) {
            await connection.query(query, [
                unidade, 
                card.index, 
                card.prize_type || null, 
                JSON.stringify(card.prize_details || {})
            ]);
        }

        await connection.commit();
        res.json({ success: true, message: "Configuração dos cards salva com sucesso!" });
    } catch (error) {
        await connection.rollback();
        console.error("❌ Erro saveCardConfig:", error);
        res.status(500).json({ error: "Erro ao salvar configuração dos cards." });
    } finally {
        connection.release();
    }
};

export const getCardConfig = async (req, res) => {
    const { unidade } = req.params;
    try {
        const [rows] = await pool.query(
            "SELECT * FROM golden_card_config WHERE unidade = ? ORDER BY card_index ASC", 
            [unidade]
        );

        const config = rows.map(r => ({
            index: r.card_index,
            prize_type: r.prize_type,
            prize_details: r.prize_details ? JSON.parse(r.prize_details) : null
        }));

        res.json(config);
    } catch (error) {
        console.error("❌ Erro getCardConfig:", error);
        res.status(500).json({ error: "Erro ao carregar configuração dos cards." });
    }
};

// 3. Buscar definição física dos armários (COM FALLBACK)
export const fetchExternalLockers = async (req, res) => {
    const { unidade } = req.params;

    const configMap = {
        sp: { 
            url: process.env.API_URL_SP || "https://dedalosadm2-3dab78314381.herokuapp.com/", 
            token: process.env.API_TOKEN_SP || "7a9e64071564f6fee8d96cd209ed3a4e86801552" 
        },
        bh: { 
            url: process.env.API_URL_BH || "https://dedalosadm2bh-09d55dca461e.herokuapp.com/", 
            token: process.env.API_TOKEN_BH || "919d97d7df39ecbd0036631caba657221acab99d" 
        }
    };
    
    const config = configMap[unidade.toLowerCase()];
    if (!config) return res.status(400).json({ error: "Unidade inválida" });

    try {
        // Tenta buscar na API Externa
        const endpoint = `${config.url}api/tools/armarios_config/`;
        console.log(`[BACKEND] Buscando armários externos em: ${endpoint}`);

        const response = await axios.get(endpoint, {
            headers: { 
                "Authorization": `Token ${config.token}`,
                "Content-Type": "application/json"
            },
            timeout: 3000 // Timeout curto para não travar muito tempo se não existir
        });
        
        res.json(response.data);

    } catch (error) {
        console.warn(`[BACKEND] Falha ao buscar armários externos (${unidade}). Usando FALLBACK local.`);
        // Se der erro (404, 500, timeout), usa o FALLBACK gerado localmente
        const fallbackData = generateFallbackLockers(unidade);
        res.json(fallbackData);
    }
};