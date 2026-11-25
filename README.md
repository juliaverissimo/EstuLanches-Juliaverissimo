## Requisitos
Docker Desktop com Docker Compose.

## Link do vídeo
[Visite o vídeo](https://drive.google.com/file/d/1FmRLsn8sjuOtxt7ROFk-OUswqOF8DbQr/view?usp=sharing)

## Ficha RDM
[Veja a ficha](https://docs.google.com/document/d/15hfEZhmHhfGwBkmfC2otBs8821BZtuG669_lWYDUMPM/edit?usp=sharing)


## Como executar
1. Clone o repositório.
2. Copie `.env.example` para `.env` e altere `DB_PASSWORD` para uma senha forte.
3. Execute `docker compose up -d --build`.
4. Confira os serviços com `docker compose ps`.
5. Consulte os logs com `docker compose logs -f`.
6. Acesse `http://localhost:3000`.

## Como executar os testes
Com o banco iniciado, execute:
```bash
docker compose --profile test run --rm tests
```
Os testes unitários verificam as regras de validação. Os testes de integração fazem requisições HTTP à API e verificam a persistência e as operações no PostgreSQL. Atenção: a suíte de integração limpa as tabelas do banco configurado; use o ambiente de desenvolvimento/teste, nunca um banco com dados reais.

## Endpoints
| Método | Rota | Função |
|---|---|---|
| GET | `/api/health` | Estado da aplicação e conexão com o banco |
| GET | `/api/produtos` | Lista o cardápio |
| POST | `/api/produtos` | Cadastra produto |
| PUT | `/api/produtos/:id` | Atualiza produto |
| DELETE | `/api/produtos/:id` | Exclui produto |
| POST | `/api/pedidos` | Registra pedido |
| GET | `/api/pedidos` | Lista pedidos |
| PATCH | `/api/pedidos/:id/status` | Atualiza status |

## Decisões de arquitetura
A aplicação é dividida em interface web, API Express e banco PostgreSQL. O Compose cria uma rede interna entre os serviços e um volume persistente para os dados. A aplicação só inicia após o healthcheck do banco indicar que ele está pronto. O cálculo do pedido usa os preços armazenados no banco, e a criação do pedido e de seus itens ocorre em transação.

## Segurança e produção
- Consultas SQL parametrizadas para reduzir risco de SQL injection.
- Validação dos dados recebidos pela API.
- Senha do banco configurável por variável de ambiente; não publique `.env`.
- O usuário do container não é root.
- Volume persistente e rede interna entre os serviços.
- Para produção real: HTTPS, gestão de segredos, autenticação/autorização, limitação de requisições, backups, monitoramento e política de atualização de imagens.

## Escalabilidade conceitual
Para atender 1 milhão de usuários cadastrados e até 100 mil simultâneos, seria necessário evoluir a arquitetura: balanceador de carga distribuindo requisições entre várias instâncias stateless da API; orquestração de containers (Kubernetes); banco gerenciado com réplica de leitura, índices e pool de conexões; cache (Redis) para cardápio; fila de mensagens para tarefas demoradas; CDN para arquivos estáticos; observabilidade, testes de carga e escalabilidade automática. Uma única instância Docker e um único banco local, como neste projeto didático, não suportam essa escala por si só.

## Limpeza do ambiente
```bash
docker compose down
```
Para remover também os dados persistidos (ação irreversível):
```bash
docker compose down -v
```
