-- The mood of media second m, AS KNOWN at wall time p_as_of: voices over the
-- five media seconds ending at m that had reached the edge by then. Called by
-- the publisher on every tick, so the same second gets fuller revisions as
-- viewers who are further behind reach it.
CREATE FUNCTION mood_as_of(p_match INT, p_sec INT, p_as_of TIMESTAMPTZ)
RETURNS TABLE (emoji TEXT, voices BIGINT, share NUMERIC)
LANGUAGE sql STABLE AS $$
    SELECT v.emoji, count(*),
           round(count(*)::numeric / sum(count(*)) OVER (), 3)
    FROM reaction_voice v
    WHERE v.match_id = p_match
      AND v.media_sec BETWEEN p_sec - 4 AND p_sec
      AND v.edge_received_at <= p_as_of
    GROUP BY v.emoji
$$;
