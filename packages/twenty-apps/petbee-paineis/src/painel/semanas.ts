// O acompanhamento semanal fixo da visão Vendedores: as últimas semanas
// comerciais (quarta a terça), sempre as mesmas, sem depender do filtro de
// período lá de cima. Pedido do dono do painel em 22/09/2026 para enxergar
// a evolução sem ficar trocando o filtro.
//
// A janela começa no piso do histórico (01/09/2026) e cresce sozinha: toda
// quarta nasce uma linha. Quando passar de MAXIMO_DE_SEMANAS, a mais antiga
// sai. Antes do piso o processo ainda estava sendo ajustado e o histórico de
// etapas nem existia, então o passado não entra: a tabela não mistura dado
// migrado com dado do processo de hoje.
import { deMicros, listarNegocios, listarNegociosPorId } from 'src/painel/crm';
import { SO_FUNIL_DE_VENDAS } from 'src/painel/cohort';
import { type Falha, tentar } from 'src/painel/dados';
import {
  entrouEm,
  feitaPorPessoa,
  filtroDeEntradaEm,
  listarMudancas,
  type MudancaDeEtapa,
  SO_NEGOCIOS,
} from 'src/painel/linha-do-tempo';
import {
  diaEmBrasilia,
  INICIO_HISTORICO,
  inicioDaSemana,
  limitesIso,
  somarDias,
} from 'src/painel/periodo';
import { ETAPAS_EM_NEGOCIACAO } from 'src/painel/rotulos';

export const MAXIMO_DE_SEMANAS = 24;

export type CelulaSemana = {
  recebidos: number;
  ganhos: number;
  receita: number;
};

export type LinhaSemana = {
  inicio: string;
  fim: string;
  // Verdadeiro quando o piso cortou dias do começo, ou quando a semana ainda
  // está correndo.
  parcial: boolean;
  emAndamento: boolean;
  porDono: Record<string, CelulaSemana>;
  total: CelulaSemana;
};

export type Semanas = {
  linhas: LinhaSemana[];
  truncado: boolean;
  falhas: Falha[];
};

export const CHAVE_SEM_DONO = 'sem-dono';

const vazia = (): CelulaSemana => ({ recebidos: 0, ganhos: 0, receita: 0 });

// As semanas comerciais da janela, da mais antiga para a mais nova.
export const listarSemanas = (hoje: string): { inicio: string; fim: string }[] => {
  const semanaAtual = inicioDaSemana(hoje);
  const maisAntigaPossivel = somarDias(semanaAtual, -7 * (MAXIMO_DE_SEMANAS - 1));
  const comeco = inicioDaSemana(
    maisAntigaPossivel > INICIO_HISTORICO ? maisAntigaPossivel : INICIO_HISTORICO,
  );
  const semanas: { inicio: string; fim: string }[] = [];

  for (let dia = comeco; dia <= semanaAtual; dia = somarDias(dia, 7)) {
    semanas.push({ inicio: dia, fim: somarDias(dia, 6) });
  }

  return semanas;
};

type Venda = {
  id: string;
  fechamento: string | null;
  ownerId: string | null;
  closeDate: string;
  amount: { amountMicros: number | null } | null;
};

type DonoDoNegocio = { id: string; ownerId: string | null };

