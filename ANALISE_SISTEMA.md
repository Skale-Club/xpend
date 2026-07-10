# Análise Completa do Sistema — Xpend

> **Data da análise**: 2026-07-10
> **Escopo**: código-fonte completo (~31.000 linhas de TypeScript, 76 commits, mar–mai/2026), schema de banco (24 modelos Prisma), infraestrutura, documentação e segurança.

---

## 1. Sumário Executivo

O Xpend evoluiu de um rastreador de gastos simples para uma plataforma de finanças pessoais completa: contas, extratos (CSV/PDF), cartões de crédito com faturas e parcelamentos, detecção de assinaturas, metas com estratégias de quitação de dívida, chat com IA (OpenRouter), sistema de memória financeira com revisão humana, e um servidor MCP para agentes externos.

**Pontos fortes**: arquitetura de módulos coerente, separação limpa entre cálculo determinístico e narrativa por IA, ingestão de extratos idempotente com merge inteligente, PWA e theming bem-feitos, middleware de auth defensivo (anti-spoofing de header), audit log do MCP, fila de revisão humana para memórias de IA.

**Riscos principais** (em ordem de severidade):

| # | Severidade | Risco |
|---|---|---|
| 1 | 🔴 **Crítica** | Endpoints de gestão de tokens MCP (`/api/mcp/tokens*`) **sem nenhuma autenticação** — qualquer pessoa na internet pode criar um token com todas as permissões (leitura e escrita, incluindo exclusão de dados) |
| 2 | 🔴 Alta | Ausência de multi-tenancy: qualquer conta Supabase autenticada acessa/edita/apaga todos os dados (IDOR sistêmico se o signup estiver aberto) |
| 3 | 🔴 Alta | Upload de extratos sem sanitização de nome de arquivo (path traversal no storage), sem limite de tamanho e com validação de tipo apenas por extensão |
| 4 | 🟠 Média-alta | `PUT /api/goals/[id]` sobrescreve `currentAmount` — editar qualquer campo de uma meta **reseta o progresso acumulado por contribuições** (perda de dados real) |
| 5 | 🟠 Média-alta | Parsing de datas do CSV com bug de código morto + ambiguidade DD/MM vs MM/DD + timezone misto (UTC vs local) → datas erradas e falha de dedup (duplicatas no re-upload) |
| 6 | 🟠 Média | Dinheiro armazenado como `Float` (IEEE-754) em todos os campos monetários — risco de drift de arredondamento; deveria ser `Decimal` |
| 7 | 🟠 Média | Dashboard/reports carregam **todas** as transações em memória (múltiplos full-scans por request) — não escala |
| 8 | 🟡 Baixa | Zero testes automatizados, CI sem build/lint/typecheck, documentação (README/CHANGELOG/QUICK_WINS) significativamente defasada |

---

## 2. Visão Geral do Sistema

### Stack
- **Frontend**: Next.js 16.1.6 (App Router), React 19.2.3, Tailwind 4, Recharts 3.7, next-themes, UI kit próprio (CVA + tokens)
- **Backend**: API Routes do Next.js, Prisma 7.4.2 + `@prisma/adapter-pg`, PostgreSQL (Supabase)
- **Auth/Storage**: Supabase Auth (cookies via middleware) + Supabase Storage (bucket privado `statements`)
- **IA**: Vercel AI SDK v6 + OpenRouter (Gemini 2.5 Flash default; GPT-4o mini, Claude 3.5 Sonnet, Llama 3.3 disponíveis)
- **Parsing**: PapaParse (CSV), unpdf + parsers determinísticos + fallback IA (PDF)

