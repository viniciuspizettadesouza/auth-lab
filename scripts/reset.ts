import { sqlClient } from "../src/db";

await sqlClient.unsafe(`
  TRUNCATE TABLE
    authentication_events,
    authentication_flows,
    webauthn_challenges,
    passkey_kinds,
    passkeys,
    two_factors,
    sessions,
    accounts,
    verifications,
    users
  RESTART IDENTITY CASCADE
`);

console.info("Auth Lab database records were removed. The schema is unchanged.");
await sqlClient.end();
