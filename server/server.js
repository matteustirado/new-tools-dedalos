import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createServer } from 'http'

import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import multer from 'multer'
import { Server } from 'socket.io'

import pool from './src/config/db.js'
import { initIO } from './src/socket.js'
import { iniciarMaestro } from './src/controllers/conductorController.js'

import trackRoutes from './src/routes/trackRoutes.js'
import playlistRoutes from './src/routes/playlistRoutes.js'
import scheduleRoutes from './src/routes/scheduleRoutes.js'
import jukeboxRoutes from './src/routes/jukeboxRoutes.js'
import toolsRoutes from './src/routes/toolsRoutes.js'
import scoreboardRoutes from './src/routes/scoreboardRoutes.js'
import priceRoutes from './src/routes/pricesRoutes.js'
import peopleRoutes from './src/routes/peopleRoutes.js'
import badgeRoutes from './src/routes/badgeRoutes.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const port = process.env.PORT || 4000
const app = express()
const httpServer = createServer(app)

const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
})

app.set('io', io)
initIO(io)

const overlayDir = path.join(__dirname, 'src/assets/upload/overlays')
const scoreboardDir = path.join(__dirname, 'src/assets/upload/scoreboard')
const pricesDir = path.join(__dirname, 'src/assets/upload/prices')
const uploadsPublicDir = path.join(__dirname, 'public/uploads')

const directories = [overlayDir, scoreboardDir, pricesDir, uploadsPublicDir]
directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
})

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'scoreboardImage') {
            return cb(null, scoreboardDir)
        }
        if (file.fieldname === 'priceMedia') {
            return cb(null, pricesDir)
        }
        if (file.fieldname === 'photo' || file.fieldname === 'logo') {
            return cb(null, uploadsPublicDir)
        }
        
        return cb(null, overlayDir)
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`
        cb(null, `file-${uniqueSuffix}${path.extname(file.originalname)}`)
    }
})

const upload = multer({ storage })

app.use(cors())
app.use(morgan('dev'))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

app.use((req, res, next) => {
    req.io = io
    next()
})

app.use('/assets/upload/covers', express.static(path.join(__dirname, 'src/assets/upload/covers')))
app.use('/assets/upload/overlays', express.static(path.join(__dirname, 'src/assets/upload/overlays')))
app.use('/assets/upload/scoreboard', express.static(path.join(__dirname, 'src/assets/upload/scoreboard')))
app.use('/assets/upload/prices', express.static(path.join(__dirname, 'src/assets/upload/prices')))
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')))

app.use('/api/tracks', trackRoutes)
app.use('/api/playlists', playlistRoutes)
app.use('/api/agendamentos', scheduleRoutes)
app.use('/api/jukebox', jukeboxRoutes)
app.use('/api/tools', toolsRoutes)
app.use('/api/scoreboard', scoreboardRoutes)
app.use('/api/prices', priceRoutes)
app.use('/api/people', peopleRoutes)
app.use('/api/badges', badgeRoutes)

app.post('/api/scoreboard/upload', upload.single('scoreboardImage'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' })
    }
    const fileUrl = `/assets/upload/scoreboard/${req.file.filename}`
    return res.json({ message: 'Imagem enviada com sucesso!', url: fileUrl })
})

app.post('/api/prices/upload', upload.single('priceMedia'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' })
    }
    const fileUrl = `/assets/upload/prices/${req.file.filename}`
    return res.json({ message: 'Mídia enviada com sucesso!', url: fileUrl })
})

app.post('/api/badges/upload-logo', upload.single('logo'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' })
    }
    const fileUrl = `/uploads/${req.file.filename}`
    return res.json({ message: 'Logo atualizado!', url: fileUrl })
})

app.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT NOW() AS now')
        return res.json({ message: 'Backend funcionando!', time: rows[0].now })
    } catch (err) {
        return res.status(500).json({ error: err.message })
    }
})

io.on('connection', (socket) => {
    socket.on('jukebox:enviarSugestao', (data) => {
        import('./src/controllers/jukeboxController.js')
            .then(ctrl => ctrl.handleReceberSugestao(socket, data))
            .catch(err => console.error(err))
    })

    socket.on('jukebox:adicionarPedido', (data) => {
        import('./src/controllers/jukeboxController.js')
            .then(ctrl => ctrl.handleAdicionarPedido(socket, data))
            .catch(err => console.error(err))
    })
})

iniciarMaestro()

httpServer.listen(port, () => {
    console.log(`Backend rodando na porta ${port}`)
})