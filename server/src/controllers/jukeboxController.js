import { getIO } from '../socket.js';
import pool from '../config/db.js';
import { 
  adicionarPedidoNaFila, 
  comporFilaVisual, 
  verificarDisponibilidadeTrack 
} from './conductorController.js';

const LIMITE_PEDIDOS = 5;
const LIMITE_TEMPO_MINUTOS = 30;
const LIMITE_ARTISTA = 2;
const LIMITE_TEMPO_ARTISTA_MINUTOS = 10;
const LIMITE_TEMPO_MUSICA_MINUTOS = 10;

export const getHistoricoPedidos = async (req, res) => {
  const limitParam = parseInt(req.query.limit, 10);
  const limit = isNaN(limitParam) || limitParam <= 0 ? 100 : limitParam;

  const query = `
    SELECT 
      jp.id,
      jp.pulseira_id,
      jp.unidade,
      jp.status,
      jp.pedido_em as created_at, 
      jp.tocado_em,
      jp.termo_busca,
      jp.telefone, 
      t.titulo,
      t.artista,
      t.thumbnail_url,
      t.is_commercial
    FROM jukebox_pedidos jp
    LEFT JOIN tracks t ON jp.track_id = t.id
    ORDER BY jp.pedido_em DESC
    LIMIT ?
  `;

  try {
    const [rows] = await pool.query(query, [limit]);
    res.json(rows);
  } catch (error) {
    console.error("[Jukebox] Erro ao buscar histórico:", error);
    res.status(500).json({ error: "Erro ao buscar histórico de pedidos." });
  }
};

export const handleReceberSugestao = async (socket, data) => {
  const { termo, pulseiraId, unidade } = data;

  if (!termo || !pulseiraId || !unidade) {
    return;
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO jukebox_pedidos (pulseira_id, unidade, status, termo_busca, track_id) VALUES (?, ?, ?, ?, NULL)',
      [pulseiraId, unidade, 'SUGERIDA', termo]
    );
    
    console.log(`[Jukebox] Sugestão salva: "${termo}" (${unidade}) - ID: ${result.insertId}`);
    socket.emit('jukebox:sugestaoAceita', { suggestionId: result.insertId }); 
  } catch (err) {
    console.error("[Jukebox] Erro ao salvar sugestão:", err);
    socket.emit('jukebox:erroPedido', { message: 'Erro ao salvar sugestão.' });
  }
};

export const handleAtualizarTelefoneSugestao = async (socket, data) => {
  const { id, telefone } = data;

  if (!id || !telefone) return;

  try {
    await pool.query(
      'UPDATE jukebox_pedidos SET telefone = ? WHERE id = ? AND status = "SUGERIDA"',
      [telefone, id]
    );
    console.log(`[Jukebox] Telefone ${telefone} atrelado à sugestão #${id}`);
    socket.emit('jukebox:telefoneAtualizadoSucesso');
  } catch (err) {
    console.error("[Jukebox] Erro ao salvar telefone da sugestão:", err);
  }
};

