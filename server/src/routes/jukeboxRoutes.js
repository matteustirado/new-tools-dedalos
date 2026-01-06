import express from 'express';
import * as jukeboxController from '../controllers/jukeboxController.js';

const router = express.Router();

router.get('/history', jukeboxController.getHistoricoPedidos);

export default router;