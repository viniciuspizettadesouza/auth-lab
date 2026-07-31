CREATE TABLE "workload_access_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"principal_id" text NOT NULL,
	"token_digest" text NOT NULL,
	"audience" text NOT NULL,
	"scope" text NOT NULL,
	"source" text NOT NULL,
	"public_jwk" jsonb,
	"key_thumbprint" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workload_assertion_replays" (
	"jti" text PRIMARY KEY NOT NULL,
	"principal_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workload_client_secrets" (
	"id" text PRIMARY KEY NOT NULL,
	"principal_id" text NOT NULL,
	"digest" text NOT NULL,
	"hint" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workload_proof_replays" (
	"jti" text PRIMARY KEY NOT NULL,
	"grant_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workload_access_grants" ADD CONSTRAINT "workload_access_grants_principal_id_workload_principals_id_fk" FOREIGN KEY ("principal_id") REFERENCES "public"."workload_principals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workload_assertion_replays" ADD CONSTRAINT "workload_assertion_replays_principal_id_workload_principals_id_fk" FOREIGN KEY ("principal_id") REFERENCES "public"."workload_principals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workload_client_secrets" ADD CONSTRAINT "workload_client_secrets_principal_id_workload_principals_id_fk" FOREIGN KEY ("principal_id") REFERENCES "public"."workload_principals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workload_proof_replays" ADD CONSTRAINT "workload_proof_replays_grant_id_workload_access_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."workload_access_grants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workload_access_grants_digest_idx" ON "workload_access_grants" USING btree ("token_digest");--> statement-breakpoint
CREATE INDEX "workload_access_grants_principal_idx" ON "workload_access_grants" USING btree ("principal_id");--> statement-breakpoint
CREATE INDEX "workload_access_grants_expiry_idx" ON "workload_access_grants" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "workload_assertion_replays_expiry_idx" ON "workload_assertion_replays" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workload_client_secrets_digest_idx" ON "workload_client_secrets" USING btree ("digest");--> statement-breakpoint
CREATE INDEX "workload_client_secrets_principal_idx" ON "workload_client_secrets" USING btree ("principal_id");--> statement-breakpoint
CREATE INDEX "workload_proof_replays_expiry_idx" ON "workload_proof_replays" USING btree ("expires_at");