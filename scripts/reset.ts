import { sqlClient } from "../src/db";

await sqlClient.unsafe(`
  TRUNCATE TABLE
    authentication_events,
    authentication_flows,
    sessions,
    accounts,
    verifications,
    users
  RESTART IDENTITY CASCADE
`);

console.info("Auth Lab database records were removed. The schema is unchanged.");
await sqlClient.end();
