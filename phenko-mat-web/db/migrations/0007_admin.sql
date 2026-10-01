CREATE TABLE "admin_actions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"admin_email" varchar(254) NOT NULL,
	"action" varchar(40) NOT NULL,
	"target_type" varchar(20) NOT NULL,
	"target_id" varchar(64) NOT NULL,
	"summary" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "resolution" varchar(20);--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "resolved_by" varchar(254);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "banned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ban_reason" varchar(300);--> statement-breakpoint
CREATE INDEX "admin_actions_created_idx" ON "admin_actions" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "reports_open_idx" ON "reports" USING btree ("item_id") WHERE "reports"."resolved_at" is null;