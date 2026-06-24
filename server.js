import express from 'express'
import multer from 'multer'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import cors from 'cors'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = 3002

const LANGFLOW_URL =
  'http://localhost:7860/api/v1/run/fea6bd7a-42bc-41ea-a85e-5dd48087dc19?stream=false'
const API_KEY = 'sk-ybr0KLIX3V6n0wLfCHQJ_iEjAtcFuTSblhx4I0UxKmM'

// Temp directory for uploaded files
const tempDir = path.join(__dirname, 'temp')
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true })
}

// Multer storage — saves uploads to ./temp with a timestamped name
const storage = multer.diskStorage({
  destination: tempDir,
  filename: (_req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname)
  }
})

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === 'application/json' ||
      file.originalname.toLowerCase().endsWith('.json')
    ) {
      cb(null, true)
    } else {
      cb(new Error('Only JSON files are allowed'))
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
})

app.use(cors())
app.use(express.json())

// ─── POST /api/analyze ───────────────────────────────────────────────────────
app.post('/api/analyze', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'A JSON test result file is required.' })
  }

  try {
    const sessionId = `test-session-${Date.now()}`

    const langflowRes = await axios.post(
      LANGFLOW_URL,
      {
        output_type: 'chat',
        input_type: 'text',
        input_value:
          'Analyze the test results from the provided file path and generate a comprehensive report',
        session_id: sessionId,
        file: req.file.path
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY
        },
        timeout: 120000
      }
    )

    res.json(langflowRes.data)
  } catch (err) {
    console.error('[Langflow Error]', err.message)
    const status = err.response?.status || 500
    const message =
      err.response?.data?.detail ||
      err.message ||
      'Failed to contact Langflow.'
    res.status(status).json({ error: message })
  } finally {
    // Always clean up temp file
    if (req.file?.path) fs.unlink(req.file.path, () => {})
  }
})

// ─── Serve built React app in production ─────────────────────────────────────
const distDir = path.join(__dirname, 'dist')
app.use(express.static(distDir))
app.get('*', (_req, res) => {
  const indexFile = path.join(distDir, 'index.html')
  if (fs.existsSync(indexFile)) {
    res.sendFile(indexFile)
  } else {
    res.status(404).send('Run "npm run build" first to serve the React app.')
  }
})

app.listen(PORT, () => {
  console.log(`\n  ✅  API Server  →  http://localhost:${PORT}`)
  console.log(`  🔗  Langflow    →  ${LANGFLOW_URL}\n`)
})
