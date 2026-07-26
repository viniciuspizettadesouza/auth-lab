export type FlowStatus = "active" | "completed" | "failed";

export type FlowSummary<TJourney extends string = string> = {
  id: string;
  method: string;
  journey: TJourney;
  status: FlowStatus;
  createdAt: string;
  updatedAt: string;
  eventCount: number;
};