### Módulos (bem além do que o CLAUDE.md documenta)
1. **Núcleo financeiro**: contas, extratos, transações, categorias hierárquicas, regras de categorização
2. **Cartões de crédito**: faturas materializadas (`CreditCardInvoice`), parcelamentos com agrupamento determinístico, ciclos de fechamento, cálculo de limite disponível
3. **Assinaturas**: detecção heurística automática pós-upload com normalização de merchant, blocklist/allowlist e limpeza de órfãos
4. **Metas (Goals)**: progresso, planos (conservador/balanceado/agressivo), cenários, milestones, contribuições, estratégias snowball/avalanche de quitação de dívida, planner com IA
5. **Chat IA**: streaming, 10 tools (5 leitura + 5 escrita), rate limit por IP, histórico persistido
6. **Memória financeira**: extração por LLM → fila de revisão humana → memórias duráveis rankeadas → injeção de contexto no chat; timeline de jornada; health checks (duplicatas, conflitos, staleness)
7. **Servidor MCP**: JSON-RPC 2.0, 28 tools (14 read + 14 write), tokens com hash SHA-256 e permissões per-tool, transports HTTP e SSE, audit log
8. **Admin**: logs de API (`ApiLog`) com gate de super-admin por email
9. **PWA**: service worker artesanal competente (network-first + fallback offline + SWR de assets)

### Estatísticas
- 76 commits (2026-03-08 a 2026-05-30), desenvolvimento ativo
- 24 modelos Prisma, ~550 linhas de schema
- ~31.000 linhas de TypeScript, `strict: true`
- 12 páginas, ~35 grupos de endpoints de API

---

## 3. Segurança

### 3.1 🔴 CRÍTICO — Gestão de tokens MCP sem autenticação (verificado)

`middleware.ts:29,76` faz **bypass total** da autenticação Supabase para qualquer rota que comece com `/api/mcp` (a intenção era permitir Bearer token nos endpoints do protocolo). Porém `/api/mcp/tokens` está sob esse prefixo e os handlers (`src/app/api/mcp/tokens/route.ts`) **não validam sessão nem token**.

**Impacto**: um atacante não autenticado pode:
- `POST /api/mcp/tokens` → criar um token com **todas** as permissões (incluindo `delete_goal`, `categorize_by_description` em massa, criação de memórias)
- `GET /api/mcp/tokens` → listar tokens existentes (com previews)
- Rotacionar/revogar tokens legítimos (DoS de integrações)

Com o token criado, obtém leitura e escrita irrestritas de todos os dados financeiros via `/api/mcp/protocol`.

**Correção**: exigir sessão Supabase nas rotas `/api/mcp/tokens*` (restringir o bypass do middleware a `/api/mcp/protocol`, `/api/mcp/sse`, `/api/mcp/messages` e `/api/mcp` raiz) e revalidar no handler.

### 3.2 Demais achados de segurança

| Severidade | Achado | Local |
|---|---|---|
| Alta | Sem escopo por usuário em nenhuma rota — IDOR generalizado se o projeto Supabase aceitar signups | todas as rotas `[id]` |
| Alta | `file.name` interpolado sem sanitização no path do storage (path traversal); sem limite de tamanho; tipo validado só por extensão; `contentType` confia no cliente | `statements/upload/route.ts:55,58,35,63` |
| Alta | Token MCP aceito via **query string** (`?token=`) em protocol/SSE/messages — vaza em logs de proxy e Referer; URL de `messages` embute o token | `protocol/route.ts:11-13`, `sse/route.ts:11,19` |
| Alta | Operações destrutivas sem confirmação/autorização extra: `DELETE /api/history` apaga todas as sessões de chat; `POST /api/categories/seed` faz escrita em massa | `history/route.ts:71`, `categories/seed/route.ts:241` |
| Média | Chave OpenRouter em **texto puro** na tabela `Settings` (mascarada no GET, mas sem cifra at-rest) | `settings/route.ts:112` |
| Média | Rotas admin confiam apenas no matcher do middleware, sem revalidar `isSuperAdmin` no handler — regressão no matcher expõe logs | `admin/logs/route.ts:6` |
| Média | Injeção de prompt persistente: conteúdo de memórias (criável via MCP ou extraído de conversas) é injetado no system prompt de sessões futuras sem sanitização | `chat/route.ts:207-214`, `contextBuilder.ts:113` |
| Média | MCP sem rate limiting; rate limit do chat é in-memory por IP, só em produção e sem teto de tokens/custo | `rateLimit.ts:27-34` |
| Média | Erros do MCP retornam `error.message` cru (pode vazar detalhes de schema do Prisma) | `mcp/route.ts:93,105` |
| Baixa | Email do dono hardcoded como fallback de super-admin | `superAdmin.ts:3` |
| Baixa | Signed URL de extrato com TTL de 7 dias | `signed-url/route.ts:8` |
| Baixa | Segredos demo hardcoded no `docker-compose.supabase.yml` (senha do Postgres, JWT secret, chaves) — entregue inseguro por padrão | `docker-compose.supabase.yml:14-15,47,86-89` |
| Baixa | Stacks de erro completos persistidos em `ApiLog` (possível PII em logs de admin) | `logger.ts:19-52` |

