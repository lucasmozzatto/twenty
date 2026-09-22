# Painéis Petbee

App de painéis comerciais instalado no CRM Petbee (`crm.petbeetools.com.br`). Este arquivo
é o mínimo para trabalhar aqui sem quebrar nada. As regras de negócio, as decisões com
data e as conferências de número estão no `README.md` desta pasta.

## Antes de mexer em qualquer número

**Leia o `README.md` desta pasta.** Cada coluna da visão Vendedores tem uma regra decidida
pelo dono do painel, com data, e várias foram discutidas, revertidas e redecididas. O
código diz o que faz, nunca por quê. Um exemplo: a coluna Perdidos usa a data de
fechamento, e não a de criação, por causa do ciclo curto de venda da casa; isso foi
testado nos dois sentidos e a decisão está registrada lá.

A visão Vendedores é **base de comissão**. Mudar uma dessas regras sem combinar antes
muda quanto alguém recebe.

## Regras que não se quebram

- **O CRM é somente leitura para este app.** O papel em `src/default-role.ts` não tem
  permissão de escrita, e é assim de propósito. Toda escrita no CRM é dos fluxos do n8n.
- **Campo novo no CRM se combina antes** com o dono do painel, e nunca se muda o formato
  de um campo que outra ferramenta já usa.
- **Nada de dado pessoal no chat**: nome de cliente, e-mail, telefone, WhatsApp, CPF. Nome
  de vendedor pode. Na tela, o telefone do cliente só existe dentro do endereço de um
  link, nunca escrito.
- **Nunca pedir chave, token ou senha no chat.**
- **Não mexer no rastreamento** (GTM, GA4, fluxos do n8n, `@petbee/tracking`) sem combinar.
- **Nunca ler o fluxo "Venda Offline — Contrato v2" inteiro** no n8n: ele contém um
  segredo.
- **Nenhuma rotina automática** (cron, agendamento, monitoramento) sem pedido explícito.
- **Propor, esperar o "ok", executar.** O dono do painel é não técnico: português simples,
  uma decisão por vez, hipótese em vez de conclusão, e número conferido duas vezes antes
  de afirmar.

## Convenções do código

- Arquivos abaixo de 300 linhas. As telas ficam em `src/painel/`, o orquestrador em
  `src/components/painel-periodo.front-component.tsx`.
- Comentários em português, curtos, explicando o PORQUÊ, colados na regra que explicam.
- Este app não tem prettier configurado: não reformate um arquivo inteiro num commit de
  conteúdo.
- O componente roda num Web Worker com DOM remoto: `title` não vira tooltip e o sinal de
  divisão sai parecido com `+` (escreva "sobre").

## Conferir e publicar

```bash
yarn typecheck && yarn twenty dev:build
```

A publicação é na VPS e quem roda é o dono do painel, depois do merge na `main`:

```bash
ssh root@srv1897290.hstgr.cloud 'cd /opt/twenty-repo && git pull origin main && cd petbee/deploy && ./publicar-paineis.sh apply'
```

O plano esperado é `0 to add, 1 to change, 0 to destroy`. O deploy automático do GitHub
só faz `git pull` na VPS, e já falhou por rede mais de uma vez, então o `git pull` do
comando acima é proposital.
