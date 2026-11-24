// Camada de banco: PostgreSQL em produção (DATABASE_URL=postgresql://...)
// e SQLite em memória nos testes. Todas as consultas são parametrizadas.
const isPg = () => (process.env.DATABASE_URL || '').startsWith('postgres');
let pool = null;
let sqlite = null;

const toPg = (sql) => { let i = 0; return sql.replace(/\?/g, () => `$${++i}`); };
const retornaLinhas = (sql) => /^\s*select/i.test(sql) || /returning/i.test(sql);

function getPool() {
  if (!pool) {
    const { Pool } = require('pg');
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

function getSqlite() {
  if (!sqlite) {
    let DatabaseSync;
    try { ({ DatabaseSync } = require('node:sqlite')); } catch {
      throw new Error('Os testes precisam do Node 22.13 ou superior (módulo node:sqlite). Rode: docker compose run --rm --no-deps web npm test');
    }
    sqlite = new DatabaseSync(':memory:');
  }
  return sqlite;
}

async function query(sql, params = []) {
  if (isPg()) return (await getPool().query(toPg(sql), params)).rows;
  const stmt = getSqlite().prepare(sql);
  if (retornaLinhas(sql)) return stmt.all(...params);
  stmt.run(...params);
  return [];
}

// Executa várias consultas de forma atômica: ou grava tudo, ou nada.
async function transaction(fn) {
  if (isPg()) {
    const c = await getPool().connect();
    try {
      await c.query('BEGIN');
      const r = await fn(async (s, p = []) => (await c.query(toPg(s), p)).rows);
      await c.query('COMMIT');
      return r;
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  }
  const d = getSqlite();
  d.exec('BEGIN');
  try {
    const r = await fn(async (s, p = []) => {
      const st = d.prepare(s);
      if (retornaLinhas(s)) return st.all(...p);
      st.run(...p);
      return [];
    });
    d.exec('COMMIT');
    return r;
  } catch (e) {
    d.exec('ROLLBACK');
    throw e;
  }
}

async function criarTabelas() {
  const pk = isPg() ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  await query(`CREATE TABLE IF NOT EXISTS produtos (
    id ${pk}, nome VARCHAR(100) NOT NULL, preco NUMERIC(8,2) NOT NULL)`);
  await query(`CREATE TABLE IF NOT EXISTS pedidos (
    id ${pk}, cliente VARCHAR(100) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'recebido')`);
  await query(`CREATE TABLE IF NOT EXISTS itens_pedido (
    id ${pk}, pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
    produto_id INTEGER NOT NULL REFERENCES produtos(id),
    quantidade INTEGER NOT NULL, preco_unit NUMERIC(8,2) NOT NULL)`);
}

// Versão 1 tinha pedidos com 1 produto só (coluna produto_id em "pedidos").
// Se o banco ainda estiver nesse formato, remove as tabelas antigas e devolve os pedidos para reimportar.
async function removerEsquemaAntigo() {
  if (!isPg()) return [];
  const col = await query(
    "SELECT 1 AS x FROM information_schema.columns WHERE table_name = 'pedidos' AND column_name = 'produto_id'");
  if (!col.length) return [];
  console.log('Esquema antigo de pedidos detectado: migrando para pedidos com vários itens...');
  const antigos = await query('SELECT cliente, produto_id, quantidade, status FROM pedidos ORDER BY id');
  await query('DROP TABLE IF EXISTS itens_pedido');
  await query('DROP TABLE pedidos');
  return antigos;
}

async function initDb() {
  const antigos = await removerEsquemaAntigo();
  await criarTabelas();
  for (const o of antigos) {
    const [p] = await query('INSERT INTO pedidos (cliente, status) VALUES (?, ?) RETURNING id', [o.cliente, o.status]);
    await query(
      'INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unit) SELECT ?, id, ?, preco FROM produtos WHERE id = ?',
      [p.id, o.quantidade, o.produto_id]);
  }
  if (antigos.length) console.log(`Migração concluída: ${antigos.length} pedido(s) preservado(s).`);
}

async function close() {
  if (pool) { await pool.end(); pool = null; }
  if (sqlite) { sqlite.close(); sqlite = null; }
}

module.exports = { query, transaction, initDb, close };
