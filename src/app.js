const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const auth = require('./auth');
const { validarProduto, validarPedido, validarStatus } = require('./validators');

const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
};

// Arquivos estáticos permitidos (lista fechada: evita acessar arquivos arbitrários)
const ESTATICOS = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/admin': ['admin.html', 'text/html; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/common.js': ['common.js', 'application/javascript; charset=utf-8'],
};

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', ...SEC_HEADERS });
  res.end(JSON.stringify(obj));
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 100_000) return null; // limite de tamanho do corpo
  }
  try { return JSON.parse(body || '{}'); } catch { return null; }
}

class ErroNegocio extends Error {
  constructor(codigo, mensagem) { super(mensagem); this.codigo = codigo; }
}

// Lista pedidos já com seus itens e o total calculado
async function listarPedidos(cliente) {
  const peds = cliente
    ? await db.query('SELECT id, cliente, status FROM pedidos WHERE cliente = ? ORDER BY id', [cliente])
    : await db.query('SELECT id, cliente, status FROM pedidos ORDER BY id');
  if (!peds.length) return [];
  const ids = peds.map((p) => p.id);
  const itens = await db.query(
    `SELECT i.pedido_id, i.produto_id, p.nome, i.quantidade, i.preco_unit
     FROM itens_pedido i JOIN produtos p ON p.id = i.produto_id
     WHERE i.pedido_id IN (${ids.map(() => '?').join(',')}) ORDER BY i.id`, ids);
  return peds.map((p) => {
    const its = itens.filter((i) => i.pedido_id === p.id).map((i) => ({
      produto_id: i.produto_id, nome: i.nome, quantidade: i.quantidade, preco: Number(i.preco_unit),
    }));
    const total = Number(its.reduce((t, i) => t + i.preco * i.quantidade, 0).toFixed(2));
    return { ...p, itens: its, total };
  });
}

async function handler(req, res) {
  const { method } = req;
  const u = new URL(req.url, 'http://localhost');
  const url = u.pathname;

  // ---------- Páginas e arquivos estáticos ----------
  if (method === 'GET' && ESTATICOS[url]) {
    const [arquivo, tipo] = ESTATICOS[url];
    res.writeHead(200, { 'Content-Type': tipo, ...SEC_HEADERS });
    return res.end(fs.readFileSync(path.join(__dirname, '..', 'public', arquivo)));
  }

  if (method === 'GET' && url === '/health') {
    await db.query('SELECT 1 AS ok');
    return send(res, 200, { status: 'ok' });
  }

  // ---------- Login do administrador ----------
  if (method === 'POST' && url === '/admin/login') {
    const ip = req.socket.remoteAddress;
    if (auth.loginBloqueado(ip)) return send(res, 429, { erro: 'muitas tentativas, aguarde 1 minuto' });
    const d = await readJson(req);
    if (!d || !auth.senhaCorreta(d.senha)) {
      auth.registrarFalha(ip);
      return send(res, 401, { erro: 'senha incorreta' });
    }
    return send(res, 200, { token: auth.criarToken() });
  }

  // ---------- Área do USUÁRIO (pública) ----------
  if (method === 'GET' && url === '/cardapio') {
    const rows = await db.query('SELECT id, nome, preco FROM produtos ORDER BY id');
    return send(res, 200, rows.map((r) => ({ ...r, preco: Number(r.preco) })));
  }

  if (method === 'POST' && url === '/pedidos') {
    const d = await readJson(req);
    const erro = d ? validarPedido(d) : 'JSON inválido';
    if (erro) return send(res, 400, { erro });
    const id = await db.transaction(async (q) => {
      const [ped] = await q('INSERT INTO pedidos (cliente) VALUES (?) RETURNING id', [d.cliente.trim()]);
      for (const it of d.itens) {
        const prod = await q('SELECT id, preco FROM produtos WHERE id = ?', [it.produto_id]);
        if (!prod.length) throw new ErroNegocio(404, 'produto não encontrado');
        await q('INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unit) VALUES (?, ?, ?, ?)',
          [ped.id, it.produto_id, it.quantidade, prod[0].preco]);
      }
      return ped.id;
    });
    return send(res, 201, { mensagem: 'pedido criado', id });
  }

  if (method === 'GET' && url === '/pedidos') {
    const cliente = u.searchParams.get('cliente');
    if (cliente) return send(res, 200, await listarPedidos(cliente.trim())); // aluno: só o próprio nome
    if (!auth.ehAdmin(req)) return send(res, 401, { erro: 'acesso restrito ao administrador' });
    return send(res, 200, await listarPedidos());
  }

  // ---------- Área do ADMINISTRADOR (exige token) ----------
  if (method === 'POST' && url === '/cardapio') {
    if (!auth.ehAdmin(req)) return send(res, 401, { erro: 'acesso restrito ao administrador' });
    const d = await readJson(req);
    const erro = d ? validarProduto(d) : 'JSON inválido';
    if (erro) return send(res, 400, { erro });
    await db.query('INSERT INTO produtos (nome, preco) VALUES (?, ?)', [d.nome.trim(), d.preco]);
    return send(res, 201, { mensagem: 'produto criado' });
  }

  const m = url.match(/^\/pedidos\/(\d+)\/status$/);
  if (method === 'PATCH' && m) {
    if (!auth.ehAdmin(req)) return send(res, 401, { erro: 'acesso restrito ao administrador' });
    const d = await readJson(req);
    const erro = d ? validarStatus(d.status) : 'JSON inválido';
    if (erro) return send(res, 400, { erro });
    const ped = await db.query('SELECT id FROM pedidos WHERE id = ?', [Number(m[1])]);
    if (!ped.length) return send(res, 404, { erro: 'pedido não encontrado' });
    await db.query('UPDATE pedidos SET status = ? WHERE id = ?', [d.status, Number(m[1])]);
    return send(res, 200, { mensagem: 'status atualizado' });
  }

  return send(res, 404, { erro: 'rota não encontrada' });
}

function createServer() {
  return http.createServer((req, res) => {
    handler(req, res).catch((err) => {
      if (err instanceof ErroNegocio) return send(res, err.codigo, { erro: err.message });
      console.error('Erro interno:', err.message); // log sem vazar detalhes ao cliente
      send(res, 500, { erro: 'erro interno' });
    });
  });
}

module.exports = { createServer };
