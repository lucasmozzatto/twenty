// Rótulos copiados dos metadados do workspace em 17/09/2026. Opção nova que
// não estiver aqui aparece com o valor "legível" (CHATGPT → Chatgpt), então
// esquecer de atualizar aqui não quebra a tela.
import { type VereditoAssinatura, type VereditoVenda } from 'src/painel/dados';
import { type Tema } from 'src/painel/tema';

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

const STATUS_ASSINATURA: Record<string, string> = {
  ATIVA: 'Ativa',
  BLOQUEADA: 'Bloqueada',
  CANCELADA: 'Cancelada',
};

const TIPO_FECHAMENTO: Record<string, string> = {
  COMERCIAL: 'Comercial',
  DIRETO: 'Direto',
  RECOMPRA: 'Recompra',
};

const FUNIL: Record<string, string> = {
  VENDAS: 'Vendas',
  CORRETORAS: 'Corretoras',
};

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
export const rotuloStatusAssinatura = traduzir(STATUS_ASSINATURA, 'Sem status');
export const rotuloTipoFechamento = traduzir(TIPO_FECHAMENTO, '—');
export const rotuloFunil = traduzir(FUNIL, '—');

// Os vereditos são os valores dos campos "Conferência banco" (negócio) e
// "Conferência funil" (assinatura), gravados pela conciliação diária.
// "Aguardando" não é valor do campo: é o vazio, antes da primeira rodada.
export const ROTULO_VEREDITO_VENDA: Record<VereditoVenda, string> = {
  CONFERIDA: 'Conferida',
  VALOR_DIVERGENTE: 'Valor divergente',
  SEM_ASSINATURA: 'Sem assinatura',
  AGUARDANDO: 'Aguardando conciliação',
};

export const ROTULO_VEREDITO_ASSINATURA: Record<VereditoAssinatura, string> = {
  COM_VENDA: 'Com venda',
  SEM_VENDA: 'Sem venda',
  CORTESIA: 'Cortesia',
  AGUARDANDO: 'Aguardando conciliação',
};

// Verde é "bate", vermelho é "olhar", laranja é "falta a outra ponta" e cinza
// é "ainda não julgado" ou "não conta".
export const corDoVereditoVenda = (veredito: VereditoVenda, tema: Tema): string =>
  ({
    CONFERIDA: tema.verde,
    VALOR_DIVERGENTE: tema.vermelho,
    SEM_ASSINATURA: tema.laranja,
    AGUARDANDO: tema.suave,
  })[veredito];

export const corDoVereditoAssinatura = (
  veredito: VereditoAssinatura,
  tema: Tema,
): string =>
  ({
    COM_VENDA: tema.verde,
    SEM_VENDA: tema.vermelho,
    CORTESIA: tema.suave,
    AGUARDANDO: tema.suave,
  })[veredito];

export const corDoStatusAssinatura = (status: string | null, tema: Tema): string =>
  status === 'CANCELADA'
    ? tema.vermelho
    : status === 'BLOQUEADA'
      ? tema.laranja
      : tema.texto;
