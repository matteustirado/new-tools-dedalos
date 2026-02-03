import pool from '../config/db.js';
import axios from 'axios';

// Helper para pegar credenciais da unidade
const getUnitCredentials = (unidade) => {
    const unitLower = unidade ? unidade.toLowerCase() : 'sp';
    if (unitLower === 'bh') {
        return {
            url: process.env.API_URL_BH || process.env.VITE_API_URL_BH,
            token: process.env.API_TOKEN_BH || process.env.VITE_API_TOKEN_BH
        };
    }
    // Default SP
    return {
        url: process.env.API_URL_SP || process.env.VITE_API_URL_SP,
        token: process.env.API_TOKEN_SP || process.env.VITE_API_TOKEN_SP
    };
};

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
    const { url, token } = getUnitCredentials('sp'); 

    try {
        const endpoint = `${url}api/entradasOne/${pulseira}/`;
        console.log(`[BACKEND] Proxy consultando pulseira ${pulseira}`);

        const response = await axios.get(endpoint, {
            headers: {
                "Authorization": `Token ${token}`,
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

export const saveGoldenConfig = async (req, res) => {
    const { unidade, config_text } = req.body;
    try {
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

// [NOVO] LÓGICA DE SORTEIO NO SERVIDOR (Com Mapeamento Real)
export const performDraw = async (req, res) => {
    const { unidade, prizeConfig } = req.body;
    const { url, token } = getUnitCredentials(unidade);

    try {
        console.log(`[DRAW] Iniciando sorteio para ${unidade}...`);

        // ROTA CONFIRMADA: api/entradas/ (O Node consegue acessar, o navegador não)
        const endpoint = `${url}api/entradas/`; 
        
        const externalResponse = await axios.get(endpoint, {
            headers: { "Authorization": `Token ${token}` }
        });

        // O sistema antigo pode retornar array direto ou dentro de .dados
        const allLockers = externalResponse.data.dados || externalResponse.data;

        if (!Array.isArray(allLockers)) {
            console.error("Resposta da API:", externalResponse.data);
            throw new Error("Resposta inválida do sistema externo: não é um array.");
        }

        // 2. Filtra Armários Elegíveis (Mapeamento baseado no seu console.log)
        // Item exemplo: { type_door: 'MÉDIA', name_door: 'PORTA 01', sit_door: 'DISPONÍVEL' }
        const availableLockers = allLockers.filter(locker => {
            const status = locker.sit_door ? locker.sit_door.toUpperCase() : '';
            const type = locker.type_door ? locker.type_door.toUpperCase() : '';

            // Regras:
            // 1. Deve estar DISPONÍVEL
            // 2. Não pode ser PP
            // 3. Não pode estar INDISPONÍVEL ou em MANUTENÇÃO
            const isFree = status === 'DISPONÍVEL'; 
            const isNotPP = type !== 'PP';
            
            return isFree && isNotPP;
        });

        console.log(`[DRAW] Total: ${allLockers.length} | Elegíveis: ${availableLockers.length}`);

        if (availableLockers.length === 0) {
            return res.status(400).json({ error: "Nenhum armário disponível para sorteio no momento." });
        }

        // 3. Preparar Sorteio
        const couponsToDraw = prizeConfig.length;
        const targetTotal = Math.min(couponsToDraw, availableLockers.length);

        // 4. Embaralhar
        const shuffledLockers = availableLockers.sort(() => 0.5 - Math.random()).slice(0, targetTotal);
        const shuffledCards = [...prizeConfig].sort(() => 0.5 - Math.random()).slice(0, targetTotal);

        // 5. Montar Resultado (Traduzindo para o formato do nosso Front)
        const finalDraw = shuffledLockers.map((locker, index) => {
            const assignedCard = shuffledCards[index];
            
            // Extrai apenas o número do nome (Ex: "PORTA 01" -> 1)
            let lockerNum = locker.name_door;
            try {
                const match = locker.name_door.match(/\d+/);
                if (match) lockerNum = parseInt(match[0], 10);
            } catch (e) {
                lockerNum = locker.name_door; // Fallback
            }

            // Mapeia Tamanho para P, M, G (Opcional, mas bom para UI)
            let sizeShort = locker.type_door;
            if (locker.type_door === 'MÉDIA') sizeShort = 'M';
            if (locker.type_door === 'PEQUENA') sizeShort = 'P';
            if (locker.type_door === 'GRANDE') sizeShort = 'G';

            return {
                locker: lockerNum,
                size: sizeShort,
                status: 'pending', // No nosso sistema é 'pending' até alguém entrar
                cardNumber: assignedCard.cardNumber,
                prizeCategory: assignedCard.category,
                preAssignedPrize: assignedCard.category,
                prize: null, 
                details: null, 
                currentWristband: null, 
                currentClientName: null
            };
        }).sort((a, b) => a.locker - b.locker);

        // 6. Salvar e Emitir
        const dbType = 'QUINTA_PREMIADA_WINNER';
        await pool.query(
            `INSERT INTO historico_promocoes (tipo, unidade, detalhes, data_hora) VALUES (?, ?, ?, NOW())`, 
            [dbType, unidade, JSON.stringify(finalDraw)]
        );

        const io = req.app.get('io');
        if (io) {
            io.emit('golden:winner_update', { unidade, winner: finalDraw });
        }

        res.json({ success: true, message: "Sorteio realizado com sucesso!", data: finalDraw });

    } catch (error) {
        console.error("❌ Erro performDraw:", error.message);
        res.status(500).json({ 
            error: "Erro na comunicação com sistema externo.", 
            details: error.response?.data || error.message 
        });
    }
};