**Pontos fortes de segurança**: remoção e reinjeção do header `x-user-email` no middleware (anti-spoofing), tokens MCP de alta entropia com só o hash persistido e exibição única, service role key usada apenas server-side, chave de API nunca exposta ao client, SQL 100% parametrizado (sem injeção), fila de revisão humana antes de memórias virarem duráveis.

---

## 4. Corretude — Bugs Identificados

### 4.1 Parsing de datas do CSV (fonte de dados corrompidos)
- `csvParser.ts:225` — o regex `mdyMatch` é **idêntico** ao `dmyMatch` da linha 218: o ramo MM/DD/YYYY é código morto inatingível.
- `csvParser.ts:212` — `new Date("05/02/2024")` é interpretado como MM/DD pelo V8, então datas europeias DD/MM válidas como US têm mês/dia **trocados silenciosamente**.
- Timezone misto: o ramo ISO cria datas em **UTC**, os ramos DD/MM em **horário local**. Como o dedup do upload compara `getTime()` exato (`upload/route.ts:166`), re-importar o mesmo extrato em formato de data diferente **duplica transações**.

### 4.2 Metas
- `PUT /api/goals/[id]` + `payload.ts:19` — sobrescreve `currentAmount` com o valor do corpo; como o progresso é acumulado via `increment` por contribuições, **editar a meta reseta o progresso** (perda de dados).
- Delete de contribuição faz read-modify-write em vez de `decrement` atômico (`contributions/[contributionId]/route.ts:22-27`) — corrida sob concorrência; piso em 0 dessincroniza do somatório.
- Comentário de semântica de DEBT_PAYOFF em `calculations.ts:24-29` contradiz o uso real em `debt-strategy/route.ts:30`.

### 4.3 Dashboard
- `getBalanceTrend`/`getNetWorthSummaryData` (`dashboard/route.ts:520,706`) somam o `initialBalance` **total** de todas as contas mas iteram transações **filtradas** pelo request → curva de saldo incorreta com qualquer filtro ativo.
- Timezone misto entre agregações (local em `getMonthlyData:203`, UTC em net worth `:721`).
- Spending pace / cash flow fixados no mês-calendário atual (`:647`) — ficam vazios quando os extratos mais recentes são antigos (inconsistente com o detector de assinaturas, que usa a freshness do dataset).

### 4.4 Cartão de crédito
- `applyFatura.ts:62-65` — todas as transações do statement são vinculadas à fatura do mês informado no formulário, ignorando a data real e o ciclo de fechamento; `invoiceReferenceForDate` existe mas não é aplicado no vínculo.
- `limit.ts:39` — snapshot de limite defasado vence o cálculo por saldo em aberto.
- `installment.ts:27` — padrão "NN/NN" no fim da descrição pode confundir data ("voo 03/12") com parcela 3/12.

### 4.5 Outros
- `parseAmount` (`csvParser.ts:205`) colapsa `NaN` em 0 e aceita transações de valor zero.
- `autoCategorize.ts:120` — o prompt de IA instrui a decidir tipo "pelo sinal do valor", mas o valor é formatado sempre positivo (`toFixed(2)` com `$`).
- Chat: default do schema Prisma `gemini-2.5-flash` (sem prefixo `google/`) é **inválido para OpenRouter** — falha até que Settings seja salvo (`schema.prisma:256` vs `models.ts:2`).
- Chat: `onFinish` persiste apenas a última mensagem assistant — passos intermediários de tool-call podem se perder do histórico (`chat/route.ts:243-269`).
- `categorize-by-keyword` faz `updateMany` global por substring sem escopo de conta — keyword genérica re-categoriza o banco inteiro (`categorize-by-keyword/route.ts:41`).
- `monthKey` do detector de assinaturas usa UTC enquanto os parsers criam datas em local (`subscriptionDetector.ts:241`).

---

## 5. Performance e Escalabilidade

