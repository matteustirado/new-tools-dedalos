import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

import {
    addGymLocation,
    addManualUser,
    approveDuoPost,
    rejectDuoPost, // 👈 IMPORTAÇÃO ADICIONADA AQUI
    archivePost,
    backfillUsernames,
    changeUserPassword,
    deleteComment,
    disconnectStrava,
    editUserProfile,
    fetchAndSaveStravaRun,
    getCommunity,
    getFeed,
    getGymLocations,
    getGymUsers,
    getPendingDuos,
    getPendingModeration,
    getPostById,
    getPostInteractions,
    getRankings,
    getStravaAuthUrl,
    getTodayActivity,
    getUserProfile,
    handleStravaCallback,
    loginGymUser,
    moderateCheckin,
    postCheckin,
    postComment,
    resetPassword,
    searchUsersForDuo,
    selectCheckin,
    syncEmployeesToGym,
    toggleBanana,
    toggleBlockUser,
    toggleLike,
    unarchivePost,
    updatePost
} from '../controllers/gymController.js';

const router = express.Router();

const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: {
        fileSize: 15 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const allowedFileTypes = /jpeg|jpg|png|webp/;
        const isMimeTypeValid = allowedFileTypes.test(file.mimetype);
        const isExtNameValid = allowedFileTypes.test(path.extname(file.originalname).toLowerCase());

        if (isMimeTypeValid && isExtNameValid) {
            return cb(null, true);
        }
        
        cb(new Error("Apenas imagens (jpeg, jpg, png, webp) são permitidas."));
    }
});

const compressImage = async (req, res, next) => {
    if (!req.file) return next();

    try {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = `gym-${uniqueSuffix}.webp`;
        
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        const filepath = path.join(uploadDir, filename);

        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        await sharp(req.file.buffer)
            .resize({
                width: 1080,
                withoutEnlargement: true
            })
            .webp({ quality: 80 })
            .toFile(filepath);

        req.file.filename = filename;
        req.file.path = filepath;
        req.file.mimetype = 'image/webp';

        next();
    } catch (error) {
        console.error("[SHARP COMPRESSION ERROR]:", error);
        return res.status(500).json({ error: "Falha ao processar e otimizar a imagem." });
    }
};

router.post('/login', loginGymUser);
router.put('/change-password', changeUserPassword);

router.get('/profile/:cpf', getUserProfile);
router.put('/profile/edit', upload.single('foto_perfil'), compressImage, editUserProfile);

router.get('/strava/auth-url', getStravaAuthUrl);
router.post('/strava/callback', handleStravaCallback);
router.post('/strava/disconnect', disconnectStrava);
router.post('/strava/fetch-run', fetchAndSaveStravaRun);

router.post('/checkin', upload.single('foto_treino'), compressImage, postCheckin);
router.post('/select-checkin', selectCheckin);
router.get('/today-activity/:cpf', getTodayActivity);

router.get('/feed', getFeed);
router.get('/community', getCommunity);
router.get('/rankings', getRankings);

router.get('/post/:id', getPostById);
router.get('/post/:id/interactions', getPostInteractions);
router.put('/post/:id/edit', updatePost);
router.put('/post/:id/archive', archivePost);
router.put('/post/:id/unarchive', unarchivePost);

router.post('/like', toggleLike);
router.post('/banana', toggleBanana);
router.post('/comment', postComment);
router.delete('/comment/:id', deleteComment);

router.get('/users/search', searchUsersForDuo);
router.post('/approve-duo', approveDuoPost);
router.post('/reject-duo', rejectDuoPost); // 👈 ROTA ADICIONADA AQUI
router.get('/pending-duos/:cpf', getPendingDuos);

router.get('/locations', getGymLocations);
router.post('/locations', addGymLocation);

router.get('/users', getGymUsers);
router.post('/users/manual', addManualUser);
router.put('/users/:cpf/toggle-block', toggleBlockUser);
router.put('/users/:cpf/reset-password', resetPassword);

router.get('/pending', getPendingModeration);
router.put('/moderate/:id', moderateCheckin);

router.post('/sync-users', syncEmployeesToGym);
router.post('/backfill-usernames', backfillUsernames);

export default router;