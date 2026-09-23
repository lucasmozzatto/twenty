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

// Os degraus do funil, em ordem. Break e Fechamento ficam fora: são espera,
// não avanço. Fechamento é quando o lead promete fechar daqui a alguns dias,
// e a maior parte das vendas vai de negociação direto para Ganho; decidido
// com o dono do painel em 23/09/2026 olhar Fechamento num quadro à parte.
export const DEGRAUS = ['EM_QUALIFICACAO', 'EM_NEGOCIACAO', 'WON'] as const;

export type Degrau = (typeof DEGRAUS)[number];

export type Percurso = {
  // Passou por negociação ou fechamento: é a coluna Qualificados.
  qualificado: boolean;
  // Índice em DEGRAUS do mais alto que alcançou; -1 é "nunca saiu de Novo
  // Lead". Ganho só conta para quem está em Ganho hoje e passou por
  // negociação: quem comprou sem passar vai para uma linha própria.
  alcance: number;
  passouPorBreak: boolean;
  passouPorFechamento: boolean;
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
  // O degrau de negociação é o mesmo critério da coluna Qualificados, para os
  // dois números nunca discordarem: quem foi de qualificação direto para
  // Fechamento também conversou com um vendedor.
  const alcance =
    etapaDeHoje === 'WON' && qualificado
      ? DEGRAUS.indexOf('WON')
      : qualificado
        ? DEGRAUS.indexOf('EM_NEGOCIACAO')
        : vistas.has('EM_QUALIFICACAO')
          ? DEGRAUS.indexOf('EM_QUALIFICACAO')
          : -1;

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
    passouPorFechamento: vistas.has('FECHAMENTO'),
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
  // Quem está em Ganho sem ter passado por negociação: compra direta,
  // recompra ou card levado direto para Ganho. Fica fora da base do funil.
  ganhoSemNegociacao: number;
  // A base do funil: os criados menos os que compraram sem negociação.
  noFunil: number;
  // Quantos chegaram pelo menos até cada degrau. Mesma ordem de DEGRAUS.
  chegaram: number[];
  // Onde está hoje quem passou por Fechamento em algum momento.
  fechamento: {
    passaram: number;
    ganho: number;
    perdido: number;
    emFechamento: number;
    outraEtapa: number;
  };
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
  const fechamento = { passaram: 0, ganho: 0, perdido: 0, emFechamento: 0, outraEtapa: 0 };
  let ganhoSemNegociacao = 0;
  let passaramPorBreak = 0;

  for (const { stage, percurso } of leads) {
    if (stage in hoje) hoje[stage as keyof JornadaDosLeads['hoje']] += 1;

    if (percurso.saiuDe !== null) {
      porSaida.set(percurso.saiuDe, (porSaida.get(percurso.saiuDe) ?? 0) + 1);
    }

    // Quem comprou sem passar por negociação fica fora da base do funil: não
    // é perda no primeiro degrau, é venda que não usou o funil.
    if (stage === 'WON' && !percurso.qualificado) {
      ganhoSemNegociacao += 1;
      continue;
    }

    for (let indice = 0; indice <= percurso.alcance; indice += 1) chegaram[indice] += 1;
    if (percurso.passouPorBreak) passaramPorBreak += 1;

    if (percurso.passouPorFechamento) {
      fechamento.passaram += 1;
      if (stage === 'WON') fechamento.ganho += 1;
      else if (stage === 'LOST') fechamento.perdido += 1;
      else if (stage === 'FECHAMENTO') fechamento.emFechamento += 1;
      else fechamento.outraEtapa += 1;
    }
  }

  const noFunil = leads.length - ganhoSemNegociacao;

  // Quantos chegaram na etapa de onde o perdido saiu: é o denominador da
  // "perda na etapa". Todo perdido que saiu de uma etapa está nele.
  const chegaramEm = (etapa: EtapaDeSaida): number | null => {
    if (etapa === 'SEM_REGISTRO') return null;
    if (etapa === 'NOVO_LEAD') return noFunil;
    if (etapa === 'BREAK') return passaramPorBreak;
    if (etapa === 'FECHAMENTO') return fechamento.passaram;

    return chegaram[DEGRAUS.indexOf(etapa)];
  };

  return {
    criados: leads.length,
    ganhoSemNegociacao,
    noFunil,
    chegaram,
    fechamento,
    hoje,
    perdidos: hoje.LOST,
    saidas: ETAPAS_DE_SAIDA.map((etapa) => ({
      etapa,
      perdidos: porSaida.get(etapa) ?? 0,
      chegaram: chegaramEm(etapa),
    })),
  };
};
