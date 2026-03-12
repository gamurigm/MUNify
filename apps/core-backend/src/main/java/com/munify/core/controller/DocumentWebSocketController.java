package com.munify.core.controller;

import com.munify.core.dto.websocket.CursorMoveEvent;
import com.munify.core.dto.websocket.DocumentDeltaEvent;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.beans.factory.annotation.Autowired;

import java.security.Principal;

/**
 * Handles incoming STOMP messages for real-time document collaboration.
 * Uses a message broker to broadcast events to all active subscribers.
 */
@Controller
public class DocumentWebSocketController {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    /**
     * Broadcasts a document change (delta) to all users editing the given document.
     * Clients should subscribe to `/topic/documents/{id}/edits` to receive these updates.
     */
    @MessageMapping("/documents/{documentId}/edit")
    public void handleDocumentEdit(
            @DestinationVariable Long documentId,
            @Payload DocumentDeltaEvent delta,
            SimpMessageHeaderAccessor headerAccessor) {

        Principal user = headerAccessor.getUser();
        if (user != null) {
            delta.setUsername(user.getName());
        }

        delta.setDocumentId(documentId);
        delta.setTimestamp(System.currentTimeMillis());

        // Broadcast to all active subscribers on this document's channel
        messagingTemplate.convertAndSend("/topic/documents/" + documentId + "/edits", delta);
    }

    /**
     * Broadcasts cursor position changes so users can see where others are typing.
     * Clients should subscribe to `/topic/documents/{id}/cursors`.
     */
    @MessageMapping("/documents/{documentId}/cursor")
    public void handleCursorMove(
            @DestinationVariable Long documentId,
            @Payload CursorMoveEvent cursorEvent,
            SimpMessageHeaderAccessor headerAccessor) {

        Principal user = headerAccessor.getUser();
        if (user != null) {
            cursorEvent.setUsername(user.getName());
        }

        cursorEvent.setDocumentId(documentId);

        messagingTemplate.convertAndSend("/topic/documents/" + documentId + "/cursors", cursorEvent);
    }
}
