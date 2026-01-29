import pool from '../config/db.js';
import axios from 'axios';

export const listEmployees = async (req, res) => {
    try {
        const unit = (req.query.unit || 'sp').toLowerCase();
        
        const [allEmployees] = await pool.query(`
            SELECT * FROM employees 
            WHERE unit = ? 
            AND (status != 'archived' OR (status = 'archived' AND last_seen_at > DATE_SUB(NOW(), INTERVAL 30 DAY)))
            ORDER BY is_new DESC, status ASC, name ASC
        `, [unit]);
        
        res.json(allEmployees);
    } catch (error) {
        console.error("Erro ao listar funcionários:", error);
        res.status(500).json({ error: "Erro ao carregar lista." });
    }
};

export const syncEmployees = async (req, res) => {
    try {
        const unit = (req.query.unit || 'sp').toLowerCase();
        let API_URL, API_TOKEN;

        if (unit === 'bh') {
            API_URL = process.env.VITE_API_URL_BH;
            API_TOKEN = process.env.VITE_API_TOKEN_BH;
        } else {
            API_URL = process.env.VITE_API_URL_SP;
            API_TOKEN = process.env.VITE_API_TOKEN_SP;
        }

        if (!API_URL || !API_TOKEN) {
            return res.status(500).json({ error: `Configuração de API para ${unit.toUpperCase()} não encontrada.` });
        }

        const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
        const endpoint = `${baseUrl}/colaborador/list/`;

        let externalList = [];
        try {
            const response = await axios.get(endpoint, {
                headers: { 
                    "Authorization": `Token ${API_TOKEN}`,
                    "Content-Type": "application/json"
                }
            });
            externalList = response.data;
        } catch (apiError) {
            console.error(`Erro API Externa (${unit}):`, apiError.message);
        }

        const now = new Date();

        if (externalList.length > 0) {
            for (const ext of externalList) {
                const cpfLimpo = ext.cpf; 
                const nomeFormatado = ext.nome ? ext.nome.toUpperCase() : "NOME DESCONHECIDO";
                
                const [rows] = await pool.query('SELECT id FROM employees WHERE cpf = ?', [cpfLimpo]);
                
                if (rows.length > 0) {
                    await pool.query(
                        'UPDATE employees SET last_seen_at = ?, status = ?, unit = ? WHERE cpf = ?',
                        [now, 'active', unit, cpfLimpo]
                    );
                } else {
                    await pool.query(
                        'INSERT INTO employees (name, cpf, unit, status, is_new, last_seen_at) VALUES (?, ?, ?, "active", true, ?)',
                        [nomeFormatado, cpfLimpo, unit, now]
                    );
                }
            }
        }

        const [allEmployees] = await pool.query(`
            SELECT * FROM employees 
            WHERE unit = ? 
            AND (status != 'archived' OR (status = 'archived' AND last_seen_at > DATE_SUB(NOW(), INTERVAL 30 DAY)))
            ORDER BY is_new DESC, status ASC, name ASC
        `, [unit]);
        
        res.json(allEmployees);

    } catch (error) {
        console.error("Erro crítico no syncEmployees:", error);
        res.status(500).json({ error: "Erro interno ao sincronizar." });
    }
};

export const updateEmployee = async (req, res) => {
    const { id } = req.params;
    const { name, role, registration_code, admission_date, photo_url, cpf } = req.body;

    try {
        await pool.query(
            `UPDATE employees SET 
                name = ?, role = ?, registration_code = ?, admission_date = ?, photo_url = ?, is_new = false, cpf = ?
             WHERE id = ?`,
            [name, role, registration_code, admission_date, photo_url, cpf, id]
        );
        res.json({ success: true, message: "Dados atualizados!" });
    } catch (error) {
        console.error("Erro ao atualizar:", error);
        res.status(500).json({ error: "Erro ao salvar dados no banco." });
    }
};

export const uploadEmployeePhoto = async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado" });
    const photoUrl = `/uploads/${req.file.filename}`;
    res.json({ url: photoUrl });
};