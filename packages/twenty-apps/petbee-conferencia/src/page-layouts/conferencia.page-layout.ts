import {
  definePageLayout,
  PageLayoutTabLayoutMode,
  PageLayoutType,
} from 'twenty-sdk/define';

import {
  CONFERENCIA_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  CONFERENCIA_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  TAB_CONFERENCIA_UNIVERSAL_IDENTIFIER,
  W_CONFERENCIA,
} from 'src/constants/universal-identifiers';

// Os dois campos de posição de propósito, igual ao painéis: o servidor desta
// instância lê `gridPosition` e o tipo do SDK declara só `position`. Enquanto
// discordarem, mandar os dois é o que funciona nos dois lados.
const posicao = (rowSpan: number, columnSpan: number) => ({
  gridPosition: { row: 0, column: 0, rowSpan, columnSpan },
  position: {
    layoutMode: PageLayoutTabLayoutMode.GRID as const,
    row: 0,
    column: 0,
    rowSpan,
    columnSpan,
  },
});

export default definePageLayout({
  universalIdentifier: CONFERENCIA_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  name: 'Conferência',
  // STANDALONE_PAGE: é o tipo que a rota /page/:id aceita. DASHBOARD só abre
  // por dentro de um registro da lista "Dashboards", e app não cria registro.
  type: PageLayoutType.STANDALONE_PAGE,
  tabs: [
    {
      universalIdentifier: TAB_CONFERENCIA_UNIVERSAL_IDENTIFIER,
      title: 'Funil × banco',
      icon: 'IconChecklist',
      position: 10,
      // Grade, não lista vertical: a lista serve à página do registro e sai
      // com largura de coluna lateral. Na grade a altura é fixa em linhas de
      // 55px; as listas paginam de 40 em 40 para caber sem rolagem interna.
      layoutMode: PageLayoutTabLayoutMode.GRID,
      widgets: [
        {
          universalIdentifier: W_CONFERENCIA,
          title: 'Conferência',
          type: 'FRONT_COMPONENT',
          // 48 linhas ≈ 2.640px: resumo, tabela por vendedor e as duas listas
          // com 40 linhas cada. Se aparecer rolagem dentro do quadro, sobe aqui.
          ...posicao(48, 12),
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier:
              CONFERENCIA_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
          },
        },
      ],
    },
  ],
});
