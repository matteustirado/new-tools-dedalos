import pool from '../config/db.js';
import { getIO } from '../socket.js';
import bcrypt from 'bcrypt';

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

export const syncEmployeesToGym = async (req, res) => {
    try {
        const [employees] = await pool.query("SELECT * FROM employees");
        let addedCount = 0;

        for (const emp of employees) {
            const cpf = emp.cpf ? String(emp.cpf).replace(/\D/g, '') : null;
            
            if (!cpf || cpf.length !== 11) continue;

            const [existing] = await pool.query("SELECT cpf FROM gym_users WHERE cpf = ?", [cpf]);
            
            if (existing.length === 0) {
                const firstName = emp.name.split(' ')[0].toLowerCase();
                const last5Cpf = cpf.slice(-5);
                const defaultPassword = `${firstName}${last5Cpf}`;
                
                const salt = await bcrypt.genSalt(10);
                const hashed = await bcrypt.hash(defaultPassword, salt);

                await pool.query(
                    "INSERT INTO gym_users (cpf, nome, senha_hash, foto_perfil) VALUES (?, ?, ?, ?)",
                    [cpf, emp.name, hashed, emp.photo || null]
                );
                
                addedCount++;
            }
        }

        if (res) {
            res.json({ message: `Sincronização concluída. ${addedCount} novos usuários cadastrados no PWA.` });
        }
    } catch (err) {
        console.error("[GYM] Erro na sincronização de usuários:", err);
        if (res) {
            res.status(500).json({ error: "Erro interno na sincronização." });
        }
    }
};

