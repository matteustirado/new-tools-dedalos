import pool from '../config/db.js';
import axios from 'axios';

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

    // Tenta pegar o token do env ou usa o fallback (não recomendado em prod, mas mantido conforme seu código original)
    const TOKEN = process.env.VITE_API_TOKEN_SP || "7a9e64071564f6fee8d96cd209ed3a4e86801552";
    // Nota: Idealmente a URL deveria ser dinâmica baseada na unidade, mas mantendo a lógica existente:
    const BASE_URL = process.env.VITE_API_URL_SP || "https://dedalosadm2-3dab78314381.herokuapp.com/";

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

export const saveGoldenWinner = async (req, res) => {
    const { unidade, type, data } = req.body;

    try {
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
        } else {
            console.warn("[SOCKET] Instância IO não encontrada no request.");
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

// [NOVO] Salvar configuração dos cartões da Quinta Premiada
export const saveGoldenConfig = async (req, res) => {
    const { unidade, config_text } = req.body;
    try {
        // Usa INSERT ON DUPLICATE KEY UPDATE para criar ou atualizar a config da unidade
        await pool.query(
            `INSERT INTO golden_presets (unidade, config_text) 
             VALUES (?, ?) 
             ON DUPLICATE KEY UPDATE config_text = VALUES(config_text)`,
            [unidade, config_text]
        );
        res.json({ success: true });
    } catch (error) {
        console.error("Erro ao salvar config:", error);
        res.status(500).json({ error: "Erro ao salvar configuração." });
    }
};

// [NOVO] Carregar configuração dos cartões
export const getGoldenConfig = async (req, res) => {
    const { unidade } = req.params;
    try {
        const [rows] = await pool.query('SELECT config_text FROM golden_presets WHERE unidade = ?', [unidade]);
        res.json({ config_text: rows.length > 0 ? rows[0].config_text : '' });
    } catch (error) {
        console.error("Erro ao carregar config:", error);
        res.status(500).json({ error: "Erro ao carregar configuração." });
    }
};