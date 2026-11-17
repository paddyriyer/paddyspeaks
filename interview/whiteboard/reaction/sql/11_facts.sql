-- One row per client batch: a session's taps for ONE media second.
-- (session_id, batch_seq) is the idempotency key: a retried batch is a no-op.
CREATE TABLE reaction_batch (
    session_id       UUID         NOT NULL,
    batch_seq        INT          NOT NULL,
    account_id       BIGINT       REFERENCES dim_account,   -- NULL = anonymous
    device_fp        TEXT         NOT NULL,                 -- coarse device fingerprint
    asn              INT          NOT NULL,                 -- network the batch came from
    region           TEXT         NOT NULL,
    match_id         INT          NOT NULL REFERENCES dim_match,
    media_sec        INT          NOT NULL,                 -- ★ the second the viewer was WATCHING
    client_sent_at   TIMESTAMPTZ  NOT NULL,
    edge_received_at TIMESTAMPTZ  NOT NULL,
    admission        TEXT         NOT NULL
                     CHECK (admission IN ('admitted','throttled','unauthenticated')),
    PRIMARY KEY (session_id, batch_seq)
);

CREATE TABLE reaction_tap (
    session_id      UUID         NOT NULL,
    batch_seq       INT          NOT NULL,
    emoji           TEXT         NOT NULL CHECK (emoji IN ('fire','clap','pray','shock','sad','angry')),
    taps            SMALLINT     NOT NULL CHECK (taps BETWEEN 1 AND 50),
    PRIMARY KEY (session_id, batch_seq, emoji),
    FOREIGN KEY (session_id, batch_seq) REFERENCES reaction_batch
);
