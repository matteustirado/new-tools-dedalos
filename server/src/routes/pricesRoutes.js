import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { 
    getPricesState, 
    updatePriceState, 
    getDefaults, 
    updateDefault,
    getCategoryMedia,
    updateCategoryMedia,
    // Funções Restauradas
    getHolidays, 
    addHoliday, 
    deleteHoliday,
    getPromotions, 
    addPromotion
} from '../controllers/pricesController.js';

const router = express.Router();

// Configuração de Upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'public/uploads/';
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'file-' + uniqueSuffix + ext);
    }
});
const upload = multer({ storage: storage });

router.post('/upload', upload.single('priceMedia'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    res.json({ url: `/uploads/${req.file.filename}` });
});

// Rotas Híbridas
router.get('/state/:unidade', getPricesState);
router.put('/state/:unidade', updatePriceState);
router.get('/defaults', getDefaults);
router.put('/defaults', updateDefault);
router.get('/media/:unidade', getCategoryMedia);
router.put('/media', updateCategoryMedia);

// Rotas Legadas (Feriados e Promoções) - AGORA ATIVAS
router.get('/holidays/:unidade', getHolidays);
router.post('/holidays', addHoliday);
router.delete('/holidays/:id', deleteHoliday);

router.get('/promotions/:unidade', getPromotions);
router.post('/promotions', addPromotion);

export default router;