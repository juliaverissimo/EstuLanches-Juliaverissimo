delete process.env.DATABASE_URL; 
process.env.ADMIN_PASSWORD = 'admin123';
process.env.SESSION_SECRET = 'segredo-de-teste';
const test = require('node:test');
const assert = require('node:assert');
const db = require('../src/db');
const { createServer } = require('../src/app');

let server, base;

test.beforeEach(async () => {
  await db.close();            
  await db.initDb();
  server = createServer();
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});
test.afterEach(async () => { server.close(); await db.close(); });

const req = (method, path, body, token) => fetch(base + path, {
  method,
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: body ? JSON.stringify(body) : undefined,
});
const loginAdmin = async () => (await (await req('POST', '/admin/login', { senha: 'admin123' })).json()).token;

test('GET /health responde ok', async () => {
  const r = await req('GET', '/health');
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(await r.json(), { status: 'ok' });
});

test('páginas do aluno e do admin e o CSS são servidos', async () => {
  for (const rota of ['/', '/admin', '/style.css', '/common.js']) {
    assert.strictEqual((await fetch(base + rota)).status, 200, rota);
  }
});

test('login do admin: senha errada = 401, correta = token', async () => {
  assert.strictEqual((await req('POST', '/admin/login', { senha: 'errada' })).status, 401);
  assert.ok(await loginAdmin());
});

test('rotas do admin sem token retornam 401', async () => {
  assert.strictEqual((await req('POST', '/cardapio', { nome: 'X', preco: 1 })).status, 401);
  assert.strictEqual((await req('GET', '/pedidos')).status, 401);
  assert.strictEqual((await req('PATCH', '/pedidos/1/status', { status: 'pronto' })).status, 401);
});

test('fluxo completo: admin cadastra, aluno pede vários itens, admin muda status', async () => {
  const token = await loginAdmin();
  assert.strictEqual((await req('POST', '/cardapio', { nome: 'Coxinha', preco: 6.5 }, token)).status, 201);
  assert.strictEqual((await req('POST', '/cardapio', { nome: 'Suco', preco: 4 }, token)).status, 201);

  const cardapio = await (await req('GET', '/cardapio')).json(); 
  assert.strictEqual(cardapio.length, 2);

  const p = await req('POST', '/pedidos', { cliente: 'João', itens: [
    { produto_id: cardapio[0].id, quantidade: 2 },
    { produto_id: cardapio[1].id, quantidade: 1 },
  ] });
  assert.strictEqual(p.status, 201);

  const meus = await (await req('GET', '/pedidos?cliente=João')).json();
  assert.strictEqual(meus.length, 1);
  assert.strictEqual(meus[0].itens.length, 2);
  assert.strictEqual(meus[0].total, 17);
  assert.strictEqual((await (await req('GET', '/pedidos?cliente=Outra')).json()).length, 0);

  const pedidos = await (await req('GET', '/pedidos', null, token)).json();
  assert.strictEqual(pedidos[0].status, 'recebido');
  assert.strictEqual((await req('PATCH', `/pedidos/${pedidos[0].id}/status`, { status: 'pronto' }, token)).status, 200);
  assert.strictEqual((await (await req('GET', '/pedidos', null, token)).json())[0].status, 'pronto');
});

test('pedido sem itens retorna 400', async () => {
  const r = await req('POST', '/pedidos', { cliente: 'Ana', itens: [] });
  assert.strictEqual(r.status, 400);
});

test('pedido com produto inexistente retorna 404 e não grava nada (transação)', async () => {
  const token = await loginAdmin();
  await req('POST', '/cardapio', { nome: 'Coxinha', preco: 6.5 }, token);
  const r = await req('POST', '/pedidos', { cliente: 'Ana', itens: [
    { produto_id: 1, quantidade: 1 }, { produto_id: 99, quantidade: 1 },
  ] });
  assert.strictEqual(r.status, 404);
  assert.strictEqual((await (await req('GET', '/pedidos', null, token)).json()).length, 0);
});

test('SQL Injection é tratado como texto comum', async () => {
  const token = await loginAdmin();
  await req('POST', '/cardapio', { nome: "x'); DROP TABLE produtos;--", preco: 1 }, token);
  assert.strictEqual((await (await req('GET', '/cardapio')).json()).length, 1);
});

test('JSON inválido retorna 400', async () => {
  const token = await loginAdmin();
  const r = await fetch(base + '/cardapio', { method: 'POST', body: '{quebrado', headers: { Authorization: `Bearer ${token}` } });
  assert.strictEqual(r.status, 400);
});
