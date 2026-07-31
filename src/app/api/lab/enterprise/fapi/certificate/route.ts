import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  authenticateCertificateManagement,
  revokeCertificate,
  rotateCertificate
} from "@/features/enterprise/server/fapi";

const schema = z.object({
  certificateThumbprint: z.string().min(20).max(100),
  clientAssertion: z.string().min(20).max(4_000),
  clientId: z.string().min(1).max(100)
});

async function authenticate(request: NextRequest, data: z.infer<typeof schema>) {
  return authenticateCertificateManagement({
    assertion: data.clientAssertion,
    audience: `${request.nextUrl.origin}${request.nextUrl.pathname}`,
    certificateThumbprint: data.certificateThumbprint,
    clientId: data.clientId
  });
}

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid client." }, { status: 400 });
  }
  const authenticated = await authenticate(request, parsed.data);
  if (!authenticated.ok) {
    return NextResponse.json({ error: authenticated.reason }, { status: 401 });
  }
  const result = await rotateCertificate(parsed.data.clientId);
  if (!result) {
    return NextResponse.json({ error: "Active client not found." }, { status: 404 });
  }
  return NextResponse.json(result);
}

export async function DELETE(request: NextRequest) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid client." }, { status: 400 });
  }
  const authenticated = await authenticate(request, parsed.data);
  if (!authenticated.ok) {
    return NextResponse.json({ error: authenticated.reason }, { status: 401 });
  }
  const revoked = await revokeCertificate(parsed.data.clientId);
  return revoked
    ? new NextResponse(null, { status: 204 })
    : NextResponse.json({ error: "Client not found." }, { status: 404 });
}
