const db = require('./db');
const { createServer } = require('./app');

const PORT = process.env.PORT || 5000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function start() {
  for (let tentativa = 1; tentativa <= 10; tentativa++) {
    try {
      await db.initDb();
      console.log('Banco de dados conectado e tabelas prontas.');
      break;
    } catch (e) {
      console.error(`Banco indisponível (tentativa ${tentativa}/10): ${e.message}`);
      if (tentativa === 10) process.exit(1);
      await sleep(2000);
    }
  }
  createServer().listen(PORT, () => console.log(`EstuLanches rodando na porta ${PORT}`));
}

start();
