const WebSocket = require('ws')
const http = require('http')
const setupWSConnection = require('y-websocket/bin/utils').setupWSConnection
const path = require('path')

// Load .env from project root or apps/ai-agents
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })
require('dotenv').config({ path: path.resolve(__dirname, '../ai-agents/.env') })

const port = process.env.PORT || 1234
const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' })
  response.end('MUNify Collaboration Server (In-Memory Mode)\n')
})

const wss = new WebSocket.Server({ server })

// Redis persistence is OPTIONAL - if unavailable, use in-memory only
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
let persistence = null

try {
  const { RedisPersistence } = require('y-redis')
  const Redis = require('ioredis')
  
  const parsedRedis = new URL(redisUrl)
  const redisOpts = {
    host: parsedRedis.hostname,
    port: parseInt(parsedRedis.port || '6379'),
    password: parsedRedis.password || undefined,
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 3) {
        console.log('[COLLAB] Redis no disponible. Operando en modo memoria.')
        return null // stop retrying
      }
      return Math.min(times * 200, 1000)
    }
  }

  // Test connection before using it
  const testClient = new Redis(redisOpts)
  testClient.on('error', () => {
    console.log('[COLLAB] Redis no disponible. Operando sin persistencia.')
    testClient.disconnect()
  })
  testClient.on('connect', () => {
    console.log(`[COLLAB] Conectado a Redis: ${redisUrl}`)
    persistence = new RedisPersistence({ redisOpts })
    testClient.disconnect()
  })
} catch (e) {
  console.log('[COLLAB] Módulo y-redis no disponible. Operando en modo memoria.')
}

wss.on('connection', (conn, req) => {
  // Extract room name from URL (e.g., /committee_GA)
  const docName = req.url.slice(1).split('?')[0] || 'default'
  console.log(`[COLLAB] Client connecting to room: ${docName}`)
  
  const opts = { gc: true, docName }
  if (persistence) {
    opts.persistence = persistence
  }
  
  setupWSConnection(conn, req, opts)
})

server.listen(port, () => {
  console.log(`[COLLAB] Collaboration server running on port ${port}`)
})
