import {
  AggregateOperations,
  definePageLayout,
  ObjectRecordGroupByDateGranularity,
  PageLayoutTabLayoutMode,
  PageLayoutType,
} from 'twenty-sdk/define';

import {
  COMERCIAL_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  FG,
  FIELD,
  OBJ,
  TAB_COMERCIAL_UNIVERSAL_IDENTIFIER,
  TAB_VENDEDORES_UNIVERSAL_IDENTIFIER,
  W_CONVERSAO,
  W_CRIADOS_DIA,
  W_MOTIVOS_PERDA,
  W_NEG_CANAL,
  W_NEG_ORIGEM,
  W_NEGOCIOS_CRIADOS,
  W_NOTA_VENDEDOR,
  W_PERDAS_CONVERSA,
  W_PIPE_ABERTO,
  W_PIPE_ETAPA_DONO,
  W_PIPE_NEGOCIACAO,
  W_PIPE_POR_DONO,
  W_PIPE_SEM_DONO,
  W_RECEITA,
  W_RECEITA_ORIGEM,
  W_SEM_ORIGEM,
  W_TICKET,
  W_VENDAS,
  W_VENDAS_CANAL,
  W_VENDAS_DIA,
  W_VENDAS_ORIGEM,
  W_VENDAS_VENDEDOR,
  W_VENDAS_VENDEDOR_PIPE,
} from 'src/constants/universal-identifiers';
import {
  buildFilter,
  dateEsteMes,
  FUSO,
  isEmpty,
  selectIs,
  selectIsNot,
} from 'src/utils/chart-filters';

// --- Os três conjuntos de filtro do painel ---------------------------------
// Toda pergunta sobre LEAD conta pela data de criação, só o mês atual.
// Toda pergunta sobre VENDA conta pela data de fechamento, só o mês atual.
// Toda pergunta sobre PIPELINE não leva data: é foto de agora.

const funilVendas = selectIs({
  field: FIELD.funnel,
  label: 'Funil',
  values: ['VENDAS'],
  displayValue: 'Vendas',
});

const filtroLead = [
  funilVendas,
  dateEsteMes({ field: FIELD.createdAt, label: 'Data de criação' }),
];

const filtroVenda = [
  funilVendas,
  selectIs({ field: FIELD.stage, label: 'Etapa', values: ['WON'] }),
  dateEsteMes({ field: FIELD.closeDate, label: 'Data de fechamento' }),
];

const filtroPipeline = [
  funilVendas,
  selectIsNot({
    field: FIELD.stage,
    label: 'Etapa',
    values: ['WON', 'LOST'],
    displayValue: 'Won, Lost',
  }),
];

// --- Atalhos de configuração ----------------------------------------------

type Medida = {
  aggregateFieldMetadataUniversalIdentifier: string;
  aggregateOperation: AggregateOperations;
};

// "Contar todos" ignora o campo escolhido e conta registros. O `name` está
// aqui só porque a configuração exige algum campo.
const contagem: Medida = {
  aggregateFieldMetadataUniversalIdentifier: FIELD.name,
  aggregateOperation: AggregateOperations.COUNT,
};

const somaValor: Medida = {
  aggregateFieldMetadataUniversalIdentifier: FIELD.amount,
  aggregateOperation: AggregateOperations.SUM,
};

const mediaValor: Medida = {
  aggregateFieldMetadataUniversalIdentifier: FIELD.amount,
  aggregateOperation: AggregateOperations.AVG,
};

const contagemEtapa: Medida = {
  aggregateFieldMetadataUniversalIdentifier: FIELD.stage,
  aggregateOperation: AggregateOperations.COUNT,
};

const numero = ({
  filter,
  prefix,
  campo = contagem,
}: {
  filter: ReturnType<typeof buildFilter>;
  prefix?: string;
  campo?: Medida;
}) => ({
  configurationType: 'AGGREGATE_CHART' as const,
  ...campo,
  displayDataLabel: false,
  timezone: FUSO,
  ...(prefix === undefined ? {} : { prefix }),
  filter,
});

const barra = ({
  eixo,
  subCampo,
  filter,
  cor,
  medida = contagem,
  ordem = 'VALUE_DESC',
}: {
  eixo: string;
  subCampo?: string;
  filter: ReturnType<typeof buildFilter>;
  cor: string;
  medida?: Medida;
  ordem?: string;
}) => ({
  configurationType: 'BAR_CHART' as const,
  ...medida,
  primaryAxisGroupByFieldMetadataUniversalIdentifier: eixo,
  ...(subCampo === undefined
    ? {}
    : { primaryAxisGroupBySubFieldName: subCampo }),
  primaryAxisOrderBy: ordem,
  axisNameDisplay: 'NONE',
  displayDataLabel: true,
  displayLegend: false,
  omitNullValues: true,
  layout: 'HORIZONTAL',
  color: cor,
  timezone: FUSO,
  filter,
});

