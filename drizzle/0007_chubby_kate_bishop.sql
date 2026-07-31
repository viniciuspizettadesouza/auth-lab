CREATE TABLE "client_assertion_replays" (
	"jti" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enterprise_memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"external_subject" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enterprise_tenants" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"domain" text NOT NULL,
	"protocol" text NOT NULL,
	"issuer" text NOT NULL,
	"sso_required" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "high_assurance_access_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"token_digest" text NOT NULL,
	"certificate_thumbprint" text NOT NULL,
	"scope" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "high_assurance_clients" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"public_jwk" jsonb NOT NULL,
	"active_certificate_thumbprint" text NOT NULL,
	"previous_certificate_thumbprint" text,
	"certificate_status" text DEFAULT 'active' NOT NULL,
	"overlap_ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_assertion_replays" ADD CONSTRAINT "client_assertion_replays_client_id_high_assurance_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."high_assurance_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enterprise_memberships" ADD CONSTRAINT "enterprise_memberships_tenant_id_enterprise_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."enterprise_tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enterprise_memberships" ADD CONSTRAINT "enterprise_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "high_assurance_access_grants" ADD CONSTRAINT "high_assurance_access_grants_client_id_high_assurance_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."high_assurance_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_assertion_replays_expires_at_idx" ON "client_assertion_replays" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "enterprise_memberships_tenant_user_idx" ON "enterprise_memberships" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "enterprise_memberships_tenant_subject_idx" ON "enterprise_memberships" USING btree ("tenant_id","external_subject");--> statement-breakpoint
CREATE UNIQUE INDEX "enterprise_tenants_slug_idx" ON "enterprise_tenants" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "enterprise_tenants_domain_idx" ON "enterprise_tenants" USING btree ("domain");--> statement-breakpoint
CREATE UNIQUE INDEX "high_assurance_access_grants_digest_idx" ON "high_assurance_access_grants" USING btree ("token_digest");--> statement-breakpoint
CREATE INDEX "high_assurance_access_grants_client_idx" ON "high_assurance_access_grants" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "high_assurance_access_grants_expires_at_idx" ON "high_assurance_access_grants" USING btree ("expires_at");