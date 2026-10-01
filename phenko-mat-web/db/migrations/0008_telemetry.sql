CREATE TABLE "error_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"source" varchar(20) NOT NULL,
	"level" varchar(10) DEFAULT 'error' NOT NULL,
	"fingerprint" varchar(64) NOT NULL,
	"route" varchar(200),
	"method" varchar(10),
	"status" integer,
	"code" varchar(60),
	"message" varchar(1000) NOT NULL,
	"stack" text,
	"user_id" uuid,
	"meta" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_stats" (
	"minute" timestamp with time zone NOT NULL,
	"route" varchar(200) NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"errors_4xx" integer DEFAULT 0 NOT NULL,
	"errors_5xx" integer DEFAULT 0 NOT NULL,
	"slow" integer DEFAULT 0 NOT NULL,
	"duration_ms_sum" bigint DEFAULT 0 NOT NULL,
	"duration_ms_max" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "request_stats_minute_route_pk" PRIMARY KEY("minute","route")
);
--> statement-breakpoint
CREATE INDEX "error_events_created_idx" ON "error_events" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "error_events_fingerprint_idx" ON "error_events" USING btree ("fingerprint","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "request_stats_minute_idx" ON "request_stats" USING btree ("minute" DESC NULLS LAST);