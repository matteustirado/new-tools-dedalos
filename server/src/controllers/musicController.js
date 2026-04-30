import pool from '../config/db.js';
import axios from 'axios';
import YtDlpWrap from 'yt-dlp-wrap';
import ffmpeg from 'fluent-ffmpeg';
import multer from 'multer';
import fs from 'fs';
import pathNode from 'path';
import { fileURLToPath } from 'url';
import { getIO } from '../socket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = pathNode.dirname(__filename);

const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3/videos';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const ytDlpWrap = new YtDlpWrap.default();
const ALL_DAYS_ARRAY = [0, 1, 2, 3, 4, 5, 6];
const SLOTS_PER_DAY = 144;

const COVERS_DIR = pathNode.join(__dirname, '../assets/upload/covers');
const OVERLAYS_DIR = pathNode.join(__dirname, '../assets/upload/overlays');
const UPLOADS_DIR = pathNode.join(__dirname, '../../public/uploads');

[COVERS_DIR, OVERLAYS_DIR, UPLOADS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'overlay') cb(null, OVERLAYS_DIR);
    else if (file.fieldname === 'cover') cb(null, COVERS_DIR);
    else cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + pathNode.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(pathNode.extname(file.originalname).toLowerCase());
    if (mimetype && extname) return cb(null, true);
    cb(new Error("Erro: Apenas arquivos de imagem são permitidos!"));
  }
}).fields([
  { name: 'cover', maxCount: 1 },
  { name: 'overlay', maxCount: 1 },
  { name: 'foto', maxCount: 1 }
]);

export const uploadMiddleware = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: "As imagens não podem exceder 5MB." });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

const deleteLocalFile = (filePath) => {
  if (!filePath) return;
  try {
    const fullPath = filePath.includes('/uploads/') 
      ? pathNode.join(__dirname, '../../public', filePath)
      : pathNode.join(__dirname, '..', filePath);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  } catch (err) {
    console.error(err);
  }
};

const safeJsonParse = (input) => {
  if (Array.isArray(input)) return input;
  if (!input || typeof input !== 'string') return [];
  try {
    const cleanedString = input.replace(/\s+/g, '').replace(/,\s*]/, ']');
    const parsed = JSON.parse(cleanedString);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

const parseYoutubeUrl = (url) => {
  try {
    const videoUrl = new URL(url);
    if (videoUrl.hostname === 'youtu.be') return videoUrl.pathname.slice(1);
    if (videoUrl.hostname.includes('youtube.com')) return videoUrl.searchParams.get('v');
    return null;
  } catch (error) {
    return null;
  }
};

const parseISODuration = (isoDuration) => {
  const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
  const matches = isoDuration.match(regex);
  const hours = parseInt(matches[1] || 0);
  const minutes = parseInt(matches[2] || 0);
  const seconds = parseInt(matches[3] || 0);
  return (hours * 3600) + (minutes * 60) + seconds;
};

const parseAndValidateTrackIds = (tracksIdsInput) => {
  let tracksIdsArray = [];
  let error = null;

  if (tracksIdsInput && typeof tracksIdsInput === 'string') {
    try {
      tracksIdsArray = JSON.parse(tracksIdsInput.replace(/\s+/g, '').replace(/,\s*]/, ']'));
      if (!Array.isArray(tracksIdsArray)) {
        error = 'Formato inválido para lista de músicas.';
        tracksIdsArray = [];
      } else {
        tracksIdsArray = tracksIdsArray.map(id => Number(id)).filter(id => !isNaN(id));
      }
    } catch (e) {
      error = `Erro ao processar lista de músicas: ${e.message}`;
    }
  } else if (Array.isArray(tracksIdsInput)) {
    tracksIdsArray = tracksIdsInput.map(id => Number(id)).filter(id => !isNaN(id));
  }
  return { tracksIdsArray, error };
};

