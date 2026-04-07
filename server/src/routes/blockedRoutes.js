import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { 
  getBlockedList, 
  getBlockedHistory, 
  addBlocked, 
  updateBlocked, 
  removeBlocked 
} from '../controllers/blockedController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, '../../public/uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `blocked-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage });
const router = express.Router();

router.get('/:unidade', getBlockedList);
router.get('/:unidade/history', getBlockedHistory);
router.post('/', upload.single('foto'), addBlocked);
router.put('/:id', upload.single('foto'), updateBlocked);
router.delete('/:id', removeBlocked);

export default router;