const linha = ({
  campoData,
  filter,
  cor,
}: {
  campoData: string;
  filter: ReturnType<typeof buildFilter>;
  cor: string;
}) => ({
  configurationType: 'LINE_CHART' as const,
  ...contagem,
  primaryAxisGroupByFieldMetadataUniversalIdentifier: campoData,
  primaryAxisDateGranularity: ObjectRecordGroupByDateGranularity.DAY,
  primaryAxisOrderBy: 'FIELD_ASC',
  axisNameDisplay: 'NONE',
  displayDataLabel: true,
  displayLegend: false,
  isCumulative: false,
  omitNullValues: false,
  color: cor,
  timezone: FUSO,
  filter,
});

const posicao = ({
  row,
  column,
  rowSpan,
  columnSpan,
}: {
  row: number;
  column: number;
  rowSpan: number;
  columnSpan: number;
}) => ({
  gridPosition: { row, column, rowSpan, columnSpan },
  position: {
    layoutMode: PageLayoutTabLayoutMode.GRID as const,
    row,
    column,
    rowSpan,
    columnSpan,
  },
});

const grafico = <TConfig,>({
  universalIdentifier,
  title,
  row,
  column,
  rowSpan,
  columnSpan,
  configuration,
}: {
  universalIdentifier: string;
  title: string;
  row: number;
  column: number;
  rowSpan: number;
  columnSpan: number;
  configuration: TConfig;
}) => ({
  universalIdentifier,
  title,
  type: 'GRAPH' as const,
  objectUniversalIdentifier: OBJ.opportunity,
  // Os dois campos de propósito. O servidor desta instância lê `gridPosition`
  // (e zera `position`); o tipo do SDK 2.40 declara só `position`. Enquanto
  // discordarem, mandar os dois é o que funciona nos dois lados.
  ...posicao({ row, column, rowSpan, columnSpan }),
  configuration,
});

// --- O painel --------------------------------------------------------------

