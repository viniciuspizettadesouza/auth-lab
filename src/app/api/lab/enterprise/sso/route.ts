import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  discoverEnterpriseTenant,
  evaluateEnterpriseSso
} from "@/features/enterprise/server/sso";
import { auth } from "@/lib/auth";

const bodySchema = z.object({
  scenario: z.enum([
    "valid",
    "wrong-issuer",
    "wrong-tenant",
    "expired",
    "unsigned",
    "unmanaged-group"
  ]),
  tenantSlug: z.string().min(1).max(80)
});

export async function GET(request: NextRequest) {
  const tenant = await discoverEnterpriseTenant(
    request.nextUrl.searchParams.get("email") ?? ""
  );
  if (!tenant) {
    return NextResponse.json({ error: "No enterprise tenant owns this domain." }, { status: 404 });
  }
  return NextResponse.json({
    domain: tenant.domain,
    name: tenant.name,
    protocol: tenant.protocol,
    ssoRequired: tenant.ssoRequired,
    slug: tenant.slug
  });
}

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid enterprise scenario." }, { status: 400 });
  }
  const current = await auth.api.getSession({ headers: request.headers });
  const result = await evaluateEnterpriseSso({
    ...parsed.data,
    userId: current?.user.id
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
