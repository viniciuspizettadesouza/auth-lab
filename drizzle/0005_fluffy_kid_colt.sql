CREATE TABLE "dpop_access_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text NOT NULL,
	"token_digest" text NOT NULL,
	"public_jwk" jsonb NOT NULL,
	"key_thumbprint" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dpop_proof_replays" (
	"jti" text PRIMARY KEY NOT NULL,
	"grant_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_assurances" (
	"session_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"level" text NOT NULL,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dpop_access_grants" ADD CONSTRAINT "dpop_access_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dpop_access_grants" ADD CONSTRAINT "dpop_access_grants_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dpop_proof_replays" ADD CONSTRAINT "dpop_proof_replays_grant_id_dpop_access_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."dpop_access_grants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_assurances" ADD CONSTRAINT "session_assurances_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_assurances" ADD CONSTRAINT "session_assurances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dpop_access_grants_token_digest_idx" ON "dpop_access_grants" USING btree ("token_digest");--> statement-breakpoint
CREATE INDEX "dpop_access_grants_user_id_idx" ON "dpop_access_grants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "dpop_access_grants_expires_at_idx" ON "dpop_access_grants" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "dpop_proof_replays_expires_at_idx" ON "dpop_proof_replays" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "session_assurances_user_id_idx" ON "session_assurances" USING btree ("user_id");