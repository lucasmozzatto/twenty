// O percurso de cada lead no funil e as três tabelas da jornada na visão Ads.
// Pedido do dono do painel em 23/09/2026: "dos leads que são do Ads, como está
// a jornada deles", por exemplo quantos vão de qualificação direto para
// perdido.
//
// Um lead PASSOU POR uma etapa se ela aparece em qualquer lado de uma mudança
// do histórico (de onde saiu ou para onde foi) ou se é a etapa de hoje. O lado
// "de onde saiu" importa porque a criação do card não grava a etapa: quem
// nasceu em negociação e foi perdido só deixa "negociação → perdido".
import {
  filtroDeEntradaEm,
  listarMudancas,
  type MudancaDeEtapa,
} from 'src/painel/linha-do-tempo';
import { ETAPAS_DE_SAIDA, type EtapaDeSaida } from 'src/painel/perdas';
import { ETAPAS_EM_NEGOCIACAO } from 'src/painel/rotulos';

// Na ordem do quadro da tela "Onde estão hoje".
export const ETAPAS_DE_HOJE = [
  'NOVO_LEAD',
  'EM_QUALIFICACAO',
  'EM_NEGOCIACAO',
  'FECHAMENTO',
  'BREAK',
  'WON',
  'LOST',
] as const;

// Os degraus do funil, em ordem. Break fica fora: é pausa, não avanço.
export const DEGRAUS = [
  'EM_QUALIFICACAO',
  'EM_NEGOCIACAO',
  'FECHAMENTO',
  'WON',
] as const;

export type Degrau = (typeof DEGRAUS)[number];

export type Percurso = {
  // Passou por negociação ou fechamento: é a coluna Qualificados.
  qualificado: boolean;
  // Índice em DEGRAUS do mais alto que alcançou; -1 é "nunca saiu de Novo
  // Lead". Ganho só conta para quem está em Ganho hoje e passou por
  // negociação: quem comprou sem passar vai para uma linha própria.
  alcance: number;
  passouPorBreak: boolean;
  // De onde saiu na última vez que virou Perdido. Só para quem está perdido
  // hoje; nos outros é null.
  saiuDe: EtapaDeSaida | null;
};

export const resumirPercurso = (
  etapaDeHoje: string,
  mudancas: MudancaDeEtapa[],
): Percurso => {
  const vistas = new Set<string>([etapaDeHoje]);
  let ultimaPerda: { antes: string; quando: string } | null = null;

  for (const mudanca of mudancas) {
    const etapa = mudanca.properties?.diff?.stage;

    // "De Ganho para Ganho" não é mudança: alguém editou outro campo.
    if (etapa?.after === undefined || etapa.after === etapa.before) continue;

    vistas.add(etapa.after);
    if (etapa.before) vistas.add(etapa.before);

    const virouPerdido = etapa.after === 'LOST' && Boolean(etapa.before);

    if (virouPerdido && (ultimaPerda === null || ultimaPerda.quando < mudanca.happensAt)) {
      ultimaPerda = { antes: etapa.before as string, quando: mudanca.happensAt };
    }
  }

  const qualificado = ETAPAS_EM_NEGOCIACAO.some((etapa) => vistas.has(etapa));
  let alcance = -1;

  DEGRAUS.forEach((degrau, indice) => {
    const chegou =
      degrau === 'WON' ? etapaDeHoje === 'WON' && qualificado : vistas.has(degrau);

    if (chegou) alcance = indice;
  });

  // Mesma tradução da tabela de perdas da visão Vendedores: etapa fora da
  // lista, ou perda sem registro no histórico, vira "Sem registro".
  const antes = ultimaPerda?.antes;
  const saiuDe: EtapaDeSaida =
    antes !== undefined && antes !== 'SEM_REGISTRO' && ETAPAS_DE_SAIDA.includes(antes as EtapaDeSaida)
      ? (antes as EtapaDeSaida)
      : 'SEM_REGISTRO';

  return {
    qualificado,
    alcance,
    passouPorBreak: vistas.has('BREAK'),
    saiuDe: etapaDeHoje === 'LOST' ? saiuDe : null,
  };
};

