import pool from '../config/db.js';
import axios from 'axios';

// ==========================================
// CONFIGURAÇÕES DE ACESSO (SITE MÃE)
// ==========================================
const SITE_CONFIG = {
    sp: {
        url: "https://www.dedalos.app.br", 
        referer: "https://www.dedalos.app.br/armarios"
    },
    bh: {
        url: "https://www.dedalosbh.app", 
        referer: "https://www.dedalosbh.app/armarios"
    }
};

// Fallback desativado
const FALLBACK_CONFIG = null;

// ==========================================
// HELPERS DE MAPEAMENTO
// ==========================================
const mapExternalSize = (typeDoor) => {
    if (!typeDoor) return 'P';
    const type = String(typeDoor).toUpperCase();
    
    if (type.includes('MÉDIA') || type.includes('MEDIA')) return 'M';
    if (type.includes('GRANDE')) return 'G';
    if (type.includes('GIGANTE') || type.includes('PRO')) return 'PP';
    if (type.includes('PEQUENA')) return 'P';
    if (type.includes('MICRO')) return 'MICRO';
    return 'P'; 
};

const mapExternalStatus = (sitDoor) => {
    if (!sitDoor) return 'ativo';
    const sit = String(sitDoor).toUpperCase();
    
    if (sit.includes('MANUT') || sit.includes('DEFEITO') || sit.includes('QUEBRAD') || sit.includes('INATIVO')) return 'manutencao';
    return 'ativo'; 
};

// ==========================================
// FUNÇÕES GERAIS
// ==========================================

export const salvarHistorico = async (req, res) => {
    try {
        const { tipo, unidade, total_sorteados, total_resgatados, detalhes } = req.body;
        if (!tipo || !unidade) return res.status(400).json({ error: "Campos obrigatórios" });

        const query = `INSERT INTO historico_promocoes (tipo, unidade, total_sorteados, total_resgatados, detalhes) VALUES (?, ?, ?, ?, ?)`;
        await pool.query(query, [tipo, unidade, total_sorteados || 0, total_resgatados || 0, JSON.stringify(detalhes || [])]);

        res.status(201).json({ message: "Salvo com sucesso!" });
    } catch (error) {
        console.error("❌ Erro salvarHistorico:", error);
        res.status(500).json({ error: "Erro interno." });
    }
};

export const listarHistorico = async (req, res) => {
    try {
        const { unidade, tipo } = req.params;
        const [rows] = await pool.query(
            "SELECT * FROM historico_promocoes WHERE unidade = ? AND tipo = ? ORDER BY data_hora DESC LIMIT 50", 
            [unidade, tipo]
        );
        const formatado = rows.map(r => ({ ...r, detalhes: typeof r.detalhes === 'string' ? JSON.parse(r.detalhes) : r.detalhes }));
        res.json(formatado);
    } catch (error) {
        res.status(500).json({ error: "Erro interno." });
    }
};

export const buscarClientePorPulseira = async (req, res) => {
    const { pulseira } = req.params;
    const TOKEN = process.env.DEDALOS_API_TOKEN || "7a9e64071564f6fee8d96cd209ed3a4e86801552";
    const BASE_URL = "https://dedalosadm2-3dab78314381.herokuapp.com/";

    try {
        const response = await axios.get(`${BASE_URL}api/entradasOne/${pulseira}/`, {
            headers: { "Authorization": `Token ${TOKEN}`, "Content-Type": "application/json" }
        });
        return res.status(200).json(response.data);
    } catch (error) {
        if (error.response) return res.status(error.response.status).json(error.response.data);
        return res.status(500).json({ message: "Erro API externa." });
    }
};

// ==========================================
// FUNÇÕES QUINTA PREMIADA
// ==========================================

export const saveGoldenWinner = async (req, res) => {
    const { unidade, type, data } = req.body;
    try {
        await pool.query("DELETE FROM historico_promocoes WHERE unidade = ? AND tipo = 'QUINTA_PREMIADA_WINNER'", [unidade]);
        await pool.query(
            "INSERT INTO historico_promocoes (tipo, unidade, detalhes, data_hora) VALUES (?, ?, ?, NOW())",
            ['QUINTA_PREMIADA_WINNER', unidade, JSON.stringify(data)]
        );
        const io = req.app.get('io');
        if (io) io.emit('golden:winner_update', { unidade, winner: data });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Erro ao processar." });
    }
};

