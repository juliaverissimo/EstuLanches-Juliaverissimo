const STATUS_VALIDOS = ['recebido', 'preparando', 'pronto', 'entregue'];
const MAX_ITENS = 20;
const MAX_QTD = 99;

function validarProduto(d = {}) {
  const nome = String(d.nome ?? '').trim();
  if (!nome || nome.length > 100) return 'nome é obrigatório (até 100 caracteres)';
  if (typeof d.preco !== 'number' || !(d.preco > 0)) return 'preco deve ser um número maior que 0';
  return null;
}

// Pedido com vários itens: { cliente, itens: [{ produto_id, quantidade }, ...] }
function validarPedido(d = {}) {
  const cliente = String(d.cliente ?? '').trim();
  if (!cliente || cliente.length > 100) return 'cliente é obrigatório (até 100 caracteres)';
  if (!Array.isArray(d.itens) || d.itens.length === 0) return 'o pedido precisa ter pelo menos 1 item';
  if (d.itens.length > MAX_ITENS) return `o pedido pode ter no máximo ${MAX_ITENS} itens`;
  for (const it of d.itens) {
    if (!it || !Number.isInteger(it.produto_id)) return 'produto_id deve ser inteiro';
    if (!Number.isInteger(it.quantidade) || it.quantidade < 1 || it.quantidade > MAX_QTD) {
      return `quantidade deve ser inteiro entre 1 e ${MAX_QTD}`;
    }
  }
  return null;
}

function validarStatus(s) {
  return STATUS_VALIDOS.includes(s) ? null : `status deve ser um de: ${STATUS_VALIDOS.join(', ')}`;
}

module.exports = { STATUS_VALIDOS, validarProduto, validarPedido, validarStatus };
