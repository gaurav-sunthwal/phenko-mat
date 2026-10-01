CREATE TABLE "item_views" (
	"item_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"details_opened_at" timestamp with time zone,
	CONSTRAINT "item_views_item_id_user_id_pk" PRIMARY KEY("item_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "item_views" ADD CONSTRAINT "item_views_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_views" ADD CONSTRAINT "item_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;