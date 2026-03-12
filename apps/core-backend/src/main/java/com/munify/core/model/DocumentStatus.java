package com.munify.core.model;

/**
 * Lifecycle status of a MUN document.
 */
public enum DocumentStatus {
    /** Initial state, document is being drafted. */
    DRAFT,

    /** Under collaborative review by co-signatories. */
    IN_REVIEW,

    /** Submitted to the Dais/Chair for formal consideration. */
    SUBMITTED,

    /** Approved by the committee. */
    APPROVED,

    /** Rejected or tabled by the committee. */
    REJECTED,

    /** Amended from a previously approved version. */
    AMENDED
}