| Problema | Local | Impacto |
|---|---|---|
| 3 varreduras completas da tabela de transações por request do dashboard (agregação + paginada + **todas** as transações de todas as contas) | `dashboard/route.ts:74,90,123` | Memória e latência crescem linearmente com o histórico |
| Saldo por conta calculado com `filter` aninhado O(contas × transações) em JS em vez de `groupBy` no banco | `dashboard/route.ts:137-147` | Idem |
| Net worth constrói série diária da primeira transação até hoje em todo request | `dashboard/route.ts:735-740` | Milhares de pontos para históricos longos |
| Reports e category-breakdown também agregam em JS sobre datasets completos | `reports/route.ts:93`, `category-breakdown/route.ts:64` | Idem |
| Upsert de assinaturas em loop (`findFirst`+`update`/`create` por padrão) após cada upload | `subscriptionDetector.ts:506-556` | N+1 de escritas em background |
| `seedCategories` sequencial (dezenas de round-trips) | `categories/seed/route.ts:164-239` | Lento, sem transação |
| Histórico completo do chat enviado ao modelo sem janela/truncamento | `chat/route.ts:216-222` | Custo e limite de contexto em conversas longas |
| Sem cache de dados no frontend (sem React Query/SWR) — `/api/accounts` e `/api/categories` refeitos em quase toda página; mutações fazem refetch total | padrão geral das páginas | Tráfego e latência desnecessários |

**Atomicidade**: falta `$transaction` em operações multi-passo importantes — upload de statement (upsert + createMany + applyFatura), update/delete de categoria com descendentes, seed de categorias. Falha parcial deixa estado inconsistente.

---

## 6. Qualidade de Código e Arquitetura

### Pontos fortes
- TypeScript `strict`, zero `console.log` em `src/`, error handling consistente (try/catch + mensagem genérica), logging de API via `withApiLogging` + `instrumentation.ts`.
- Separação exemplar entre cálculo determinístico e narrativa de IA (goals/aiPlanner, faturas com reconciliação contra totais impressos antes de aceitar parse local).
- Ingestão idempotente: re-upload faz merge preservando edições do usuário; `applyFatura` nunca reverte status de pagamento.
- Detecção de assinaturas sofisticada (normalização de merchant, mediana de intervalos, inatividade relativa à freshness do dataset, limpeza de órfãos).
- MCP com registry limpo (reads/writes separados), audit best-effort e human-in-the-loop na fila de memórias.

### Fragilidades
- **Componentes gigantes**: `reports/page.tsx` (1.218 linhas), `TransactionList.tsx` (925), `subscriptions/page.tsx` (832), `TimelineUpload.tsx` (814) — misturam parsing, formatação e estado de UI.
- **Duplicação**: helpers de agregação quase idênticos entre `dashboard/route.ts` e `reports/route.ts`; `normalizeInt/Float` copiados entre rotas de accounts; mapeamento de transações duplicado no dashboard client; `buildFinancialContext` exposto em 3 lugares.
- **Validação inconsistente**: `lib/validation.ts` (539 linhas) existe, mas `validateCategoryData` e `validateSettings` nunca são chamados; subscriptions/rules validam inline e minimamente; datas de querystring viram 500 do Prisma quando inválidas.
- **Naming enganoso**: tudo se chama "Gemini" (`geminiApiKey`, `geminiChatModel`) mas o provider real é OpenRouter — alta chance de confusão em manutenção.
- **Resquícios**: `$queryRaw` para ler campo que já existe tipado no Prisma (`chat/route.ts:43`), stub `stream/route.ts` retornando 204, comentários de rascunho em produção (`reports/route.ts:212-214`), dep morta `@vercel/analytics`.
- **Frontend sem error boundaries** (nenhum `error.tsx`/`not-found.tsx` no App Router); guards `readArrayResponse` adotados em parte das páginas apenas (origem dos bugs recentes "guard against non-array responses").
- **Fallbacks silenciosos** no chat (sessão "temp" em memória, catch retornando lista vazia) mascaram falhas de banco.

---

## 7. Testes, CI e Documentação

