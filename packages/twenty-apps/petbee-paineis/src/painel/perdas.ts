// De onde saem as perdas: para cada negócio perdido no período, de qual etapa
// ele saiu e por qual motivo. Responde as três perguntas que a tela de cima
// não responde: quem perdeu, em que etapa, e por quê.
//
// A perda entra pela MESMA régua da coluna Perdidos: está em Perdido hoje e a
// data de fechamento cai no período. O histórico de etapas entra só para
// dizer de onde o lead saiu; quando não há registro (lead criado já perdido,
// ou perda anterior ao início do histórico), a etapa fica 'SEM_REGISTRO'.
// Combinado com o dono do painel em 21/09/2026.
import { type Filtro, listarNegocios } from 'src/painel/crm';
import { type Falha, tentar } from 'src/painel/dados';
import {
  entrouEm,
  filtroDeEntradaEm,
  listarMudancas,
  type MudancaDeEtapa,
  SO_NEGOCIOS,
} from 'src/painel/linha-do-tempo';
import { limitesIso, type Periodo } from 'src/painel/periodo';

// Na ordem do funil; "Sem registro" por último, porque não é etapa de verdade.
export const ETAPAS_DE_SAIDA = [
  'NOVO_LEAD',
  'EM_QUALIFICACAO',
  'EM_NEGOCIACAO',
  'BREAK',
  'FECHAMENTO',
  'SEM_REGISTRO',
] as const;

export type EtapaDeSaida = (typeof ETAPAS_DE_SAIDA)[number];

// As duas primeiras são descarte antes de o lead chegar num vendedor.
export const ETAPAS_ANTES_DO_VENDEDOR: EtapaDeSaida[] = [
  'NOVO_LEAD',
  'EM_QUALIFICACAO',
];

export type PerdaClassificada = {
  id: string;
  ownerId: string | null;
  motivo: string | null;
  etapa: EtapaDeSaida;
  // Só para montar o link da conversa; o painel nunca escreve o número na
  // tela, ele vai dentro do endereço do link.
  whatsapp: string | null;
};

export type Perdas = {
  itens: PerdaClassificada[];
  truncado: boolean;
  falhas: Falha[];
};

type NegocioPerdido = {
  id: string;
  ownerId: string | null;
  motivoLost: string | null;
  whatsapp: string | null;
};

const noPeriodo = (campo: string, inicio: string, fim: string): Filtro[] => [
  { [campo]: { gte: inicio } },
  { [campo]: { lt: fim } },
];

export const buscarPerdas = async (periodo: Periodo): Promise<Perdas> => {
  const { inicio, fim } = limitesIso(periodo);
  const falhas: Falha[] = [];

  const [perdidos, mudancas] = await Promise.all([
    tentar(
      'negócios perdidos no período',
      listarNegocios<NegocioPerdido>(
        {
          and: [
            { funnel: { eq: 'VENDAS' } },
            { stage: { eq: 'LOST' } },
            ...noPeriodo('closeDate', inicio, fim),
          ],
        },
        'id ownerId motivoLost whatsapp',
      ),
      { nos: [] as NegocioPerdido[], truncado: false },
      falhas,
    ),
    tentar(
      'etapa de onde saíram as perdas',
      listarMudancas({
        and: [
          SO_NEGOCIOS,
          filtroDeEntradaEm(['LOST']),
          ...noPeriodo('happensAt', inicio, fim),
        ],
      }),
      { mudancas: [] as MudancaDeEtapa[], truncado: false },
      falhas,
    ),
  ]);

  // Um negócio pode ter sido perdido, reaberto e perdido de novo: vale a
  // etapa da ÚLTIMA vez, que é a que corresponde ao estado de hoje.
  const ultimaSaida = new Map<string, { etapa: string; quando: string }>();

  for (const mudanca of mudancas.mudancas) {
    const negocio = mudanca.targetOpportunityId;
    const antes = mudanca.properties?.diff?.stage?.before;

    if (negocio === null || antes === undefined || antes === null) continue;
    if (!entrouEm(mudanca, ['LOST'])) continue;

    const registrada = ultimaSaida.get(negocio);

    if (registrada === undefined || registrada.quando < mudanca.happensAt) {
      ultimaSaida.set(negocio, { etapa: antes, quando: mudanca.happensAt });
    }
  }

  const conhecida = (etapa: string | undefined): EtapaDeSaida =>
    ETAPAS_DE_SAIDA.includes(etapa as EtapaDeSaida) && etapa !== 'SEM_REGISTRO'
      ? (etapa as EtapaDeSaida)
      : 'SEM_REGISTRO';

  const itens = perdidos.nos.map((negocio) => ({
    id: negocio.id,
    ownerId: negocio.ownerId,
    motivo: negocio.motivoLost,
    etapa: conhecida(ultimaSaida.get(negocio.id)?.etapa),
    whatsapp: negocio.whatsapp,
  }));

  return {
    itens,
    truncado: perdidos.truncado || mudancas.truncado,
    falhas,
  };
};

