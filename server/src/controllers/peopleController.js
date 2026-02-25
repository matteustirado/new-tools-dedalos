import pool from '../config/db.js';
import axios from 'axios';

export const syncEmployees = async (req, res) => {
    try {
        const API_URL = process.env.VITE_API_URL_SP;
        const API_TOKEN = process.env.VITE_API_TOKEN_SP;

        if (!API_URL || !API_TOKEN) {
            return res.status(500).json({ error: "Configuração de API ausente no servidor." });
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
            console.error("Erro ao conectar na API externa:", apiError.message);
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
                        [now, 'active', ext.unidade, cpfLimpo]
                    );
                } else {
                    await pool.query(
                        'INSERT INTO employees (name, cpf, unit, status, is_new, last_seen_at) VALUES (?, ?, ?, "active", true, ?)',
                        [nomeFormatado, cpfLimpo, ext.unidade, now]
                    );
                }
            }

            await pool.query(
                `UPDATE employees 
                 SET status = 'archived' 
                 WHERE status = 'active' 
                 AND last_seen_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)`
            );
        }

        const [allEmployees] = await pool.query(`
            SELECT * FROM employees 
            WHERE status != 'archived' OR (status = 'archived' AND last_seen_at > DATE_SUB(NOW(), INTERVAL 30 DAY))
            ORDER BY is_new DESC, status ASC, name ASC
        `);

        res.json(allEmployees);

    } catch (error) {
        console.error("Erro crítico no syncEmployees:", error);
        res.status(500).json({ error: "Erro interno ao sincronizar." });
    }
};

export const updateEmployee = async (req, res) => {
    const { id } = req.params;
    const { name, role, registration_code, admission_date, photo_url } = req.body;

    try {
        await pool.query(
            `UPDATE employees SET 
                name = ?, role = ?, registration_code = ?, admission_date = ?, photo_url = ?, is_new = false 
             WHERE id = ?`,
            [name, role, registration_code, admission_date, photo_url, id]
        );

        res.json({ success: true, message: "Dados atualizados!" });
    } catch (error) {
        console.error("Erro ao atualizar:", error);
        res.status(500).json({ error: "Erro ao salvar dados no banco." });
    }
};

export const uploadEmployeePhoto = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado" });
    }

    const photoUrl = `/uploads/${req.file.filename}`;
    res.json({ url: photoUrl });
};