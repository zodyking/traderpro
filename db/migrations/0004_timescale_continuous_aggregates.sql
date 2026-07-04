-- Roll up fine-grained candles into 1-hour continuous aggregate buckets.
CREATE MATERIALIZED VIEW IF NOT EXISTS candles_1h_cagg
WITH (timescaledb.continuous) AS
SELECT
  symbol_id,
  time_bucket(INTERVAL '1 hour', "time") AS bucket,
  first(open, "time") AS open,
  max(high) AS high,
  min(low) AS low,
  last(close, "time") AS close,
  coalesce(sum(volume), 0) AS volume
FROM candles
WHERE interval IN ('1m', '5m', '15m')
GROUP BY symbol_id, bucket
WITH NO DATA;
--> statement-breakpoint
SELECT add_continuous_aggregate_policy(
  'candles_1h_cagg',
  start_offset => INTERVAL '3 hours',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);
