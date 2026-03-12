package com.munify.core.dto.websocket;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Payload representing a user's cursor position and selection state
 * for presence indicators during collaborative editing.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CursorMoveEvent {
    private Long documentId;
    private String username;
    
    /** Start offset of the text selection or cursor position */
    private Integer anchor;
    
    /** End offset of the text selection */
    private Integer head;
    
    /** Color assigned to the user cursor */
    private String color;
}