// Todas as mudanças de etapa destes negócios, em qualquer data. Em lotes,
// para a lista de identificadores não crescer sem limite numa consulta só.
export const buscarMudancasDeEtapa = async (
  ids: string[],
): Promise<{ porNegocio: Map<string, MudancaDeEtapa[]>; truncado: boolean }> => {
  const porNegocio = new Map<string, MudancaDeEtapa[]>();
  const TAMANHO_DO_LOTE = 150;
  let truncado = false;

  for (let inicio = 0; inicio < ids.length; inicio += TAMANHO_DO_LOTE) {
    const pagina = await listarMudancas({
      and: [
        { targetOpportunityId: { in: ids.slice(inicio, inicio + TAMANHO_DO_LOTE) } },
        filtroDeEntradaEm(ETAPAS_DE_HOJE),
      ],
    });

    truncado = truncado || pagina.truncado;

    for (const mudanca of pagina.mudancas) {
      const negocio = mudanca.targetOpportunityId;

      if (negocio === null) continue;
      porNegocio.set(negocio, [...(porNegocio.get(negocio) ?? []), mudanca]);
    }
  }

  return { porNegocio, truncado };
};

export type LeadNoFunil = { stage: string; percurso: Percurso };

export type JornadaDosLeads = {
  criados: number;
  // Quantos chegaram pelo menos até cada degrau, sem os que compraram sem
  // passar por negociação. Mesma ordem de DEGRAUS.
  chegaram: number[];
  ganhoSemNegociacao: number;
  hoje: Record<(typeof ETAPAS_DE_HOJE)[number], number>;
  perdidos: number;
  // Para cada etapa de saída: quantos perdidos saíram dali e quantos leads
  // chegaram lá. `chegaram` é null em "Sem registro", que não é etapa.
  saidas: { etapa: EtapaDeSaida; perdidos: number; chegaram: number | null }[];
};

export const montarJornada = (leads: LeadNoFunil[]): JornadaDosLeads => {
  const chegaram = DEGRAUS.map(() => 0);
  const hoje = Object.fromEntries(ETAPAS_DE_HOJE.map((etapa) => [etapa, 0])) as JornadaDosLeads['hoje'];
  const porSaida = new Map<EtapaDeSaida, number>();
  let ganhoSemNegociacao = 0;
  let passaramPorBreak = 0;

  for (const { stage, percurso } of leads) {
    if (stage in hoje) hoje[stage as keyof JornadaDosLeads['hoje']] += 1;

    if (percurso.saiuDe !== null) {
      porSaida.set(percurso.saiuDe, (porSaida.get(percurso.saiuDe) ?? 0) + 1);
    }

    // Quem comprou sem passar por negociação fica fora dos degraus: senão o
    // funil mostraria mais vendas do que gente que chegou em fechamento.
    if (stage === 'WON' && !percurso.qualificado) {
      ganhoSemNegociacao += 1;
      continue;
    }

    for (let indice = 0; indice <= percurso.alcance; indice += 1) chegaram[indice] += 1;
    if (percurso.passouPorBreak) passaramPorBreak += 1;
  }

  // Quantos chegaram na etapa de onde o perdido saiu: é o denominador da
  // "perda na etapa". Todo perdido que saiu de uma etapa está nele.
  const chegaramEm = (etapa: EtapaDeSaida): number | null => {
    if (etapa === 'SEM_REGISTRO') return null;
    if (etapa === 'NOVO_LEAD') return leads.length;
    if (etapa === 'BREAK') return passaramPorBreak;

    return chegaram[DEGRAUS.indexOf(etapa)];
  };

  return {
    criados: leads.length,
    chegaram,
    ganhoSemNegociacao,
    hoje,
    perdidos: hoje.LOST,
    saidas: ETAPAS_DE_SAIDA.map((etapa) => ({
      etapa,
      perdidos: porSaida.get(etapa) ?? 0,
      chegaram: chegaramEm(etapa),
    })),
  };
};
