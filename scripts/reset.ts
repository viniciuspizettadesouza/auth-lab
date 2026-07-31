import { sqlClient } from "../src/db";

await sqlClient.unsafe(`
  TRUNCATE TABLE
    authentication_events,
    authentication_flows,
    portable_presentation_replays,
    portable_presentation_requests,
    portable_credentials,
    workload_proof_replays,
    workload_assertion_replays,
    workload_access_grants,
    workload_client_secrets,
    workload_audit_events,
    workload_api_keys,
    workload_principals,
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
