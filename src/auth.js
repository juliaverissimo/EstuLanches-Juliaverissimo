// Autenticação do administrador: senha vinda do ambiente + token assinado (HMAC) com validade.
// Token sem estado (stateless): qualquer réplica da aplicação consegue validar.
const crypto = require('crypto');

const secret = () => process.env.SESSION_SECRET || '';
const sign = (exp) => crypto.createHmac('sha256', secret()).update(String(exp)).digest('hex');
const sha = (s) => crypto.createHash('sha256').update(s).digest();

function senhaCorreta(senha) {
  const real = process.env.ADMIN_PASSWORD || '';
  if (!real || typeof senha !== 'string') return false; // sem senha configurada = login desativado
  return crypto.timingSafeEqual(sha(senha), sha(real));
}

function criarToken(horas = 8) {
  const exp = Date.now() + horas * 3600 * 1000;
  return `${exp}.${sign(exp)}`;
}

function tokenValido(token) {
  if (!secret() || typeof token !== 'string') return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || !(Number(exp) > Date.now())) return false;
  const esperado = sign(exp);
  return sig.length === esperado.length &&
    crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(esperado));
}

function ehAdmin(req) {
  const h = req.headers['authorization'] || '';
  return tokenValido(h.startsWith('Bearer ') ? h.slice(7) : '');
}

// Limite simples de tentativas de login por IP (5 erros por minuto)
const tentativas = new Map();
function loginBloqueado(ip) {
  const t = (tentativas.get(ip) || []).filter((x) => Date.now() - x < 60_000);
  tentativas.set(ip, t);
  return t.length >= 5;
}
function registrarFalha(ip) {
  tentativas.set(ip, [...(tentativas.get(ip) || []), Date.now()]);
}

module.exports = { senhaCorreta, criarToken, tokenValido, ehAdmin, loginBloqueado, registrarFalha };