const analyzeLoudness = async (trackId, youtubeId) => {
  try {
    const videoUrl = `http://www.youtube.com/watch?v=${youtubeId}`;
    const rawOutput = await ytDlpWrap.execPromise([videoUrl, '--dump-single-json', '--no-warnings', '--quiet']);
    const jsonStartIndex = rawOutput.indexOf('{');
    if (jsonStartIndex === -1) throw new Error('JSON inválido');

    const metadata = JSON.parse(rawOutput.substring(jsonStartIndex));
    const audioFormat = metadata.formats.find(f => f.acodec !== 'none' && f.vcodec === 'none' && (f.ext === 'm4a' || f.ext === 'opus')) 
                     || metadata.formats.find(f => f.acodec !== 'none' && f.vcodec === 'none');

    if (!audioFormat) throw new Error('Formato de áudio não encontrado');

    const loudness = await new Promise((resolve, reject) => {
      let loudnessValue = null;
      ffmpeg(audioFormat.url)
        .withAudioFilter('ebur128')
        .on('stderr', (line) => {
          const match = line.match(/I:\s*(-?[\d\.]+)\s*LUFS/);
          if (match && match[1]) loudnessValue = parseFloat(match[1]);
        })
        .on('error', reject)
        .on('end', () => loudnessValue !== null ? resolve(loudnessValue) : reject(new Error('Loudness não extraído')))
        .format('null')
        .save('-');
    });

    await pool.query('UPDATE tracks SET loudness_lufs = ?, status_processamento = "PROCESSADO" WHERE id = ?', [loudness, trackId]);
    try { getIO().emit('acervo:atualizado'); } catch (e) {}

  } catch (err) {
    try {
      await pool.query('UPDATE tracks SET status_processamento = "ERRO" WHERE id = ?', [trackId]);
      getIO().emit('acervo:atualizado');
    } catch (dbError) {}
  }
};

