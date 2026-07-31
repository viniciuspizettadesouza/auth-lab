import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex
} from "drizzle-orm/pg-core";

export const user = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
    image: text("image"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [uniqueIndex("users_email_idx").on(table.email)]
);

export const session = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" })
  },
  (table) => [
    uniqueIndex("sessions_token_idx").on(table.token),
    index("sessions_user_id_idx").on(table.userId)
  ]
);

export const sessionAssurance = pgTable(
  "session_assurances",
  {
    sessionId: text("session_id")
      .primaryKey()
      .references(() => session.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    level: text("level")
      .$type<"phishing-resistant">()
      .notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [index("session_assurances_user_id_idx").on(table.userId)]
);

type DpopPublicJwk = {
  kty: "EC";
  crv: "P-256";
  x: string;
  y: string;
};

export const dpopAccessGrant = pgTable(
  "dpop_access_grants",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => session.id, { onDelete: "cascade" }),
    tokenDigest: text("token_digest").notNull(),
    publicJwk: jsonb("public_jwk").$type<DpopPublicJwk>().notNull(),
    keyThumbprint: text("key_thumbprint").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("dpop_access_grants_token_digest_idx").on(table.tokenDigest),
    index("dpop_access_grants_user_id_idx").on(table.userId),
    index("dpop_access_grants_expires_at_idx").on(table.expiresAt)
  ]
);

export const dpopProofReplay = pgTable(
  "dpop_proof_replays",
  {
    jti: text("jti").primaryKey(),
    grantId: text("grant_id")
      .notNull()
      .references(() => dpopAccessGrant.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [index("dpop_proof_replays_expires_at_idx").on(table.expiresAt)]
);

export const account = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    index("accounts_user_id_idx").on(table.userId),
    uniqueIndex("accounts_provider_account_idx").on(table.providerId, table.accountId)
  ]
);

export const verification = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    uniqueIndex("verifications_identifier_idx").on(table.identifier)
  ]
);

export const twoFactor = pgTable(
  "two_factors",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verified: boolean("verified").default(false).notNull(),
    failedVerificationCount: integer("failed_verification_count")
      .default(0)
      .notNull(),
    lockedUntil: timestamp("locked_until", { withTimezone: true })
  },
  (table) => [
    index("two_factors_secret_idx").on(table.secret),
    index("two_factors_user_id_idx").on(table.userId)
  ]
);

export const passkey = pgTable(
  "passkeys",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    credentialID: text("credential_id").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: boolean("backed_up").notNull(),
    transports: text("transports"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    aaguid: text("aaguid")
  },
  (table) => [
    uniqueIndex("passkeys_credential_id_idx").on(table.credentialID),
    index("passkeys_user_id_idx").on(table.userId)
  ]
);

export const passkeyKind = pgTable(
  "passkey_kinds",
  {
    credentialID: text("credential_id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"passkey" | "security-key">().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [index("passkey_kinds_user_id_idx").on(table.userId)]
);

export const webauthnChallenge = pgTable(
  "webauthn_challenges",
  {
    id: text("id").primaryKey(),
    challenge: text("challenge").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    purpose: text("purpose").$type<"security-key-step-up">().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index("webauthn_challenges_user_id_idx").on(table.userId),
    index("webauthn_challenges_expires_at_idx").on(table.expiresAt)
  ]
);

export const oidcAuthorizationCode = pgTable(
  "oidc_authorization_codes",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull(),
    redirectUri: text("redirect_uri").notNull(),
    subject: text("subject").notNull(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    nonce: text("nonce").notNull(),
    codeChallenge: text("code_challenge").notNull(),
    scope: text("scope").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index("oidc_authorization_codes_expires_at_idx").on(table.expiresAt),
    index("oidc_authorization_codes_subject_idx").on(table.subject)
  ]
);

export const oauthDeviceAuthorization = pgTable(
  "oauth_device_authorizations",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull(),
    userCode: text("user_code").notNull(),
    scope: text("scope").notNull(),
    status: text("status")
      .$type<"pending" | "approved" | "denied" | "consumed">()
      .default("pending")
      .notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    intervalSeconds: integer("interval_seconds").default(3).notNull(),
    pollCount: integer("poll_count").default(0).notNull(),
    lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("oauth_device_authorizations_user_code_idx").on(table.userCode),
    index("oauth_device_authorizations_expires_at_idx").on(table.expiresAt),
    index("oauth_device_authorizations_user_id_idx").on(table.userId)
  ]
);

export const deviceAccessGrant = pgTable(
  "device_access_grants",
  {
    id: text("id").primaryKey(),
    authorizationId: text("authorization_id")
      .notNull()
      .references(() => oauthDeviceAuthorization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tokenDigest: text("token_digest").notNull(),
    scope: text("scope").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("device_access_grants_token_digest_idx").on(table.tokenDigest),
    uniqueIndex("device_access_grants_authorization_idx").on(table.authorizationId),
    index("device_access_grants_expires_at_idx").on(table.expiresAt)
  ]
);

type EnterpriseProtocol = "oidc" | "saml";

export const enterpriseTenant = pgTable(
  "enterprise_tenants",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    domain: text("domain").notNull(),
    protocol: text("protocol").$type<EnterpriseProtocol>().notNull(),
    issuer: text("issuer").notNull(),
    ssoRequired: boolean("sso_required").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("enterprise_tenants_slug_idx").on(table.slug),
    uniqueIndex("enterprise_tenants_domain_idx").on(table.domain)
  ]
);

export const enterpriseMembership = pgTable(
  "enterprise_memberships",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => enterpriseTenant.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    externalSubject: text("external_subject").notNull(),
    role: text("role").$type<"member" | "admin">().default("member").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("enterprise_memberships_tenant_user_idx").on(
      table.tenantId,
      table.userId
    ),
    uniqueIndex("enterprise_memberships_tenant_subject_idx").on(
      table.tenantId,
      table.externalSubject
    )
  ]
);

type EnterprisePublicJwk = {
  kty: "EC";
  crv: "P-256";
  x: string;
  y: string;
};

export const highAssuranceClient = pgTable(
  "high_assurance_clients",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    publicJwk: jsonb("public_jwk").$type<EnterprisePublicJwk>().notNull(),
    activeCertificateThumbprint: text("active_certificate_thumbprint").notNull(),
    previousCertificateThumbprint: text("previous_certificate_thumbprint"),
    certificateStatus: text("certificate_status")
      .$type<"active" | "revoked">()
      .default("active")
      .notNull(),
    overlapEndsAt: timestamp("overlap_ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  }
);

export const clientAssertionReplay = pgTable(
  "client_assertion_replays",
  {
    jti: text("jti").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => highAssuranceClient.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [index("client_assertion_replays_expires_at_idx").on(table.expiresAt)]
);

export const highAssuranceAccessGrant = pgTable(
  "high_assurance_access_grants",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => highAssuranceClient.id, { onDelete: "cascade" }),
    tokenDigest: text("token_digest").notNull(),
    certificateThumbprint: text("certificate_thumbprint").notNull(),
    scope: text("scope").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("high_assurance_access_grants_digest_idx").on(table.tokenDigest),
    index("high_assurance_access_grants_client_idx").on(table.clientId),
    index("high_assurance_access_grants_expires_at_idx").on(table.expiresAt)
  ]
);

export const authSchema = {
  users: user,
  sessions: session,
  accounts: account,
  verifications: verification,
  twoFactors: twoFactor,
  passkeys: passkey
};
