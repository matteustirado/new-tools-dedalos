import express from 'express';
import multer from 'multer';
import path from 'path';

import { 
    postCheckin, 
    getFeed, 
    toggleLike,
    toggleBanana, 
    postComment, 
    getRankings, 
    getPendingModeration,
    moderateCheckin,
    getGymLocations,
    addGymLocation,
    syncEmployeesToGym,
    getGymUsers,
    toggleBlockUser,
    resetPassword,
    loginGymUser,
    changeUserPassword,
    addManualUser,
    getUserProfile,
    getCommunity,
    editUserProfile,
    backfillUsernames,
    getPostById,
    updatePost,
    archivePost,
    unarchivePost,
    deleteComment
} from '../controllers/gymController.js';

const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = path.extname(file.originalname);
        cb(null, `gym-${uniqueSuffix}${fileExtension}`);
    }
});

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

router.post('/login', loginGymUser);
router.put('/change-password', changeUserPassword);

router.post('/checkin', upload.single('foto_treino'), postCheckin);
router.get('/feed', getFeed);
router.get('/post/:id', getPostById);
router.put('/post/:id/edit', updatePost);
router.put('/post/:id/archive', archivePost);
router.put('/post/:id/unarchive', unarchivePost);
router.post('/like', toggleLike);
router.post('/banana', toggleBanana); 
router.post('/comment', postComment);
router.delete('/comment/:id', deleteComment);

router.put('/profile/edit', upload.single('foto_perfil'), editUserProfile);
router.get('/profile/:cpf', getUserProfile);
router.get('/community', getCommunity);

router.get('/rankings', getRankings);

router.get('/pending', getPendingModeration);
router.put('/moderate/:id', moderateCheckin);

router.get('/locations', getGymLocations);
router.post('/locations', addGymLocation);

router.post('/sync-users', syncEmployeesToGym);
router.post('/users/manual', addManualUser);
router.post('/backfill-usernames', backfillUsernames);
router.get('/users', getGymUsers);
router.put('/users/:cpf/toggle-block', toggleBlockUser);
router.put('/users/:cpf/reset-password', resetPassword);

export default router;