const test = require('node:test');
const assert = require('node:assert');

const BASE = process.env.SMOKE_URL;
const opts = { skip: BASE ? false : 'defina SMOKE_URL para testar o sistema no ar' };

test('produção: /health responde ok (aplicação conectada ao banco)', opts, async () => {
  const r = await fetch(BASE + '/health');
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(await r.json(), { status: 'ok' });
});

test('produção: páginas do aluno e do administrador abrem', opts, async () => {
  assert.strictEqual((await fetch(BASE + '/')).status, 200);
  assert.strictEqual((await fetch(BASE + '/admin')).status, 200);
});

test('produção: cardápio público responde uma lista', opts, async () => {
  const r = await fetch(BASE + '/cardapio');
  assert.strictEqual(r.status, 200);
  assert.ok(Array.isArray(await r.json()));
});

test('produção: rotas do administrador exigem login (401)', opts, async () => {
  assert.strictEqual((await fetch(BASE + '/pedidos')).status, 401);
  const r = await fetch(BASE + '/cardapio', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: 'x', preco: 1 }),
  });
  assert.strictEqual(r.status, 401);
});

test('produção: senha de administrador errada é recusada', opts, async () => {
  const r = await fetch(BASE + '/admin/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senha: 'senha-errada-de-teste' }),
  });
  assert.strictEqual(r.status, 401);
});
