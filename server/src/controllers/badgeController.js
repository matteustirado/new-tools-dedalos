import pool from '../config/db.js';

export const getTemplates = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM badge_templates ORDER BY role_name ASC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const saveTemplate = async (req, res) => {
    const { role_name, config, is_default } = req.body;

    try {
        if (is_default) {
            await pool.query('UPDATE badge_templates SET is_default = FALSE');
        }

        const query = `
            INSERT INTO badge_templates (role_name, config, is_default)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE config = VALUES(config), is_default = VALUES(is_default)
        `;
        
        await pool.query(query, [role_name.toUpperCase(), JSON.stringify(config), is_default]);
        res.json({ message: 'Modelo salvo com sucesso!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const deleteTemplate = async (req, res) => {
    const { role_name } = req.params;

    if (role_name === 'DEFAULT') {
        return res.status(400).json({ error: 'Não pode deletar o padrão' });
    }
    
    try {
        await pool.query('DELETE FROM badge_templates WHERE role_name = ?', [role_name]);
        res.json({ message: 'Modelo deletado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};