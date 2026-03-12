package com.munify.core.dto.websocket;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Payload representing a CRDT delta update or a simple content change
 * for collaborative editing via WebSockets.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentDeltaEvent {
    /** The ID of the document being edited */
    private Long documentId;
    
    /** The actual edit action, patch, or Yjs CRDT Uint8Array payload (base64 encoded) */
    private String delta;
    
    /** Who made the edit */
    private String username;
    
    /** Client timestamp for ordering */
    private Long timestamp;
}
