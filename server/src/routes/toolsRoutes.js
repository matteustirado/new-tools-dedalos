import express from 'express';
import { 
    salvarHistorico, 
    listarHistorico, 
    buscarClientePorPulseira,
    saveGoldenWinner,
    getLastGoldenWinner
} from '../controllers/toolsController.js';

const router = express.Router();

router.post('/history', salvarHistorico);
router.get('/history/:unidade/:tipo', listarHistorico);

router.get('/client/:pulseira', buscarClientePorPulseira);

router.post('/golden/winner', saveGoldenWinner);
router.get('/golden/winner/:unidade', getLastGoldenWinner);

export default router;