import express from 'express';
import {
  castVote,
  deletePreset,
  executarMarcoZero,
  getActiveConfig,
  getCrowdCount,
  getPresets,
  getScoreboardHistory,
  getVotes,
  resetVotes,
  savePreset,
  testarTrigger,
  updateActiveConfig
} from '../controllers/scoreboardController.js';

const router = express.Router();

router.get('/active/:unidade', getActiveConfig);
router.post('/active', updateActiveConfig);

router.get('/crowd/:unidade', getCrowdCount);

router.get('/history/:unidade', getScoreboardHistory);

router.get('/marco-zero', executarMarcoZero);

router.get('/presets/:unidade', getPresets);
router.post('/presets', savePreset);
router.delete('/presets/:id', deletePreset);

router.get('/test-trigger/:unidade', testarTrigger);

router.get('/votes/:unidade', getVotes);
router.post('/vote', castVote);
router.post('/reset-votes', resetVotes);

export default router;