export const getLastGoldenWinner = async (req, res) => {
    const { unidade } = req.params;
    try {
        const [rows] = await pool.query(
            "SELECT detalhes FROM historico_promocoes WHERE unidade = ? AND tipo = 'QUINTA_PREMIADA_WINNER' ORDER BY id DESC LIMIT 1", 
            [unidade]
        );
        if (rows.length > 0) {
            res.json(typeof rows[0].detalhes === 'string' ? JSON.parse(rows[0].detalhes) : rows[0].detalhes);
        } else {
            res.json(null);
        }
    } catch (error) {
        res.status(500).json({ error: "Erro ao buscar." });
    }
};

export const clearGoldenWinner = async (req, res) => {
    const { unidade } = req.params;
    try {
        await pool.query("DELETE FROM historico_promocoes WHERE unidade = ? AND tipo = 'QUINTA_PREMIADA_WINNER'", [unidade]);
        const io = req.app.get('io');
        if (io) io.emit('golden:winner_update', { unidade, winner: null });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Erro ao limpar." });
    }
};

export const saveCardConfig = async (req, res) => {
    const { unidade, cards } = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const query = `INSERT INTO golden_card_config (unidade, card_index, prize_type, prize_details) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE prize_type = VALUES(prize_type), prize_details = VALUES(prize_details)`;
        for (const card of cards) {
            await connection.query(query, [unidade, card.index, card.prize_type || null, JSON.stringify(card.prize_details || {})]);
        }
        await connection.commit();
        res.json({ success: true });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: "Erro ao salvar config." });
    } finally {
        connection.release();
    }
};

export const getCardConfig = async (req, res) => {
    const { unidade } = req.params;
    try {
        const [rows] = await pool.query("SELECT * FROM golden_card_config WHERE unidade = ? ORDER BY card_index ASC", [unidade]);
        const config = rows.map(r => ({ index: r.card_index, prize_type: r.prize_type, prize_details: r.prize_details ? JSON.parse(r.prize_details) : null }));
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: "Erro ao carregar config." });
    }
};

// ==========================================
// 3. BUSCAR INFRAESTRUTURA (SITE MÃE NEXT.JS)
// ==========================================
export const fetchExternalLockers = async (req, res) => {
    const { unidade } = req.params;
    
    const siteConfig = SITE_CONFIG[unidade.toLowerCase()];
    if (!siteConfig) return res.status(400).json({ error: "Unidade inválida" });

    try {
        const endpoint = `${siteConfig.url}/api/proxy`;
        
        // Headers simplificados para passar pelo WAF/Frontend
        const response = await axios.get(endpoint, {
            headers: { 
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": siteConfig.referer,
                "Origin": siteConfig.url
            },
            timeout: 6000
        });
        
        const listaBruta = response.data.dados || response.data.data || response.data;

        if (Array.isArray(listaBruta)) {
            const lockersProcessados = listaBruta.map(item => {
                const numeroLimpo = parseInt(String(item.name_door).replace(/\D/g, ''));
                if (isNaN(numeroLimpo)) return null;

                return {
                    numero: numeroLimpo,
                    tamanho: mapExternalSize(item.type_door),
                    status: mapExternalStatus(item.sit_door)
                };
            }).filter(item => item !== null);

            if (lockersProcessados.length === 0) {
                throw new Error("Lista vazia após processamento.");
            }

            lockersProcessados.sort((a, b) => a.numero - b.numero);
            
            console.log(`[BACKEND] Infra carregada de ${siteConfig.url}: ${lockersProcessados.length} armários.`);
            return res.json(lockersProcessados);
        } else {
            throw new Error("Site não retornou um array em data.dados.");
        }

    } catch (error) {
        console.error(`[BACKEND] Erro infra (${unidade}): ${error.message}`);
        res.json([]); 
    }
};