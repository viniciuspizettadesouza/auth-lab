import { randomUUID } from "node:crypto";

import type { NextResponse } from "next/server";

export const VISITOR_COOKIE = "auth_lab_visitor";

export function readCookieValue(
  cookieHeader: string | null | undefined,
  name: string
): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

export function getVisitorIdFromHeaders(headers: Headers): string | null {
  return readCookieValue(headers.get("cookie"), VISITOR_COOKIE);
}

export function createVisitorId(): string {
  return randomUUID();
}

export function setVisitorCookie(
  response: NextResponse,
  visitorId: string
): void {
  response.cookies.set(VISITOR_COOKIE, visitorId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });
}
