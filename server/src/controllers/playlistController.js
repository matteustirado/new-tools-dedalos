import pool from '../config/db.js';
import multer from 'multer';
import path from 'url';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pathNode from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = pathNode.dirname(__filename);

const COVERS_DIR = pathNode.join(__dirname, '../assets/upload/covers');
const OVERLAYS_DIR = pathNode.join(__dirname, '../assets/upload/overlays');

if (!fs.existsSync(COVERS_DIR)) {
  fs.mkdirSync(COVERS_DIR, { recursive: true });
}

if (!fs.existsSync(OVERLAYS_DIR)) {
  fs.mkdirSync(OVERLAYS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === 'overlay') {
      cb(null, OVERLAYS_DIR);
    } else {
      cb(null, COVERS_DIR);
    }
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + pathNode.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(pathNode.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Erro: Apenas arquivos de imagem (jpeg, jpg, png, gif, webp) são permitidos!"));
  }
}).fields([
  { name: 'cover', maxCount: 1 },
  { name: 'overlay', maxCount: 1 }
]);

export const uploadMiddleware = (req, res, next) => {
  upload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: "As imagens não podem exceder 5MB." });
      }
      return res.status(400).json({ error: `Erro no upload: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

const parseAndValidateTrackIds = (tracksIdsInput) => {
  let tracksIdsArray = [];
  let error = null;

  if (tracksIdsInput && typeof tracksIdsInput === 'string') {
    try {
      const cleanedString = tracksIdsInput
        .replace(/\s+/g, '')
        .replace(/,\s*]/, ']');

      tracksIdsArray = JSON.parse(cleanedString);

      if (!Array.isArray(tracksIdsArray)) {
        error = 'Formato inválido para lista de músicas.';
        tracksIdsArray = [];
      } else {
        tracksIdsArray = tracksIdsArray.map(id => Number(id)).filter(id => !isNaN(id));
      }
    } catch (e) {
      error = `Erro ao processar lista de músicas: ${e.message}`;
      tracksIdsArray = [];
    }
  } else if (Array.isArray(tracksIdsInput)) {
    tracksIdsArray = tracksIdsInput.map(id => Number(id)).filter(id => !isNaN(id));
    if (tracksIdsArray.length !== tracksIdsInput.length) {
      error = 'Lista de músicas (recebida como array) contém IDs numéricos inválidos.';
      tracksIdsArray = [];
    }
  }

  return { tracksIdsArray, error };
};

const deleteLocalFile = (filePath) => {
  if (!filePath) return;
  try {
    const fullPath = pathNode.join(__dirname, '..', filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (err) {
    console.error(err);
  }
};

export const createPlaylist = async (req, res) => {
  const { name, description, tracks_ids } = req.body;
  const coverFile = req.files && req.files['cover'] ? req.files['cover'][0] : null;
  const overlayFile = req.files && req.files['overlay'] ? req.files['overlay'][0] : null;

  const { tracksIdsArray, error: parseError } = parseAndValidateTrackIds(tracks_ids);

  if (!name || parseError) {
    if (coverFile) deleteLocalFile(`/assets/upload/covers/${coverFile.filename}`);
    if (overlayFile) deleteLocalFile(`/assets/upload/overlays/${overlayFile.filename}`);
    
    const errorMessage = parseError || 'Nome da playlist é obrigatório.';
    return res.status(400).json({ error: errorMessage });
  }

  try {
    const imagePath = coverFile ? `/assets/upload/covers/${coverFile.filename}` : null;
    const overlayPath = overlayFile ? `/assets/upload/overlays/${overlayFile.filename}` : null;

    const newPlaylist = {
      nome: name,
      descricao: description,
      imagem: imagePath,
      overlay: overlayPath,
      tracks_ids: JSON.stringify(tracksIdsArray)
    };

    const [result] = await pool.query('INSERT INTO playlists SET ?', newPlaylist);
    
    res.status(201).json({ 
      message: 'Playlist criada com sucesso!', 
      id: result.insertId, 
      imagePath,
      overlayPath 
    });
  } catch (err) {
    if (coverFile) deleteLocalFile(`/assets/upload/covers/${coverFile.filename}`);
    if (overlayFile) deleteLocalFile(`/assets/upload/overlays/${overlayFile.filename}`);
    res.status(500).json({ error: 'Erro ao salvar a playlist no banco de dados.' });
  }
};

const safeJsonParse = (jsonString) => {
  if (!jsonString || typeof jsonString !== 'string') {
    return Array.isArray(jsonString) ? jsonString.map(id => Number(id)).filter(id => !isNaN(id)) : [];
  }
  try {
    const cleanedString = jsonString
      .replace(/\s+/g, '')
      .replace(/,\s*]/, ']');
    const parsed = JSON.parse(cleanedString);
    return Array.isArray(parsed)
      ? parsed.map(id => Number(id)).filter(id => !isNaN(id))
      : [];
  } catch (e) {
    return [];
  }
};

export const getAllPlaylists = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM playlists ORDER BY nome ASC');
    const processedRows = rows.map(playlist => ({
      ...playlist,
      tracks_ids: safeJsonParse(playlist.tracks_ids)
    }));
    res.json(processedRows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar playlists.' });
  }
};

export const getPlaylistById = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM playlists WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Playlist não encontrada.' });
    }
    const playlist = rows[0];
    const processedPlaylist = {
      ...playlist,
      tracks_ids: safeJsonParse(playlist.tracks_ids)
    };
    res.json(processedPlaylist);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar a playlist.' });
  }
};

export const updatePlaylist = async (req, res) => {
  const { id } = req.params;
  const { name, description, tracks_ids, existingImagePath, existingOverlayPath } = req.body;
  const coverFile = req.files && req.files['cover'] ? req.files['cover'][0] : null;
  const overlayFile = req.files && req.files['overlay'] ? req.files['overlay'][0] : null;

  const { tracksIdsArray, error: parseError } = parseAndValidateTrackIds(tracks_ids);

  if (!name || parseError) {
    if (coverFile) deleteLocalFile(`/assets/upload/covers/${coverFile.filename}`);
    if (overlayFile) deleteLocalFile(`/assets/upload/overlays/${overlayFile.filename}`);
    
    const errorMessage = parseError || 'Nome da playlist é obrigatório.';
    return res.status(400).json({ error: errorMessage });
  }

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

    const updatedPlaylist = {
      nome: name,
      descricao: description,
      imagem: imagePath,
      overlay: overlayPath,
      tracks_ids: JSON.stringify(tracksIdsArray)
    };

    const [result] = await pool.query('UPDATE playlists SET ? WHERE id = ?', [updatedPlaylist, id]);

    if (result.affectedRows === 0) {
      if (coverFile) deleteLocalFile(imagePath);
      if (overlayFile) deleteLocalFile(overlayPath);
      return res.status(404).json({ error: 'Playlist não encontrada para atualização.' });
    }

    res.json({ 
      message: 'Playlist atualizada com sucesso!', 
      imagePath,
      overlayPath 
    });
  } catch (err) {
    if (coverFile) deleteLocalFile(`/assets/upload/covers/${coverFile.filename}`);
    if (overlayFile) deleteLocalFile(`/assets/upload/overlays/${overlayFile.filename}`);
    res.status(500).json({ error: 'Erro ao atualizar a playlist no banco de dados.' });
  }
};

export const deletePlaylist = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT imagem, overlay FROM playlists WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Playlist não encontrada.' });
    }

    const { imagem, overlay } = rows[0];
    const [result] = await pool.query('DELETE FROM playlists WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Playlist não encontrada para exclusão.' });
    }

    if (imagem) deleteLocalFile(imagem);
    if (overlay) deleteLocalFile(overlay);

    res.json({ message: 'Playlist excluída com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir a playlist.' });
  }
};