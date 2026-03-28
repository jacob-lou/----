import 'dotenv/config'
import { createServer } from 'http'
import app from './app'
import { setupSocket } from './socket'
import { startScheduler } from './scheduler'

const PORT = parseInt(process.env.PORT || '3000', 10)

const httpServer = createServer(app)
setupSocket(httpServer)
startScheduler()

httpServer.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`)
})