export default definePageLayout({
  universalIdentifier: COMERCIAL_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  name: 'Painel Comercial',
  // STANDALONE_PAGE, nao DASHBOARD: a rota /page/:id e servida pelo
  // StandalonePageLayoutPage, que exige este tipo. DASHBOARD so abre por
  // dentro de um registro da lista "Dashboards", e app nao cria registro.
  type: PageLayoutType.STANDALONE_PAGE,
  tabs: [
    {
      universalIdentifier: TAB_COMERCIAL_UNIVERSAL_IDENTIFIER,
      title: 'Comercial',
      icon: 'IconTargetArrow',
      position: 10,
      layoutMode: PageLayoutTabLayoutMode.GRID,
      widgets: [
        // Fileira de números
        grafico({
          universalIdentifier: W_NEGOCIOS_CRIADOS,
          title: 'Negócios criados',
          row: 0,
          column: 0,
          rowSpan: 2,
          columnSpan: 2,
          configuration: numero({
            filter: buildFilter(FG.negociosCriados, filtroLead),
          }),
        }),
        grafico({
          universalIdentifier: W_VENDAS,
          title: 'Vendas',
          row: 0,
          column: 2,
          rowSpan: 2,
          columnSpan: 2,
          configuration: numero({
            filter: buildFilter(FG.vendas, filtroVenda),
          }),
        }),
        grafico({
          universalIdentifier: W_RECEITA,
          title: 'Receita mensal',
          row: 0,
          column: 4,
          rowSpan: 2,
          columnSpan: 2,
          configuration: numero({
            filter: buildFilter(FG.receita, filtroVenda),
            prefix: 'R$ ',
            campo: somaValor,
          }),
        }),
        grafico({
          universalIdentifier: W_TICKET,
          title: 'Ticket médio',
          row: 0,
          column: 6,
          rowSpan: 2,
          columnSpan: 2,
          configuration: numero({
            filter: buildFilter(FG.ticket, filtroVenda),
            prefix: 'R$ ',
            campo: mediaValor,
          }),
        }),
        grafico({
          universalIdentifier: W_CONVERSAO,
          title: 'Conversão',
          row: 0,
          column: 8,
          rowSpan: 2,
          columnSpan: 2,
          configuration: {
            ...numero({
              filter: buildFilter(FG.conversao, filtroLead),
              campo: contagemEtapa,
            }),
            // Proporção de Ganho dentro da própria safra: numerador e
            // denominador saem do mesmo grupo de negócios.
            ratioAggregateConfig: {
              fieldMetadataUniversalIdentifier: FIELD.stage,
              optionValue: 'WON',
            },
          },
        }),
        grafico({
          universalIdentifier: W_SEM_ORIGEM,
          title: 'Sem origem',
          row: 0,
          column: 10,
          rowSpan: 2,
          columnSpan: 2,
          configuration: numero({
            filter: buildFilter(FG.semOrigem, [
              ...filtroLead,
              isEmpty({ field: FIELD.origem, label: 'Origem' }),
            ]),
          }),
        }),

        // Linhas do tempo
        grafico({
          universalIdentifier: W_CRIADOS_DIA,
          title: 'Negócios criados por dia',
          row: 2,
          column: 0,
          rowSpan: 6,
          columnSpan: 6,
          configuration: linha({
            campoData: FIELD.createdAt,
            filter: buildFilter(FG.criadosDia, filtroLead),
            cor: 'pink',
          }),
        }),
        grafico({
          universalIdentifier: W_VENDAS_DIA,
          title: 'Vendas por dia',
          row: 2,
          column: 6,
          rowSpan: 6,
          columnSpan: 6,
          configuration: linha({
            campoData: FIELD.closeDate,
            filter: buildFilter(FG.vendasDia, filtroVenda),
            cor: 'green',
          }),
        }),

        // Origem
        grafico({
          universalIdentifier: W_NEG_ORIGEM,
          title: 'Negócios por origem',
          row: 8,
          column: 0,
          rowSpan: 6,
          columnSpan: 6,
          configuration: barra({
            eixo: FIELD.origem,
            filter: buildFilter(FG.negOrigem, filtroLead),
            cor: 'pink',
          }),
        }),
        grafico({
          universalIdentifier: W_VENDAS_ORIGEM,
          title: 'Vendas por origem',
          row: 8,
          column: 6,
          rowSpan: 6,
          columnSpan: 6,
          configuration: barra({
            eixo: FIELD.origem,
            filter: buildFilter(FG.vendasOrigem, filtroVenda),
            cor: 'green',
          }),
        }),

        // Canal
        grafico({
          universalIdentifier: W_NEG_CANAL,
          title: 'Negócios por canal',
          row: 14,
          column: 0,
          rowSpan: 6,
          columnSpan: 6,
          configuration: barra({
            eixo: FIELD.canal,
            filter: buildFilter(FG.negCanal, filtroLead),
            cor: 'pink',
          }),
        }),
        grafico({
          universalIdentifier: W_VENDAS_CANAL,
          title: 'Vendas por canal',
          row: 14,
          column: 6,
          rowSpan: 6,
          columnSpan: 6,
          configuration: barra({
            eixo: FIELD.canal,
            filter: buildFilter(FG.vendasCanal, filtroVenda),
            cor: 'green',
          }),
        }),

        // Receita e vendedor
        grafico({
          universalIdentifier: W_RECEITA_ORIGEM,
          title: 'Receita por origem',
          row: 20,
          column: 0,
          rowSpan: 6,
          columnSpan: 6,
          configuration: barra({
            eixo: FIELD.origem,
            filter: buildFilter(FG.receitaOrigem, filtroVenda),
            cor: 'green',
            medida: somaValor,
          }),
        }),
        grafico({
          universalIdentifier: W_VENDAS_VENDEDOR,
          title: 'Vendas por vendedor',
          row: 20,
          column: 6,
          rowSpan: 6,
          columnSpan: 6,
          configuration: barra({
            eixo: FIELD.owner,
            subCampo: 'name.firstName',
            filter: buildFilter(FG.vendasVendedor, filtroVenda),
            cor: 'green',
          }),
        }),
      ],
    },
    {
      universalIdentifier: TAB_VENDEDORES_UNIVERSAL_IDENTIFIER,
      title: 'Vendedores',
      icon: 'IconUsers',
      position: 20,
      layoutMode: PageLayoutTabLayoutMode.GRID,
      widgets: [
        grafico({
          universalIdentifier: W_PIPE_ABERTO,
          title: 'Negócios em aberto',
          row: 0,
          column: 0,
          rowSpan: 2,
          columnSpan: 3,
          configuration: numero({
            filter: buildFilter(FG.pipeAberto, filtroPipeline),
          }),
        }),
        grafico({
          universalIdentifier: W_PIPE_SEM_DONO,
          title: 'Sem dono',
          row: 0,
          column: 3,
          rowSpan: 2,
          columnSpan: 3,
          configuration: numero({
            filter: buildFilter(FG.pipeSemDono, [
              ...filtroPipeline,
              isEmpty({
                field: FIELD.owner,
                label: 'Dono',
                type: 'RELATION',
              }),
            ]),
          }),
        }),
        grafico({
          universalIdentifier: W_PIPE_NEGOCIACAO,
          title: 'Em negociação',
          row: 0,
          column: 6,
          rowSpan: 2,
          columnSpan: 3,
          configuration: numero({
            filter: buildFilter(FG.pipeNegociacao, [
              funilVendas,
              selectIs({
                field: FIELD.stage,
                label: 'Etapa',
                values: ['EM_NEGOCIACAO', 'FECHAMENTO'],
                displayValue: 'Em negociação, Fechamento',
              }),
            ]),
          }),
        }),
        grafico({
          universalIdentifier: W_PERDAS_CONVERSA,
          title: 'Perdas com conversa',
          row: 0,
          column: 9,
          rowSpan: 2,
          columnSpan: 3,
          // Só os motivos que implicam conversa real. Os motivos "QF" e
          // "já é cliente" ficam fora: ali nunca houve contato.
          configuration: numero({
            filter: buildFilter(FG.perdasConversa, [
              funilVendas,
              selectIs({ field: FIELD.stage, label: 'Etapa', values: ['LOST'] }),
              dateEsteMes({ field: FIELD.createdAt, label: 'Data de criação' }),
              selectIs({
                field: FIELD.motivoLost,
                label: 'Motivo de Lost',
                values: [
                  'BUDGET_FORA_DO_ORCAMENTO',
                  'CONCORRENTE',
                  'NAO_GOSTOU_SEM_INTERESSE',
                  'TIMING_VAI_FECHAR_PRA_FRENTE',
                  'FALTA_DE_COBERTURA_ESPECIFICA',
                  'CLINICA',
                  'PAROU_DE_RESPONDER',
                  'FORMA_DE_PAGAMENTO',
                  'SEM_INTERESSE_JA_TEM_PLANO_OT',
                ],
                displayValue: 'motivos com conversa',
              }),
            ]),
          }),
        }),

        grafico({
          universalIdentifier: W_PIPE_POR_DONO,
          title: 'Pipeline por dono',
          row: 2,
          column: 0,
          rowSpan: 6,
          columnSpan: 6,
          configuration: barra({
            eixo: FIELD.owner,
            subCampo: 'name.firstName',
            filter: buildFilter(FG.pipePorDono, filtroPipeline),
            cor: 'blue',
          }),
        }),
        grafico({
          universalIdentifier: W_VENDAS_VENDEDOR_PIPE,
          title: 'Vendas por vendedor',
          row: 2,
          column: 6,
          rowSpan: 6,
          columnSpan: 6,
          configuration: barra({
            eixo: FIELD.owner,
            subCampo: 'name.firstName',
            filter: buildFilter(FG.vendasVendedorPipe, filtroVenda),
            cor: 'green',
          }),
        }),

        {
          universalIdentifier: W_NOTA_VENDEDOR,
          title: 'Como ler',
          type: 'STANDALONE_RICH_TEXT',
          ...posicao({ row: 8, column: 0, rowSpan: 3, columnSpan: 12 }),
          configuration: {
            configurationType: 'STANDALONE_RICH_TEXT',
            body: {
              markdown: [
                '**Lucas não é um vendedor.** É o dono padrão de todo negócio até alguém clicar em "Assumir" na inbox.',
                'O que aparece no nome dele são **vendas diretas, sem vendedor** — compra pelo site ou recompra.',
                '',
                'As vendas com vendedor de verdade, que comissionam, são as das outras pessoas.',
                '',
                'Os gráficos de pipeline são foto de **agora**, sem corte de data. Os de venda e de lead mostram **só o mês atual** (horário de Brasília): venda pela data de fechamento, lead pela data de criação. No dia 1 o painel zera e começa o mês novo.',
              ].join('\n'),
            },
          },
        },

        grafico({
          universalIdentifier: W_PIPE_ETAPA_DONO,
          title: 'Pipeline por etapa e dono',
          row: 11,
          column: 0,
          rowSpan: 8,
          columnSpan: 12,
          configuration: {
            ...barra({
              eixo: FIELD.stage,
              filter: buildFilter(FG.pipeEtapaDono, filtroPipeline),
              cor: 'blue',
              // Etapa tem ordem própria: assim o gráfico lê como o funil.
              ordem: 'FIELD_POSITION_ASC',
            }),
            secondaryAxisGroupByFieldMetadataUniversalIdentifier: FIELD.owner,
            secondaryAxisGroupBySubFieldName: 'name.firstName',
            secondaryAxisOrderBy: 'FIELD_ASC',
            groupMode: 'STACKED',
            displayLegend: true,
            displayDataLabel: false,
          },
        }),

        grafico({
          universalIdentifier: W_MOTIVOS_PERDA,
          title: 'Motivos de perda',
          row: 19,
          column: 0,
          rowSpan: 6,
          columnSpan: 12,
          configuration: barra({
            eixo: FIELD.motivoLost,
            filter: buildFilter(FG.motivosPerda, [
              funilVendas,
              selectIs({ field: FIELD.stage, label: 'Etapa', values: ['LOST'] }),
              dateEsteMes({ field: FIELD.createdAt, label: 'Data de criação' }),
            ]),
            cor: 'orange',
          }),
        }),
      ],
    },
  ],
});
