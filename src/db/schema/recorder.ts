import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex
} from "drizzle-orm/pg-core";

import type {
  EventActor,
  EventOutcome,
  FlowStatus,
  SafeEventMetadata
} from "@/contracts";
import { user } from "@/db/schema/auth";

export const authenticationFlow = pgTable(
  "authentication_flows",
  {
    id: text("id").primaryKey(),
    method: text("method").default("password").notNull(),
    journey: text("journey").notNull(),
    status: text("status").$type<FlowStatus>().default("active").notNull(),
    visitorId: text("visitor_id").notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    nextSequence: integer("next_sequence").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("events_flow_sequence_idx").on(table.flowId, table.sequence),
    index("events_flow_id_idx").on(table.flowId)
  ]
);

export type AuthenticationFlow = typeof authenticationFlow.$inferSelect;
export type AuthenticationEvent = typeof authenticationEvent.$inferSelect;
