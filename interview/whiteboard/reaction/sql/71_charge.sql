-- Charge exactly once. A retry with the same key returns the original intent
-- and moves no money; the same key with a different amount is a client bug,
-- refused loudly. The funds check and the debit happen under one row lock.
CREATE FUNCTION charge(p_key TEXT, p_order BIGINT, p_customer BIGINT, p_amount BIGINT)
RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE
    v_id   BIGINT;
    v_prev payment_intent%ROWTYPE;
BEGIN
    INSERT INTO payment_intent (idempotency_key, order_id, customer_id, amount_minor)
    VALUES (p_key, p_order, p_customer, p_amount)
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING intent_id INTO v_id;

    IF v_id IS NULL THEN                                  -- a replay
        SELECT * INTO v_prev FROM payment_intent WHERE idempotency_key = p_key;
        IF v_prev.amount_minor <> p_amount OR v_prev.customer_id <> p_customer THEN
            RAISE EXCEPTION 'idempotency key % reused with a different request', p_key;
        END IF;
        RETURN v_prev.intent_id;
    END IF;

    UPDATE wallet SET balance_minor = balance_minor - p_amount
    WHERE customer_id = p_customer AND balance_minor >= p_amount;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'insufficient funds for customer %', p_customer;  -- rolls back the intent too
    END IF;

    INSERT INTO ledger_entry (txn_id, account, amount_minor) VALUES
        (v_id, 'customer:' || p_customer, -p_amount),
        (v_id, 'merchant',                 p_amount);
    RETURN v_id;
END $$;
