import express from 'express';
import { 
    salvarHistorico, 
    listarHistorico, 
    buscarClientePorPulseira,
    saveGoldenWinner,
    getLastGoldenWinner,
    saveGoldenConfig,
    getGoldenConfig,
    performDraw // [NOVO] Importado
} from '../controllers/toolsController.js';

const router = express.Router();

// Rotas de Histórico
router.post('/history', salvarHistorico);
router.get('/history/:unidade/:tipo', listarHistorico);

// Rota de Cliente (Proxy para API Dedalos)
router.get('/client/:pulseira', buscarClientePorPulseira);

// Rotas do Sorteio (Vencedores e Estado Atual)
router.post('/golden/winner', saveGoldenWinner);
router.get('/golden/winner/:unidade', getLastGoldenWinner);

// [NOVO] Rotas de Configuração de Prêmios (Cartões)
router.post('/golden/config', saveGoldenConfig);
router.get('/golden/config/:unidade', getGoldenConfig);

// [NOVO] Rota para Realizar o Sorteio (Server-Side)
router.post('/golden/draw', performDraw);

export default router;