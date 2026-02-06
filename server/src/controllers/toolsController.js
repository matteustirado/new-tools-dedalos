import pool from '../config/db.js';
import axios from 'axios';

// Salva o histórico final da promoção
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

// Lista o histórico de promoções anteriores
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

// Proxy para buscar dados do cliente na API externa
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

// Salva o estado atual do sorteio (Vencedor Ativo)
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

// Busca o último sorteio ativo (para persistência ao recarregar página)
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

// [NOVO] Limpa o sorteio ativo do banco e avisa via socket (Correção do bug de finalização)
export const clearGoldenWinner = async (req, res) => {
    const { unidade } = req.params;
    try {
        const query = `
            DELETE FROM historico_promocoes 
            WHERE unidade = ? AND tipo = 'QUINTA_PREMIADA_WINNER'
        `;
        
        await pool.query(query, [unidade]);

        // Avisa via Socket para limpar a tela de todos conectados
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

// [NOVO] Salva a configuração dos 50 cards
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

// [NOVO] Busca a configuração salva dos cards
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
            res.json([]); // Retorna vazio se ainda não configurou
        }
    } catch (error) {
        console.error("❌ Erro ao buscar config cards:", error);
        res.status(500).json({ error: "Erro ao buscar configuração." });
    }
};

// [NOVO] Busca a lista completa de armários (Portas) da API Externa (Correção da Dinâmica)
export const getLockers = async (req, res) => {
    const { unidade } = req.params;

    // Configurações de API baseadas na unidade
    let baseUrl, token;
    if (unidade.toLowerCase() === 'bh') {
        baseUrl = process.env.VITE_API_URL_BH || "https://dedalosadm2bh-09d55dca461e.herokuapp.com/";
        token = process.env.VITE_API_TOKEN_BH || "919d97d7df39ecbd0036631caba657221acab99d";
    } else {
        baseUrl = process.env.VITE_API_URL_SP || "https://dedalosadm2-3dab78314381.herokuapp.com/";
        token = process.env.VITE_API_TOKEN_SP || "7a9e64071564f6fee8d96cd209ed3a4e86801552";
    }

    try {
        const endpoint = `${baseUrl}api/portas/`;
        console.log(`[BACKEND] Buscando armários (portas) em: ${endpoint}`);

        const response = await axios.get(endpoint, {
            headers: {
                "Authorization": `Token ${token}`,
                "Content-Type": "application/json"
            }
        });

        // A API externa retorna { status: '1', mensagem: '...', dados: [...] }
        // Garantimos que retornamos apenas o array de dados
        let dados = response.data;
        if (dados.dados) {
            dados = dados.dados;
        }

        return res.status(200).json(dados);

    } catch (error) {
        console.error("❌ Erro ao buscar lista de armários:", error.message);
        
        if (error.response) {
            return res.status(error.response.status).json(error.response.data);
        }
        
        return res.status(500).json({ message: "Erro interno ao buscar lista de armários." });
    }
};