import pool from '../config/db.js';
import { getIO } from '../socket.js';

const calcularDistanciaMetros = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const p1 = lat1 * Math.PI / 180;
    const p2 = lat2 * Math.PI / 180;
    const deltaP = (lat2 - lat1) * Math.PI / 180;
    const deltaLon = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaP / 2) * Math.sin(deltaP / 2) +
        Math.cos(p1) * Math.cos(p2) *
        Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
};

export const postCheckin = async (req, res) => {
    const { colaborador_id, unidade, mensagem, latitude, longitude } = req.body;
    const foto_treino_url = req.file ? `/uploads/${req.file.filename}` : null;

    if (!colaborador_id || !foto_treino_url) {
        return res.status(400).json({ error: "Colaborador e Foto são obrigatórios." });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    let gym_location_id = null;
    const is_validado = true;

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        if (!isNaN(lat) && !isNaN(lng)) {
            const [locations] = await connection.query("SELECT * FROM gym_locations");
            
            for (const loc of locations) {
                const dist = calcularDistanciaMetros(lat, lng, loc.latitude, loc.longitude);
                if (dist <= loc.raio_metros) {
                    gym_location_id = loc.id;
                    break;
                }
            }
        }

        const [result] = await connection.query(
            `INSERT INTO gym_checkins (colaborador_id, unidade, gym_location_id, foto_treino_url, mensagem, latitude, longitude, is_validado) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [colaborador_id, unidade || 'SP', gym_location_id, foto_treino_url, mensagem || '', lat || null, lng || null, is_validado]
        );

        await connection.commit();

        const io = getIO();
        if (io) {
            io.emit('gym:new_post', {
                id: result.insertId,
                colaborador_id,
                unidade: unidade || 'SP'
            });
        }

        res.status(201).json({ message: "Check-in realizado com sucesso!", checkin_id: result.insertId });
    } catch (err) {
        await connection.rollback();
        console.error("[GYM] Erro ao salvar check-in:", err);
        res.status(500).json({ error: "Erro interno ao processar o check-in." });
    } finally {
        connection.release();
    }
};

export const getFeed = async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    try {
        const query = `
            SELECT 
                c.id, c.colaborador_id, c.unidade, c.foto_treino_url, c.mensagem, c.created_at, c.is_validado,
                u.nome AS colaborador_nome, u.foto_perfil AS colaborador_foto,
                l.nome AS academia_nome,
                (SELECT COUNT(*) FROM gym_likes WHERE checkin_id = c.id) AS likes_count,
                (SELECT COUNT(*) FROM gym_comments WHERE checkin_id = c.id) AS comments_count
            FROM gym_checkins c
            LEFT JOIN colaboradores u ON c.colaborador_id = u.id
            LEFT JOIN gym_locations l ON c.gym_location_id = l.id
            WHERE c.is_validado = 1
            ORDER BY c.created_at DESC
            LIMIT ? OFFSET ?
        `;

        const [feed] = await pool.query(query, [Number(limit), Number(offset)]);
        
        res.json(feed);
    } catch (err) {
        console.error("[GYM] Erro ao buscar feed:", err);
        res.status(500).json({ error: err.message });
    }
};

export const toggleLike = async (req, res) => {
    const { checkin_id, colaborador_id } = req.body;

    if (!checkin_id || !colaborador_id) {
        return res.status(400).json({ error: "Dados inválidos." });
    }

    try {
        const [existing] = await pool.query(
            "SELECT id FROM gym_likes WHERE checkin_id = ? AND colaborador_id = ?",
            [checkin_id, colaborador_id]
        );

        let action = 'liked';

        if (existing.length > 0) {
            await pool.query("DELETE FROM gym_likes WHERE id = ?", [existing[0].id]);
            action = 'unliked';
        } else {
            await pool.query(
                "INSERT INTO gym_likes (checkin_id, colaborador_id) VALUES (?, ?)",
                [checkin_id, colaborador_id]
            );
        }

        const io = getIO();
        if (io) {
            io.emit('gym:new_like', { checkin_id, action, colaborador_id });
        }

        res.json({ success: true, action });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const postComment = async (req, res) => {
    const { checkin_id, colaborador_id, texto } = req.body;

    if (!checkin_id || !colaborador_id || !texto) {
        return res.status(400).json({ error: "Dados inválidos." });
    }

    try {
        const [result] = await pool.query(
            "INSERT INTO gym_comments (checkin_id, colaborador_id, texto) VALUES (?, ?, ?)",
            [checkin_id, colaborador_id, texto]
        );

        const io = getIO();
        if (io) {
            io.emit('gym:new_comment', { checkin_id, comment_id: result.insertId });
        }

        res.status(201).json({ success: true, comment_id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getRankings = async (req, res) => {
    try {
        const [topAnual] = await pool.query(`
            SELECT c.colaborador_id, u.nome, u.foto_perfil, COUNT(*) as total_checkins
            FROM gym_checkins c
            LEFT JOIN colaboradores u ON c.colaborador_id = u.id
            WHERE YEAR(c.created_at) = YEAR(CURRENT_DATE) AND c.is_validado = 1
            GROUP BY c.colaborador_id
            ORDER BY total_checkins DESC
            LIMIT 3
        `);

        const [topMensalSP] = await pool.query(`
            SELECT c.colaborador_id, u.nome, u.foto_perfil, COUNT(*) as total_checkins
            FROM gym_checkins c
            LEFT JOIN colaboradores u ON c.colaborador_id = u.id
            WHERE MONTH(c.created_at) = MONTH(CURRENT_DATE) 
              AND YEAR(c.created_at) = YEAR(CURRENT_DATE) 
              AND c.unidade = 'SP' AND c.is_validado = 1
            GROUP BY c.colaborador_id
            ORDER BY total_checkins DESC
            LIMIT 3
        `);

        const [topMensalBH] = await pool.query(`
            SELECT c.colaborador_id, u.nome, u.foto_perfil, COUNT(*) as total_checkins
            FROM gym_checkins c
            LEFT JOIN colaboradores u ON c.colaborador_id = u.id
            WHERE MONTH(c.created_at) = MONTH(CURRENT_DATE) 
              AND YEAR(c.created_at) = YEAR(CURRENT_DATE) 
              AND c.unidade = 'BH' AND c.is_validado = 1
            GROUP BY c.colaborador_id
            ORDER BY total_checkins DESC
            LIMIT 3
        `);

        const [rankingGeral] = await pool.query(`
            SELECT c.colaborador_id, u.nome, u.foto_perfil, c.unidade, 
                   COUNT(*) as total_checkins, MAX(c.created_at) as ultimo_checkin
            FROM gym_checkins c
            LEFT JOIN colaboradores u ON c.colaborador_id = u.id
            WHERE MONTH(c.created_at) = MONTH(CURRENT_DATE) 
              AND YEAR(c.created_at) = YEAR(CURRENT_DATE) AND c.is_validado = 1
            GROUP BY c.colaborador_id
            ORDER BY total_checkins DESC
        `);

        res.json({ topAnual, topMensalSP, topMensalBH, rankingGeral });
    } catch (err) {
        console.error("[GYM] Erro ao gerar rankings:", err);
        res.status(500).json({ error: err.message });
    }
};

export const getOrphanLocations = async (req, res) => {
    try {
        const [orphans] = await pool.query(`
            SELECT id, colaborador_id, foto_treino_url, latitude, longitude, created_at 
            FROM gym_checkins 
            WHERE gym_location_id IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL AND is_validado = 1
            ORDER BY created_at DESC
        `);
        
        res.json(orphans);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const moderateCheckin = async (req, res) => {
    const { id } = req.params;
    const { action } = req.body;

    const is_validado = action === 'VETAR' ? 0 : 1;

    try {
        await pool.query("UPDATE gym_checkins SET is_validado = ? WHERE id = ?", [is_validado, id]);
        
        const io = getIO();
        if (io) {
            io.emit('gym:ranking_updated');
        }

        res.json({ message: `Check-in ${action === 'VETAR' ? 'vetado' : 'restaurado'} com sucesso.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};