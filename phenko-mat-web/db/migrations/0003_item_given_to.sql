ALTER TABLE "items" ADD COLUMN "given_to_id" uuid;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_given_to_id_users_id_fk" FOREIGN KEY ("given_to_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "items_given_to_idx" ON "items" USING btree ("given_to_id") WHERE "items"."given_to_id" is not null;