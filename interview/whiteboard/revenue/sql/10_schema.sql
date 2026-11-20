-- The Revenue Problem — the operational facts both dashboards read. PostgreSQL 16.
-- One table of orders, one of refunds. Neither dashboard is wrong about these rows;
-- they disagree about which rows, which amounts and which month.
CREATE TABLE orders (
    order_id      BIGINT        PRIMARY KEY,
    customer_id   BIGINT        NOT NULL,
    is_test       BOOLEAN       NOT NULL,           -- QA and demo orders
    ordered_at    TIMESTAMPTZ   NOT NULL,           -- when the customer placed it
    fulfilled_at  TIMESTAMPTZ   NOT NULL,           -- when we delivered: the recognition point
    subtotal      NUMERIC(12,2) NOT NULL CHECK (subtotal > 0),   -- goods and services
    tax           NUMERIC(12,2) NOT NULL CHECK (tax >= 0)        -- collected for the state
);

CREATE TABLE refunds (
    refund_id     BIGINT        PRIMARY KEY,
    order_id      BIGINT        NOT NULL REFERENCES orders,
    refunded_at   TIMESTAMPTZ   NOT NULL,
    amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0)      -- refunded revenue, excl. tax
);
