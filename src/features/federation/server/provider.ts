import "server-only";

import { and, eq, gt, isNull } from "drizzle-orm";

import { db } from "@/db";
import { oidcAuthorizationCode } from "@/db/schema";
import { federationConfig } from "@/features/federation/server/config";
import {
  randomOpaque,
  sha256,
  signIdToken,
  verifyIdToken
} from "@/features/federation/server/protocol";

export async function issueAuthorizationCode(input: {
  clientId: string;
  codeChallenge: string;
  email: string;
  name: string;
  nonce: string;
  redirectUri: string;
  scope: string;
  subject: string;
}) {
  const rawCode = randomOpaque();
  await db.insert(oidcAuthorizationCode).values({
    id: sha256(rawCode),
    clientId: input.clientId,
    redirectUri: input.redirectUri,
    subject: input.subject,
    email: input.email,
    name: input.name,
    nonce: input.nonce,
    codeChallenge: input.codeChallenge,
    scope: input.scope,
    expiresAt: new Date(Date.now() + 60_000)
  });
  return rawCode;
}

export async function exchangeAuthorizationCode(input: {
  clientId: string;
  clientSecret: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
}) {
  const config = federationConfig();
  if (
    input.clientId !== config.clientId ||
    input.clientSecret !== config.clientSecret
  ) {
    throw new Error("invalid_client");
  }

  const [authorization] = await db
    .update(oidcAuthorizationCode)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(oidcAuthorizationCode.id, sha256(input.code)),
        eq(oidcAuthorizationCode.clientId, input.clientId),
        eq(oidcAuthorizationCode.redirectUri, input.redirectUri),
        isNull(oidcAuthorizationCode.consumedAt),
        gt(oidcAuthorizationCode.expiresAt, new Date())
      )
    )
    .returning();
  if (!authorization) throw new Error("invalid_grant");
  if (sha256(input.codeVerifier) !== authorization.codeChallenge) {
    throw new Error("invalid_grant");
  }

  const now = Math.floor(Date.now() / 1000);
  const idToken = signIdToken(
    {
      iss: config.issuer,
      aud: config.clientId,
      sub: authorization.subject,
      email: authorization.email,
      name: authorization.name,
      nonce: authorization.nonce,
      email_verified: true,
      iat: now,
      exp: now + 300
    },
    config.signingSecret
  );
  const verified = verifyIdToken(idToken, {
    audience: config.clientId,
    issuer: config.issuer,
    nonceSecret: config.nonceSecret,
    signingSecret: config.signingSecret
  });
  if (!verified) throw new Error("invalid_id_token");

  return {
    accessToken: randomOpaque(),
    accessTokenExpiresAt: new Date(Date.now() + 300_000),
    idToken,
    scopes: authorization.scope.split(" ")
  };
}
