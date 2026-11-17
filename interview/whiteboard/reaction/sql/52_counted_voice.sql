-- What every downstream number reads: voices from sessions that passed integrity.
CREATE VIEW counted_voice AS
SELECT v.*
FROM reaction_voice v
JOIN session_integrity i USING (session_id)
WHERE NOT i.excluded;
