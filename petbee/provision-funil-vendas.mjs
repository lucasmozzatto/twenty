// Fase 1 — Funil Vendas (Bitrix categoria 0) espelhado no objeto Opportunity
// do Twenty. Idempotente: pode rodar de novo sem estragar nada.
// Uso: TWENTY_API_KEY=... [TWENTY_API_URL=...] node provision-funil-vendas.mjs
const API_URL = process.env.TWENTY_API_URL || 'https://crm.petbeetools.com.br';
const API_KEY = process.env.TWENTY_API_KEY;
if (!API_KEY) throw new Error('Defina TWENTY_API_KEY');

const gql = async (query, variables = {}) => {
  const res = await fetch(`${API_URL}/metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join(' | '));
  return json.data;
};

// valor de opção: MAIÚSCULO, sem acento, só letra/número/underscore
const optionValue = (label) =>
  label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const PALETTE = ['blue', 'turquoise', 'purple', 'sky', 'orange', 'pink', 'yellow', 'green', 'red', 'gray'];
const toOptions = (labels, colorOf) =>
  labels.map((label, position) => ({
    value: optionValue(label),
    label,
    color: colorOf ? colorOf(label, position) : PALETTE[position % PALETTE.length],
    position,
  }));

// Funil "por tarefa" (decisão do Lucas, 2026-08-14): etapas medem venda;
// a cadência de FUP vira tarefa com vencimento + contador no card.
// Break = estacionamento com FUP de resgate após 60 dias, antes do Lost.
// Na importação do histórico: FUP 0-5 → Em negociação (fupNumero = N),
// FUP Break → Break, Qualificação → Em qualificação.
const ETAPAS = ['Novo Lead', 'Em qualificação', 'Em negociação', 'Fechamento', 'Break', 'Won', 'Lost'];
const corEtapa = (label) =>
  label === 'Won' ? 'green'
  : label === 'Lost' ? 'red'
  : label === 'Novo Lead' ? 'blue'
  : label === 'Em qualificação' ? 'sky'
  : label === 'Break' ? 'yellow'
  : label === 'Fechamento' ? 'orange'
  : 'turquoise';

// Campos vivos do Bitrix (medidos por amostragem) + âncora
const CAMPOS = [
  { name: 'idBitrix', label: 'ID Bitrix', type: 'TEXT', icon: 'IconLink' },
  { name: 'fupNumero', label: 'FUP nº', type: 'NUMBER', icon: 'IconRepeat' },
  { name: 'proximoContato', label: 'Próximo contato', type: 'DATE_TIME', icon: 'IconCalendarTime' },
  { name: 'canal', label: 'Canal', type: 'SELECT', icon: 'IconRoute', options: toOptions(['WhatsApp', 'WhatsApp Clientes', 'Onboarding', 'Indicação', 'Formulário', 'Instagram', 'Outbound', 'Outros']) },
  { name: 'origem', label: 'Origem', type: 'SELECT', icon: 'IconDoorEnter', options: toOptions(['Indicação - Clínica', 'Indicação - Cliente', 'Google Ads', 'Facebook Ads', 'Instagram Ads', 'Cliente', 'Cadastro Direto', 'Influencer', 'Corretor', 'Roleta da Sorte', 'Organic Search', 'Organic Social', 'Tour', 'Parceiros', 'FUP_auto', 'Outros', 'PV']) },
  { name: 'whatsapp', label: 'WhatsApp', type: 'TEXT', icon: 'IconBrandWhatsapp' },
  { name: 'motivoLost', label: 'Motivo de Lost', type: 'SELECT', icon: 'IconThumbDown', options: toOptions(['Falta de Retorno - QF', 'Região não atendida - QF', 'Pet desqualificado - QF', 'Lead desqualificado - QF', 'Numero inválido - QF', 'Parou de responder', 'Não gostou/Sem interesse', 'Budget/Fora do orçamento', 'Timing/Vai fechar pra frente', 'Concorrente', 'Falta de cobertura específica', 'Forma de pagamento', 'Clínica', 'Já é cliente/Fechou com outro nome', 'Pet 10+', 'Sem interesse/já tem plano - OT']) },
  { name: 'testeLp', label: 'Teste LP', type: 'SELECT', icon: 'IconFlask', options: toOptions(['A', 'B', 'Londrina', 'Black', 'AnoNovo', 'LP (quandoopioracontece)', 'LP (ongoing)', 'LP (calculadorapet)', 'LP (site_calculadorapet)', 'Copa26', 'LP (pioracontece_black)', 'ClubePetbee', 'LP MaedePet', 'LP-site', 'Quiz', 'LP-sem-copart', 'LP-gatos']) },
  { name: 'clientIdGa4', label: 'ClientID GA4', type: 'TEXT', icon: 'IconChartLine' },
  { name: 'fechamento', label: 'Fechamento', type: 'SELECT', icon: 'IconCheckbox', options: toOptions(['Comercial', 'Direto', 'Recompra']) },
  { name: 'pagamento', label: 'Pagamento', type: 'SELECT', icon: 'IconCreditCard', options: toOptions(['Cartão', 'Boleto', 'Pix']) },
  { name: 'ativacao', label: 'Ativação', type: 'SELECT', icon: 'IconBolt', options: toOptions(['Automática', 'Manual']) },
  { name: 'cidade', label: 'Cidade', type: 'SELECT', icon: 'IconMapPin', options: toOptions(['Curitiba', 'São José dos Pinhais', 'Pato Branco', 'Londrina', 'Pinhais', 'Colombo', 'Araucária', 'Fazenda Rio Grande', 'Campo Largo', 'Cambé']) },
];

const data = await gql(`query O($f: ObjectFilter!, $p: CursorPaging!) { objects(filter: $f, paging: $p) { edges { node { id nameSingular labelSingular labelPlural fieldsList { id name options } } } } }`, { f: {}, p: { first: 300 } });
const opp = data.objects.edges.map((e) => e.node).find((o) => o.nameSingular === 'opportunity');
if (!opp) throw new Error('Objeto opportunity não encontrado');

// 1) Rótulos do objeto: Opportunity → Negócio (vocabulário do time)
if (opp.labelSingular !== 'Negócio') {
  await gql(`mutation U($input: UpdateOneObjectInput!) { updateOneObject(input: $input) { id } }`,
    { input: { id: opp.id, update: { labelSingular: 'Negócio', labelPlural: 'Negócios' } } });
  console.log('✓ objeto renomeado: Negócio / Negócios');
} else console.log('• objeto já se chama Negócio');

// 2) Etapas do kanban = etapas do funil Vendas
const stageField = opp.fieldsList.find((f) => f.name === 'stage');
const atuais = (stageField.options || []).map((o) => o.value).join(',');
const novas = toOptions(ETAPAS, corEtapa);
if (atuais !== novas.map((o) => o.value).join(',')) {
  await gql(`mutation U($input: UpdateOneFieldMetadataInput!) { updateOneField(input: $input) { id } }`,
    { input: { id: stageField.id, update: { options: novas, defaultValue: "'NOVO_LEAD'", label: 'Etapa' } } });
  console.log(`✓ etapas do funil configuradas (${ETAPAS.length})`);
} else console.log('• etapas já configuradas');

// 3) Campos do card
for (const campo of CAMPOS) {
  if (opp.fieldsList.some((f) => f.name === campo.name)) {
    console.log(`• opportunity.${campo.name} já existe`);
    continue;
  }
  await gql(`mutation C($input: CreateOneFieldMetadataInput!) { createOneField(input: $input) { id } }`,
    { input: { field: { ...campo, objectMetadataId: opp.id } } });
  console.log(`✓ criado opportunity.${campo.name} ("${campo.label}")`);
}
console.log('\nPronto. Abra Negócios no CRM e confira o kanban por Etapa.');
