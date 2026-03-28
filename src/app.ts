import express from 'express'
import path from 'path'
import trendsRouter from './routes/trends'

const app = express()

app.use(express.json())
app.use(express.static(path.join(__dirname, '../public')))

// API routes
app.use('/api', trendsRouter)

// SPA fallback
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'))
})

export default app
