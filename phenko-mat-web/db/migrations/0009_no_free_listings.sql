ALTER TABLE "items" DROP CONSTRAINT "items_price_range";--> statement-breakpoint
ALTER TABLE "items" ALTER COLUMN "price_inr" DROP DEFAULT;--> statement-breakpoint
-- No more free listings: existing ₹0 items become ₹1 before the new minimum applies.
UPDATE "items" SET "price_inr" = 1, "updated_at" = now() WHERE "price_inr" = 0;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_price_range" CHECK ("items"."price_inr" between 1 and 10000000);