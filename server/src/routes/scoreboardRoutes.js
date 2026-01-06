import express from 'express';
import { 
    getActiveConfig, 
    updateActiveConfig, 
    castVote, 
    getVotes, 
    resetVotes, 
    savePreset, 
    getPresets, 
    deletePreset,
    testarTrigger,
    getCrowdCount 
} from '../controllers/scoreboardController.js';

const router = express.Router();

router.get('/crowd/:unidade', getCrowdCount);

router.get('/active/:unidade', getActiveConfig);
router.post('/active', updateActiveConfig);

router.post('/vote', castVote);
router.get('/votes/:unidade', getVotes);
router.post('/reset-votes', resetVotes);

router.get('/presets/:unidade', getPresets); 
router.post('/presets', savePreset);
router.delete('/presets/:id', deletePreset);

router.get('/test-trigger/:unidade', testarTrigger);

export default router;