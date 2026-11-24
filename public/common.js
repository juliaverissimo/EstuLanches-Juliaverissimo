const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = (n) => 'R$ ' + Number(n).toFixed(2).replace('.', ',');
const api = (method, url, body, token) => fetch(url, {
  method,
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: body ? JSON.stringify(body) : undefined,
});
// Bloco HTML de um pedido (usado nas duas áreas)
const itensHtml = (p) => `<ul>${p.itens.map((i) =>
  `<li><span>${i.quantidade} x ${esc(i.nome)}</span><span>${brl(i.preco * i.quantidade)}</span></li>`).join('')}</ul>
  <div class="total"><span>Total</span><span>${brl(p.total)}</span></div>`;
