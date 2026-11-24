// Testes unitários: funções de validação isoladas (sem servidor e sem banco)
const test = require('node:test');
const assert = require('node:assert');
const { validarProduto, validarPedido, validarStatus } = require('../src/validators');

test('produto válido não retorna erro', () => {
  assert.strictEqual(validarProduto({ nome: 'Coxinha', preco: 6.5 }), null);
});
test('produto sem nome é rejeitado', () => {
  assert.ok(validarProduto({ preco: 5 }));
});
test('produto com preço negativo ou em texto é rejeitado', () => {
  assert.ok(validarProduto({ nome: 'X', preco: -1 }));
  assert.ok(validarProduto({ nome: 'X', preco: '5' }));
});
test('pedido com vários itens é aceito', () => {
  const d = { cliente: 'Ana', itens: [{ produto_id: 1, quantidade: 2 }, { produto_id: 2, quantidade: 1 }] };
  assert.strictEqual(validarPedido(d), null);
});
test('pedido sem itens ou sem cliente é rejeitado', () => {
  assert.ok(validarPedido({ cliente: 'Ana', itens: [] }));
  assert.ok(validarPedido({ cliente: 'Ana' }));
  assert.ok(validarPedido({ cliente: '', itens: [{ produto_id: 1, quantidade: 1 }] }));
});
test('item com quantidade inválida é rejeitado', () => {
  assert.ok(validarPedido({ cliente: 'Ana', itens: [{ produto_id: 1, quantidade: 0 }] }));
  assert.ok(validarPedido({ cliente: 'Ana', itens: [{ produto_id: 1, quantidade: 100 }] }));
  assert.ok(validarPedido({ cliente: 'Ana', itens: [{ produto_id: 'x', quantidade: 1 }] }));
});
test('pedido com mais de 20 itens é rejeitado', () => {
  const itens = Array.from({ length: 21 }, (_, i) => ({ produto_id: i + 1, quantidade: 1 }));
  assert.ok(validarPedido({ cliente: 'Ana', itens }));
});
test('status inválido é rejeitado e válido é aceito', () => {
  assert.ok(validarStatus('xyz'));
  assert.strictEqual(validarStatus('pronto'), null);
});
