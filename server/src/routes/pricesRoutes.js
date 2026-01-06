import express from 'express';
import {
    getPriceConfigByType,
    updatePriceConfig,
    getActiveDisplayPrice,
    getHolidays,
    addHoliday,
    deleteHoliday,
    getPromotions,
    savePromotions
} from '../controllers/pricesController.js';

const router = express.Router();

router.get('/holidays/:unidade', getHolidays);
router.post('/holidays', addHoliday);
router.delete('/holidays/:id', deleteHoliday);

router.get('/promotions/:unidade', getPromotions);
router.post('/promotions', savePromotions);

router.get('/config/:unidade/:tipo', getPriceConfigByType);
router.post('/config', updatePriceConfig);

router.get('/display/:unidade', getActiveDisplayPrice);

export default router;