import express from 'express';
import { 
    salvarHistorico, 
    listarHistorico, 
    buscarClientePorPulseira,
    saveGoldenWinner,
    getLastGoldenWinner,
    clearGoldenWinner,    
    saveCardConfig,       
    getCardConfig,        
    fetchExternalLockers  
} from '../controllers/toolsController.js';

const router = express.Router();

router.post('/history', salvarHistorico);
router.get('/history/:unidade/:tipo', listarHistorico);

router.get('/client/:pulseira', buscarClientePorPulseira);

router.post('/golden/winner', saveGoldenWinner);
router.get('/golden/winner/:unidade', getLastGoldenWinner);
router.delete('/golden/winner/:unidade', clearGoldenWinner); 

router.post('/golden/config', saveCardConfig);         
router.get('/golden/config/:unidade', getCardConfig);  
router.get('/lockers/:unidade', fetchExternalLockers); 

export default router;