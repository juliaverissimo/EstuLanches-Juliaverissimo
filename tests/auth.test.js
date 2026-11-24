process.env.ADMIN_PASSWORD = 'admin123';
process.env.SESSION_SECRET = 'segredo-de-teste';
const test = require('node:test');
const assert = require('node:assert');
const auth = require('../src/auth');

test('senha correta é aceita e errada é recusada', () => {
  assert.ok(auth.senhaCorreta('admin123'));
  assert.ok(!auth.senhaCorreta('errada'));
  assert.ok(!auth.senhaCorreta(undefined));
});
test('token gerado é válido', () => {
  assert.ok(auth.tokenValido(auth.criarToken()));
});
test('token adulterado é recusado', () => {
  const [exp, sig] = auth.criarToken().split('.');
  assert.ok(!auth.tokenValido(`${Number(exp) + 1000}.${sig}`));
  assert.ok(!auth.tokenValido('lixo'));
});
test('token expirado é recusado', () => {
  assert.ok(!auth.tokenValido(auth.criarToken(-1)));
});
