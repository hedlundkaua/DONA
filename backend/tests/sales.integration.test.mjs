import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";

const base = process.env.BASE_URL ?? "http://localhost:3102/api";
const db = new URL(process.env.TEST_DATABASE_URL ?? "http://invalid");
if (db.hostname !== "localhost" || db.port !== "5433" || db.pathname !== "/dona_test_r4") throw new Error("Refusing tests outside localhost:5433/dona_test_r4.");
const identifier = process.env.TEST_ADMIN_IDENTIFIER;
const password = process.env.TEST_ADMIN_PASSWORD;
if (!identifier || !password) throw new Error("Test credentials must be supplied via environment.");
function session() { return { cookie: "", csrf: "" }; }
async function request(s, method, path, body, csrf = true) {
  const headers = {};
  if (s.cookie) headers.cookie = s.cookie;
  if (body !== undefined) headers["content-type"] = "application/json";
  if (csrf && s.csrf && !["GET", "HEAD"].includes(method)) headers["x-csrf-token"] = s.csrf;
  const res = await fetch(`${base}${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) s.cookie = setCookie.split(";", 1)[0];
  return { status: res.status, body: await res.json() };
}
async function login(user, pass) {
  const s = session(); const result = await request(s, "POST", "/auth/login", { identifier: user, password: pass }, false);
  assert.equal(result.status, 200, "test user login"); s.csrf = result.body.data.csrfToken; return s;
}

test("clientes e vendas: normalização, permissão, datas, estoque atômico e rastreabilidade", async () => {
  const admin = await login(identifier, password);
  const suffix = randomBytes(5).toString("hex");
  const productsResponse = await request(admin, "GET", "/produtos");
  assert.equal(productsResponse.status, 200);
  const products = productsResponse.body.data;
  const seedProduct = products.find((p) => p.nome === "Pastel de Carne");
  assert.ok(seedProduct, "dedicated seed category/product exists");
  const productResponse = await request(admin, "POST", "/produtos", { nome: `R4 venda ${suffix}`, categoriaId: seedProduct.categoriaId, precoCusto: "1.25", precoVenda: "6.00", quantidadeEstoque: "40", estoqueMinimo: "0" });
  const secondResponse = await request(admin, "POST", "/produtos", { nome: `R4 venda 2 ${suffix}`, categoriaId: seedProduct.categoriaId, precoCusto: "2.00", precoVenda: "5.00", quantidadeEstoque: "40", estoqueMinimo: "0" });
  assert.equal(productResponse.status, 201);
  assert.equal(secondResponse.status, 201);
  const product = productResponse.body.data;
  const second = secondResponse.body.data;
  const originalProduct = await request(admin, "GET", `/produtos/${product.id}`);
  const initialQty = Number(originalProduct.body.data.quantidadeEstoque);

  const createdClient = await request(admin, "POST", "/clientes", { nome: `Cliente ${suffix}`, whatsapp: "(11) 91234-5678", instagram: "@cliente_teste" });
  assert.equal(createdClient.status, 201);
  const client = createdClient.body.data;
  assert.equal(client.whatsapp, "+5511912345678");
  assert.equal(client.instagram, "cliente_teste");
  const duplicateClient = await request(admin, "POST", "/clientes", { nome: `Duplicado ${suffix}`, whatsapp: "5511912345678" });
  assert.equal(duplicateClient.status, 201, `WhatsApp duplicates are allowed while uniqueness policy is undecided: ${JSON.stringify(duplicateClient.body)}`);
  assert.equal((await request(admin, "POST", "/clientes", { nome: "A", whatsapp: "123" })).status, 400);

  const paid = await request(admin, "POST", "/vendas", { clienteId: client.id, statusPagamento: "PAGO", itens: [{ produtoId: product.id, quantidade: 2 }] });
  assert.equal(paid.status, 201);
  assert.equal(paid.body.data.total, "12.00");
  assert.equal(paid.body.data.itens[0].valorUnitario, "6.00");
  assert.equal(paid.body.data.itens[0].subtotal, "12.00");
  assert.ok(paid.body.data.usuario.id > 0);
  assert.equal(paid.body.data.dataPedido, `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`, "commercial date serializes as UTC midnight without local-date shifting");
  assert.equal(paid.body.data.vencimento, null);

  const onTerm = await request(admin, "POST", "/vendas", { clienteId: client.id, statusPagamento: "A_PRAZO", dataPedido: "2026-11-10", vencimento: "2026-11-09", itens: [{ produtoId: product.id, quantidade: 1 }] });
  assert.equal(onTerm.status, 400, "due date before sale date rejected");
  const missingDue = await request(admin, "POST", "/vendas", { clienteId: client.id, statusPagamento: "A_PRAZO", itens: [{ produtoId: product.id, quantidade: 1 }] });
  assert.equal(missingDue.status, 400);
  const fakeDiscount = await request(admin, "POST", "/vendas", { clienteId: client.id, statusPagamento: "PAGO", desconto: "1.00", itens: [{ produtoId: product.id, quantidade: 1 }] });
  assert.equal(fakeDiscount.status, 400);
  const fakeTotal = await request(admin, "POST", "/vendas", { clienteId: client.id, statusPagamento: "PAGO", total: "1.00", itens: [{ produtoId: product.id, quantidade: 1 }] });
  assert.equal(fakeTotal.status, 400);
  const fakeUnitPrice = await request(admin, "POST", "/vendas", { clienteId: client.id, statusPagamento: "PAGO", itens: [{ produtoId: product.id, quantidade: 1, valorUnitario: "0.01" }] });
  assert.equal(fakeUnitPrice.status, 400);
  const due = await request(admin, "POST", "/vendas", { clienteId: client.id, statusPagamento: "A_PRAZO", dataPedido: "2026-11-10", vencimento: "2026-12-10", itens: [{ produtoId: product.id, quantidade: 1 }, { produtoId: second.id, quantidade: 1 }] });
  assert.equal(due.status, 201);
  assert.equal(due.body.data.statusPagamento, "A_PRAZO");
  assert.equal(due.body.data.vencimento, "2026-12-10T00:00:00.000Z");

  const detail = await request(admin, "GET", `/vendas/${due.body.data.id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.usuario.id, paid.body.data.usuario.id);
  assert.equal(detail.body.data.itens.length, 2);
  assert.equal(detail.body.data.movimentacoes.length, 2);
  assert.deepEqual(Object.keys(detail.body.data.cliente).sort(), ["id", "nome"], "sale detail contains no client contact fields");
  assert.ok(detail.body.data.movimentacoes.every((m) => m.operadorId === detail.body.data.usuario.id && m.vendaId === due.body.data.id));
  const saleList = await request(admin, "GET", `/vendas?clienteId=${client.id}&statusPagamento=A_PRAZO&page=1&limit=5`);
  assert.equal(saleList.body.data.total, 1);
  assert.deepEqual(Object.keys(saleList.body.data.items[0].cliente).sort(), ["id", "nome"]);

  const productAfter = await request(admin, "GET", `/produtos/${product.id}`);
  assert.equal(Number(productAfter.body.data.quantidadeEstoque), initialQty - 3);

  // Concurrent oversubscription is serialized by product row locks; one request must roll back.
  const initialConcurrent = Number(productAfter.body.data.quantidadeEstoque);
  const tryConcurrent = () => request(admin, "POST", "/vendas", { clienteId: client.id, statusPagamento: "PAGO", itens: [{ produtoId: product.id, quantidade: 25 }] });
  const concurrent = await Promise.all([tryConcurrent(), tryConcurrent()]);
  assert.deepEqual(concurrent.map((x) => x.status).sort(), [201, 422]);
  const remaining = await request(admin, "GET", `/produtos/${product.id}`);
  assert.equal(Number(remaining.body.data.quantidadeEstoque), initialConcurrent - 25);

  // Failure on the second item rolls back the first stock decrement and all sale/history rows.
  const beforeFirst = Number(remaining.body.data.quantidadeEstoque);
  const rollback = await request(admin, "POST", "/vendas", { clienteId: client.id, statusPagamento: "PAGO", itens: [{ produtoId: product.id, quantidade: 1 }, { produtoId: second.id, quantidade: 999999 }] });
  assert.equal(rollback.status, 422);
  const afterRollback = await request(admin, "GET", `/produtos/${product.id}`);
  assert.equal(Number(afterRollback.body.data.quantidadeEstoque), beforeFirst);

  const duplicateItems = await request(admin, "POST", "/vendas", { clienteId: client.id, statusPagamento: "PAGO", itens: [{ produtoId: product.id, quantidade: 1 }, { produtoId: product.id, quantidade: 1 }] });
  assert.equal(duplicateItems.status, 400);

  async function makeRole(profile) {
    const rolePassword = randomBytes(24).toString("base64url");
    const roleName = `r4_${profile.toLowerCase()}_${suffix}`;
    const createdUser = await request(admin, "POST", "/usuarios", { nome: `R4 ${profile}`, nomeUsuario: roleName, email: `${roleName}@example.test`, senha: rolePassword, perfil: profile });
    assert.equal(createdUser.status, 201, `create ${profile}`);
    return login(roleName, rolePassword);
  }
  const vendor = await makeRole("VENDEDOR");
  assert.equal((await request(vendor, "GET", "/clientes")).status, 200);
  assert.equal((await request(vendor, "POST", "/clientes", { nome: `Negado ${suffix}`, whatsapp: "(11) 93456-7890" })).status, 403);
  assert.equal((await request(vendor, "POST", "/vendas", { clienteId: client.id, statusPagamento: "PAGO", itens: [{ produtoId: product.id, quantidade: 1 }] })).status, 201);
  assert.equal((await request(admin, "PATCH", `/clientes/${duplicateClient.body.data.id}`, { ativo: false })).status, 200);
  const stockUser = await makeRole("ESTOQUISTA");
  const stockClients = await request(stockUser, "GET", "/clientes");
  assert.equal(stockClients.status, 200);
  assert.ok(stockClients.body.data.some((c) => c.id === client.id && c.nome === client.nome));
  assert.ok(!stockClients.body.data.some((c) => c.id === duplicateClient.body.data.id), "inactive clients are excluded from the warehouse list");
  assert.ok(stockClients.body.data.every((c) => Object.keys(c).sort().join(",") === "id,nome"), "warehouse listing exposes only ID and name");
  assert.deepEqual((await request(stockUser, "GET", "/clientes?ativo=false")).body.data, [], "inactive customer filter is empty for warehouse role");
  const nameSearch = await request(stockUser, "GET", `/clientes?q=${encodeURIComponent(client.nome)}`);
  assert.ok(nameSearch.body.data.some((c) => c.id === client.id));
  assert.deepEqual((await request(stockUser, "GET", `/clientes?q=${encodeURIComponent(client.whatsapp)}`)).body.data, [], "warehouse search does not search WhatsApp");
  assert.equal((await request(stockUser, "GET", `/clientes/${client.id}`)).status, 403);
  assert.equal((await request(stockUser, "POST", "/clientes", { nome: `Negado Estoque ${suffix}`, whatsapp: "(11) 93456-7891" })).status, 403);
  assert.equal((await request(stockUser, "PATCH", `/clientes/${client.id}`, { nome: "Invasão" })).status, 403);
  const stockSale = await request(stockUser, "POST", "/vendas", { clienteId: client.id, statusPagamento: "PAGO", itens: [{ produtoId: product.id, quantidade: 1 }] });
  assert.equal(stockSale.status, 201);
  assert.deepEqual(Object.keys(stockSale.body.data.cliente).sort(), ["id", "nome"], "sale creation response contains no client contacts");
  const finance = await makeRole("FINANCEIRO");
  assert.equal((await request(finance, "GET", "/vendas")).status, 200);
  assert.equal((await request(finance, "GET", "/clientes")).status, 403);
  assert.equal((await request(finance, "POST", "/vendas", { clienteId: client.id, statusPagamento: "PAGO", itens: [{ produtoId: product.id, quantidade: 1 }] })).status, 403);

  // Inactive products are refused, while the prior sale snapshot and history remain available.
  assert.equal((await request(admin, "PATCH", `/produtos/${second.id}`, { ativo: false })).status, 200);
  const inactiveProductSale = await request(admin, "POST", "/vendas", { clienteId: client.id, statusPagamento: "PAGO", itens: [{ produtoId: second.id, quantidade: 1 }] });
  assert.equal(inactiveProductSale.status, 422);
  assert.equal((await request(admin, "PATCH", `/produtos/${second.id}`, { ativo: true })).status, 200);

  // Inactive customers and products cannot be used for new sales; old sale detail remains readable.
  assert.equal((await request(admin, "PATCH", `/clientes/${client.id}`, { ativo: false })).status, 200);
  const inactiveSale = await request(admin, "POST", "/vendas", { clienteId: client.id, statusPagamento: "PAGO", itens: [{ produtoId: second.id, quantidade: 1 }] });
  assert.equal(inactiveSale.status, 422);
  assert.equal((await request(admin, "GET", `/vendas/${paid.body.data.id}`)).status, 200);

});
