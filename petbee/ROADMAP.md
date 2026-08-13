# Roadmap — CRM Petbee (Twenty)

Memória viva do projeto. Atualizado em 2026-08-12.

## Estado atual (feito ✅)

- **CRM em produção própria**: Twenty self-hosted em VPS Hostinger (KVM 2),
  `crm.petbeetools.com.br`, HTTPS automático (Caddy), firewall, backup diário
  03h30 (14 dias, `/opt/twenty-backups`), versão fixada via `TAG`.
- **Login**: Google SSO restrito a `@petbee.com.br` (app Interno no Google
  Cloud); login por senha desativado; workspace por convite.
- **Modelo**: Tutor (Person estendido) 1—N Pets 1—N Assinatura N—1 Plano,
  âncoras "ID Petbee" em tudo; catálogo de planos = `catalog.Plans`
  (Básico/Plus/Premium/Senior).
- **Base completa carregada e espelhada**: 7.731 tutores, 10.038 pets (992
  clones da origem deduplicados), 5.378 assinaturas (3.410 ativas), via robô
  em `petbee/sync` lendo a **réplica read-only** (Postgres do Retool DB,
  empurrada por DMS — nunca a produção). Cron de 1h (`SYNC_CRON_SCHEDULE`),
  **provado em produção**: tutora criada no app às 22h54 UTC de 12/08
  apareceu no CRM às 23h00m08s pela ronda automática, sem toque humano.
- **Enriquecimento**: aniversário e cidade/UF do tutor, falecido (227) e
  microchip do pet, addons/próxima cobrança/cortesia da assinatura.
- **Regras do robô**: upsert por âncora; adoção de leads por e-mail; dedup de
  pets clonados (prioridade: assinatura ativa); campos editados pelo time
  nunca são tocados; rate limit tratado com espera; linhas inválidas são
  puladas e reportadas, nunca travam a carga.
- Workflows de demonstração do Twenty removidos (um deles disparou 7.731
  execuções na carga).

## Próximas fases

### Migração do Bitrix24 (comercial) — em etapas
- **Fase 0 — Raio-X** (executado em 2026-08-12): 12 funis, 32.896 negócios
  (~8.880 abertos), 16.941 contatos, 27 campos custom. Cruzamento por
  e-mail: **69% dos contatos do Bitrix já são clientes Petbee** (7.639 —
  serão fundidos por adoção); ~3.345 leads puros a importar; 5.957 sem
  e-mail (só entram se tiverem negócio aberto em funil prioritário).
  Prioridades do Lucas: **Vendas (0)** e **Outbound (18)** migram como
  funis; **Envio de contrato (6) vira automação n8n** (esteira de contrato
  para assinaturas offline). Em quarentena para validação com o time:
  Recuperação de Lost (12), Customers (2), Indicação (10), Corretores (16),
  Crédito (4), Parcerias (22), Brokers (24). Mortos (não migram): Upgrades
  (14) e Clube Petbee (20). **Time comercial: 3 usuários** (Lucas, Rodrigo e
  Vitória). **Existe um agente de IA que qualifica leads e os move no
  pipeline** — peça crítica: o time não pode perder esse fluxo na virada;
  mapear onde ele roda (Make? ferramenta própria?), quais critérios usa e
  quais etapas ele movimenta, para reconstruí-lo apontando para o Twenty
  antes de desligar o Bitrix. **Raio-X do agente (Lucas, 2026-08-13): roda
  na infra própria da Petbee (app no Railway, fora do Make), falando direto
  com a API do Bitrix** — migrar = trocar as chamadas Bitrix por chamadas à
  API do Twenty no próprio código. Pendência restante da fase: validação da
  quarentena com o time.
- **Inventário do Make** (print de 2026-08-13, 17 cenários) — classificados
  pelo destino na migração:
  - **Morrem com o Bitrix, sem substituto** (o espelho da réplica já faz o
    trabalho no Twenty): Customer Events (2,3 mil execuções), Pet Events
    (3 mil), Subscription Events (234), Integration Checkout Events (39 mil)
    — todos empurram dados do app para dentro do Bitrix. Get Info Fonte
    api/petbee (parado).
  - **Carregam lógica comercial → reconstruir no n8n/Twenty Workflows**:
    webhook-createdealcrm-sales (4,9 mil), webhook-updatedealcrm-sales
    (68 mil execuções — o maior de todos), webhook-deletedealcrm-sales
    (parado desde jan/2025), Envio Contrato Venda Offline (180 — vira a
    automação do funil 6). Precisa exportar os blueprints para ver a lógica
    interna antes de reconstruir.
  - **Independentes do CRM (migram no próprio ritmo)**: as 5 Integration
    WPP cobrança (fup pix, limites, pix padrão, review payment, serasa —
    todas marcando 0 execuções; conferir quais estão ligadas),
    Digisac-bitrix (0 execuções, 68 módulos — conferir se está morto),
    Face e Google Insights, Reports Investor.
- **Fase 1 — Modelo comercial no Twenty**: Opportunities (kanban nativo) com
  as etapas dos funis, campos custom equivalentes, âncora `idBitrix` em
  negócio/empresa (Person já tem).
