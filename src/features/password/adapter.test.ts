import { describe, expect, it } from "vitest";

import {
  passwordJourneys,
  passwordMethodAdapter,
  passwordOperations
} from "@/features/password/adapter";
import {
  getMethodAdapter,
  interactiveMethodAdapters
} from "@/features/method-registry";
import { authenticationMethods } from "@/lib/catalog";

describe("password method adapter", () => {
  it("supplies complete metadata and exactly the five product panels", () => {
    expect(passwordMethodAdapter.metadata.slug).toBe("password");
    expect(passwordMethodAdapter.panels.map((panel) => panel.id)).toEqual([
      "user-experience",
      "flow",
      "network-inspector",
      "explanation",
      "comparison"
    ]);
  });

  it("owns every password journey and recorder operation", () => {
    expect(passwordMethodAdapter.recorder.journeys).toEqual(passwordJourneys);
    expect(Object.keys(passwordMethodAdapter.recorder.operations)).toEqual(
      passwordOperations
    );
    expect(
      Object.values(passwordMethodAdapter.recorder.operations).every(
        (operation) =>
          operation.endpoint.startsWith("/") &&
          operation.success &&
          operation.failure
      )
    ).toBe(true);
  });

  it("is discoverable through the method registry used by shared code", () => {
    expect(interactiveMethodAdapters).toContain(passwordMethodAdapter);
    expect(getMethodAdapter("password")).toBe(passwordMethodAdapter);
    expect(getMethodAdapter("unknown")).toBeUndefined();
    expect(
      authenticationMethods.find(({ slug }) => slug === "password")
    ).toBe(passwordMethodAdapter.metadata);
  });
});
