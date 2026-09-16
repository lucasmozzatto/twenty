// Rótulos copiados dos metadados do workspace em 16/09/2026. Opção nova que
// não estiver aqui aparece com o valor "legível" (CHATGPT → Chatgpt), então
// esquecer de atualizar aqui não quebra a tela.

const ORIGEM: Record<string, string> = {
  INDICACAO_CLINICA: 'Indicação - Clínica',
  INDICACAO_CLIENTE: 'Indicação - Cliente',
  GOOGLE_ADS: 'Google Ads',
  FACEBOOK_ADS: 'Facebook Ads',
  INSTAGRAM_ADS: 'Instagram Ads',
  CLIENTE: 'Cliente',
  CADASTRO_DIRETO: 'Cadastro Direto',
  INFLUENCER: 'Influencer',
  CORRETOR: 'Corretor',
  ROLETA_DA_SORTE: 'Roleta da Sorte',
  ORGANIC_SEARCH: 'Organic Search',
  ORGANIC_SOCIAL: 'Organic Social',
  TOUR: 'Tour',
  PARCEIROS: 'Parceiros',
  FUP_AUTO: 'FUP_auto',
  OUTROS: 'Outros',
  PV: 'PV',
  CHATGPT: 'ChatGPT',
};

const CANAL: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  WHATSAPP_CLIENTES: 'WhatsApp Clientes',
  ONBOARDING: 'Onboarding',
  INDICACAO: 'Indicação',
  FORMULARIO: 'Formulário',
  INSTAGRAM: 'Instagram',
  OUTBOUND: 'Outbound',
  OUTROS: 'Outros',
};

const ETAPA: Record<string, string> = {
  NOVO_LEAD: 'Novo Lead',
  EM_QUALIFICACAO: 'Em qualificação',
  EM_NEGOCIACAO: 'Em negociação',
  FECHAMENTO: 'Fechamento',
  BREAK: 'Break',
  WON: 'Ganho',
  LOST: 'Perdido',
};

const MOTIVO_LOST: Record<string, string> = {
  FALTA_DE_RETORNO_QF: 'Falta de retorno - QF',
  REGIAO_NAO_ATENDIDA_QF: 'Região não atendida - QF',
  PET_DESQUALIFICADO_QF: 'Pet desqualificado - QF',
  LEAD_DESQUALIFICADO_QF: 'Lead desqualificado - QF',
  NUMERO_INVALIDO_QF: 'Número inválido - QF',
  PAROU_DE_RESPONDER: 'Parou de responder',
  NAO_GOSTOU_SEM_INTERESSE: 'Não gostou / sem interesse',
  BUDGET_FORA_DO_ORCAMENTO: 'Fora do orçamento',
  TIMING_VAI_FECHAR_PRA_FRENTE: 'Timing - fecha à frente',
  CONCORRENTE: 'Concorrente',
  FALTA_DE_COBERTURA_ESPECIFICA: 'Falta de cobertura',
  FORMA_DE_PAGAMENTO: 'Forma de pagamento',
  CLINICA: 'Preferiu clínica',
  JA_E_CLIENTE_FECHOU_COM_OUTRO_NOME: 'Já é cliente / outro nome',
  PET_10: 'Pet 10+',
  SEM_INTERESSE_JA_TEM_PLANO_OT: 'Já tem outro plano',
};

// Etapas em aberto, na ordem do funil. Fora daqui ficam só Ganho e Perdido.
export const ETAPAS_ABERTAS = [
  'NOVO_LEAD',
  'EM_QUALIFICACAO',
  'EM_NEGOCIACAO',
  'FECHAMENTO',
  'BREAK',
] as const;

// Etapas que contam como "qualificado": alguém conversou de verdade.
export const ETAPAS_EM_NEGOCIACAO = ['EM_NEGOCIACAO', 'FECHAMENTO'];

// Só os motivos que implicam conversa real. Os motivos "QF" (qualificação) e
// "já é cliente" ficam fora: ali nunca houve contato.
export const MOTIVOS_COM_CONVERSA = [
  'BUDGET_FORA_DO_ORCAMENTO',
  'CONCORRENTE',
  'NAO_GOSTOU_SEM_INTERESSE',
  'TIMING_VAI_FECHAR_PRA_FRENTE',
  'FALTA_DE_COBERTURA_ESPECIFICA',
  'CLINICA',
  'PAROU_DE_RESPONDER',
  'FORMA_DE_PAGAMENTO',
  'SEM_INTERESSE_JA_TEM_PLANO_OT',
];

const legivel = (valor: string): string =>
  valor
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, (letra) => letra.toUpperCase());

const traduzir =
  (mapa: Record<string, string>, vazio: string) =>
  (chave: string | null): string =>
    chave === null ? vazio : (mapa[chave] ?? legivel(chave));

export const rotuloOrigem = traduzir(ORIGEM, 'Sem origem');
export const rotuloCanal = traduzir(CANAL, 'Sem canal');
export const rotuloEtapa = traduzir(ETAPA, 'Sem etapa');
export const rotuloMotivoLost = traduzir(MOTIVO_LOST, 'Sem motivo');
