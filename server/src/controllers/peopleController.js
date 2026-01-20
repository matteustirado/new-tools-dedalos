import pool from '../config/db.js';
import axios from 'axios';

export const syncEmployees = async (req, res) => {
    try {
        console.log("📥 [PEOPLE] Iniciando sincronização com API Externa...");

        // USANDO VARIÁVEIS DE AMBIENTE (Seguro)
        // O docker-compose passa essas variáveis para o backend
        const API_URL = process.env.VITE_API_URL_SP; 
        const API_TOKEN = process.env.VITE_API_TOKEN_SP;

        if (!API_URL || !API_TOKEN) {
            console.error("❌ ERRO: Variáveis de ambiente VITE_API_URL_SP ou VITE_API_TOKEN_SP não configuradas.");
            return res.status(500).json({ error: "Configuração de API ausente no servidor." });
        }

        // Garante que a URL não tenha barra duplicada ou falte barra
        const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
        const endpoint = `${baseUrl}/colaborador/list/`;

        // 1. Buscar dados da API Externa
        let externalList = [];
        try {
            const response = await axios.get(endpoint, {
                headers: { 
                    "Authorization": `Token ${API_TOKEN}`,
                    "Content-Type": "application/json"
                }
            });
            externalList = response.data;
            console.log(`✅ [PEOPLE] Lista baixada: ${externalList.length} colaboradores.`);
        } catch (apiError) {
            console.error("❌ Erro ao conectar na API externa:", apiError.message);
            // Se falhar a conexão, continuamos com o que tem no banco local
        }

        const now = new Date();

        // 2. Processar e Atualizar Banco Local
        if (externalList.length > 0) {
            for (const ext of externalList) {
                // Tratamento de dados
                const cpfLimpo = ext.cpf; 
                const nomeFormatado = ext.nome ? ext.nome.toUpperCase() : "NOME DESCONHECIDO";

                // Verifica se já existe
                const [rows] = await pool.query('SELECT id FROM employees WHERE cpf = ?', [cpfLimpo]);
                
                if (rows.length > 0) {
                    // ATUALIZA (Confirma que está ativo e visto hoje)
                    // Não sobrescrevemos nome/cargo se já tivermos editado localmente (opcional, aqui estamos confiando na API externa para unidade e status)
                    await pool.query(
                        'UPDATE employees SET last_seen_at = ?, status = ?, unit = ? WHERE cpf = ?',
                        [now, 'active', ext.unidade, cpfLimpo]
                    );
                } else {
                    // INSERE NOVO
                    await pool.query(
                        'INSERT INTO employees (name, cpf, unit, status, is_new, last_seen_at) VALUES (?, ?, ?, "active", true, ?)',
                        [nomeFormatado, cpfLimpo, ext.unidade, now]
                    );
                    console.log(`✨ Novo colaborador detectado: ${nomeFormatado}`);
                }
            }

            // 3. Arquivar quem NÃO veio na lista hoje
            // Se o 'last_seen_at' for mais antigo que 1 hora atrás (significa que não estava na lista baixada agora), marca como arquivado
            await pool.query(
                `UPDATE employees 
                 SET status = 'archived' 
                 WHERE status = 'active' 
                 AND last_seen_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)`
            );
        }

        // 4. Retornar lista completa do Banco Local
        // Trazemos ativos primeiro, depois arquivados recentes (30 dias)
        const [allEmployees] = await pool.query(`
            SELECT * FROM employees 
            WHERE status != 'archived' OR (status = 'archived' AND last_seen_at > DATE_SUB(NOW(), INTERVAL 30 DAY))
            ORDER BY is_new DESC, status ASC, name ASC
        `);
        
        res.json(allEmployees);

    } catch (error) {
        console.error("❌ Erro crítico no syncEmployees:", error);
        res.status(500).json({ error: "Erro interno ao sincronizar." });
    }
};

export const updateEmployee = async (req, res) => {
    const { id } = req.params;
    const { name, role, registration_code, admission_date, photo_url } = req.body;

    try {
        // Ao salvar manualmente, removemos a flag 'is_new'
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
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado" });
    
    // Retorna a URL pública para o frontend exibir
    const photoUrl = `/uploads/${req.file.filename}`;
    res.json({ url: photoUrl });
};