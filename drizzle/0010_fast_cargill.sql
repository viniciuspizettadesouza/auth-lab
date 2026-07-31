CREATE TABLE "portable_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"visitor_id" text NOT NULL,
	"holder_thumbprint" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portable_presentation_replays" (
	"jti" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portable_presentation_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"visitor_id" text NOT NULL,
	"nonce_digest" text NOT NULL,
	"audience" text NOT NULL,
	"requested_claims" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "portable_presentation_replays" ADD CONSTRAINT "portable_presentation_replays_request_id_portable_presentation_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."portable_presentation_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "portable_credentials_visitor_idx" ON "portable_credentials" USING btree ("visitor_id");--> statement-breakpoint
CREATE INDEX "portable_presentation_replays_expiry_idx" ON "portable_presentation_replays" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "portable_presentation_requests_nonce_idx" ON "portable_presentation_requests" USING btree ("nonce_digest");--> statement-breakpoint
CREATE INDEX "portable_presentation_requests_visitor_idx" ON "portable_presentation_requests" USING btree ("visitor_id");--> statement-breakpoint
CREATE INDEX "portable_presentation_requests_expiry_idx" ON "portable_presentation_requests" USING btree ("expires_at");