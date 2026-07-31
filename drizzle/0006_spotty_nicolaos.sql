CREATE TABLE "device_access_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"authorization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"token_digest" text NOT NULL,
	"scope" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_device_authorizations" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"user_code" text NOT NULL,
	"scope" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"user_id" text,
	"interval_seconds" integer DEFAULT 3 NOT NULL,
	"poll_count" integer DEFAULT 0 NOT NULL,
	"last_polled_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "device_access_grants" ADD CONSTRAINT "device_access_grants_authorization_id_oauth_device_authorizations_id_fk" FOREIGN KEY ("authorization_id") REFERENCES "public"."oauth_device_authorizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_access_grants" ADD CONSTRAINT "device_access_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_device_authorizations" ADD CONSTRAINT "oauth_device_authorizations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "device_access_grants_token_digest_idx" ON "device_access_grants" USING btree ("token_digest");--> statement-breakpoint
CREATE UNIQUE INDEX "device_access_grants_authorization_idx" ON "device_access_grants" USING btree ("authorization_id");--> statement-breakpoint
CREATE INDEX "device_access_grants_expires_at_idx" ON "device_access_grants" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_device_authorizations_user_code_idx" ON "oauth_device_authorizations" USING btree ("user_code");--> statement-breakpoint
CREATE INDEX "oauth_device_authorizations_expires_at_idx" ON "oauth_device_authorizations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "oauth_device_authorizations_user_id_idx" ON "oauth_device_authorizations" USING btree ("user_id");