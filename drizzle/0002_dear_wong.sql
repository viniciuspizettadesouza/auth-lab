DROP INDEX "verifications_identifier_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");