export const postCheckin = async (req, res) => {
    const { colaborador_cpf, unidade, mensagem, latitude, longitude } = req.body;
    const foto_treino_url = req.file ? `/uploads/${req.file.filename}` : null;

    if (!colaborador_cpf || !foto_treino_url) {
        return res.status(400).json({ error: "Colaborador e Foto são obrigatórios." });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    let gym_location_id = null;

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [user] = await connection.query("SELECT is_blocked FROM gym_users WHERE cpf = ?", [colaborador_cpf]);
        
        if (user.length === 0 || user[0].is_blocked) {
            await connection.rollback();
            return res.status(403).json({ error: "Acesso negado. Conta bloqueada ou inexistente." });
        }

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
            `INSERT INTO gym_checkins (colaborador_cpf, unidade, gym_location_id, foto_treino_url, mensagem, latitude, longitude) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [colaborador_cpf, unidade || 'SP', gym_location_id, foto_treino_url, mensagem || '', lat || null, lng || null]
        );

        await connection.commit();

        const io = getIO();
        
        if (io) {
            io.emit('gym:new_post', {
                id: result.insertId,
                colaborador_cpf,
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
                c.id, c.colaborador_cpf, c.unidade, c.foto_treino_url, c.mensagem, c.created_at,
                c.imagem_valida, c.localizacao_valida,
                u.nome AS colaborador_nome, u.foto_perfil AS colaborador_foto,
                l.nome AS academia_nome,
                (SELECT COUNT(*) FROM gym_likes WHERE checkin_id = c.id) AS likes_count,
                (SELECT COUNT(*) FROM gym_comments WHERE checkin_id = c.id) AS comments_count
            FROM gym_checkins c
            LEFT JOIN gym_users u ON c.colaborador_cpf = u.cpf
            LEFT JOIN gym_locations l ON c.gym_location_id = l.id
            WHERE (c.imagem_valida IS NULL OR c.imagem_valida = 1)
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
    const { checkin_id, colaborador_cpf } = req.body;

    if (!checkin_id || !colaborador_cpf) {
        return res.status(400).json({ error: "Dados inválidos." });
    }

    try {
        const [existing] = await pool.query(
            "SELECT id FROM gym_likes WHERE checkin_id = ? AND colaborador_cpf = ?",
            [checkin_id, colaborador_cpf]
        );

        let action = 'liked';

        if (existing.length > 0) {
            await pool.query("DELETE FROM gym_likes WHERE id = ?", [existing[0].id]);
            action = 'unliked';
        } else {
            await pool.query(
                "INSERT INTO gym_likes (checkin_id, colaborador_cpf) VALUES (?, ?)",
                [checkin_id, colaborador_cpf]
            );
        }

        const io = getIO();
        
        if (io) {
            io.emit('gym:new_like', { checkin_id, action, colaborador_cpf });
        }

        res.json({ success: true, action });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const postComment = async (req, res) => {
    const { checkin_id, colaborador_cpf, texto } = req.body;

    if (!checkin_id || !colaborador_cpf || !texto) {
        return res.status(400).json({ error: "Dados inválidos." });
    }

    try {
        const [result] = await pool.query(
            "INSERT INTO gym_comments (checkin_id, colaborador_cpf, texto) VALUES (?, ?, ?)",
            [checkin_id, colaborador_cpf, texto]
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
        const baseQuery = `
            SELECT c.colaborador_cpf as colaborador_id, u.nome, u.foto_perfil, COUNT(*) as total_checkins
            FROM gym_checkins c
            LEFT JOIN gym_users u ON c.colaborador_cpf = u.cpf
            WHERE (c.imagem_valida IS NULL OR c.imagem_valida = 1)
        `;

        const [topAnual] = await pool.query(`
            ${baseQuery} AND YEAR(c.created_at) = YEAR(CURRENT_DATE) 
            GROUP BY c.colaborador_cpf 
            ORDER BY total_checkins DESC LIMIT 3
        `);

        const [topMensalSP] = await pool.query(`
            ${baseQuery} AND MONTH(c.created_at) = MONTH(CURRENT_DATE) 
            AND YEAR(c.created_at) = YEAR(CURRENT_DATE) AND c.unidade = 'SP' 
            GROUP BY c.colaborador_cpf 
            ORDER BY total_checkins DESC LIMIT 3
        `);

        const [topMensalBH] = await pool.query(`
            ${baseQuery} AND MONTH(c.created_at) = MONTH(CURRENT_DATE) 
            AND YEAR(c.created_at) = YEAR(CURRENT_DATE) AND c.unidade = 'BH' 
            GROUP BY c.colaborador_cpf 
            ORDER BY total_checkins DESC LIMIT 3
        `);

        const [rankingGeral] = await pool.query(`
            SELECT c.colaborador_cpf as colaborador_id, u.nome, u.foto_perfil, c.unidade, 
                   COUNT(*) as total_checkins, MAX(c.created_at) as ultimo_checkin
            FROM gym_checkins c
            LEFT JOIN gym_users u ON c.colaborador_cpf = u.cpf
            WHERE MONTH(c.created_at) = MONTH(CURRENT_DATE) AND YEAR(c.created_at) = YEAR(CURRENT_DATE) 
              AND (c.imagem_valida IS NULL OR c.imagem_valida = 1)
            GROUP BY c.colaborador_cpf
            ORDER BY total_checkins DESC
        `);

        res.json({ topAnual, topMensalSP, topMensalBH, rankingGeral });
    } catch (err) {
        console.error("[GYM] Erro ao gerar rankings:", err);
        res.status(500).json({ error: err.message });
    }
};

export const getPendingModeration = async (req, res) => {
    try {
        const [pending] = await pool.query(`
            SELECT c.id, c.colaborador_cpf, u.nome AS colaborador_nome, u.foto_perfil AS colaborador_foto, 
                   c.foto_treino_url, c.latitude, c.longitude, c.imagem_valida, c.localizacao_valida, c.created_at 
            FROM gym_checkins c
            INNER JOIN gym_users u ON c.colaborador_cpf = u.cpf
            WHERE c.imagem_valida IS NULL OR c.localizacao_valida IS NULL
            ORDER BY c.created_at ASC
        `);
        
        res.json(pending);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const moderateCheckin = async (req, res) => {
    const { id } = req.params;
    const { imagem_valida, localizacao_valida, gym_location_id } = req.body;

    try {
        let updateQuery = "UPDATE gym_checkins SET ";
        let queryParams = [];

        if (imagem_valida !== undefined) {
            updateQuery += "imagem_valida = ?, ";
            queryParams.push(imagem_valida);
        }
        
        if (localizacao_valida !== undefined) {
            updateQuery += "localizacao_valida = ?, ";
            queryParams.push(localizacao_valida);
        }
        
        if (gym_location_id !== undefined) {
            updateQuery += "gym_location_id = ?, ";
            queryParams.push(gym_location_id);
        }

        updateQuery = updateQuery.slice(0, -2) + " WHERE id = ?";
        queryParams.push(id);

        await pool.query(updateQuery, queryParams);
        
        const io = getIO();
        
        if (io) {
            io.emit('gym:ranking_updated');
        }

        res.json({ message: "Check-in moderado com sucesso." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getGymLocations = async (req, res) => {
    try {
        const [locations] = await pool.query("SELECT * FROM gym_locations");
        
        res.json(locations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const addGymLocation = async (req, res) => {
    const { nome, unidade, latitude, longitude, raio_metros } = req.body;
    
    try {
        const [result] = await pool.query(
            "INSERT INTO gym_locations (nome, unidade, latitude, longitude, raio_metros) VALUES (?, ?, ?, ?, ?)",
            [nome, unidade || 'SP', latitude, longitude, raio_metros || 100]
        );
        
        res.status(201).json({ message: "Localização cadastrada!", location_id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getGymUsers = async (req, res) => {
    try {
        const [users] = await pool.query("SELECT cpf, nome, foto_perfil, is_blocked, must_change_password, created_at FROM gym_users ORDER BY nome ASC");
        
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const toggleBlockUser = async (req, res) => {
    const { cpf } = req.params;
    const { is_blocked } = req.body;

    try {
        await pool.query("UPDATE gym_users SET is_blocked = ? WHERE cpf = ?", [is_blocked, cpf]);
        
        res.json({ message: `Status de bloqueio alterado.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const resetPassword = async (req, res) => {
    const { cpf } = req.params;

    try {
        const [users] = await pool.query("SELECT nome FROM gym_users WHERE cpf = ?", [cpf]);
        
        if (users.length === 0) return res.status(404).json({ error: "Usuário não encontrado." });

        const firstName = users[0].nome.split(' ')[0].toLowerCase();
        const last5Cpf = String(cpf).slice(-5);
        const defaultPassword = `${firstName}${last5Cpf}`;
        
        const salt = await bcrypt.genSalt(10);
        const hashed = await bcrypt.hash(defaultPassword, salt);

        await pool.query("UPDATE gym_users SET senha_hash = ?, must_change_password = 1 WHERE cpf = ?", [hashed, cpf]);
        
        res.json({ message: "Senha redefinida com sucesso.", defaultPassword });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};