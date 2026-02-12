import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import path from 'path'
import multer from 'multer'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { createServer } from 'http'
import { Server } from 'socket.io'

import pool from './src/config/db.js'
import { initIO } from './src/socket.js'
import { iniciarMaestro, setOverlayRadio } from './src/controllers/conductorController.js'

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

const app = express()
const httpServer = createServer(app)
const port = process.env.PORT || 4000

const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
})

app.set('io', io)
initIO(io)

const overlayDir = path.join(__dirname, 'src/assets/upload/overlays')
const scoreboardDir = path.join(__dirname, 'src/assets/upload/scoreboard')
const pricesDir = path.join(__dirname, 'src/assets/upload/prices')
const uploadsPublicDir = path.join(__dirname, 'public/uploads')

if (!fs.existsSync(overlayDir)) fs.mkdirSync(overlayDir, { recursive: true })
if (!fs.existsSync(scoreboardDir)) fs.mkdirSync(scoreboardDir, { recursive: true })
if (!fs.existsSync(pricesDir)) fs.mkdirSync(pricesDir, { recursive: true })
if (!fs.existsSync(uploadsPublicDir)) fs.mkdirSync(uploadsPublicDir, { recursive: true })

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'scoreboardImage') {
            cb(null, scoreboardDir)
        } else if (file.fieldname === 'priceMedia') {
            cb(null, pricesDir)
        } else if (file.fieldname === 'photo' || file.fieldname === 'logo') { 
            cb(null, uploadsPublicDir)
        } else {
            cb(null, overlayDir)
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, 'file-' + uniqueSuffix + path.extname(file.originalname))
    }
})

const upload = multer({ storage: storage })

app.use(cors())
app.use(morgan('dev'))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

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

app.post('/api/overlay', upload.single('overlay'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' })
    const fileUrl = `/assets/upload/overlays/${req.file.filename}`
    setOverlayRadio(fileUrl)
    res.json({ message: 'Overlay atualizado!', url: fileUrl })
})

app.delete('/api/overlay', (req, res) => {
    setOverlayRadio(null)
    res.json({ message: 'Overlay removido!' })
})

app.post('/api/scoreboard/upload', upload.single('scoreboardImage'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' })
    const fileUrl = `/assets/upload/scoreboard/${req.file.filename}`
    res.json({ message: 'Imagem enviada com sucesso!', url: fileUrl })
})

app.post('/api/prices/upload', upload.single('priceMedia'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' })
    const fileUrl = `/assets/upload/prices/${req.file.filename}`
    res.json({ message: 'Mídia enviada com sucesso!', url: fileUrl })
})

app.post('/api/badges/upload-logo', upload.single('logo'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' })
    const fileUrl = `/uploads/${req.file.filename}`
    res.json({ message: 'Logo atualizado!', url: fileUrl })
})

app.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT NOW() AS now')
        res.json({ message: 'Backend funcionando!', time: rows[0].now })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

io.on('connection', (socket) => {
    socket.on('jukebox:enviarSugestao', (data) => {
        import('./src/controllers/jukeboxController.js').then(ctrl => {
            ctrl.handleReceberSugestao(socket, data)
        }).catch(err => console.error("Erro ao carregar controller de sugestão:", err))
    })

    socket.on('jukebox:adicionarPedido', (data) => {
        import('./src/controllers/jukeboxController.js').then(ctrl => {
            ctrl.handleAdicionarPedido(socket, data)
        }).catch(err => console.error("Erro ao carregar controller de pedido:", err))
    })
})

iniciarMaestro()

httpServer.listen(port, () => {
    console.log(`Backend rodando (com Socket.io) na porta ${port}`)
})