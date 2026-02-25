import pool from '../config/db.js';
import { getIO } from '../socket.js';
import { io as ioClient } from 'socket.io-client';
import axios from 'axios';

const CHECKIN_INTERVAL = 30000;

const EXTERNAL_SOCKETS = {
    SP: 'https://placar-80b3f72889ba.herokuapp.com/',
    BH: 'https://placarbh-cf51a4a5b78a.herokuapp.com/'
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
        BH: { url: process.env.VITE_API_URL_BH, token: process.env.VITE_API_TOKEN_BH }
    }[unidadeUpper];

    log('PROXY', `Iniciando busca externa para unidade: ${unidadeUpper}`);

    if (!config || !config.url) {
        log('PROXY_ERR', '❌ Configuração de API (URL/Token) não encontrada no .env do servidor.', { unidade: unidadeUpper });
        return null;
    }

    try {
        const baseUrl = config.url.replace(/\/$/, "");
        let endpoint = `${baseUrl}/api/contador/`;
        let response;

        try {
            response = await axios.get(endpoint, {
                headers: { "Authorization": `Token ${config.token}` },
                timeout: 5000
            });
        } catch (err) {
            log('PROXY_WARN', `Falha no endpoint principal (${err.message}). Tentando fallback...`);
            
            const dataHoje = new Date().toISOString().split('T')[0];
            endpoint = `${baseUrl}/api/entradasPorData/${dataHoje}`;
            response = await axios.get(endpoint, {
                headers: { "Authorization": `Token ${config.token}` },
                timeout: 5000
            });
        }

        const data = response.data;

        if (Array.isArray(data)) {
            if (data.length > 0 && data[0].contador !== undefined) return data[0].contador;
            return data.length;
        } 
        
        if (data.results) {
            return data.results.length;
        } 
        
        if (data.contador !== undefined) {
            return data.contador;
        } 
        
        if (data.count !== undefined) {
            return data.count;
        }

        return 0;

    } catch (error) {
        console.error(`[Dedalos API] Erro crítico em ${unidade}:`, error.message);
        log('PROXY_ERR', `Erro na comunicação com API externa`, error.message);
        return null;
    }
};

const iniciarPonteRealTime = () => {
    log('PONTE', "Iniciando Ponte Real-Time com servidores externos...");

    Object.entries(EXTERNAL_SOCKETS).forEach(([unidade, url]) => {
        try {
            const socket = ioClient(url, { transports: ['websocket', 'polling'] });

            socket.on('connect', () => {
                log('PONTE', `✅ [${unidade}] Conectado ao servidor externo!`);
            });

            socket.on('disconnect', () => {});

            socket.on('new_id', async (data) => {
                log('PONTE', `⚡ [${unidade}] CHECK-IN DETECTADO!`);
                const totalAtual = await fetchFromDedalos(unidade);
                
                if (totalAtual !== null) {
                    const io = getIO();
                    io.emit('checkin:novo', { 
                        unidade: unidade, 
                        total: totalAtual, 
                        origem: 'websocket_externo',
                        timestamp: new Date()
                    });
                }
            });

        } catch (error) {
            console.error(`[Ponte ${unidade}] Erro ao inicializar socket:`, error);
        }
    });
};

const iniciarSentinela = () => {
    log('SENTINELA', "Serviço de Backup HTTP iniciado.");

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
                        timestamp: new Date()
                    });
                    lastCheckinCount[unidade] = totalAtual;
                }
            }
        }
    }, CHECKIN_INTERVAL);
};

iniciarPonteRealTime();
iniciarSentinela();

export const getCrowdCount = async (req, res) => {
    const { unidade } = req.params;
    log('API', `Frontend solicitou contagem para ${unidade}`);
    
    const count = await fetchFromDedalos(unidade);
    
    if (count !== null) {
        return res.json({ count });
    }

    log('API_ERR', `Falha ao obter contagem para ${unidade}`);
    res.status(502).json({ error: "Falha na comunicação com API Dedalos Externa" });
};

export const testarTrigger = (req, res) => {
    const { unidade } = req.params;
    const unidadeUpper = unidade ? unidade.toUpperCase() : 'SP';

    try {
        const io = getIO();
        log('TESTE', `Disparo manual para ${unidadeUpper}`);
        
        io.emit('checkin:novo', { 
            unidade: unidadeUpper,
            total: 999, 
            novos: 1,
            timestamp: new Date()
        });

        res.json({ message: `Teste enviado para ${unidadeUpper}` });
    } catch (error) {
        res.status(500).json({ error: "Erro interno." });
    }
};

export const getActiveConfig = async (req, res) => {
    const { unidade } = req.params;

    try {
        const [rows] = await pool.query('SELECT * FROM scoreboard_active WHERE unidade = ?', [unidade.toUpperCase()]);
        
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
        return res.status(400).json({ error: "Dados incompletos." });
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
        await connection.query('DELETE FROM scoreboard_votes WHERE unidade = ?', [unidadeUpper]);
        
        await connection.commit();

        const io = getIO();
        io.emit('scoreboard:config_updated', { unidade: unidadeUpper });
        io.emit('scoreboard:vote_updated', { unidade: unidadeUpper, votes: [] });

        res.json({ message: "Placar atualizado!" });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
};

export const castVote = async (req, res) => {
    const { unidade, optionIndex } = req.body;
    
    if (!unidade || optionIndex === undefined) {
        return res.status(400).json({ error: "Voto inválido." });
    }

    try {
        const unidadeUpper = unidade.toUpperCase();
        await pool.query('INSERT INTO scoreboard_votes (unidade, option_index) VALUES (?, ?)', [unidadeUpper, optionIndex]);
        
        const io = getIO();
        const [rows] = await pool.query(
            'SELECT option_index, COUNT(*) as count FROM scoreboard_votes WHERE unidade = ? GROUP BY option_index', 
            [unidadeUpper]
        );

        io.emit('scoreboard:vote_updated', { unidade: unidadeUpper, votes: rows });
        res.json({ message: "Voto computado." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getVotes = async (req, res) => {
    const { unidade } = req.params;

    try {
        const [rows] = await pool.query(
            'SELECT option_index, COUNT(*) as count FROM scoreboard_votes WHERE unidade = ? GROUP BY option_index', 
            [unidade.toUpperCase()]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const resetVotes = async (req, res) => {
    const { unidade } = req.body;

    try {
        const unidadeUpper = unidade.toUpperCase();
        await pool.query('DELETE FROM scoreboard_votes WHERE unidade = ?', [unidadeUpper]);
        
        const io = getIO();
        io.emit('scoreboard:vote_updated', { unidade: unidadeUpper, votes: [] });
        
        res.json({ message: "Votos zerados." });
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
        res.json({ message: "Preset salvo." });
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

        const formatted = rows.map(r => ({ 
            ...r, 
            opcoes: (typeof r.opcoes === 'string') ? JSON.parse(r.opcoes) : r.opcoes 
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
        res.json({ message: "Preset excluído." });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
};