- **Fase 2 — Dados em lotes**: piloto de ~20 negócios → validação → base
  toda. **Política de contatos SELADA (Lucas, 2026-08-12)**: 1) casou por
  e-mail → adota o cliente existente (7.639); 2) casou por telefone em 1↔1
  perfeito → adota (127); 3) e-mail ou telefone válido sem casamento → cria
  como Lead (~9,5 mil — leads de WhatsApp são legítimos); 4) sem contato
  válido → descarta com relatório (162; ressalva: se tiver negócio aberto em
  funil migrado, aparece destacado para decisão manual). Importador
  idempotente re-rodável (ancora idBitrix) = delta automático; pode rodar
  diário via cron no VPS durante a transição.
- **Fase 3 — Automações: matar o Make → n8n self-hosted**. Peça fundadora:
  o **"porteiro único de entrada"** — subfluxo reutilizável "upsert-lead"
  (escadinha âncora → e-mail → telefone 1↔1; achou atualiza, senão cria).
  Regra da casa: nenhuma automação escreve no CRM direto; todas passam pelo
  porteiro. Virada de fontes por canal (LP/WhatsApp migra = para de criar no
  Bitrix no mesmo ato — uma maternidade por lead). Decisão: substituir
  o Make por estrutura própria open source (n8n), rodando no MESMO VPS
  (bloco a mais no `petbee/deploy/docker-compose.yml`, subdomínio próprio
  via Caddy). **Artefatos prontos (2026-08-13)**: serviço `n8n` no compose
  (Postgres próprio no mesmo banco, timezone São Paulo, chave de cifra
  gerada 1x), domínio `n8n.petbeetools.com.br` no Caddy, instalação via
  `petbee/deploy/add-n8n.sh`, backup diário passou a incluir o banco do
  n8n. **n8n NO AR em `n8n.petbeetools.com.br` (2026-08-13)**, conta de
  dono criada pelo Lucas. **Porteiro único v1 pronto** em `petbee/n8n/`
  (porteiro-unico.json + teste-porteiro.json + README): escadinha e-mail →
  telefone 1↔1 → cria com campo Origem (novo campo TEXT em Person);
  descarte pela política selada. Consulta de busca validada contra o CRM
  real antes de embarcar no fluxo. Cada cenário reconstruído no n8n já aponta para o Twenty —
  aposenta o cenário do Make e a dependência do Bitrix de uma vez. Make e
  n8n rodam em paralelo até cada cenário provar.
- **Fase 4 — Virada**: time vendendo no Twenty, Bitrix congelado, delta
  final, cancelar **Bitrix e Make**.

### Camada de IA (futuro, pós-virada)
- **Prioridade nº 1 desta camada: o agente qualificador de leads** que já
  existe hoje no fluxo comercial (qualifica e move o lead no pipeline).
  Ele precisa ser reapontado para o Twenty ANTES da virada — é pré-requisito
  da Fase 4, não um "depois". Como é código próprio da Petbee (Railway)
  falando com a API do Bitrix, a migração é uma troca de integrações no
  próprio app: chamadas Bitrix REST → GraphQL do Twenty, criação de lead
  passando pelo porteiro único. A inteligência (prompt/critérios) fica
  intacta para o comportamento que o time conhece não mudar.
- Candidato avaliado: **Sim (sim.ai)** — open source Apache 2.0,
  self-hostável, focado em agentes de IA (LLM + knowledge base). Decisão de
  2026-08: n8n é a espinha dorsal das automações (maturidade no
  encanamento); Sim fica no radar para agentes (triagem WhatsApp,
  atendimento com contexto da base) quando essa camada nascer. Ambos
  coexistem no mesmo VPS.

### Fase de eventos (com o dev — quando 1h de latência doer)
- EventBridge → Lambda (na VPC, lendo a réplica) → API do Twenty, só para os
  eventos que exigem minutos (assinatura bloqueada/cancelada, cliente novo).
- Cron relaxa para diário (madrugada) como reconciliador. Pauta discutida e
  aprovada em conceito; artefatos sob demanda.

## Pendências de manutenção

- **CTO**: trocar a senha da réplica (retool_db) de forma COORDENADA — a
  credencial passou por chats e o DMS pode usá-la; criar credencial
  somente-leitura dedicada ao CRM.
- **Trocar a API key do Twenty** usada pelo robô (passou por chat): criar
  nova → atualizar `.env` do VPS → revogar a antiga, nessa ordem.
- **Migrar este fork para `github.com/petbee`** (Settings → Transfer
  ownership; endereço antigo redireciona; ajustar remote no VPS).
- Backup externo dos dumps (rclone → Google Drive) ou snapshots Hostinger.
- Views do time (Clientes ativos, kanban de assinaturas, lista de
  reconquista com as 1.968 canceladas) e convites @petbee.com.br.
- Planilha dos 48 grupos de CPF duplicado (limpeza na origem) e aviso ao
  time do bug de cadastro repetido de pets no app.
