import pool from '../config/db.js';

export const getBlockedList = async (req, res) => {
  const { unidade } = req.params;
  
  try {
    const [rows] = await pool.query(
      `SELECT * FROM lista_bloqueados WHERE unidade = ? AND status = 'ATIVO' ORDER BY data_inclusao DESC`,
      [unidade.toUpperCase()]
    );

    return res.json(rows);
  } catch (err) {
    console.error("[BlockedList] Erro ao buscar bloqueados ativos:", err);
    return res.status(500).json({ error: 'Erro interno ao buscar lista de bloqueados.' });
  }
};

export const getBlockedHistory = async (req, res) => {
  const { unidade } = req.params;
  
  try {
    const [rows] = await pool.query(
      `SELECT * FROM lista_bloqueados WHERE unidade = ? AND status = 'REMOVIDO' ORDER BY data_remocao DESC`,
      [unidade.toUpperCase()]
    );

    return res.json(rows);
  } catch (err) {
    console.error("[BlockedList] Erro ao buscar histórico:", err);
    return res.status(500).json({ error: 'Erro interno ao buscar histórico.' });
  }
};

export const addBlocked = async (req, res) => {
  const { unidade, nome_completo, data_limite, motivo, blockAllUnits } = req.body;
  const foto_url = req.file ? `/uploads/${req.file.filename}` : null;
  
  if (!unidade || !nome_completo) {
    return res.status(400).json({ error: 'Unidade e Nome Completo são obrigatórios.' });
  }

  try {
    const isBlockAll = blockAllUnits === 'true' || blockAllUnits === true;
    const unidadesToBlock = isBlockAll ? ['SP', 'BH'] : [unidade.toUpperCase()];

    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      for (const unit of unidadesToBlock) {
        await connection.query(
          `INSERT INTO lista_bloqueados (unidade, nome_completo, motivo, foto_url, data_limite) VALUES (?, ?, ?, ?, ?)`,
          [unit, nome_completo.trim(), motivo || null, foto_url, data_limite || null]
        );
      }

      await connection.commit();
      return res.status(201).json({ message: 'Bloqueio adicionado com sucesso.' });
    } catch (txErr) {
      await connection.rollback();
      throw txErr;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error("[BlockedList] Erro ao adicionar bloqueio:", err);
    return res.status(500).json({ error: 'Erro ao salvar o bloqueio no banco de dados.' });
  }
};

export const updateBlocked = async (req, res) => {
  const { id } = req.params;
  const { nome_completo, data_limite, motivo } = req.body;
  const newFotoUrl = req.file ? `/uploads/${req.file.filename}` : null;
  
  if (!nome_completo) {
    return res.status(400).json({ error: 'O nome não pode ser vazio.' });
  }

  try {
    let query = `UPDATE lista_bloqueados SET nome_completo = ?, data_limite = ?, motivo = ?`;
    const params = [nome_completo.trim(), data_limite || null, motivo || null];

    if (newFotoUrl) {
      query += `, foto_url = ?`;
      params.push(newFotoUrl);
    }

    query += ` WHERE id = ?`;
    params.push(id);

    const [result] = await pool.query(query, params);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Registro não encontrado.' });
    }
    
    return res.json({ message: 'Bloqueio atualizado com sucesso.', foto_url: newFotoUrl });
  } catch (err) {
    console.error("[BlockedList] Erro ao atualizar bloqueio:", err);
    return res.status(500).json({ error: 'Erro ao atualizar registro.' });
  }
};

export const removeBlocked = async (req, res) => {
  const { id } = req.params;
  
  try {
    const [result] = await pool.query(
      `UPDATE lista_bloqueados SET status = 'REMOVIDO', data_remocao = NOW() WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Registro não encontrado.' });
    }

    return res.json({ message: 'Bloqueio removido (enviado para o histórico).' });
  } catch (err) {
    console.error("[BlockedList] Erro ao remover bloqueio:", err);
    return res.status(500).json({ error: 'Erro ao remover registro.' });
  }
};