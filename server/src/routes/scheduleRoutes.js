import express from 'express';
import {
    getScheduleByDate,
    saveSchedule,
    getScheduleReport,
    getScheduleSummaryByMonth
} from '../controllers/scheduleController.js';

const router = express.Router();

router.get('/:data', getScheduleByDate);
router.get('/relatorio/:data', getScheduleReport);
router.get('/summary/:year/:month', getScheduleSummaryByMonth);

router.post('/', saveSchedule);

export default router;