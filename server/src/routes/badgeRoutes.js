import express from 'express';
import { 
  getTemplates, 
  saveTemplate, 
  deleteTemplate 
} from '../controllers/badgeController.js';

const router = express.Router();

router.get('/templates', getTemplates);
router.post('/templates', saveTemplate);
router.delete('/templates/:role_name', deleteTemplate);

export default router;