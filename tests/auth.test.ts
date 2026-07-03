import test from "node:test";
import assert from "node:assert/strict";
import { signupUser, loginUser } from "../app/auth/auth";

test("signup and login create a JWT-backed session for a new user", async () => {
  const email = `auth-${Date.now()}@example.com`;

  const signup = await signupUser({
    name: "Test User",
    email,
    password: "password123",
  });

  assert.ok(signup.token);
  assert.equal(signup.user.email, email);

  const login = await loginUser({
    email,
    password: "password123",
  });

  assert.ok(login.token);
  assert.equal(login.user.email, email);
});
