CREATE EXTENSION IF NOT EXISTS timescaledb;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS citext;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
--> statement-breakpoint
CREATE TABLE "ai_reviews" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"packet" jsonb NOT NULL,
	"result" jsonb,
	"model" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"tokens_in" integer,
	"tokens_out" integer,
	"cost_usd" numeric(10, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_reviews_target_type_check" CHECK ("ai_reviews"."target_type" IN ('strategy', 'trade', 'risk', 'lesson')),
	CONSTRAINT "ai_reviews_status_check" CHECK ("ai_reviews"."status" IN ('queued', 'running', 'done', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "backtest_metrics" (
	"run_id" uuid PRIMARY KEY NOT NULL,
	"trade_count" integer NOT NULL,
	"win_rate" numeric(6, 4),
	"profit_factor" numeric(10, 4),
	"expectancy" numeric(14, 6),
	"total_return" numeric(14, 6),
	"cagr" numeric(10, 6),
	"max_drawdown" numeric(10, 6),
	"sharpe" numeric(10, 4),
	"sortino" numeric(10, 4),
	"avg_win" numeric(14, 6),
	"avg_loss" numeric(14, 6),
	"exposure_pct" numeric(6, 4),
	"longest_win_streak" integer,
	"longest_loss_streak" integer,
	"regime_breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"quality_warnings" text[] DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backtest_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"strategy_version_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"config" jsonb NOT NULL,
	"data_snapshot" jsonb NOT NULL,
	"error" text,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "backtest_runs_status_check" CHECK ("backtest_runs"."status" IN ('queued', 'running', 'done', 'failed', 'canceled'))
);
--> statement-breakpoint
CREATE TABLE "backtest_trades" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"symbol_id" uuid NOT NULL,
	"side" text NOT NULL,
	"entry_time" timestamp with time zone NOT NULL,
	"entry_price" double precision NOT NULL,
	"exit_time" timestamp with time zone,
	"exit_price" double precision,
	"qty" double precision NOT NULL,
	"pnl" numeric(14, 6),
	"r_multiple" numeric(10, 4),
	"exit_reason" text,
	"signal_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "backtest_trades_side_check" CHECK ("backtest_trades"."side" IN ('long', 'short'))
);
--> statement-breakpoint
CREATE TABLE "equity_points" (
	"run_id" uuid NOT NULL,
	"time" timestamp with time zone NOT NULL,
	"equity" numeric(16, 6) NOT NULL,
	"drawdown" numeric(10, 6) NOT NULL,
	CONSTRAINT "equity_points_run_id_time_pk" PRIMARY KEY("run_id","time")
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"limits" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"provider_ref" text,
	"period_end" timestamp with time zone,
	CONSTRAINT "subscriptions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "usage_counters" (
	"user_id" uuid NOT NULL,
	"metric" text NOT NULL,
	"period" date NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "usage_counters_user_id_metric_period_pk" PRIMARY KEY("user_id","metric","period")
);
--> statement-breakpoint
CREATE TABLE "broker_accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"connection_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"account_ref" text NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"equity" numeric(16, 4),
	"cash" numeric(16, 4),
	"buying_power" numeric(16, 4),
	"snapshot_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "broker_connections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"broker" text NOT NULL,
	"label" text NOT NULL,
	"creds_enc" "bytea",
	"status" text DEFAULT 'connected' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "broker_connections_status_check" CHECK ("broker_connections"."status" IN ('connected', 'syncing', 'degraded', 'expired', 'revoked'))
);
--> statement-breakpoint
CREATE TABLE "broker_sync_jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"connection_id" uuid NOT NULL,
	"status" text NOT NULL,
	"range_from" timestamp with time zone,
	"range_to" timestamp with time zone,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "executions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"symbol_id" uuid,
	"raw_symbol" text NOT NULL,
	"side" text NOT NULL,
	"qty" double precision NOT NULL,
	"price" double precision NOT NULL,
	"fees" numeric(12, 4) DEFAULT '0' NOT NULL,
	"executed_at" timestamp with time zone NOT NULL,
	"order_ref" text,
	"source_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "executions_side_check" CHECK ("executions"."side" IN ('buy', 'sell'))
);
--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount" numeric(16, 4) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	CONSTRAINT "transfers_kind_check" CHECK ("transfers"."kind" IN ('deposit', 'withdrawal', 'fee', 'dividend'))
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"scopes" text[] DEFAULT '{}' NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"target" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" "inet",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mfa_methods" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"secret_enc" "bytea" NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mfa_methods_kind_check" CHECK ("mfa_methods"."kind" IN ('totp', 'webauthn', 'recovery'))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"device_label" text,
	"ip" "inet",
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" "citext" NOT NULL,
	"password_hash" text,
	"display_name" text NOT NULL,
	"experience" text DEFAULT 'novice' NOT NULL,
	"ui_mode" text DEFAULT 'novice' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_experience_check" CHECK ("users"."experience" IN ('novice', 'developing', 'advanced', 'system')),
	CONSTRAINT "users_ui_mode_check" CHECK ("users"."ui_mode" IN ('novice', 'pro'))
);
--> statement-breakpoint
CREATE TABLE "candles" (
	"symbol_id" uuid NOT NULL,
	"interval" text NOT NULL,
	"time" timestamp with time zone NOT NULL,
	"open" double precision NOT NULL,
	"high" double precision NOT NULL,
	"low" double precision NOT NULL,
	"close" double precision NOT NULL,
	"volume" double precision,
	"source" text NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"quality_flags" text[] DEFAULT '{}' NOT NULL,
	CONSTRAINT "candles_symbol_id_interval_time_pk" PRIMARY KEY("symbol_id","interval","time")
);
--> statement-breakpoint
CREATE TABLE "data_quality_reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"symbol_id" uuid NOT NULL,
	"interval" text NOT NULL,
	"kind" text NOT NULL,
	"range_from" timestamp with time zone NOT NULL,
	"range_to" timestamp with time zone NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"status" text DEFAULT 'healthy' NOT NULL,
	CONSTRAINT "providers_status_check" CHECK ("providers"."status" IN ('healthy', 'delayed', 'gapped', 'untrusted', 'unavailable'))
);
--> statement-breakpoint
CREATE TABLE "quote_snapshots" (
	"symbol_id" uuid NOT NULL,
	"time" timestamp with time zone NOT NULL,
	"bid" double precision,
	"ask" double precision,
	"last" double precision,
	"volume_day" double precision,
	CONSTRAINT "quote_snapshots_symbol_id_time_pk" PRIMARY KEY("symbol_id","time")
);
--> statement-breakpoint
CREATE TABLE "symbols" (
	"id" uuid PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"exchange" text NOT NULL,
	"ticker" text NOT NULL,
	"asset_class" text NOT NULL,
	"currency" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "symbols_provider_exchange_ticker_unique" UNIQUE("provider_id","exchange","ticker"),
	CONSTRAINT "symbols_asset_class_check" CHECK ("symbols"."asset_class" IN ('stock', 'crypto', 'forex', 'futures', 'index', 'option'))
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"symbol_id" uuid,
	"strategy_version_id" uuid,
	"condition" jsonb NOT NULL,
	"condition_hash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_fired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist_symbols" (
	"watchlist_id" uuid NOT NULL,
	"symbol_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "watchlist_symbols_watchlist_id_symbol_id_pk" PRIMARY KEY("watchlist_id","symbol_id")
);
--> statement-breakpoint
CREATE TABLE "watchlists" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"layout" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"asset_class" text NOT NULL,
	"timeframe" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategy_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"strategy_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"rules" jsonb NOT NULL,
	"risk_model" jsonb NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"assumptions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "strategy_versions_strategy_id_version_unique" UNIQUE("strategy_id","version")
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"symbol_id" uuid,
	"strategy_version_id" uuid,
	"execution_ids" uuid[] DEFAULT '{}' NOT NULL,
	"side" text,
	"setup_tag" text,
	"planned" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actual" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"emotion" text,
	"mistakes" text[] DEFAULT '{}' NOT NULL,
	"note" text,
	"screenshots" text[] DEFAULT '{}' NOT NULL,
	"opened_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journal_entries_side_check" CHECK ("journal_entries"."side" IS NULL OR "journal_entries"."side" IN ('long', 'short'))
);
--> statement-breakpoint
ALTER TABLE "ai_reviews" ADD CONSTRAINT "ai_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backtest_metrics" ADD CONSTRAINT "backtest_metrics_run_id_backtest_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."backtest_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backtest_runs" ADD CONSTRAINT "backtest_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backtest_runs" ADD CONSTRAINT "backtest_runs_strategy_version_id_strategy_versions_id_fk" FOREIGN KEY ("strategy_version_id") REFERENCES "public"."strategy_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backtest_trades" ADD CONSTRAINT "backtest_trades_run_id_backtest_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."backtest_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backtest_trades" ADD CONSTRAINT "backtest_trades_symbol_id_symbols_id_fk" FOREIGN KEY ("symbol_id") REFERENCES "public"."symbols"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equity_points" ADD CONSTRAINT "equity_points_run_id_backtest_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."backtest_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_accounts" ADD CONSTRAINT "broker_accounts_connection_id_broker_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."broker_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_accounts" ADD CONSTRAINT "broker_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_connections" ADD CONSTRAINT "broker_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_sync_jobs" ADD CONSTRAINT "broker_sync_jobs_connection_id_broker_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."broker_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executions" ADD CONSTRAINT "executions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executions" ADD CONSTRAINT "executions_account_id_broker_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."broker_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executions" ADD CONSTRAINT "executions_symbol_id_symbols_id_fk" FOREIGN KEY ("symbol_id") REFERENCES "public"."symbols"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_account_id_broker_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."broker_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mfa_methods" ADD CONSTRAINT "mfa_methods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candles" ADD CONSTRAINT "candles_symbol_id_symbols_id_fk" FOREIGN KEY ("symbol_id") REFERENCES "public"."symbols"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_quality_reports" ADD CONSTRAINT "data_quality_reports_symbol_id_symbols_id_fk" FOREIGN KEY ("symbol_id") REFERENCES "public"."symbols"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_snapshots" ADD CONSTRAINT "quote_snapshots_symbol_id_symbols_id_fk" FOREIGN KEY ("symbol_id") REFERENCES "public"."symbols"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symbols" ADD CONSTRAINT "symbols_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_symbol_id_symbols_id_fk" FOREIGN KEY ("symbol_id") REFERENCES "public"."symbols"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_strategy_version_id_strategy_versions_id_fk" FOREIGN KEY ("strategy_version_id") REFERENCES "public"."strategy_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_symbols" ADD CONSTRAINT "watchlist_symbols_watchlist_id_watchlists_id_fk" FOREIGN KEY ("watchlist_id") REFERENCES "public"."watchlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_symbols" ADD CONSTRAINT "watchlist_symbols_symbol_id_symbols_id_fk" FOREIGN KEY ("symbol_id") REFERENCES "public"."symbols"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlists" ADD CONSTRAINT "watchlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_versions" ADD CONSTRAINT "strategy_versions_strategy_id_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_symbol_id_symbols_id_fk" FOREIGN KEY ("symbol_id") REFERENCES "public"."symbols"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_strategy_version_id_strategy_versions_id_fk" FOREIGN KEY ("strategy_version_id") REFERENCES "public"."strategy_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ai_target" ON "ai_reviews" USING btree ("user_id","target_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_bt_user" ON "backtest_runs" USING btree ("user_id","strategy_version_id","queued_at");--> statement-breakpoint
CREATE INDEX "idx_btt_run" ON "backtest_trades" USING btree ("run_id","entry_time");--> statement-breakpoint
CREATE INDEX "idx_exec_user_time" ON "executions" USING btree ("user_id","account_id","executed_at");--> statement-breakpoint
CREATE INDEX "idx_exec_symbol" ON "executions" USING btree ("user_id","symbol_id","executed_at");--> statement-breakpoint
CREATE INDEX "idx_audit_user_time" ON "audit_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_dqr_symbol" ON "data_quality_reports" USING btree ("symbol_id","interval","created_at");--> statement-breakpoint
CREATE INDEX "idx_alerts_active" ON "alerts" USING btree ("active","symbol_id","condition_hash");--> statement-breakpoint
CREATE INDEX "idx_journal" ON "journal_entries" USING btree ("user_id","symbol_id","setup_tag","opened_at");
--> statement-breakpoint
SELECT create_hypertable('candles', 'time', chunk_time_interval => INTERVAL '7 days', if_not_exists => TRUE);
--> statement-breakpoint
ALTER TABLE candles SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'symbol_id, interval',
  timescaledb.compress_orderby = 'time DESC'
);
--> statement-breakpoint
SELECT add_compression_policy('candles', INTERVAL '30 days', if_not_exists => TRUE);
--> statement-breakpoint
SELECT create_hypertable('quote_snapshots', 'time', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
--> statement-breakpoint
SELECT add_retention_policy('quote_snapshots', INTERVAL '14 days', if_not_exists => TRUE);