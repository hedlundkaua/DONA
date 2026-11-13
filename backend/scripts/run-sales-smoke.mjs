import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("Set TEST_DATABASE_URL for the isolated sales smoke test.");
const db = new URL(databaseUrl);
if (db.hostname !== "localhost" || db.port !== "5433" || db.pathname.replace(/^\//, "") !== "dona_test_r4") {
  throw new Error("Refusing to seed or test: target must be localhost:5433/dona_test_r4.");
}
const username = "r4_sales_admin";
const email = `${username}@example.test`;
const password = randomBytes(24).toString("base64url");
const secret = randomBytes(48).toString("base64url");
const api = "http://localhost:3102/api";
function run(args, env) {
  const result = spawnSync(process.execPath, args, { env, encoding: "utf8" });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`command failed (exit ${result.status ?? result.error?.message}).`);
}
const devEnv = { ...process.env, NODE_ENV: "development", DATABASE_URL: databaseUrl,
  DEV_ADMIN_NAME: "R4 Sales Smoke Admin", DEV_ADMIN_USERNAME: username, DEV_ADMIN_EMAIL: email, DEV_ADMIN_PASSWORD: password };
run(["node_modules/prisma/build/index.js", "db", "seed"], devEnv);
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3102"], {
  cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", DATABASE_URL: databaseUrl,
    SESSION_SECRET: secret, NEXT_TELEMETRY_DISABLED: "1" }, stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
server.stdout.on("data", (chunk) => { output += chunk.toString(); });
server.stderr.on("data", (chunk) => { output += chunk.toString(); });
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(`${api}/auth/session`, { signal: AbortSignal.timeout(1000) });
      if (response.status === 401) { ready = true; break; }
    } catch { /* local test server starting */ }
    if (server.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error(`Dedicated test server not ready. ${output.slice(-3000)}`);
  run(["--test", "tests/sales.integration.test.mjs"], { ...devEnv, NODE_ENV: "test",
    TEST_DATABASE_URL: databaseUrl, TEST_ADMIN_IDENTIFIER: username, TEST_ADMIN_PASSWORD: password, BASE_URL: api });
  console.log("Sales/customer smoke passed against the isolated dona_test_r4 database.");
} finally {
  if (server.exitCode === null) {
    server.kill("SIGTERM");
    await Promise.race([new Promise((resolve) => server.once("exit", resolve)), new Promise((resolve) => setTimeout(resolve, 3000))]);
    if (server.exitCode === null) server.kill("SIGKILL");
  }
}
