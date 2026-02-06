import express from 'express';
import { 
    salvarHistorico, 
    listarHistorico, 
    buscarClientePorPulseira,
    saveGoldenWinner,
    getLastGoldenWinner,
    clearGoldenWinner,
    saveGoldenConfig,
    getGoldenConfig,
    getLockers
} from '../controllers/toolsController.js';

const router = express.Router();

router.post('/history', salvarHistorico);
router.get('/history/:unidade/:tipo', listarHistorico);
router.get('/client/:pulseira', buscarClientePorPulseira);

router.post('/golden/winner', saveGoldenWinner);
router.get('/golden/winner/:unidade', getLastGoldenWinner);
router.delete('/golden/winner/:unidade', clearGoldenWinner);

router.post('/golden/config', saveGoldenConfig);
router.get('/golden/config/:unidade', getGoldenConfig);

// A rota crítica que estava faltando
router.get('/lockers/:unidade', getLockers);

export default router;