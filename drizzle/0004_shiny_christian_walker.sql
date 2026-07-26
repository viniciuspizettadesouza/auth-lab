CREATE TABLE "oidc_authorization_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"subject" text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"nonce" text NOT NULL,
	"code_challenge" text NOT NULL,
	"scope" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "oidc_authorization_codes_expires_at_idx" ON "oidc_authorization_codes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "oidc_authorization_codes_subject_idx" ON "oidc_authorization_codes" USING btree ("subject");