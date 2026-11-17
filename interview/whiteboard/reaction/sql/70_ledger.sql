-- The same boxes with money in them. Here the record, not the aggregate, is
-- the product. Double entry: every transaction's entries sum to zero, checked
-- by the database at COMMIT, not by a nightly job.
CREATE TABLE wallet (
    customer_id   BIGINT  PRIMARY KEY,
    balance_minor BIGINT  NOT NULL CHECK (balance_minor >= 0)
);

CREATE TABLE payment_intent (
    intent_id        BIGSERIAL   PRIMARY KEY,
    idempotency_key  TEXT        NOT NULL UNIQUE,     -- ★ one charge per intent, forever
    order_id         BIGINT      NOT NULL,
    customer_id      BIGINT      NOT NULL REFERENCES wallet,
    amount_minor     BIGINT      NOT NULL CHECK (amount_minor > 0),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ledger_entry (
    entry_id      BIGSERIAL PRIMARY KEY,
    txn_id        BIGINT    NOT NULL REFERENCES payment_intent (intent_id),
    account       TEXT      NOT NULL,                 -- 'customer:42', 'merchant'
    amount_minor  BIGINT    NOT NULL CHECK (amount_minor <> 0)
);

CREATE FUNCTION assert_balanced() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF (SELECT sum(amount_minor) FROM ledger_entry WHERE txn_id = NEW.txn_id) <> 0 THEN
        RAISE EXCEPTION 'txn % does not balance', NEW.txn_id;
    END IF;
    RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER ledger_balances
    AFTER INSERT ON ledger_entry
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION assert_balanced();
