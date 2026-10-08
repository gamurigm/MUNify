package collab

import (
	"log"
	"net/http"
	"strings"
	"sync"

	"golang.org/x/net/websocket"
)

// Room represents a collaborative editing room.
type Room struct {
	clients map[*websocket.Conn]bool
	mu      sync.RWMutex
}

// Hub manages all active rooms.
type Hub struct {
	rooms map[string]*Room
	mu    sync.RWMutex
}

// NewHub creates a collaboration hub.
func NewHub() *Hub {
	return &Hub{rooms: make(map[string]*Room)}
}

func (h *Hub) getOrCreateRoom(name string) *Room {
	h.mu.Lock()
	defer h.mu.Unlock()

	if room, ok := h.rooms[name]; ok {
		return room
	}

	room := &Room{clients: make(map[*websocket.Conn]bool)}
	h.rooms[name] = room
	log.Printf("[COLLAB] Room created: %s", name)
	return room
}

func (r *Room) addClient(conn *websocket.Conn) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.clients[conn] = true
}

func (r *Room) removeClient(conn *websocket.Conn) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.clients, conn)
}

func (r *Room) broadcast(sender *websocket.Conn, msg []byte) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for client := range r.clients {
		if client != sender {
			websocket.Message.Send(client, string(msg))
		}
	}
}

// Handler returns an HTTP handler for WebSocket connections.
// Clients connect to /ws/collab/{roomName}
func (h *Hub) Handler() http.Handler {
	return websocket.Handler(func(conn *websocket.Conn) {
		// Extract room name from URL path
		path := conn.Request().URL.Path
		roomName := strings.TrimPrefix(path, "/ws/collab/")
		if roomName == "" || roomName == path {
			roomName = "default"
		}

		room := h.getOrCreateRoom(roomName)
		room.addClient(conn)
		log.Printf("[COLLAB] Client connected to room: %s (total: %d)", roomName, len(room.clients))

		defer func() {
			room.removeClient(conn)
			conn.Close()
			log.Printf("[COLLAB] Client disconnected from room: %s", roomName)
		}()

		// Relay messages
		for {
			var msg []byte
			if err := websocket.Message.Receive(conn, &msg); err != nil {
				break
			}
			room.broadcast(conn, msg)
		}
	})
}
