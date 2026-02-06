import express from 'express';
import { 
    salvarHistorico, 
    listarHistorico, 
    buscarClientePorPulseira,
    saveGoldenWinner,
    getLastGoldenWinner,
    clearGoldenWinner,    // [NOVO] Para limpar o sorteio ativo
    saveCardConfig,       // [NOVO] Salvar grid de cards
    getCardConfig,        // [NOVO] Ler grid de cards
    fetchExternalLockers  // [NOVO] Proxy para API de armários
} from '../controllers/toolsController.js';

const router = express.Router();

// Rotas de Histórico
router.post('/history', salvarHistorico);
router.get('/history/:unidade/:tipo', listarHistorico);

// Rotas de Clientes (Proxy Dedalos)
router.get('/client/:pulseira', buscarClientePorPulseira);

// Rotas da Quinta Premiada (Sorteio Ativo)
router.post('/golden/winner', saveGoldenWinner);
router.get('/golden/winner/:unidade', getLastGoldenWinner);
router.delete('/golden/winner/:unidade', clearGoldenWinner); // [NOVO] Rota para finalizar/limpar sorteio

// Rotas da Quinta Premiada (Configuração e Infraestrutura)
router.post('/golden/config', saveCardConfig);         // Salvar grid de 50 cards
router.get('/golden/config/:unidade', getCardConfig);  // Carregar grid de 50 cards
router.get('/lockers/:unidade', fetchExternalLockers); // Buscar lista física de armários

export default router;