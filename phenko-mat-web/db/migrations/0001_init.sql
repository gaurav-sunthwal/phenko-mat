CREATE TYPE "public"."category_group" AS ENUM('tier', 'kind', 'custom');--> statement-breakpoint
CREATE TYPE "public"."item_condition" AS ENUM('new', 'like_new', 'good', 'used');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('active', 'given', 'removed');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('spam', 'scam', 'prohibited', 'offensive', 'other');--> statement-breakpoint
CREATE TYPE "public"."swipe_direction" AS ENUM('left', 'right');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" varchar(48) PRIMARY KEY NOT NULL,
	"name" varchar(40) NOT NULL,
	"emoji" varchar(16) NOT NULL,
	"group" "category_group" DEFAULT 'custom' NOT NULL,
	"blurb" varchar(120),
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connections" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"item_id" uuid NOT NULL,
	"taker_id" uuid NOT NULL,
	"giver_id" uuid NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"taker_read_at" timestamp with time zone DEFAULT now() NOT NULL,
	"giver_read_at" timestamp with time zone DEFAULT 'epoch' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connections_distinct_parties" CHECK ("connections"."taker_id" <> "connections"."giver_id")
);
--> statement-breakpoint
CREATE TABLE "item_categories" (
	"item_id" uuid NOT NULL,
	"category_id" varchar(48) NOT NULL,
	CONSTRAINT "item_categories_item_id_category_id_pk" PRIMARY KEY("item_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" varchar(80) NOT NULL,
	"description" varchar(1000) DEFAULT '' NOT NULL,
	"photos" text[] NOT NULL,
	"condition" "item_condition" NOT NULL,
	"price_inr" integer DEFAULT 0 NOT NULL,
	"area" varchar(80) NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"location" geography(Point, 4326) GENERATED ALWAYS AS ((ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography)) STORED NOT NULL,
	"status" "item_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "items_price_range" CHECK ("items"."price_inr" between 0 and 10000000),
	CONSTRAINT "items_photos_count" CHECK (cardinality("items"."photos") between 1 and 6),
	CONSTRAINT "items_lat_range" CHECK ("items"."lat" between -90 and 90),
	CONSTRAINT "items_lng_range" CHECK ("items"."lng" between -180 and 180)
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"connection_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"body" varchar(2000) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_body_not_blank" CHECK (length(btrim("messages"."body")) > 0)
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" varchar(200) PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"item_id" uuid,
	"reported_user_id" uuid,
	"reason" "report_reason" NOT NULL,
	"details" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_has_target" CHECK ("reports"."item_id" is not null or "reports"."reported_user_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "swipes" (
	"user_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"direction" "swipe_direction" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "swipes_user_id_item_id_pk" PRIMARY KEY("user_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "user_interests" (
	"user_id" uuid NOT NULL,
	"category_id" varchar(48) NOT NULL,
	CONSTRAINT "user_interests_user_id_category_id_pk" PRIMARY KEY("user_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"firebase_uid" varchar(128) NOT NULL,
	"email" varchar(254),
	"name" varchar(60) NOT NULL,
	"bio" varchar(300) DEFAULT '' NOT NULL,
	"avatar_url" text,
	"area" varchar(80),
	"lat" double precision,
	"lng" double precision,
	"location" geography(Point, 4326) GENERATED ALWAYS AS ((ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography)) STORED,
	"radius_km" smallint DEFAULT 10 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_radius_range" CHECK ("users"."radius_km" between 1 and 100),
	CONSTRAINT "users_lat_range" CHECK ("users"."lat" between -90 and 90),
	CONSTRAINT "users_lng_range" CHECK ("users"."lng" between -180 and 180),
	CONSTRAINT "users_location_pair" CHECK (("users"."lat" is null) = ("users"."lng" is null))
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_taker_id_users_id_fk" FOREIGN KEY ("taker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_giver_id_users_id_fk" FOREIGN KEY ("giver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_categories" ADD CONSTRAINT "item_categories_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_categories" ADD CONSTRAINT "item_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_user_id_users_id_fk" FOREIGN KEY ("reported_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swipes" ADD CONSTRAINT "swipes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swipes" ADD CONSTRAINT "swipes_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_name_lower_key" ON "categories" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "connections_item_taker_key" ON "connections" USING btree ("item_id","taker_id");--> statement-breakpoint
CREATE INDEX "connections_taker_recent_idx" ON "connections" USING btree ("taker_id","last_message_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "connections_giver_recent_idx" ON "connections" USING btree ("giver_id","last_message_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "item_categories_category_idx" ON "item_categories" USING btree ("category_id","item_id");--> statement-breakpoint
CREATE INDEX "items_active_location_idx" ON "items" USING gist ("location") WHERE "items"."status" = 'active';--> statement-breakpoint
CREATE INDEX "items_owner_created_idx" ON "items" USING btree ("owner_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "messages_connection_id_idx" ON "messages" USING btree ("connection_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_reporter_item_key" ON "reports" USING btree ("reporter_id","item_id");--> statement-breakpoint
CREATE INDEX "swipes_user_created_idx" ON "swipes" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "swipes_item_idx" ON "swipes" USING btree ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_firebase_uid_key" ON "users" USING btree ("firebase_uid");