export const fetchYoutubeData = async (req, res) => {
  const { url } = req.body;
  const youtubeId = parseYoutubeUrl(url);

  if (!youtubeId) return res.status(400).json({ error: 'URL inválida.' });

  try {
    const [existing] = await pool.query('SELECT id FROM tracks WHERE youtube_id = ?', [youtubeId]);
    if (existing.length > 0) return res.status(409).json({ error: 'Música já existe.' });

    const response = await axios.get(YOUTUBE_API_URL, {
      params: { part: 'snippet,contentDetails', id: youtubeId, key: YOUTUBE_API_KEY }
    });

    if (response.data.items.length === 0) return res.status(404).json({ error: 'Vídeo não encontrado.' });

    const snippet = response.data.items[0].snippet;
    const durationInSeconds = parseISODuration(response.data.items[0].contentDetails.duration);
    const thumbnailUrl = snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || null;

    res.json({
      youtube_id: youtubeId,
      titulo: snippet.title,
      artista: snippet.channelTitle,
      duracao_segundos: durationInSeconds,
      end_segundos: durationInSeconds,
      thumbnail_url: thumbnailUrl
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar YouTube.' });
  }
};

export const addTrack = async (req, res) => {
  const { youtube_id, titulo, artista, artistas_participantes, album, ano, gravadora, diretor, thumbnail_url, duracao_segundos, start_segundos, end_segundos, is_commercial, dias_semana } = req.body;

  if (!youtube_id || !titulo || !artista) return res.status(400).json({ error: 'Dados incompletos.' });

  const diasSemanaArray = Array.isArray(dias_semana) && dias_semana.length > 0 ? dias_semana : ALL_DAYS_ARRAY;

  try {
    const newTrack = {
      youtube_id, titulo, artista, album, gravadora, diretor, thumbnail_url, duracao_segundos, start_segundos, end_segundos, is_commercial,
      artistas_participantes: JSON.stringify(artistas_participantes || []),
      ano: (ano !== '' && ano != null) ? parseInt(ano, 10) : null,
      dias_semana: JSON.stringify(diasSemanaArray),
      status_processamento: 'PENDENTE'
    };

    const [result] = await pool.query('INSERT INTO tracks SET ?', newTrack);
    getIO().emit('acervo:atualizado');
    
    res.status(201).json({ message: 'Música adicionada!', id: result.insertId });
    analyzeLoudness(result.insertId, youtube_id);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar no banco.' });
  }
};

export const listTracks = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM tracks ORDER BY created_at DESC');
    res.json(rows.map(track => ({
      ...track,
      artistas_participantes: safeJsonParse(track.artistas_participantes),
      dias_semana: safeJsonParse(track.dias_semana)
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateTrack = async (req, res) => {
  const { id } = req.params;
  const { titulo, artista, artistas_participantes, album, ano, gravadora, diretor, thumbnail_url, start_segundos, end_segundos, is_commercial, dias_semana } = req.body;

  const diasSemanaArray = Array.isArray(dias_semana) && dias_semana.length > 0 ? dias_semana : ALL_DAYS_ARRAY;

  try {
    const fieldsToUpdate = {
      titulo, artista, album, gravadora, diretor, thumbnail_url, start_segundos, end_segundos, is_commercial,
      artistas_participantes: JSON.stringify(artistas_participantes || []),
      ano: (ano !== '' && ano != null) ? parseInt(ano, 10) : null,
      dias_semana: JSON.stringify(diasSemanaArray)
    };

    const [result] = await pool.query('UPDATE SET ? WHERE id = ?', [fieldsToUpdate, id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Música não encontrada.' });

    getIO().emit('acervo:atualizado');
    res.json({ message: 'Música atualizada!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar.' });
  }
};

export const deleteTrack = async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM tracks WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Música não encontrada.' });
    getIO().emit('acervo:atualizado');
    res.json({ message: 'Música deletada!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao deletar.' });
  }
};

export const deleteMultipleTracks = async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'IDs inválidos.' });

  const numericIds = ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
  if (numericIds.length === 0) return res.status(400).json({ error: 'IDs inválidos.' });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const placeholders = numericIds.map(() => '?').join(',');
    const [result] = await connection.query(`DELETE FROM tracks WHERE id IN (${placeholders})`, numericIds);
    await connection.commit();
    getIO().emit('acervo:atualizado');
    res.json({ message: `${result.affectedRows} excluídas!` });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: 'Erro ao excluir.' });
  } finally {
    connection.release();
  }
};

export const createPlaylist = async (req, res) => {
  const { name, description, tracks_ids } = req.body;
  const coverFile = req.files?.['cover']?.[0];
  const overlayFile = req.files?.['overlay']?.[0];
  const { tracksIdsArray, error } = parseAndValidateTrackIds(tracks_ids);

  if (!name || error) {
    if (coverFile) deleteLocalFile(`/assets/upload/covers/${coverFile.filename}`);
    if (overlayFile) deleteLocalFile(`/assets/upload/overlays/${overlayFile.filename}`);
    return res.status(400).json({ error: error || 'Nome obrigatório.' });
  }

  try {
    const imagePath = coverFile ? `/assets/upload/covers/${coverFile.filename}` : null;
    const overlayPath = overlayFile ? `/assets/upload/overlays/${overlayFile.filename}` : null;

    const [result] = await pool.query('INSERT INTO playlists SET ?', {
      nome: name, descricao: description, imagem: imagePath, overlay: overlayPath, tracks_ids: JSON.stringify(tracksIdsArray)
    });
    res.status(201).json({ message: 'Playlist criada!', id: result.insertId, imagePath, overlayPath });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar playlist.' });
  }
};

export const getAllPlaylists = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM playlists ORDER BY nome ASC');
    res.json(rows.map(p => ({ ...p, tracks_ids: safeJsonParse(p.tracks_ids) })));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar playlists.' });
  }
};

export const getPlaylistById = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM playlists WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Playlist não encontrada.' });
    res.json({ ...rows[0], tracks_ids: safeJsonParse(rows[0].tracks_ids) });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar.' });
  }
};

