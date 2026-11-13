import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";

const baseUrl = process.env.BASE_URL ?? "http://localhost:3101/api";
const databaseUrl = process.env.DATABASE_URL;
const adminIdentifier = process.env.TEST_ADMIN_IDENTIFIER;
const adminPassword = process.env.TEST_ADMIN_PASSWORD;
const db = databaseUrl ? new URL(databaseUrl) : null;

if (!db || db.pathname.replace(/^\//, "") !== "dona_test_r3" || db.port !== "5433") {
  throw new Error("Testes de auth recusados: DATABASE_URL precisa apontar para dona_test_r3 na porta 5433.");
}
if (!adminIdentifier || !adminPassword || Buffer.byteLength(adminPassword, "utf8") < 12) {
  throw new Error("Defina TEST_ADMIN_IDENTIFIER e TEST_ADMIN_PASSWORD via ambiente (mínimo 12 bytes).");
}
if (new URL(baseUrl).hostname !== "localhost" || new URL(baseUrl).port !== "3101") {
  throw new Error("Testes de auth recusados: BASE_URL precisa apontar para localhost:3101.");
}

function client() { return { cookie: "", csrf: "" }; }

async function request(session, method, path, body, { csrf = true } = {}) {
  const headers = {};
  if (session.cookie) headers.cookie = session.cookie;
  if (body !== undefined) headers["content-type"] = "application/json";
  if (csrf && session.csrf && !["GET", "HEAD"].includes(method)) headers["x-csrf-token"] = session.csrf;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) session.cookie = setCookie.split(";", 1)[0];
  const payload = await response.json();
  return { status: response.status, payload, setCookie };
}

