CREATE TABLE IF NOT EXISTS "journal_conversations" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "journal_entry_id" uuid NOT NULL REFERENCES "journal_entries"("id") ON DELETE CASCADE,
  "messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "journal_conversations_entry_unique"
  ON "journal_conversations" ("journal_entry_id");
