import { sqlClient } from "../src/db";

await sqlClient.unsafe(`
  TRUNCATE TABLE
    authentication_events,
    authentication_flows,
    client_assertion_replays,
    high_assurance_access_grants,
    high_assurance_clients,
    enterprise_memberships,
    enterprise_tenants,
    device_access_grants,
    oauth_device_authorizations,
    dpop_proof_replays,
    dpop_access_grants,
    session_assurances,
    oidc_authorization_codes,
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
