package com.munify.core.model;

/**
 * The canonical types of documents produced during a Model United Nations simulation.
 */
public enum DocumentType {
    /** A formal position paper outlining a country's stance on a topic. */
    POSITION_PAPER,

    /** A draft resolution with preambulatory and operative clauses. */
    RESOLUTION,

    /** An official declaration made by a delegation or bloc. */
    DECLARATION,

    /** An informal working paper used during caucus and negotiation. */
    WORKING_PAPER
}
