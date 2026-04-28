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
import webpush from 'web-push'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import crypto from 'crypto'

import pool from './src/config/db.js'
import { initIO } from './src/socket.js'
import { iniciarMaestro } from './src/controllers/conductorController.js'
import { initCronJobs } from './src/cron/gymCron.js' 
import hmacMiddleware from './src/middlewares/hmacMiddleware.js'

import trackRoutes from './src/routes/trackRoutes.js'
import playlistRoutes from './src/routes/playlistRoutes.js'
import scheduleRoutes from './src/routes/scheduleRoutes.js'
import jukeboxRoutes from './src/routes/jukeboxRoutes.js'
import toolsRoutes from './src/routes/toolsRoutes.js'
import scoreboardRoutes from './src/routes/scoreboardRoutes.js'
import priceRoutes from './src/routes/pricesRoutes.js'
import peopleRoutes from './src/routes/peopleRoutes.js'
import badgeRoutes from './src/routes/badgeRoutes.js'
import gymRoutes from './src/routes/gymRoutes.js'
import blockedRoutes from './src/routes/blockedRoutes.js'

dotenv.config()

const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:matteustirado@gmail.com'
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
    console.log('[WebPush] Configuração de notificações ativada com sucesso.')
  } catch (error) {
    console.error('[WebPush] Erro ao configurar chaves VAPID:', error)
  }
} else {
  console.warn('⚠️ [WebPush] Chaves VAPID não encontradas nas variáveis de ambiente.')
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const port = process.env.PORT || 4000
const app = express()
const httpServer = createServer(app)

const allowedOrigins = [
  'https://banana.dedalosbar.com',
  'https://api.dedalosbar.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:4000'
]

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true)
    }
    
    if (origin.endsWith('.dedalosbar.com')) {
      return callback(null, true)
    }

    console.warn(`[CORS] Origem bloqueada: ${origin}`)
    callback(new Error('Not allowed by CORS'))
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-App-Timestamp', 'X-App-Signature'],
  credentials: true
}

const io = new Server(httpServer, {
  cors: corsOptions
})

app.set('io', io)
initIO(io)

const overlayDir = path.join(__dirname, 'src/assets/upload/overlays')
const scoreboardDir = path.join(__dirname, 'src/assets/upload/scoreboard')
const pricesDir = path.join(__dirname, 'src/assets/upload/prices')
const uploadsPublicDir = path.join(__dirname, 'public/uploads')

const directories = [
  overlayDir,
  scoreboardDir,
  pricesDir,
  uploadsPublicDir
]

directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
})

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'scoreboardImage') return cb(null, scoreboardDir)
    if (file.fieldname === 'priceMedia') return cb(null, pricesDir)
    if (file.fieldname === 'photo' || file.fieldname === 'logo') return cb(null, uploadsPublicDir)
    
    return cb(null, overlayDir)
  },
  filename: (req, file, cb) => {
    const secureSuffix = crypto.randomBytes(16).toString('hex')
    cb(null, `file-${Date.now()}-${secureSuffix}${path.extname(file.originalname)}`)
  }
})

const upload = multer({ storage })

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 500,
  message: { error: "Muitas requisições deste IP, por favor, tente novamente após 15 minutos." },
  standardHeaders: true, 
  legacyHeaders: false,
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 10,
  message: { error: "Muitas tentativas de login. Sua conta foi bloqueada temporariamente por 15 minutos por segurança." },
  standardHeaders: true, 
  legacyHeaders: false,
})

app.use(helmet())
app.use(helmet.frameguard({ action: 'deny' }))
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }))

app.use(cors(corsOptions))

app.use(morgan('dev'))
app.use(express.json({ limit: '5mb' }))
app.use(express.urlencoded({ extended: true, limit: '5mb' }))

app.use(generalLimiter)
app.use(hmacMiddleware)

app.use('/api/gym/login', authLimiter)
app.use('/api/gym/2fa/verify', authLimiter)

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
app.use('/api/gym', gymRoutes)
app.use('/api/blocked', blockedRoutes)

app.post('/api/scoreboard/upload', upload.single('scoreboardImage'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' })
  
  return res.json({ 
    message: 'Imagem enviada com sucesso!', 
    url: `/assets/upload/scoreboard/${req.file.filename}` 
  })
})

app.post('/api/prices/upload', upload.single('priceMedia'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' })
  
  return res.json({ 
    message: 'Mídia enviada com sucesso!', 
    url: `/assets/upload/prices/${req.file.filename}` 
  })
})

app.post('/api/badges/upload-logo', upload.single('logo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' })
  
  return res.json({ 
    message: 'Logo atualizado!', 
    url: `/uploads/${req.file.filename}` 
  })
})

app.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT NOW() AS now')
    return res.json({ message: 'Backend funcionando!', time: rows[0].now })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro interno no servidor.' })
  }
})

io.on('connection', (socket) => {
  socket.lastJukeboxRequest = 0

  socket.on('jukebox:enviarSugestao', (data) => {
    import('./src/controllers/jukeboxController.js')
      .then(ctrl => ctrl.handleReceberSugestao(socket, data))
      .catch(err => console.error(err))
  })

  socket.on('jukebox:adicionarPedido', (data) => {
    const now = Date.now()
    if (now - socket.lastJukeboxRequest < 3000) {
      return console.warn(`[Socket] Bloqueio Spam: Socket ${socket.id} na Jukebox.`)
    }
    socket.lastJukeboxRequest = now

    if (data && typeof data.musica === 'string' && data.musica.length > 200) {
      return console.warn(`[Socket] Bloqueio Payload: Texto muito longo.`)
    }

    import('./src/controllers/jukeboxController.js')
      .then(ctrl => ctrl.handleAdicionarPedido(socket, data))
      .catch(err => console.error(err))
  })

  socket.on('jukebox:atualizarTelefoneSugestao', (data) => {
    import('./src/controllers/jukeboxController.js')
      .then(ctrl => ctrl.handleAtualizarTelefoneSugestao(socket, data))
      .catch(err => console.error(err))
  })

  socket.on('system:forceReload', (data) => {
    if (!data || data.secret !== process.env.JWT_SECRET) {
      return console.warn(`[Socket] Tentativa não autorizada de forceReload bloqueada.`)
    }

    console.log('[System] Comando manual de atualização global recebido. Recarregando as telas ativas...')
    io.emit('system:executeReload')
  })
})

iniciarMaestro()
initCronJobs()

httpServer.listen(port, () => {
  console.log(`Backend rodando na porta ${port}`)
})