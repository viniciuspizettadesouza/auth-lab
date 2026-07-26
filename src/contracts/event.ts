export type EventActor =
  | "user"
  | "browser"
  | "application"
  | "database"
  | "email";

export type EventOutcome = "pending" | "success" | "failure" | "info";

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

export type LabEvent = {
  id: string;
  sequence: number;
  actor: EventActor;
  action: string;
  description: string;
  outcome: EventOutcome;
  safeMetadata: SafeEventMetadata;
  createdAt: string;
};