export type LinhaDePerdas = {
  chave: string | null;
  porEtapa: Record<EtapaDeSaida, number>;
  total: number;
};

const vazio = (): Record<EtapaDeSaida, number> => ({
  NOVO_LEAD: 0,
  EM_QUALIFICACAO: 0,
  EM_NEGOCIACAO: 0,
  BREAK: 0,
  FECHAMENTO: 0,
  SEM_REGISTRO: 0,
});

// Agrupa por uma chave qualquer (dono ou motivo) com as etapas nas colunas.
const agrupar = (
  itens: PerdaClassificada[],
  chaveDe: (item: PerdaClassificada) => string | null,
): LinhaDePerdas[] => {
  const linhas = new Map<string | null, LinhaDePerdas>();

  for (const item of itens) {
    const chave = chaveDe(item);
    const linha = linhas.get(chave) ?? { chave, porEtapa: vazio(), total: 0 };

    linha.porEtapa[item.etapa] += 1;
    linha.total += 1;
    linhas.set(chave, linha);
  }

  // Maior primeiro; "sem dono" e "sem motivo" no fim, porque não são pessoa
  // nem escolha de ninguém.
  return [...linhas.values()].sort((a, b) => {
    if (a.chave === null) return 1;
    if (b.chave === null) return -1;

    return b.total - a.total;
  });
};

export const perdasPorVendedor = (
  itens: PerdaClassificada[],
  membros: string[],
  ignorar: (dono: string) => boolean,
): LinhaDePerdas[] => {
  const linhas = agrupar(itens, (item) => item.ownerId);
  const presentes = new Set(linhas.map((linha) => linha.chave));

  // Todo vendedor tem linha, como na tabela de cima, mesmo sem perda nenhuma.
  for (const membro of membros) {
    if (presentes.has(membro) || ignorar(membro)) continue;
    linhas.push({ chave: membro, porEtapa: vazio(), total: 0 });
  }

  return linhas;
};

export const perdasPorMotivo = (
  itens: PerdaClassificada[],
  dono: string | null | 'time',
): LinhaDePerdas[] =>
  agrupar(
    dono === 'time' ? itens : itens.filter((item) => item.ownerId === dono),
    (item) => item.motivo,
  );

export const somarLinhas = (linhas: LinhaDePerdas[]): LinhaDePerdas => {
  const total: LinhaDePerdas = { chave: 'total', porEtapa: vazio(), total: 0 };

  for (const linha of linhas) {
    for (const etapa of ETAPAS_DE_SAIDA) total.porEtapa[etapa] += linha.porEtapa[etapa];
    total.total += linha.total;
  }

  return total;
};

// O link abre a conversa na ferramenta de atendimento da casa, no mesmo
// formato que o CRM já usa na coluna WhatsApp das tarefas: o endereço leva
// os dígitos em `tel`. O número vai só dentro do endereço; na tela aparece a
// palavra, nunca o telefone. Sem número utilizável, não há link.
const ATENDIMENTO = 'https://wpp.petbeetools.com.br/';

export const conversaNoWhatsapp = (numero: string | null): string | null => {
  const digitos = (numero ?? '').replace(/\D/g, '');

  // 10 ou 11 dígitos é DDD mais número, sem o país: falta o 55. Acima disso
  // o país já veio. A conta é por tamanho, e não por "começa com 55", porque
  // 55 também é o DDD de Santa Maria.
  const completo =
    digitos.length === 10 || digitos.length === 11 ? `55${digitos}` : digitos;

  return completo.length < 12 || completo.length > 15
    ? null
    : `${ATENDIMENTO}?tel=${completo}`;
};
