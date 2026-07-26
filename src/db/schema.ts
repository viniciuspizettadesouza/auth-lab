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
    image: text("image"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
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
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    index("accounts_user_id_idx").on(table.userId),
    uniqueIndex("accounts_provider_account_idx").on(
      table.providerId,
      table.accountId
    )
  ]
);

export const verification = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)]
);

export type FlowJourney =
  | "sign-up"
  | "sign-in"
  | "password-reset"
  | "session";
export type FlowStatus = "active" | "completed" | "failed";
export type EventActor =
  | "user"
  | "browser"
  | "application"
  | "database"
  | "email";
export type EventOutcome = "pending" | "success" | "failure" | "info";

export const authenticationFlow = pgTable(
  "authentication_flows",
  {
    id: text("id").primaryKey(),
    method: text("method").$type<"password">().default("password").notNull(),
    journey: text("journey").$type<FlowJourney>().notNull(),
    status: text("status").$type<FlowStatus>().default("active").notNull(),
    visitorId: text("visitor_id").notNull(),
    userId: text("user_id").references(() => user.id, {
      onDelete: "set null"
    }),
    nextSequence: integer("next_sequence").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    index("flows_visitor_id_idx").on(table.visitorId),
    index("flows_user_id_idx").on(table.userId),
    index("flows_created_at_idx").on(table.createdAt)
  ]
);

export type SafeEventMetadata = {
  endpoint?: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
  fields?: string[];
  entityId?: string;
  email?: string;
  cookieFlags?: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "lax" | "strict" | "none";
  };
};

export const authenticationEvent = pgTable(
  "authentication_events",
  {
    id: text("id").primaryKey(),
    flowId: text("flow_id")
      .notNull()
      .references(() => authenticationFlow.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    actor: text("actor").$type<EventActor>().notNull(),
    action: text("action").notNull(),
    description: text("description").notNull(),
    outcome: text("outcome").$type<EventOutcome>().notNull(),
    safeMetadata: jsonb("safe_metadata")
      .$type<SafeEventMetadata>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("events_flow_sequence_idx").on(table.flowId, table.sequence),
    index("events_flow_id_idx").on(table.flowId)
  ]
);

export const schema = {
  user,
  session,
  account,
  verification,
  authenticationFlow,
  authenticationEvent
};

export type AuthenticationFlow = typeof authenticationFlow.$inferSelect;
export type AuthenticationEvent = typeof authenticationEvent.$inferSelect;
