import pool from '../config/db.js';
import axios from 'axios';

// --- FUNÇÕES DE HISTÓRICO ---

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

// --- FUNÇÕES DE CLIENTE (PROXY) ---

export const buscarClientePorPulseira = async (req, res) => {
    const { pulseira } = req.params;

    // [CORREÇÃO] Usando VITE_ prefixo conforme docker-compose
    const TOKEN = process.env.VITE_API_TOKEN_SP; 
    const BASE_URL = process.env.VITE_API_URL_SP;

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

// --- FUNÇÕES QUINTA PREMIADA (SORTEIO) ---

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
            io.emit('golden:winner_update', {
                unidade: unidade,
                winner: null
            });
        }

        res.json({ success: true, message: "Sorteio ativo limpo com sucesso." });
    } catch (error) {
        console.error("❌ Erro ao limpar sorteio ativo:", error);
        res.status(500).json({ error: "Erro ao limpar sorteio." });
    }
};

// --- FUNÇÕES QUINTA PREMIADA (CONFIGURAÇÃO) ---

export const saveGoldenConfig = async (req, res) => {
    const { unidade, cards } = req.body;
    try {
        const cardsString = JSON.stringify(cards);
        
        const query = `
            INSERT INTO golden_card_config (unidade, cards_data)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE cards_data = VALUES(cards_data)
        `;
        
        await pool.query(query, [unidade, cardsString]);
        res.json({ success: true, message: "Configuração dos cards salva!" });
    } catch (error) {
        console.error("❌ Erro ao salvar config cards:", error);
        res.status(500).json({ error: "Erro ao salvar configuração." });
    }
};

export const getGoldenConfig = async (req, res) => {
    const { unidade } = req.params;
    try {
        const query = 'SELECT cards_data FROM golden_card_config WHERE unidade = ?';
        const [rows] = await pool.query(query, [unidade]);
        
        if (rows.length > 0) {
            const data = typeof rows[0].cards_data === 'string' 
                ? JSON.parse(rows[0].cards_data) 
                : rows[0].cards_data;
            res.json(data);
        } else {
            res.json([]);
        }
    } catch (error) {
        console.error("❌ Erro ao buscar config cards:", error);
        res.status(500).json({ error: "Erro ao buscar configuração." });
    }
};

// --- FUNÇÕES QUINTA PREMIADA (BUSCA EXTERNA) ---

export const getLockers = async (req, res) => {
    const { unidade } = req.params;

    // [CORREÇÃO CRÍTICA] Usando os nomes exatos do docker-compose (VITE_)
    let baseUrl, token;
    if (unidade.toLowerCase() === 'bh') {
        baseUrl = process.env.VITE_API_URL_BH;
        token = process.env.VITE_API_TOKEN_BH;
    } else {
        baseUrl = process.env.VITE_API_URL_SP;
        token = process.env.VITE_API_TOKEN_SP;
    }

    if (!baseUrl || !token) {
        console.error(`❌ Variáveis de ambiente VITE_API_... não configuradas para unidade: ${unidade}`);
        return res.status(500).json({ message: "Configuração de API ausente no servidor." });
    }

    try {
        // Remove barra final da URL se houver e adiciona /api/proxy
        const sanitizedUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const endpoint = `${sanitizedUrl}/api/proxy`;
        
        console.log(`[BACKEND] Buscando armários (via Proxy) em: ${endpoint}`);

        const response = await axios.get(endpoint, {
            headers: {
                "Authorization": `Token ${token}`,
                "Content-Type": "application/json"
            }
        });

        // Tratamento da resposta (baseado no script que rodou no console)
        let dados = response.data.dados || response.data.data || [];

        // Converte para array se necessário
        if (!Array.isArray(dados) && typeof dados === 'object') {
            dados = Object.values(dados);
        }

        // Normalização dos dados
        const cleanData = dados.map(item => {
            const num = parseInt((item.name_door || '').replace(/\D/g, '')) || 0;

            let size = 'UNK';
            const typeUpper = (item.type_door || '').toUpperCase();
            if (typeUpper.includes('MÉDIA') || typeUpper.includes('MEDIA')) size = 'M';
            else if (typeUpper.includes('GRANDE')) size = 'G';
            else if (typeUpper.includes('PEQUENA')) size = 'P';
            else if (typeUpper.includes('MICRO') || typeUpper.includes('PP')) size = 'PP';

            let status = 'LIVRE';
            const sitUpper = (item.sit_door || '').toUpperCase();
            if (sitUpper.includes('CLIENTE-IN')) status = 'OCUPADO';
            else if (sitUpper.includes('MANUTEN') || sitUpper.includes('INDISPON')) status = 'MANUTENCAO';
            else if (sitUpper.includes('RESERVADO')) status = 'RESERVADO';

            return {
                locker: num,
                size: size,
                status: status,
                original_id: item.id_door
            };
        });

        return res.status(200).json(cleanData);

    } catch (error) {
        console.error("❌ Erro ao buscar armários na API externa:", error.message);
        
        if (error.response) {
            console.error("Status:", error.response.status);
            return res.status(error.response.status).json({ 
                message: "Erro na API externa", 
                details: error.response.data 
            });
        }
        
        return res.status(500).json({ message: "Erro interno ao buscar armários." });
    }
};