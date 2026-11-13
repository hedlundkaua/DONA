import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("TEST_DATABASE_URL is required.");
const db = new URL(databaseUrl);
if (db.hostname !== "localhost" || db.port !== "5433" || db.pathname.replace(/^\//, "") !== "dona_test_r3") {
  throw new Error("Refusing to seed or test: TEST_DATABASE_URL must target localhost:5433/dona_test_r3.");
}

const adminName = "R3 Smoke Administrator";
const adminUsername = "r3_smoke_admin";
const adminEmail = `${adminUsername}@example.test`;
const adminPassword = randomBytes(24).toString("base64url");
const sessionSecret = randomBytes(48).toString("base64url");
const baseUrl = "http://localhost:3101/api";
function runNode(args, env) {
  const result = spawnSync(process.execPath, args, { env, encoding: "utf8" });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`node ${args.join(" ")} failed (exit ${result.status ?? result.error?.message}).`);
}

const seedEnv = {
  ...process.env,
  NODE_ENV: "development",
  DATABASE_URL: databaseUrl,
  DEV_ADMIN_NAME: adminName,
  DEV_ADMIN_USERNAME: adminUsername,
  DEV_ADMIN_EMAIL: adminEmail,
  DEV_ADMIN_PASSWORD: adminPassword,
};
runNode(["node_modules/prisma/build/index.js", "db", "seed"], seedEnv);

const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3101"], {
  cwd: process.cwd(),
  env: { ...process.env, NODE_ENV: "production", DATABASE_URL: databaseUrl, SESSION_SECRET: sessionSecret, NEXT_TELEMETRY_DISABLED: "1" },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput += chunk.toString(); });
server.stderr.on("data", (chunk) => { serverOutput += chunk.toString(); });

try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(`${baseUrl}/auth/session`, { signal: AbortSignal.timeout(1000) });
      if (response.status === 401) { ready = true; break; }
    } catch { /* wait for the local dedicated test server */ }
    if (server.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error(`Test server failed to become ready. ${serverOutput.slice(-4000)}`);

  runNode(["--test", "tests/auth.integration.test.mjs"], {
    ...seedEnv,
    NODE_ENV: "test",
    TEST_DATABASE_URL: databaseUrl,
    TEST_ADMIN_IDENTIFIER: adminUsername,
    TEST_ADMIN_PASSWORD: adminPassword,
    BASE_URL: baseUrl,
    EXPECT_SECURE_COOKIE: "1",
  });
  console.log("Auth integration smoke test completed against dona_test_r3.");
} finally {
  if (server.exitCode === null) {
    server.kill("SIGTERM");
    await Promise.race([
      new Promise((resolve) => server.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
    if (server.exitCode === null) server.kill("SIGKILL");
  }
}
