import express from 'express';
import multer from 'multer';
import path from 'path';
import { 
    syncEmployees, 
    updateEmployee, 
    uploadEmployeePhoto 
} from '../controllers/peopleController.js';

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = path.extname(file.originalname);
        cb(null, `employee-${uniqueSuffix}${fileExtension}`);
    }
});

const upload = multer({ storage });
const router = express.Router();

router.get('/sync', syncEmployees);
router.post('/update/:id', updateEmployee);
router.post('/upload', upload.single('photo'), uploadEmployeePhoto);

export default router;