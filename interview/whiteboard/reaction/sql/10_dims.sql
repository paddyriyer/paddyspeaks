-- The Reaction Problem — schema. PostgreSQL 16.
-- Two clocks on every row: MEDIA time (where in the broadcast the viewer was)
-- and WALL time (when a machine saw it). The mood is keyed on media time.

CREATE TABLE dim_match (
    match_id        INT          PRIMARY KEY,
    title           TEXT         NOT NULL,
    starts_at       TIMESTAMPTZ  NOT NULL
);

-- Ball-by-ball, already aligned to the broadcast's media clock.
CREATE TABLE dim_delivery (
    match_id        INT          NOT NULL REFERENCES dim_match,
    over_no         SMALLINT     NOT NULL,
    ball_no         SMALLINT     NOT NULL,
    media_sec       INT          NOT NULL,          -- when the ball is bowled, in media time
    outcome         TEXT         NOT NULL
                    CHECK (outcome IN ('dot','run','four','six','wicket','wide')),
    PRIMARY KEY (match_id, over_no, ball_no)
);

CREATE TABLE dim_account (
    account_id      BIGINT       PRIMARY KEY,
    created_at      TIMESTAMPTZ  NOT NULL
);
