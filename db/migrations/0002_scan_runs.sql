CREATE TABLE IF NOT EXISTS "scan_runs" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" text DEFAULT 'queued' NOT NULL,
  "config" jsonb NOT NULL,
  "result" jsonb,
  "error" text,
  "queued_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone,
  CONSTRAINT "scan_runs_status_check" CHECK ("status" IN ('queued', 'running', 'done', 'failed', 'canceled'))
);

CREATE INDEX IF NOT EXISTS "idx_scan_user" ON "scan_runs" ("user_id", "queued_at");