export const updatePlaylist = async (req, res) => {
  const { name, description, tracks_ids, existingImagePath, existingOverlayPath } = req.body;
  const coverFile = req.files?.['cover']?.[0];
  const overlayFile = req.files?.['overlay']?.[0];
  const { tracksIdsArray, error } = parseAndValidateTrackIds(tracks_ids);

  if (!name || error) return res.status(400).json({ error: error || 'Nome obrigatório.' });

  try {
    let imagePath = existingImagePath || null;
    let overlayPath = existingOverlayPath || null;

    if (coverFile) {
      imagePath = `/assets/upload/covers/${coverFile.filename}`;
      if (existingImagePath) deleteLocalFile(existingImagePath);
    }
    if (overlayFile) {
      overlayPath = `/assets/upload/overlays/${overlayFile.filename}`;
      if (existingOverlayPath) deleteLocalFile(existingOverlayPath);
    }

    const [result] = await pool.query('UPDATE playlists SET ? WHERE id = ?', [{
      nome: name, descricao: description, imagem: imagePath, overlay: overlayPath, tracks_ids: JSON.stringify(tracksIdsArray)
    }, req.params.id]);

    if (result.affectedRows === 0) return res.status(404).json({ error: 'Não encontrada.' });
    res.json({ message: 'Playlist atualizada!', imagePath, overlayPath });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar.' });
  }
};

export const deletePlaylist = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT imagem, overlay FROM playlists WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Não encontrada.' });

    const [result] = await pool.query('DELETE FROM playlists WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Não excluída.' });

    deleteLocalFile(rows[0].imagem);
    deleteLocalFile(rows[0].overlay);
    res.json({ message: 'Playlist excluída!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir.' });
  }
};

export const getScheduleSummaryByMonth = async (req, res) => {
  const { year, month } = req.params;
  const lastDay = new Date(year, month, 0).getDate();
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  try {
    const [rows] = await pool.query(
      `SELECT DISTINCT DATE_FORMAT(data_agendamento, '%Y-%m-%d') as scheduled_date FROM agendamentos WHERE data_agendamento BETWEEN ? AND ? AND playlist_id IS NOT NULL`,
      [start, end]
    );
    res.json(rows.map(r => r.scheduled_date));
  } catch (err) {
    res.status(500).json({ error: 'Erro no agendamento.' });
  }
};

export const getScheduleByDate = async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT slot_index, playlist_id FROM agendamentos WHERE data_agendamento = ? ORDER BY slot_index ASC`, [req.params.data]);
    const playlistIds = rows.map(r => r.playlist_id).filter(id => id !== null);

    let playlists = [];
    if (playlistIds.length > 0) {
      const placeholders = playlistIds.map(() => '?').join(',');
      [playlists] = await pool.query(`SELECT id, nome FROM playlists WHERE id IN (${placeholders})`, playlistIds);
    }

    const schedule = {};
    rows.forEach(row => {
      if (row.playlist_id !== null) {
        const pData = playlists.find(p => p.id === row.playlist_id);
        schedule[row.slot_index] = { playlist_id: row.playlist_id, playlist_nome: pData ? pData.nome : 'Playlist Inválida' };
      }
    });
    res.json(schedule);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar.' });
  }
};

export const saveSchedule = async (req, res) => {
  const { dates, schedule, regra_repeticao } = req.body;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    if (dates.length > 0) {
      const placeholders = dates.map(() => '?').join(',');
      await connection.query(`DELETE FROM agendamentos WHERE data_agendamento IN (${placeholders})`, dates);
    }

    const inserts = [];
    dates.forEach(date => {
      for (let slot = 0; slot < SLOTS_PER_DAY; slot++) {
        if (schedule[slot]?.playlist_id) {
          inserts.push([date, slot, Number(schedule[slot].playlist_id), regra_repeticao]);
        }
      }
    });

    if (inserts.length > 0) {
      await connection.query('INSERT INTO agendamentos (data_agendamento, slot_index, playlist_id, regra_repeticao) VALUES ?', [inserts]);
    }
    await connection.commit();
    res.status(201).json({ message: 'Agendamento salvo!' });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: 'Erro ao salvar.' });
  } finally {
    connection.release();
  }
};

export const getBlockedList = async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM lista_bloqueados WHERE unidade = ? AND status = 'ATIVO' ORDER BY data_inclusao DESC`, [req.params.unidade.toUpperCase()]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar bloqueados.' });
  }
};