test("auth, autorização, CSRF, lockout session invalidation and actor attribution", async () => {
  const suffix = randomBytes(5).toString("hex");
  const anonymous = client();
  const protectedRoutes = [
    ["GET", "/categorias"], ["POST", "/categorias"],
    ["GET", "/categorias/1"], ["PUT", "/categorias/1"], ["PATCH", "/categorias/1"], ["DELETE", "/categorias/1"],
    ["GET", "/produtos"], ["POST", "/produtos"], ["GET", "/produtos/1"], ["PUT", "/produtos/1"], ["PATCH", "/produtos/1"], ["DELETE", "/produtos/1"],
    ["GET", "/produtos/estoque-baixo"], ["GET", "/estoque/movimentacoes"], ["POST", "/estoque/movimentacoes"],
    ["GET", "/estoque/ajustes"], ["POST", "/estoque/ajustes"], ["GET", "/usuarios"], ["POST", "/usuarios"], ["PATCH", "/usuarios/1"],
    ["GET", "/auth/session"], ["POST", "/auth/session"], ["POST", "/auth/password"],
  ];
  for (const [method, path] of protectedRoutes) {
    assert.equal((await request(anonymous, method, path, method === "GET" || method === "DELETE" ? undefined : {})).status, 401, `${method} ${path} must require auth`);
  }
  assert.equal((await request(client(), "POST", "/auth/login", { identifier: adminIdentifier, password: "not-the-admin-password" })).status, 401);
  const unknownIdentity = `missing-${suffix}@example.test`;
  for (let attempt = 0; attempt < 10; attempt++) {
    assert.equal((await request(client(), "POST", "/auth/login", { identifier: unknownIdentity, password: "wrong-password" }, { csrf: false })).status, 401);
  }
  assert.equal((await request(client(), "POST", "/auth/login", { identifier: unknownIdentity, password: "wrong-password" }, { csrf: false })).status, 429);

  const admin = client();
  const login = await request(admin, "POST", "/auth/login", { identifier: adminIdentifier, password: adminPassword }, { csrf: false });
  assert.equal(login.status, 200);
  assert.equal(login.payload.data.user.perfil, "ADMINISTRADOR");
  assert.match(login.setCookie ?? "", /HttpOnly/i);
  assert.match(login.setCookie ?? "", /SameSite=Lax/i);
  if (process.env.EXPECT_SECURE_COOKIE === "1") assert.match(login.setCookie ?? "", /Secure/i);
  assert.ok(login.payload.data.csrfToken);
  admin.csrf = login.payload.data.csrfToken;

  const restored = client();
  restored.cookie = admin.cookie;
  const session = await request(restored, "GET", "/auth/session");
  assert.equal(session.status, 200);
  restored.csrf = session.payload.data.csrfToken;
  assert.equal((await request(admin, "POST", "/categorias", { nome: `sem-csrf-${Date.now()}` }, { csrf: false })).status, 403);
  const categoryName = `Auth Case ${suffix}`;
  assert.equal((await request(admin, "POST", "/categorias", { nome: categoryName })).status, 201);
  assert.equal((await request(admin, "POST", "/categorias", { nome: categoryName.toLowerCase() })).status, 409);

  const sellerPassword = randomBytes(24).toString("base64url");
  const createSeller = await request(admin, "POST", "/usuarios", {
    nome: "Usuário de teste",
    nomeUsuario: `seller_${suffix}`,
    email: `seller-${suffix}@example.test`,
    senha: sellerPassword,
    perfil: "VENDEDOR",
  });
  assert.equal(createSeller.status, 201);
  assert.equal("senhaHash" in createSeller.payload.data, false);
  const sellerId = createSeller.payload.data.id;

  const seller = client();
  const sellerLogin = await request(seller, "POST", "/auth/login", {
    identifier: `seller_${suffix}`,
    password: sellerPassword,
  }, { csrf: false });
  assert.equal(sellerLogin.status, 200);
  seller.csrf = sellerLogin.payload.data.csrfToken;
  const products = await request(seller, "GET", "/produtos");
  assert.equal(products.status, 200);
  assert.equal(products.payload.data.some((product) => "precoCusto" in product), false);
  assert.equal((await request(seller, "POST", "/categorias", { nome: `seller-${suffix}` })).status, 403);
  assert.equal((await request(seller, "POST", "/estoque/movimentacoes", { produtoId: 1, tipoMovimento: "ENTRADA", quantidade: 1 })).status, 403);

  const stockedProduct = products.payload.data.find((product) => product.ativo && Number(product.quantidadeEstoque) > 0);
  if (stockedProduct) {
    const movement = await request(seller, "POST", "/estoque/movimentacoes", {
      produtoId: stockedProduct.id,
      tipoMovimento: "SAIDA",
      quantidade: 1,
    });
    assert.equal(movement.status, 201);
    assert.equal(movement.payload.data.movimentacao.operadorId, sellerId);
  }

  assert.equal((await request(admin, "PATCH", `/usuarios/${sellerId}`, { perfil: "ESTOQUISTA" })).status, 200);
  assert.equal((await request(seller, "GET", "/auth/session")).status, 401);
  const stockist = client();
  const stockistLogin = await request(stockist, "POST", "/auth/login", {
    identifier: `seller_${suffix}`,
    password: sellerPassword,
  }, { csrf: false });
  assert.equal(stockistLogin.status, 200);
  stockist.csrf = stockistLogin.payload.data.csrfToken;
  assert.equal((await request(stockist, "GET", "/estoque/ajustes")).status, 200);

  assert.equal((await request(admin, "PATCH", `/usuarios/${sellerId}`, { ativo: false })).status, 200);
  assert.equal((await request(stockist, "GET", "/auth/session")).status, 401);

  const newPassword = randomBytes(24).toString("base64url");
  const changed = await request(admin, "POST", "/auth/password", { currentPassword: adminPassword, newPassword });
  assert.equal(changed.status, 200);
  assert.equal((await request(admin, "GET", "/auth/session")).status, 401);
  const relogin = client();
  const reloginResponse = await request(relogin, "POST", "/auth/login", { identifier: adminIdentifier, password: newPassword }, { csrf: false });
  assert.equal(reloginResponse.status, 200);
  relogin.csrf = reloginResponse.payload.data.csrfToken;
  assert.equal((await request(relogin, "POST", "/auth/session")).status, 200);
  assert.equal((await request(relogin, "GET", "/auth/session")).status, 401);
});
