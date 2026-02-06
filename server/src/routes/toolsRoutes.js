import express from 'express';
import { 
    salvarHistorico, 
    listarHistorico, 
    buscarClientePorPulseira,
    saveGoldenWinner,
    getLastGoldenWinner,
    saveGoldenConfig,  // [NOVO]
    getGoldenConfig,   // [NOVO]
    clearGoldenWinner, // [NOVO]
    getLockers         // [NOVO]
} from '../controllers/toolsController.js';

const router = express.Router();

// Rotas de Histórico
router.post('/history', salvarHistorico);
router.get('/history/:unidade/:tipo', listarHistorico);

// Rota de Consulta de Cliente (Proxy)
router.get('/client/:pulseira', buscarClientePorPulseira);

// Rotas da Quinta Premiada (Sorteio e Vencedor Ativo)
router.post('/golden/winner', saveGoldenWinner);
router.get('/golden/winner/:unidade', getLastGoldenWinner);
router.delete('/golden/winner/:unidade', clearGoldenWinner); // [NOVO] Rota para limpar sorteio

// Rotas de Configuração dos Cards (Persistência)
router.post('/golden/config', saveGoldenConfig);
router.get('/golden/config/:unidade', getGoldenConfig);

// [NOVO] Rota para buscar lista de armários (Portas) da API Externa
router.get('/lockers/:unidade', getLockers);

export default router;