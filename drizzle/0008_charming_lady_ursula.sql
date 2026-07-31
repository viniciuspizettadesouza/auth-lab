CREATE TABLE "workload_api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"principal_id" text NOT NULL,
	"digest" text NOT NULL,
	"hint" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workload_audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"principal_id" text NOT NULL,
	"key_id" text,
	"action" text NOT NULL,
	"outcome" text NOT NULL,
	"detail" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workload_principals" (
	"id" text PRIMARY KEY NOT NULL,
	"visitor_id" text NOT NULL,
	"name" text NOT NULL,
	"audience" text NOT NULL,
	"scopes" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workload_api_keys" ADD CONSTRAINT "workload_api_keys_principal_id_workload_principals_id_fk" FOREIGN KEY ("principal_id") REFERENCES "public"."workload_principals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workload_audit_events" ADD CONSTRAINT "workload_audit_events_principal_id_workload_principals_id_fk" FOREIGN KEY ("principal_id") REFERENCES "public"."workload_principals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workload_audit_events" ADD CONSTRAINT "workload_audit_events_key_id_workload_api_keys_id_fk" FOREIGN KEY ("key_id") REFERENCES "public"."workload_api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workload_api_keys_digest_idx" ON "workload_api_keys" USING btree ("digest");--> statement-breakpoint
CREATE INDEX "workload_api_keys_principal_idx" ON "workload_api_keys" USING btree ("principal_id");--> statement-breakpoint
CREATE INDEX "workload_api_keys_expiry_idx" ON "workload_api_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "workload_audit_events_principal_idx" ON "workload_audit_events" USING btree ("principal_id");--> statement-breakpoint
CREATE INDEX "workload_audit_events_created_idx" ON "workload_audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "workload_principals_visitor_idx" ON "workload_principals" USING btree ("visitor_id");