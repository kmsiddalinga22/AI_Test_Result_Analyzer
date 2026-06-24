import formidable from 'formidable'
import axios from 'axios'
import fs from 'fs'

const LANGFLOW_URL =
  process.env.LANGFLOW_URL ||
  'http://localhost:7860/api/v1/run/8db27283-714b-4804-bea8-55c0786ec9da?stream=false'

const API_KEY =
  process.env.LANGFLOW_API_KEY ||
  'sk-ybr0KLIX3V6n0wLfCHQJ_iEjAtcFuTSblhx4I0UxKmM'

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const form = formidable({
    uploadDir: '/tmp',
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024 // 10 MB
  })

  let file1, file2

  try {
    const [, files] = await form.parse(req)
    file1 = Array.isArray(files.file1) ? files.file1[0] : files.file1
    file2 = Array.isArray(files.file2) ? files.file2[0] : files.file2

    if (!file1 || !file2) {
      return res.status(400).json({ error: 'Both files are required.' })
    }

    const sessionId = `session-${Date.now()}`
    const inputValue = (Array.isArray(fields.instruction) ? fields.instruction[0] : fields.instruction || 'analyze').toString().slice(0, 2000)

    const langflowRes = await axios.post(
      LANGFLOW_URL,
      {
        output_type: 'chat',
        input_type: 'text',
        input_value: inputValue,
        session_id: sessionId,
        file1: file1.filepath,
        file2: file2.filepath
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
    console.error('[analyze]', err.message)
    const status = err.response?.status || 500
    res.status(status).json({
      error: err.response?.data?.detail || err.message || 'Analysis failed.'
    })
  } finally {
    if (file1?.filepath) fs.unlink(file1.filepath, () => {})
    if (file2?.filepath) fs.unlink(file2.filepath, () => {})
  }
}