export const getBlockedHistory = async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM lista_bloqueados WHERE unidade = ? AND status = 'REMOVIDO' ORDER BY data_remocao DESC`, [req.params.unidade.toUpperCase()]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar histórico.' });
  }
};

export const addBlocked = async (req, res) => {
  const { unidade, nome_completo, data_limite, motivo, blockAllUnits } = req.body;
  const foto_url = req.files?.['foto']?.[0] ? `/uploads/${req.files['foto'][0].filename}` : null;
  const isBlockAll = blockAllUnits === 'true' || blockAllUnits === true;
  const unidades = isBlockAll ? ['SP', 'BH'] : [unidade.toUpperCase()];

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const unit of unidades) {
      await connection.query(
        `INSERT INTO lista_bloqueados (unidade, nome_completo, motivo, foto_url, data_limite) VALUES (?, ?, ?, ?, ?)`,
        [unit, nome_completo.trim(), motivo || null, foto_url, data_limite || null]
      );
    }
    await connection.commit();
    res.status(201).json({ message: 'Bloqueio adicionado!' });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: 'Erro ao salvar.' });
  } finally {
    connection.release();
  }
};

export const updateBlocked = async (req, res) => {
  const { nome_completo, data_limite, motivo } = req.body;
  const foto_url = req.files?.['foto']?.[0] ? `/uploads/${req.files['foto'][0].filename}` : null;
  
  try {
    const query = foto_url 
      ? 'UPDATE lista_bloqueados SET nome_completo=?, data_limite=?, motivo=?, foto_url=? WHERE id=?' 
      : 'UPDATE lista_bloqueados SET nome_completo=?, data_limite=?, motivo=? WHERE id=?';
    const params = foto_url ? [nome_completo, data_limite, motivo, foto_url, req.params.id] : [nome_completo, data_limite, motivo, req.params.id];

    const [result] = await pool.query(query, params);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Não encontrado.' });
    res.json({ message: 'Atualizado com sucesso!', foto_url });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar.' });
  }
};

export const removeBlocked = async (req, res) => {
  try {
    const [result] = await pool.query(`UPDATE lista_bloqueados SET status = 'REMOVIDO', data_remocao = NOW() WHERE id = ?`, [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Não encontrado.' });
    res.json({ message: 'Bloqueio removido!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover.' });
  }
};

let maestroInterval = null;
let filaReproducao = [];
let pedidosJukebox = [];
let comerciaisFila = [];

const radioState = {
  playerAtivo: 'A',
  musicaAtual: null,
  tempoAtualSegundos: 0,
  playlistAtualId: null,
  overlayUrl: null
};

const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const fetchCurrentSchedule = async () => {
  try {
    const now = new Date();
    const currentDateStr = now.toISOString().split('T')[0];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const currentSlot = Math.floor(currentMinutes / 10);

    const [rows] = await pool.query(
      `SELECT playlist_id FROM agendamentos WHERE data_agendamento = ? AND slot_index <= ? ORDER BY slot_index DESC LIMIT 1`,
      [currentDateStr, currentSlot]
    );

    if (rows.length > 0 && rows[0].playlist_id) {
      if (radioState.playlistAtualId !== rows[0].playlist_id) {
        radioState.playlistAtualId = rows[0].playlist_id;
        await carregarPlaylistParaFila(rows[0].playlist_id);
      }
    }
  } catch (err) {
    console.error(err);
  }
};

const carregarPlaylistParaFila = async (playlistId) => {
  try {
    const [rows] = await pool.query('SELECT tracks_ids FROM playlists WHERE id = ?', [playlistId]);
    if (rows.length === 0) return;

    const trackIds = safeJsonParse(rows[0].tracks_ids);
    if (trackIds.length === 0) return;

    const placeholders = trackIds.map(() => '?').join(',');
    const [tracks] = await pool.query(`SELECT * FROM tracks WHERE id IN (${placeholders}) AND status_processamento = 'PROCESSADO'`, trackIds);

    filaReproducao = shuffleArray(tracks.map(t => ({ ...t, tipo: 'PLAYLIST' })));
    emitirFila();
  } catch (err) {
    console.error(err);
  }
};

const emitirFila = () => {
  const filaCombinada = [...comerciaisFila, ...pedidosJukebox, ...filaReproducao].slice(0, 15);
  getIO().emit('maestro:filaAtualizada', filaCombinada);
};

const tocarProximaMusica = () => {
  let proxima = null;

  if (comerciaisFila.length > 0) proxima = comerciaisFila.shift();
  else if (pedidosJukebox.length > 0) proxima = pedidosJukebox.shift();
  else if (filaReproducao.length > 0) {
    proxima = filaReproducao.shift();
    filaReproducao.push(proxima);
  }

  if (proxima) {
    radioState.musicaAtual = proxima;
    radioState.tempoAtualSegundos = 0;
    radioState.playerAtivo = radioState.playerAtivo === 'A' ? 'B' : 'A';

    getIO().emit('maestro:tocarAgora', { player: radioState.playerAtivo, musicaInfo: radioState.musicaAtual });
    emitirFila();
  } else {
    radioState.musicaAtual = null;
    radioState.tempoAtualSegundos = 0;
    getIO().emit('maestro:pararTudo');
  }
};

const tick = async () => {
  if (!radioState.musicaAtual) {
    await fetchCurrentSchedule();
    tocarProximaMusica();
    return;
  }

  radioState.tempoAtualSegundos += 1;
  const endSeconds = radioState.musicaAtual.end_segundos || radioState.musicaAtual.duracao_segundos;

  if (endSeconds - radioState.tempoAtualSegundos === 4) {
    getIO().emit('maestro:iniciarCrossfade', { duration: 4 });
  }

  if (radioState.tempoAtualSegundos >= endSeconds) {
    tocarProximaMusica();
  } else {
    getIO().emit('maestro:progresso', { tempoAtual: radioState.tempoAtualSegundos, tempoTotal: endSeconds });
  }
};

export const startMaestro = () => {
  if (maestroInterval) clearInterval(maestroInterval);
  fetchCurrentSchedule();
  maestroInterval = setInterval(tick, 1000);
};

export const handleMusicSockets = (socket) => {
  socket.emit('maestro:estadoCompleto', radioState);
  emitirFila();

  socket.on('dj:pularMusica', () => tocarProximaMusica());

  socket.on('dj:tocarComercialAgora', async (trackId) => {
    try {
      const [rows] = await pool.query('SELECT * FROM tracks WHERE id = ?', [trackId]);
      if (rows.length > 0) {
        comerciaisFila.unshift({ ...rows[0], tipo: 'COMERCIAL_MANUAL' });
        tocarProximaMusica();
      }
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('dj:carregarPlaylistManual', async (playlistId) => {
    radioState.playlistAtualId = playlistId;
    await carregarPlaylistParaFila(playlistId);
    tocarProximaMusica();
  });

  socket.on('dj:adicionarPedido', async (trackId) => {
    try {
      const [rows] = await pool.query('SELECT * FROM tracks WHERE id = ?', [trackId]);
      if (rows.length > 0) {
        pedidosJukebox.push({ ...rows[0], tipo: 'DJ_PEDIDO' });
        emitirFila();
      }
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('dj:vetarPedido', (trackId) => {
    pedidosJukebox = pedidosJukebox.filter(p => p.id !== trackId);
    emitirFila();
  });
};