- **Testes: inexistentes.** Nenhum arquivo de teste, nenhum runner configurado, nenhuma dependência de teste. Módulos ideais para começar: `csvParser`, `subscriptionDetector`, `creditCard/*`, `goals/calculations`, `debtPayoff` (puros, determinísticos).
- **CI: apenas um keepalive.** O único workflow (`supabase-keepalive.yml`) faz curl a cada 6h para o free tier do Supabase não pausar. Não há build, lint nem typecheck em PRs.
- **Documentação defasada**:
  - `README.md` ainda é o boilerplate do `create-next-app` (o dev roda na porta **6112**, não 3000).
  - `CHANGELOG.md` congelado em v1.1.0 (2026-03-02) — goals, MCP, journey, credit cards e dezenas de features posteriores não constam.
  - `QUICK_WINS.md` marca como concluído o que não foi feito (optimistic updates, skeletons).
  - `SELF_HOSTED.md` instrui a usar rotas `/api/supabase/*` que não existem.
  - `CLAUDE.md` é o mais fiel, mas descreve ~7 modelos de um schema com 24 e chama de "Google Generative AI" o que é OpenRouter.
  - Existem **duas fontes de migração** (`prisma/migrations/` e `supabase/migrations/`) que podem divergir.

---

## 8. Recomendações Priorizadas

### P0 — Corrigir imediatamente (segurança)
1. **Autenticar `/api/mcp/tokens*`** — restringir o bypass do middleware aos endpoints do protocolo MCP e revalidar sessão nos handlers de tokens. É a vulnerabilidade mais grave do sistema.
2. Parar de aceitar token MCP via query string; usar apenas header `Authorization`.
3. Sanitizar `file.name` no upload (gerar nome próprio), impor limite de tamanho e validar MIME real.
4. Desabilitar signups no projeto Supabase (ou implementar `userId` + escopo em todas as queries) enquanto o app for single-user.

### P1 — Corrigir em seguida (integridade de dados)
5. Corrigir `PUT /api/goals/[id]` para não sobrescrever `currentAmount` (remover do payload de update).
6. Reescrever `parseDate` do CSV: eliminar o `new Date(string)` ambíguo, corrigir o regex duplicado, normalizar tudo para UTC — e normalizar datas existentes no dedup.
7. Corrigir `getBalanceTrend`/net worth para respeitar (ou ignorar coerentemente) os filtros ativos.
8. Envolver upload de statement e operações multi-passo de categorias em `$transaction`.
9. Usar `decrement` atômico no delete de contribuição.

### P2 — Dívida estrutural
10. Migrar campos monetários de `Float` para `Decimal` (migração + ajuste de serialização).
11. Mover agregações do dashboard/reports para `groupBy`/SQL no banco; paginar listas ilimitadas.
12. Aplicar `invoiceReferenceForDate` no vínculo transação→fatura.
13. Adotar React Query (ou SWR) para cache/invalidations no frontend; padronizar `readArrayResponse` em todas as páginas; adicionar `error.tsx` global.
14. Centralizar validação (usar `lib/validation.ts` ou migrar tudo para Zod, já presente no projeto).

### P3 — Sustentabilidade
15. Vitest + testes dos módulos puros (parsers, detector, cálculos de metas/cartão); CI com build + lint + typecheck + test.
16. Quebrar os 4 componentes gigantes em subcomponentes/hooks.
17. Renomear `gemini*` → `openrouter*`/`aiApiKey` (schema + código) e corrigir o default inválido `gemini-2.5-flash` → `google/gemini-2.5-flash`.
18. Atualizar README/CHANGELOG/SELF_HOSTED/CLAUDE.md; remover `@vercel/analytics` ou montá-lo; unificar a fonte de migrações.
19. Adicionar teto de custo/tokens para chamadas de IA e rate limiting persistente (o atual é in-memory por IP).

---

## 9. Conclusão

O Xpend é um projeto ambicioso e funcionalmente rico, com engenharia acima da média em vários pontos (reconciliação de faturas, idempotência de ingestão, human-in-the-loop de memórias, PWA). A dívida está concentrada em três frentes: **(a) segurança do perímetro MCP e do modelo single-tenant**, **(b) corretude de datas/dinheiro** (parsing ambíguo, timezone misto, `Float` monetário) e **(c) escalabilidade das agregações**. O item 3.1 (tokens MCP sem auth) merece correção antes de qualquer outra coisa — é explorável remotamente sem credenciais em qualquer deploy público.
