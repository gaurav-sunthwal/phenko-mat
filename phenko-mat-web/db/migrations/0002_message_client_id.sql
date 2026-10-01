ALTER TABLE "messages" ADD COLUMN "client_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "messages_sender_client_id_key" ON "messages" USING btree ("sender_id","client_id");