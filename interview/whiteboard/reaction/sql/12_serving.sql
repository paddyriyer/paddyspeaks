-- What we actually broadcast. A media second's mood keeps growing as viewers
-- further behind reach it, so a snapshot is a REVISION: what was known about
-- second media_sec as of published_at. Screens never render a stale one.
CREATE TABLE mood_snapshot (
    match_id        INT          NOT NULL REFERENCES dim_match,
    region          TEXT         NOT NULL,                  -- 'ALL' for the merged view
    media_sec       INT          NOT NULL,
    revision        INT          NOT NULL,
    published_at    TIMESTAMPTZ  NOT NULL,
    voices          INT          NOT NULL CHECK (voices >= 0),
    is_partial      BOOLEAN      NOT NULL,                  -- a region missing from the merge
    shares          JSONB        NOT NULL,
    PRIMARY KEY (match_id, region, media_sec, revision)
);

-- 1% of clients report what they rendered and where their player was.
CREATE TABLE render_receipt (
    session_id       UUID        NOT NULL,
    match_id         INT         NOT NULL,
    snapshot_media_sec INT       NOT NULL,     -- the second the mood describes
    player_media_ms  BIGINT      NOT NULL,     -- where THIS viewer's player was at render
    rendered_at      TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (session_id, rendered_at)
);

CREATE INDEX ON reaction_batch (match_id, media_sec);
CREATE INDEX ON reaction_batch (account_id);
