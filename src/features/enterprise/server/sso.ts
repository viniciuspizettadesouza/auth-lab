import "server-only";

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { enterpriseMembership, enterpriseTenant } from "@/db/schema";

const tenants = [
  {
    id: "tenant-northstar",
    slug: "northstar",
    name: "Northstar Engineering",
    domain: "northstar.auth-lab.local",
    protocol: "oidc" as const,
    issuer: "https://id.northstar.auth-lab.local"
  },
  {
    id: "tenant-legacy",
    slug: "legacy-industries",
    name: "Legacy Industries",
    domain: "legacy.auth-lab.local",
    protocol: "saml" as const,
    issuer: "https://sso.legacy.auth-lab.local/metadata"
  }
];

export type EnterpriseScenario =
  | "valid"
  | "wrong-issuer"
  | "wrong-tenant"
  | "expired"
  | "unsigned"
  | "unmanaged-group";

async function ensureTenants() {
  await db
    .insert(enterpriseTenant)
    .values(tenants)
    .onConflictDoNothing();
}

export async function discoverEnterpriseTenant(email: string) {
  await ensureTenants();
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  const [tenant] = await db
    .select()
    .from(enterpriseTenant)
    .where(eq(enterpriseTenant.domain, domain))
    .limit(1);
  return tenant ?? null;
}

export async function evaluateEnterpriseSso(input: {
  scenario: EnterpriseScenario;
  tenantSlug: string;
  userId?: string | null;
}) {
  await ensureTenants();
  const [tenant] = await db
    .select()
    .from(enterpriseTenant)
    .where(eq(enterpriseTenant.slug, input.tenantSlug))
    .limit(1);
  if (!tenant) return { ok: false as const, reason: "unknown-tenant" as const };

  const checks = [
    "domain resolves to exactly one tenant",
    `${tenant.protocol.toUpperCase()} response is correlated to the request`,
    "issuer matches tenant-owned metadata",
    "audience and destination match this application",
    "signature and time window are valid",
    "external subject is tenant-scoped",
    "directory group maps to an allowed role",
    "SSO enforcement retains controlled recovery"
  ];
  const reasons: Partial<Record<EnterpriseScenario, string>> = {
    "wrong-issuer": "Issuer belongs to a different enterprise tenant.",
    "wrong-tenant": "The subject was presented under the wrong tenant boundary.",
    expired: "The enterprise response is outside its validity window.",
    unsigned: "The enterprise response lacks a trusted signature.",
    "unmanaged-group": "Directory groups do not map to an allowed application role."
  };
  if (input.scenario !== "valid") {
    return {
      ok: false as const,
      protocol: tenant.protocol,
      reason: reasons[input.scenario] ?? "Enterprise policy rejected the response.",
      checks: checks.slice(0, Math.max(2, checks.length - 2))
    };
  }
  if (!input.userId) {
    return {
      ok: false as const,
      protocol: tenant.protocol,
      reason: "Authenticate through the enterprise provider before membership mapping.",
      checks: checks.slice(0, 5)
    };
  }

  await db
    .insert(enterpriseMembership)
    .values({
      id: randomUUID(),
      tenantId: tenant.id,
      userId: input.userId,
      externalSubject: `${tenant.slug}:${input.userId}`,
      role: "member"
    })
    .onConflictDoUpdate({
      target: [enterpriseMembership.tenantId, enterpriseMembership.userId],
      set: { externalSubject: `${tenant.slug}:${input.userId}`, role: "member" }
    });
  return {
    ok: true as const,
    checks,
    membership: { role: "member", tenant: tenant.name },
    protocol: tenant.protocol,
    ssoRequired: tenant.ssoRequired
  };
}
