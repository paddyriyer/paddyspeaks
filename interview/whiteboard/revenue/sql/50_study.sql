-- Did people understand more, or did they just like the colours? Accuracy,
-- time, and the dangerous cell: wrong but confident. (Rows are SYNTHETIC here.)
CREATE TABLE study_response (
    participant   TEXT     NOT NULL,
    role          TEXT     NOT NULL,
    variant       TEXT     NOT NULL CHECK (variant IN ('today', 'redesign')),
    task          TEXT     NOT NULL,
    correct       BOOLEAN  NOT NULL,
    confidence    SMALLINT NOT NULL CHECK (confidence BETWEEN 1 AND 5),
    seconds       INT      NOT NULL,
    PRIMARY KEY (participant, task)
);
