import express from 'express';
import multer from 'multer';
import path from 'path';
import { 
    postCheckin, 
    getFeed, 
    toggleLike, 
    postComment, 
    getRankings, 
    getOrphanLocations,
    moderateCheckin
} from '../controllers/gymController.js';

const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'gym-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error("Apenas imagens (jpeg, jpg, png, webp) são permitidas."));
    }
});

router.post('/checkin', upload.single('foto_treino'), postCheckin);
router.get('/feed', getFeed);
router.post('/like', toggleLike);
router.post('/comment', postComment);

router.get('/rankings', getRankings);
router.get('/orphans', getOrphanLocations);
router.put('/moderate/:id', moderateCheckin);

export default router;