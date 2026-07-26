import { auth } from "../src/lib/auth";
import { sqlClient } from "../src/db";

const email = "demo@auth-lab.local";

try {
  const result = await auth.api.signUpEmail({
    body: {
      name: "Auth Lab Demo",
      email,
      password: "correct horse battery staple",
      callbackURL: `${
        process.env.BETTER_AUTH_URL ?? "http://localhost:3000"
      }/methods/password`
    }
  });
  console.info(`Created ${result.user.email}. Verify it through Mailpit before signing in.`);
} catch {
  console.info(`${email} already exists; no seed changes were required.`);
} finally {
  await sqlClient.end();
}
