import pool from '../config/db.js';
import path from 'path';
import fs from 'fs';

const emitUpdate = (req, unidade) => {
    try {
        const io = req.app.get('io');
        if (io) {
            io.emit('prices:updated', { unidade: unidade.toLowerCase() });
            console.log(`[Socket] Evento prices:updated emitido para: ${unidade}`);
        }
    } catch (error) {
        console.error("Erro ao emitir socket:", error);
    }
};

export const getHolidays = async (req, res) => {
    const { unidade } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM holidays WHERE unidade = ? ORDER BY data_feriado ASC', [unidade.toUpperCase()]);
        res.json(rows);
    } catch (err) {
        console.error("Erro getHolidays:", err);
        res.status(500).json({ error: err.message });
    }
};

export const addHoliday = async (req, res) => {
    const { unidade, nome, data_feriado } = req.body;
    try {
        await pool.query('INSERT INTO holidays (unidade, nome, data_feriado) VALUES (?, ?, ?)', [unidade.toUpperCase(), nome, data_feriado]);
        emitUpdate(req, unidade);
        res.json({ message: "Feriado adicionado!" });
    } catch (err) {
        console.error("Erro addHoliday:", err);
        res.status(500).json({ error: "Erro ao adicionar (Verifique se a data já existe)." });
    }
};

export const deleteHoliday = async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query('SELECT unidade FROM holidays WHERE id = ?', [id]);
        if (rows.length === 0) return res.json({ message: "Feriado já removido." });

        const unidade = rows[0].unidade;
        await pool.query('DELETE FROM holidays WHERE id = ?', [id]);
        
        emitUpdate(req, unidade);
        res.json({ message: "Feriado removido." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getPromotions = async (req, res) => {
    const { unidade } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM price_promotions WHERE unidade = ? ORDER BY id DESC', [unidade.toUpperCase()]);
        const formatted = rows.map(r => ({
            ...r,
            dias_ativos: (typeof r.dias_ativos === 'string') ? JSON.parse(r.dias_ativos) : r.dias_ativos
        }));
        res.json(formatted);
    } catch (err) {
        console.error("Erro getPromotions:", err);
        res.status(500).json({ error: err.message });
    }
};

export const savePromotions = async (req, res) => {
    const { unidade, promotions } = req.body;
    if (!unidade) return res.status(400).json({ error: "Unidade obrigatória." });

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const unidadeUpper = unidade.toUpperCase();

        await connection.query('DELETE FROM price_promotions WHERE unidade = ?', [unidadeUpper]);

        if (promotions && promotions.length > 0) {
            const values = promotions.map(p => [unidadeUpper, p.image_url, JSON.stringify(p.dias_ativos)]);
            await connection.query('INSERT INTO price_promotions (unidade, image_url, dias_ativos) VALUES ?', [values]);
        }

        await connection.commit();
        emitUpdate(req, unidade);
        res.json({ message: "Promoções salvas com sucesso!" });
    } catch (err) {
        await connection.rollback();
        console.error("Erro savePromotions:", err);
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
};

export const getPriceConfigByType = async (req, res) => {
    const { unidade, tipo } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM prices_active WHERE unidade = ? AND tipo = ?', [unidade.toUpperCase(), tipo]);
        
        if (rows.length === 0) {
            return res.json({
                unidade: unidade.toUpperCase(),
                tipo: tipo,
                titulo_tabela: 'Nova Tabela',
                qtd_categorias: 3,
                modo_exibicao: 'tv',
                aviso_1: '', aviso_2: '', aviso_3: '', aviso_4: '',
                categorias: []
            });
        }

        const config = rows[0];
        if (typeof config.categorias === 'string') config.categorias = JSON.parse(config.categorias);
        res.json(config);
    } catch (err) {
        console.error("Erro getPriceConfig:", err);
        res.status(500).json({ error: err.message });
    }
};

export const updatePriceConfig = async (req, res) => {
    const { unidade, tipo, titulo_tabela, qtd_categorias, modo_exibicao, aviso_1, aviso_2, aviso_3, aviso_4, categorias } = req.body;
    if (!unidade || !tipo) return res.status(400).json({ error: "Dados incompletos." });

    try {
        const categoriasJson = JSON.stringify(categorias);
        const unidadeUpper = unidade.toUpperCase();

        const sql = `
            INSERT INTO prices_active (unidade, tipo, titulo_tabela, qtd_categorias, modo_exibicao, aviso_1, aviso_2, aviso_3, aviso_4, categorias)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            titulo_tabela = VALUES(titulo_tabela),
            qtd_categorias = VALUES(qtd_categorias),
            modo_exibicao = VALUES(modo_exibicao),
            aviso_1 = VALUES(aviso_1),
            aviso_2 = VALUES(aviso_2),
            aviso_3 = VALUES(aviso_3),
            aviso_4 = VALUES(aviso_4),
            categorias = VALUES(categorias)
        `;

        await pool.query(sql, [unidadeUpper, tipo, titulo_tabela, qtd_categorias, modo_exibicao, aviso_1, aviso_2, aviso_3, aviso_4, categoriasJson]);
        
        emitUpdate(req, unidade);
        res.json({ message: "Tabela salva com sucesso!" });
    } catch (err) {
        console.error("Erro updatePriceConfig:", err);
        res.status(500).json({ error: err.message });
    }
};

export const getActiveDisplayPrice = async (req, res) => {
    const { unidade } = req.params;
    const unidadeUpper = unidade.toUpperCase();
    
    const hoje = new Date();
    hoje.setHours(hoje.getHours() - 3);
    const dataIso = hoje.toISOString().split('T')[0];
    const diaSemana = hoje.getDay();

    try {
        let tipoAtivo = 'padrao';

        const [feriados] = await pool.query('SELECT * FROM holidays WHERE unidade = ? AND data_feriado = ?', [unidadeUpper, dataIso]);
        
        if (feriados.length > 0) {
            tipoAtivo = 'feriado';
        } else if (diaSemana === 0 || diaSemana === 6) {
            tipoAtivo = 'fim_de_semana';
        }

        const [rows] = await pool.query('SELECT * FROM prices_active WHERE unidade = ? AND tipo = ?', [unidadeUpper, tipoAtivo]);
        if (rows.length === 0) return res.status(404).json({ error: "Nenhuma tabela configurada." });

        const config = rows[0];
        if (typeof config.categorias === 'string') config.categorias = JSON.parse(config.categorias);
        
        config.debug_info = {
            data: dataIso,
            dia_semana: diaSemana,
            tipo_detectado: tipoAtivo
        };

        res.json(config);
    } catch (err) {
        console.error("Erro getActiveDisplayPrice:", err);
        res.status(500).json({ error: err.message });
    }
};

export const uploadPriceMedia = async (req, res) => {
    if (!req.files || !req.files.priceMedia) return res.status(400).json({ error: "Nenhum arquivo." });

    const file = req.files.priceMedia;
    const uploadPath = path.join(process.cwd(), 'public', 'uploads', 'prices');

    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

    const fileName = `price_${Date.now()}${path.extname(file.name)}`;
    file.mv(path.join(uploadPath, fileName), (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ url: `/uploads/prices/${fileName}` });
    });
};