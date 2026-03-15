const WebSocket = require('ws')
const http = require('http')
const setupWSConnection = require('y-websocket/bin/utils').setupWSConnection
const { RedisPersistence } = require('y-redis')
const Redis = require('ioredis')
const path = require('path')

// Load .env from project root or apps/ai-agents
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })
require('dotenv').config({ path: path.resolve(__dirname, '../ai-agents/.env') })

const port = process.env.PORT || 1234
const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' })
  response.end('MUNify Collaboration Server (Scale Ready)\n')
})

const wss = new WebSocket.Server({ server })

// Redis configuration for scaling and persistence
// Using ioredis for more robust URL parsing
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
console.log(`[COLLAB] Connecting to Redis at ${redisUrl}`)

const parsedRedis = new URL(redisUrl)
const redisOpts = {
  host: parsedRedis.hostname,
  port: parseInt(parsedRedis.port || '6379'),
  password: parsedRedis.password || undefined,
  maxRetriesPerRequest: null
}

const redisPersistence = new RedisPersistence({
  redisOpts
})

// Optional: Add logging to the persistence internal client if possible, 
// but parsing redisUrl into redisOpts is the standard fix for y-redis.

wss.on('connection', (conn, req) => {
  // Extract room name from URL (e.g., /committee_GA)
  const docName = req.url.slice(1).split('?')[0] || 'default'
  console.log(`[COLLAB] Client connecting to room: ${docName}`)
  
  // Standard y-websocket setup with Redis persistence integration
  setupWSConnection(conn, req, {
    gc: true,
    docName,
    persistence: redisPersistence
  })
})

server.listen(port, () => {
  console.log(`[COLLAB] Collaboration server running on port ${port}`)
})
