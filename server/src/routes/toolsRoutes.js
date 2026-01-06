import express from 'express';
import { 
    salvarHistorico, 
    listarHistorico, 
    buscarClientePorPulseira 
} from '../controllers/toolsController.js';

const router = express.Router();

router.post('/history', salvarHistorico);
router.get('/history/:unidade/:tipo', listarHistorico);
router.get('/client/:pulseira', buscarClientePorPulseira);

export default router;