export const buscarSemanas = async (hoje: string): Promise<Semanas> => {
  const semanas = listarSemanas(hoje);
  const falhas: Falha[] = [];

  if (semanas.length === 0) return { linhas: [], truncado: false, falhas };

  // A janela nunca começa antes do piso, mesmo quando a semana comercial
  // começa no mês anterior: a primeira linha conta só de 01/09 em diante.
  const primeiroDia =
    semanas[0].inicio > INICIO_HISTORICO ? semanas[0].inicio : INICIO_HISTORICO;
  const { inicio, fim } = limitesIso({
    de: primeiroDia,
    ate: semanas[semanas.length - 1].fim,
  });

  const noPeriodo = (campo: string) => [
    { [campo]: { gte: inicio } },
    { [campo]: { lt: fim } },
  ];

  const [vendas, entradas, ganhos] = await Promise.all([
    tentar(
      'vendas das últimas semanas',
      listarNegocios<Venda>(
        {
          and: [
            SO_FUNIL_DE_VENDAS,
            { stage: { eq: 'WON' } },
            ...noPeriodo('closeDate'),
          ],
        },
        'id fechamento ownerId closeDate amount { amountMicros }',
      ),
      { nos: [] as Venda[], truncado: false },
      falhas,
    ),
    tentar(
      'entradas em negociação das últimas semanas',
      listarMudancas({
        and: [
          SO_NEGOCIOS,
          filtroDeEntradaEm(ETAPAS_EM_NEGOCIACAO),
          ...noPeriodo('happensAt'),
        ],
      }),
      { mudancas: [] as MudancaDeEtapa[], truncado: false },
      falhas,
    ),
    tentar(
      'ganhos marcados à mão das últimas semanas',
      listarMudancas({
        and: [SO_NEGOCIOS, filtroDeEntradaEm(['WON']), ...noPeriodo('happensAt')],
      }),
      { mudancas: [] as MudancaDeEtapa[], truncado: false },
      falhas,
    ),
  ]);

  // Primeira entrada em negociação de cada negócio dentro da janela. Quem já
  // tinha entrado antes do piso não aparece aqui, porque o histórico da
  // janela é tudo que existe de processo novo.
  const primeiraEntrada = new Map<string, string>();

  for (const mudanca of entradas.mudancas) {
    const negocio = mudanca.targetOpportunityId;

    if (negocio === null || !entrouEm(mudanca, ETAPAS_EM_NEGOCIACAO)) continue;
    if (!primeiraEntrada.has(negocio)) primeiraEntrada.set(negocio, mudanca.happensAt);
  }

  const marcadasAMao = new Set(
    ganhos.mudancas
      .filter((mudanca) => feitaPorPessoa(mudanca))
      .map((mudanca) => mudanca.targetOpportunityId),
  );

  // O dono é o de hoje, como no resto da visão: o histórico não guarda dono.
  const donos = await tentar(
    'donos dos leads recebidos',
    listarNegociosPorId<DonoDoNegocio>([...primeiraEntrada.keys()], 'id ownerId', [
      SO_FUNIL_DE_VENDAS,
    ]),
    { nos: [] as DonoDoNegocio[], truncado: false },
    falhas,
  );

  const linhas: LinhaSemana[] = semanas.map((semana) => ({
    ...semana,
    parcial: semana.inicio < INICIO_HISTORICO,
    emAndamento: semana.fim >= hoje,
    porDono: {},
    total: vazia(),
  }));

  const celula = (dia: string, dono: string | null): CelulaSemana | null => {
    const linha = linhas.find(
      (candidata) => dia >= candidata.inicio && dia <= candidata.fim,
    );

    if (linha === undefined) return null;

    const chave = dono ?? CHAVE_SEM_DONO;

    linha.porDono[chave] = linha.porDono[chave] ?? vazia();

    return linha.porDono[chave];
  };

  for (const negocio of donos.nos) {
    const entrada = primeiraEntrada.get(negocio.id);

    if (entrada === undefined) continue;

    const alvo = celula(diaEmBrasilia(new Date(entrada)), negocio.ownerId);

    if (alvo !== null) alvo.recebidos += 1;
  }

  // Ganhos seguem a regra de comissão da tabela de cima: Comercial, ou campo
  // vazio com passagem por negociação ou marcado à mão por um vendedor.
  for (const venda of vendas.nos) {
    const contada =
      venda.fechamento === 'COMERCIAL' ||
      (venda.fechamento === null &&
        (primeiraEntrada.has(venda.id) || marcadasAMao.has(venda.id)));

    if (!contada) continue;

    const alvo = celula(diaEmBrasilia(new Date(venda.closeDate)), venda.ownerId);

    if (alvo === null) continue;

    alvo.ganhos += 1;
    alvo.receita += deMicros(venda.amount?.amountMicros) ?? 0;
  }

  for (const linha of linhas) {
    for (const celulaDoDono of Object.values(linha.porDono)) {
      linha.total.recebidos += celulaDoDono.recebidos;
      linha.total.ganhos += celulaDoDono.ganhos;
      linha.total.receita += celulaDoDono.receita;
    }
  }

  // Mais recente em cima: é o que se olha primeiro.
  return {
    linhas: [...linhas].reverse(),
    truncado: vendas.truncado || entradas.truncado || donos.truncado,
    falhas,
  };
};
