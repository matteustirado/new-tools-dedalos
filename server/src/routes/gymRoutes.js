import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import crypto from 'crypto';

import {
  addGymLocation,
  addManualUser,
  approveDuoPost,
  rejectDuoPost,
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
  sendSocialInvite,
  answerSocialInvite,
  acceptTerms,
  syncEmployeesToGym,
  toggleBanana,
  toggleBlockUser,
  toggleLike,
  unarchivePost,
  updatePost,
  registerUser,
  check2FA,
  requestReset,
  verify2FAReset,
  changePasswordForce,
  generate2FA,
  verifyAndEnable2FA,
  checkUserExists
} from '../controllers/gymController.js';

import {
  subscribePush,
  getInboxNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead
} from '../controllers/notificationController.js';

import authMiddleware from '../middlewares/authMiddleware.js';

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

  const minFileSize = 20 * 1024; 
  if (req.file.size < minFileSize) {
      return res.status(400).json({ error: "A imagem enviada é muito pequena (menos de 20KB). Imagens forjadas não são permitidas." });
  }

  try {
    const metadata = await sharp(req.file.buffer).metadata();
    
    if (!metadata.width || !metadata.height || metadata.width < 400 || metadata.height < 400) {
        return res.status(400).json({ error: "As dimensões da imagem são muito pequenas. A resolução mínima aceita é 400x400 pixels." });
    }

    const secureSuffix = crypto.randomBytes(16).toString('hex');
    const filename = `gym-${Date.now()}-${secureSuffix}.webp`;
    
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
    console.error('[Sharp Error]', error);
    return res.status(500).json({ error: "Falha ao processar a imagem. Certifique-se de que o arquivo é uma imagem válida." });
  }
};

router.post('/login', loginGymUser);
router.post('/register', registerUser);
router.get('/check-user', checkUserExists);
router.post('/check-2fa', check2FA);
router.post('/request-reset', requestReset);
router.post('/verify-2fa-reset', verify2FAReset);
router.put('/change-password-force', changePasswordForce);

router.use(authMiddleware);

router.put('/change-password', changeUserPassword);
router.post('/accept-terms', acceptTerms);
router.post('/generate-2fa', generate2FA);
router.post('/verify-enable-2fa', verifyAndEnable2FA);

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
router.post('/reject-duo', rejectDuoPost);

router.post('/send-invite', sendSocialInvite); 
router.post('/answer-social-invite', answerSocialInvite);

router.post('/push/subscribe', subscribePush);
router.get('/inbox-notifications/:cpf', getInboxNotifications);
router.get('/pending-duos/:cpf', getPendingDuos); 
router.get('/notifications/:cpf/unread-count', getUnreadNotificationCount);
router.put('/notifications/read-all', markAllNotificationsAsRead);
router.put('/notifications/:id/read', markNotificationAsRead);

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