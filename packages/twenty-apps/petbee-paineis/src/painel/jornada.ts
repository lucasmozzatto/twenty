// A jornada: de cada etapa, para onde os negócios foram. Uma linha por etapa
// de partida, uma coluna por destino, e duas lentes sobre o mesmo lote:
//
//   PRÓXIMO PASSO  — para cada entrada na etapa dentro do período, qual foi a
//                    linha seguinte do histórico. Conta entradas: quem voltou
//                    para negociação depois de um Break conta duas vezes lá,
//                    porque foram dois passos de verdade.
//   SITUAÇÃO HOJE  — dos negócios que entraram na etapa no período, onde cada
//                    um está agora. Conta negócios distintos. É a lente que
//                    responde "foi para Break e depois virou Ganho ou Perdido?".
//
// "Entrar em Novo Lead" é ser criado. Se a automação criar o negócio já em
// outra etapa, ele entra nessa etapa e aparece na nota "criados já em outra
// etapa", para não sumir da conta.
import { listarNegocios, listarNegociosPorId } from 'src/painel/crm';
import { type Falha, tentar } from 'src/painel/dados';
import {
  listarMudancas,
  type MudancaDeEtapa,
  SO_NEGOCIOS,
} from 'src/painel/linha-do-tempo';
import { limitesIso, type Periodo, recortarNoHistorico } from 'src/painel/periodo';

export const ETAPAS_DE_PARTIDA = [
  'NOVO_LEAD',
  'EM_QUALIFICACAO',
  'EM_NEGOCIACAO',
  'FECHAMENTO',
  'BREAK',
] as const;

export const DESTINOS = [
  'NOVO_LEAD',
  'EM_QUALIFICACAO',
  'EM_NEGOCIACAO',
  'FECHAMENTO',
  'BREAK',
  'WON',
  'LOST',
  'AINDA_AQUI',
] as const;

export type Destino = (typeof DESTINOS)[number];

export type LinhaJornada = {
  etapa: string;
  entraram: number;
  destinos: Record<Destino, number>;
};

export type Jornada = {
  proximoPasso: LinhaJornada[];
  situacaoHoje: LinhaJornada[];
  criadosEmOutraEtapa: { etapa: string; quantos: number }[];
  periodo: Periodo;
  cortadoNoInicio: boolean;
  truncado: boolean;
  falhas: Falha[];
};

type NegocioHoje = { id: string; stage: string; createdAt: string };

type Passo = { antes: string | undefined; depois: string; quando: string };

type Historia = {
  criadoEm: string;
  etapaHoje: string;
  // Só mudanças de verdade (antes ≠ depois), em ordem de hora.
  passos: Passo[];
};

type Entrada = { id: string; etapa: string; indiceDoProximoPasso: number };

const linhaVazia = (etapa: string): LinhaJornada => ({
  etapa,
  entraram: 0,
  destinos: {
    NOVO_LEAD: 0,
    EM_QUALIFICACAO: 0,
    EM_NEGOCIACAO: 0,
    FECHAMENTO: 0,
    BREAK: 0,
    WON: 0,
    LOST: 0,
    AINDA_AQUI: 0,
  },
});

const comoDestino = (etapa: string): Destino =>
  (DESTINOS as readonly string[]).includes(etapa) ? (etapa as Destino) : 'AINDA_AQUI';

const passoDe = (mudanca: MudancaDeEtapa): Passo | null => {
  const etapa = mudanca.properties?.diff?.stage;

  if (etapa?.after === undefined || etapa.after === etapa.before) return null;

  return { antes: etapa.before, depois: etapa.after, quando: mudanca.happensAt };
};

// As entradas em etapa dentro do período, negócio a negócio. Criação conta
// como entrada na etapa inicial, que é o "antes" do primeiro passo ou, sem
// passo nenhum, a etapa de hoje.
const listarEntradas = (
  historias: Map<string, Historia>,
  inicio: string,
  fim: string,
): Entrada[] => {
  const entradas: Entrada[] = [];

  for (const [id, historia] of historias) {
    if (historia.criadoEm >= inicio && historia.criadoEm < fim) {
      const inicial = historia.passos[0]?.antes ?? historia.etapaHoje;

      entradas.push({ id, etapa: inicial, indiceDoProximoPasso: 0 });
    }

    historia.passos.forEach((passo, indice) => {
      if (passo.quando >= inicio && passo.quando < fim) {
        entradas.push({ id, etapa: passo.depois, indiceDoProximoPasso: indice + 1 });
      }
    });
  }

  return entradas;
};

const contar = (
  entradas: Entrada[],
  historias: Map<string, Historia>,
  lente: 'proximo-passo' | 'situacao-hoje',
): LinhaJornada[] => {
  const linhas = new Map(ETAPAS_DE_PARTIDA.map((etapa) => [etapa, linhaVazia(etapa)]));
  const jaContado = new Set<string>();

  for (const entrada of entradas) {
    const linha = linhas.get(entrada.etapa as (typeof ETAPAS_DE_PARTIDA)[number]);
    const historia = historias.get(entrada.id);

    if (linha === undefined || historia === undefined) continue;

    // Na lente de hoje cada negócio conta uma vez por etapa.
    const chave = `${entrada.id}:${entrada.etapa}`;

    if (lente === 'situacao-hoje') {
      if (jaContado.has(chave)) continue;
      jaContado.add(chave);
    }

    const destino: Destino =
      lente === 'proximo-passo'
        ? comoDestino(historia.passos[entrada.indiceDoProximoPasso]?.depois ?? 'AINDA_AQUI')
        : historia.etapaHoje === entrada.etapa
          ? 'AINDA_AQUI'
          : comoDestino(historia.etapaHoje);

    linha.entraram += 1;
    linha.destinos[destino] += 1;
  }

  return [...linhas.values()];
};

