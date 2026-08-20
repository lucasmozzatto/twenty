# Fluxos do n8n — Petbee

Fluxos prontos para importar em `https://n8n.petbeetools.com.br`.

## Porteiro Único (`porteiro-unico.json`)

A regra da casa: **nenhuma automação escreve lead no CRM diretamente** —
todas chamam este subfluxo, que garante que ninguém entra duplicado.

O que ele faz com cada `{ nome, email, telefone, origem }` recebido:

1. **Normaliza**: e-mail minúsculo/validado; telefone só dígitos, sem o 55,
   com chave DDD + 8 últimos dígitos (imune ao nono dígito).
2. **Descarta** quem não tem e-mail nem telefone válidos (política selada:
   sem contato ≠ lead) — devolve `resultado: descartado`.
3. **Busca no CRM** por e-mail exato OU telefone parecido, numa consulta só.
4. **Adota** se achou por e-mail, ou por telefone em casamento 1↔1 perfeito
   — devolve `resultado: adotado` + `personId` (não cria nada).
5. **Cria** o lead (com campo Origem preenchido) se não achou ninguém —
   devolve `resultado: criado` + `personId`.

## Teste do Porteiro (`teste-porteiro.json`)

Fluxo de um botão só: injeta um lead falso ("Lead Teste Porteiro") no
porteiro. Rodar 2× prova o upsert: 1ª vez `criado`, 2ª vez `adotado`,
e no CRM existe UM registro só.

## Como importar (uma vez)

1. **Credencial**: n8n → Credentials → Add credential → "Header Auth".
   - Name: `Twenty API`
   - Header Name: `Authorization`
   - Header Value: `Bearer SUA_CHAVE_DA_API` (crie uma chave própria para o
     n8n no Twenty: Settings → APIs)
2. **Importar**: num workflow novo, menu `⋯` (canto superior direito) →
   *Import from URL* → cole a URL raw do JSON no GitHub. Primeiro o
   porteiro, salve; depois o teste.
3. Nos nós "Buscar no CRM" e "Criar lead no CRM", selecione a credencial
   `Twenty API` se aparecer aviso vermelho. No teste, abra "Chamar o
   porteiro" e selecione o fluxo "Porteiro Único" na lista.

## Contrato de entrada do porteiro

| campo    | obrigatório | exemplo                       |
| -------- | ----------- | ----------------------------- |
| nome     | não         | "Maria Silva"                 |
| email    | não*        | "maria@gmail.com"             |
| telefone | não*        | "(41) 99859-5556", "5541..."  |
| origem   | recomendado | "lp-planos", "whatsapp-time"  |

\* pelo menos um dos dois precisa ser válido, senão o lead é descartado.
