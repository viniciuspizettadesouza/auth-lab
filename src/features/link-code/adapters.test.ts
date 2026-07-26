import { describe, expect, it } from "vitest";

import {
  emailOtpAdapter,
  magicLinkAdapter,
  milestone3Adapters,
  smsOtpAdapter,
  totpAdapter
} from "@/features/link-code/adapters";
import { getMethodAdapter } from "@/features/method-registry";
import { authenticationMethods } from "@/lib/catalog";
import {
  EMAIL_OTP_ALLOWED_ATTEMPTS,
  EMAIL_OTP_EXPIRES_IN_SECONDS,
  MAGIC_LINK_EXPIRES_IN_SECONDS,
  SMS_SIMULATION_ALLOWED_ATTEMPTS,
  SMS_SIMULATION_EXPIRES_IN_SECONDS,
  TOTP_ACCOUNT_FAILURE_LIMIT,
  TOTP_LOCK_SECONDS
} from "@/features/link-code/config";

describe("milestone 3 method adapters", () => {
  it("registers each method once with all five panels", () => {
    expect(milestone3Adapters).toHaveLength(4);
    for (const adapter of milestone3Adapters) {
      expect(getMethodAdapter(adapter.metadata.slug)).toBe(adapter);
      expect(adapter.panels.map(({ id }) => id)).toEqual([
        "user-experience",
        "flow",
        "network-inspector",
        "explanation",
        "comparison"
      ]);
      expect(
        authenticationMethods.filter(
          ({ slug }) => slug === adapter.metadata.slug
        )
      ).toEqual([adapter.metadata]);
    }
  });

  it("keeps real and simulated delivery visibly distinct", () => {
    expect(magicLinkAdapter.metadata.status).toBe("interactive");
    expect(emailOtpAdapter.metadata.status).toBe("interactive");
    expect(totpAdapter.metadata.status).toBe("interactive");
    expect(smsOtpAdapter.metadata.status).toBe("simulation");
    expect(smsOtpAdapter.metadata.name).toMatch(/simulation/i);
  });

  it("declares bounded replay and recovery operations", () => {
    expect(
      emailOtpAdapter.recorder.operations["email-otp-verify"].completesFlow
    ).toBe(true);
    expect(
      totpAdapter.recorder.operations["backup-code-verify"].completesFlow
    ).toBe(true);
    expect(
      smsOtpAdapter.recorder.operations["sms-otp-verify"].completesFlow
    ).toBe(true);
  });

  it("keeps every proof short-lived and attempt-bounded", () => {
    expect(MAGIC_LINK_EXPIRES_IN_SECONDS).toBe(300);
    expect(EMAIL_OTP_EXPIRES_IN_SECONDS).toBe(300);
    expect(EMAIL_OTP_ALLOWED_ATTEMPTS).toBe(3);
    expect(SMS_SIMULATION_EXPIRES_IN_SECONDS).toBe(120);
    expect(SMS_SIMULATION_ALLOWED_ATTEMPTS).toBe(3);
    expect(TOTP_ACCOUNT_FAILURE_LIMIT).toBe(5);
    expect(TOTP_LOCK_SECONDS).toBe(300);
  });
});