export const buscarJornada = async (periodoPedido: Periodo): Promise<Jornada> => {
  const { periodo, cortado } = recortarNoHistorico(periodoPedido);
  const { inicio, fim } = limitesIso(periodo);
  const falhas: Falha[] = [];

  const [mudancas, criados] = await Promise.all([
    tentar(
      'histórico de etapas (jornada)',
      listarMudancas({
        and: [
          SO_NEGOCIOS,
          { properties: { like: '%"stage"%' } },
          { happensAt: { gte: inicio } },
          { happensAt: { lt: fim } },
        ],
      }),
      { mudancas: [] as MudancaDeEtapa[], truncado: false },
      falhas,
    ),
    tentar(
      'negócios criados (jornada)',
      listarNegocios<NegocioHoje>(
        { and: [{ createdAt: { gte: inicio } }, { createdAt: { lt: fim } }] },
        'id stage createdAt',
      ),
      { nos: [] as NegocioHoje[], truncado: false },
      falhas,
    ),
  ]);

  const negocios = new Map(criados.nos.map((negocio) => [negocio.id, negocio]));
  const soNoHistorico = [
    ...new Set(
      mudancas.mudancas
        .map((mudanca) => mudanca.targetOpportunityId)
        .filter((id): id is string => id !== null && !negocios.has(id)),
    ),
  ];

  // Quem mudou de etapa no período mas foi criado antes: falta a situação de
  // hoje. E quem entrou perto do fim do período pode ter dado o passo seguinte
  // depois dele, então os passos posteriores entram também.
  const [restantes, posteriores] = await Promise.all([
    tentar(
      'situação dos negócios (jornada)',
      listarNegociosPorId<NegocioHoje>(soNoHistorico, 'id stage createdAt'),
      { nos: [] as NegocioHoje[], truncado: false },
      falhas,
    ),
    fim > new Date().toISOString()
      ? Promise.resolve([] as MudancaDeEtapa[])
      : tentar(
          'passos posteriores ao período (jornada)',
          passosPosteriores([...negocios.keys(), ...soNoHistorico], fim),
          [] as MudancaDeEtapa[],
          falhas,
        ),
  ]);

  for (const negocio of restantes.nos) negocios.set(negocio.id, negocio);

  const historias = new Map<string, Historia>();

  for (const negocio of negocios.values()) {
    historias.set(negocio.id, {
      criadoEm: negocio.createdAt,
      etapaHoje: negocio.stage,
      passos: [],
    });
  }

  for (const mudanca of [...mudancas.mudancas, ...posteriores]) {
    const historia =
      mudanca.targetOpportunityId === null
        ? undefined
        : historias.get(mudanca.targetOpportunityId);
    const passo = passoDe(mudanca);

    if (historia !== undefined && passo !== null) historia.passos.push(passo);
  }

  for (const historia of historias.values()) {
    historia.passos.sort((a, b) => (a.quando < b.quando ? -1 : a.quando > b.quando ? 1 : 0));
  }

  const entradas = listarEntradas(historias, inicio, fim);

  const criadosEmOutraEtapa = new Map<string, number>();

  for (const entrada of entradas) {
    if (entrada.indiceDoProximoPasso === 0 && entrada.etapa !== 'NOVO_LEAD') {
      criadosEmOutraEtapa.set(entrada.etapa, (criadosEmOutraEtapa.get(entrada.etapa) ?? 0) + 1);
    }
  }

  return {
    proximoPasso: contar(entradas, historias, 'proximo-passo'),
    situacaoHoje: contar(entradas, historias, 'situacao-hoje'),
    criadosEmOutraEtapa: [...criadosEmOutraEtapa].map(([etapa, quantos]) => ({ etapa, quantos })),
    periodo,
    cortadoNoInicio: cortado,
    truncado: mudancas.truncado || criados.truncado || restantes.truncado,
    falhas,
  };
};

// Mudanças de etapa depois do fim do período, só dos negócios da jornada.
const passosPosteriores = async (
  ids: string[],
  fim: string,
): Promise<MudancaDeEtapa[]> => {
  const TAMANHO_DO_LOTE = 150;
  const todas: MudancaDeEtapa[] = [];

  for (let inicio = 0; inicio < ids.length; inicio += TAMANHO_DO_LOTE) {
    const { mudancas } = await listarMudancas({
      and: [
        { targetOpportunityId: { in: ids.slice(inicio, inicio + TAMANHO_DO_LOTE) } },
        { properties: { like: '%"stage"%' } },
        { happensAt: { gte: fim } },
      ],
    });

    todas.push(...mudancas);
  }

  return todas;
};
