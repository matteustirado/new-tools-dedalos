import express from 'express';
import { syncEmployees, listEmployees, updateEmployee, uploadEmployeePhoto } from '../controllers/peopleController.js';
import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'employee-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });
const router = express.Router();

router.get('/sync', syncEmployees);
router.get('/list', listEmployees);
router.post('/update/:id', updateEmployee);
router.post('/upload', upload.single('photo'), uploadEmployeePhoto);

export default router;