export const handleAdicionarPedido = async (socket, data) => {
  const { trackId, pulseiraId, unidade } = data;

  if (!trackId || !pulseiraId || !unidade) {
    socket.emit('jukebox:erroPedido', { message: 'Pedido inválido.' });
    return;
  }
  
  const pulseiraLimpa = String(pulseiraId).trim();

  if (pulseiraLimpa.length === 0) {
    socket.emit('jukebox:erroPedido', { message: 'Número da pulseira inválido.' });
    return;
  }

  const disponibilidade = verificarDisponibilidadeTrack(trackId);
  
  if (!disponibilidade.allowed) {
    socket.emit('jukebox:pedidoRecusado', { motivo: disponibilidade.motivo });
    return; 
  }

  try {
    const [trackInfo] = await pool.query('SELECT titulo, artista FROM tracks WHERE id = ?', [trackId]);
    
    if (trackInfo.length === 0) {
      socket.emit('jukebox:erroPedido', { message: 'Música não encontrada no acervo.' });
      return;
    }

    const [songLimitCheck] = await pool.query(
      `SELECT COUNT(*) as total_musica
       FROM jukebox_pedidos
       WHERE track_id = ? AND unidade = ? 
         AND pedido_em > NOW() - INTERVAL ? MINUTE`,
      [trackId, unidade, LIMITE_TEMPO_MUSICA_MINUTOS]
    );

    if (songLimitCheck[0].total_musica > 0) {
      socket.emit('jukebox:erroPedido', { 
        message: `A música "${trackInfo[0].titulo}" acabou de ser pedida e já está na fila. Escolha outro hit!`
      });
      return;
    }

    const nomeArtistaOriginal = trackInfo[0].artista || '';
    const mainArtist = nomeArtistaOriginal.split(/,| feat\.|&/i)[0].trim();

    if (mainArtist) {
      const [artistLimitCheck] = await pool.query(
        `SELECT COUNT(*) as total_artista
         FROM jukebox_pedidos jp
         JOIN tracks t ON jp.track_id = t.id
         WHERE jp.unidade = ? 
           AND jp.pedido_em > NOW() - INTERVAL ? MINUTE
           AND t.artista LIKE ?`,
        [unidade, LIMITE_TEMPO_ARTISTA_MINUTOS, `${mainArtist}%`]
      );

      if (artistLimitCheck[0].total_artista >= LIMITE_ARTISTA) {
        socket.emit('jukebox:erroPedido', { 
          message: `A pista já está cheia de pedidos de ${mainArtist}. Tente diversificar e pedir outro cantor!`
        });
        return;
      }
    }

    const [rateLimitCheck] = await pool.query(
      `SELECT 
         COUNT(*) as total_pedidos,
         TIMESTAMPDIFF(SECOND, NOW(), DATE_ADD(MIN(pedido_em), INTERVAL ? MINUTE)) as segundos_restantes
       FROM jukebox_pedidos 
       WHERE pulseira_id = ? AND unidade = ? 
         AND pedido_em > NOW() - INTERVAL ? MINUTE`,
      [LIMITE_TEMPO_MINUTOS, pulseiraLimpa, unidade, LIMITE_TEMPO_MINUTOS]
    );

    if (rateLimitCheck[0].total_pedidos >= LIMITE_PEDIDOS) {
      const segRestantes = rateLimitCheck[0].segundos_restantes;
      const diffMinutos = Math.floor(segRestantes / 60);
      const diffSegundos = segRestantes % 60;
      
      const tempoFormatado = diffMinutos > 0 
        ? `${diffMinutos}m e ${diffSegundos}s` 
        : `${diffSegundos}s`;

      socket.emit('jukebox:erroPedido', { 
        message: `Limite de ${LIMITE_PEDIDOS} músicas atingido! Uma vaga será libertada em ${tempoFormatado}.`,
        isRateLimit: true
      });
      return;
    }

    const [insertResult] = await pool.query(
      'INSERT INTO jukebox_pedidos (track_id, pulseira_id, unidade, status) VALUES (?, ?, ?, ?)',
      [trackId, pulseiraLimpa, unidade, 'PENDENTE']
    );
    
    const pedidoObjeto = {
      id: insertResult.insertId,
      trackId,
      pulseiraId: pulseiraLimpa,
      unidade,
      tipo: 'JUKEBOX'
    };
    
    const posicaoNaFila = adicionarPedidoNaFila(pedidoObjeto); 

    socket.emit('jukebox:pedidoAceito', { posicao: posicaoNaFila });
    
    const filaVisual = await comporFilaVisual();
    getIO().emit('maestro:filaAtualizada', filaVisual);

  } catch (err) {
    console.error("[Jukebox] Erro interno no handleAdicionarPedido:", err);
    socket.emit('jukebox:erroPedido', { message: 'Erro crítico ao processar pedido.' });
  }
};