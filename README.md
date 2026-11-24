# 🥪 EstuLanches

Sistema de gestão de **cardápio e pedidos da cantina escolar**. Resolve filas e anotações em papel: o aluno vê o cardápio e faz o pedido; a cantina acompanha o status (recebido → preparando → pronto → entregue).

**Tecnologias:** Node.js 22 (http nativo), PostgreSQL 16, Docker e Docker Compose.

## Como rodar (produção)
```bash
cp .env.example .env       
docker compose up -d --build
docker compose ps           
docker compose logs        
```
Acesse:
- **Área do aluno:** http://localhost:5000
- **Área do administrador:** http://localhost:5000/admin (senha = `ADMIN_PASSWORD` do `.env`)
- Saúde: http://localhost:5000/health

## Testes
A atividade pede **testes unitários** e **testes de integração**; o projeto tem os dois, mais um teste de validação do ambiente no ar.

| Tipo | Arquivos | O que testa |
|---|---|---|
| Unitários | `tests/unitarios.test.js`, `tests/auth.test.js` | validações (pedido com vários itens, produto, status) e autenticação (senha, token válido/adulterado/expirado) |
| Integração | `tests/integracao.test.js` | API + banco: fluxo aluno/admin, total do pedido, transação, rotas protegidas (401), 404, SQL Injection |
| Validação em produção | `tests/smoke.test.js` | sistema já no ar no Docker: /health, páginas, cardápio, 401 nas rotas do admin (não grava nada) |

**Rodar dentro do Docker (recomendado, não depende do Node da sua máquina):**
```bash
docker compose run --rm --no-deps web npm test            # unitários + integração
docker compose exec -e SMOKE_URL=http://localhost:5000 web npm run test:smoke   # valida o ambiente no ar
```

**Rodar na sua máquina:** precisa de **Node 22.13 ou superior**.
```bash
npm test                  # tudo (o smoke é ignorado sem SMOKE_URL)
npm run test:unit
npm run test:integration
```
Os testes usam SQLite em memória e **nunca** tocam no banco de produção, mesmo dentro do container.

## API
| Método | Rota | Função |
|---|---|---|
| GET | /cardapio | aluno: ver cardápio |
| POST | /pedidos | aluno: fazer pedido com **vários itens** `{cliente, itens:[{produto_id, quantidade}]}` |
| GET | /pedidos?cliente=Nome | aluno: ver os próprios pedidos |
| POST | /admin/login | admin: obter token (senha do .env) |
| POST | /cardapio | **admin**: cadastrar produto |
| GET | /pedidos | **admin**: ver todos os pedidos |
| PATCH | /pedidos/{id}/status | **admin**: atualizar status |
| GET | /health | verificação de saúde |

## Segurança
- Áreas separadas: rotas do admin exigem token assinado (HMAC) com validade de 8h, conferido no servidor; senha só no `.env`, comparação em tempo constante e limite de 5 tentativas/min
- Pedido e itens gravados em **transação** (ou grava tudo, ou nada); limite de 20 itens por pedido e 99 por item
- Consultas SQL parametrizadas (anti SQL Injection) e validação de entrada
- Limite de tamanho do corpo da requisição e cabeçalhos de segurança HTTP
- Container roda como usuário não-root (`USER node`)
- Senhas em variáveis de ambiente (`.env` fora do Git)
- Banco sem porta exposta (só rede interna do Docker)
- Erros internos vão para o log, sem vazar detalhes ao cliente

## Escalabilidade (conceitual – 1 milhão de usuários, 100 mil simultâneos)
- **Stateless:** a aplicação não guarda sessão → dezenas/centenas de réplicas idênticas
- **Load Balancer** (Nginx/ALB) distribuindo entre réplicas; **Kubernetes** com autoscaling (HPA)
- **Banco:** PostgreSQL com réplicas de leitura, pool de conexões (PgBouncer) e, se preciso, particionamento por região/escola
- **Cache** (Redis) para o cardápio, que é lido muito mais do que escrito
- **CDN** para arquivos estáticos; **fila** (RabbitMQ/SQS) para absorver picos de pedidos
- **Multi-zona/região** para alta disponibilidade; monitoramento (Prometheus/Grafana)

## Roteiro do vídeo (2 a 5 min)
1. **(0:00)** Apresente-se e o projeto: problema (filas/papel) e solução
2. **(0:30)** Dockerfile: imagem alpine, dependências em cache, usuário não-root
3. **(1:00)** docker-compose.yml: serviços web+db, healthcheck, volume, .env, banco sem porta pública
4. **(1:30)** Testes: unitários, integração e smoke rodando com `docker compose run --rm --no-deps web npm test`
5. **(2:00)** Código: `src/app.js` (rotas), `src/db.js` (SQL parametrizado), `src/validators.js`
6. **(2:30)** Demo (mostre a área do aluno montando um pedido com vários itens e a área do admin com login): `docker compose up`, `ps`, `logs`, navegador fazendo um pedido
7. **(3:30)** Mostrar a Ficha RDM em PDF
8. **(4:00)** Segurança e **(4:30)** escalabilidade (listas acima)

## Problemas comuns no Docker
- **Já rodou uma versão anterior?** O sistema migra sozinho as tabelas antigas de pedidos ao iniciar (veja `docker compose logs web`). Basta refazer o build: `docker compose up -d --build`.
- **"erro interno" ao enviar pedido**: o motivo real aparece em `docker compose logs web`.
- **"crie o arquivo .env"**: rode `cp .env.example .env` (no Windows: `copy .env.example .env`) antes do `docker compose up`.
- **Senha do banco com caracteres especiais** (`@ : / #`): use só letras e números em `POSTGRES_PASSWORD`, pois ela vai dentro da URL de conexão.
- **Porta 5000 ocupada**: troque `"5000:5000"` por `"8080:5000"` no compose e acesse a porta 8080.
- **Mudou o `.env` do banco depois da primeira subida**: `docker compose down -v` e suba de novo (apaga os dados).
- **Ver o que deu errado**: `docker compose logs web` e `docker compose logs db`.
