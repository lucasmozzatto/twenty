import {
  definePageLayout,
  PageLayoutTabLayoutMode,
  PageLayoutType,
} from 'twenty-sdk/define';

import {
  COMERCIAL_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  PAINEL_PERIODO_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  TAB_PERIODO_UNIVERSAL_IDENTIFIER,
  W_PAINEL_PERIODO,
} from 'src/constants/universal-identifiers';

// Os dois campos de posição de propósito: o servidor desta instância lê
// `gridPosition` e o tipo do SDK 2.40 declara só `position`. Enquanto
// discordarem, mandar os dois é o que funciona nos dois lados — e o espalhe
// é o que faz o TypeScript aceitar o campo que ele não conhece.
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

// Uma aba só. As abas "Comercial" e "Vendedores", feitas de gráficos nativos,
// existiram até 16/09/2026 e foram apagadas: mostravam o mesmo que esta,
// travadas em "este mês", e toda melhoria entrava só aqui — duas telas
// contando a mesma coisa acabam divergindo. O histórico delas está no git.
export default definePageLayout({
  universalIdentifier: COMERCIAL_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  name: 'Painel Comercial',
  // STANDALONE_PAGE, nao DASHBOARD: a rota /page/:id e servida pelo
  // StandalonePageLayoutPage, que exige este tipo. DASHBOARD so abre por
  // dentro de um registro da lista "Dashboards", e app nao cria registro.
  type: PageLayoutType.STANDALONE_PAGE,
  tabs: [
    {
      universalIdentifier: TAB_PERIODO_UNIVERSAL_IDENTIFIER,
      title: 'Por período',
      icon: 'IconCalendarStats',
      position: 10,
      layoutMode: PageLayoutTabLayoutMode.GRID,
      widgets: [
        {
          universalIdentifier: W_PAINEL_PERIODO,
          title: 'Escolha o período',
          type: 'FRONT_COMPONENT',
          // Cada linha da grade tem 55px. O quadro inteiro pede ~2.300px.
          ...posicao(42, 12),
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier:
              PAINEL_PERIODO_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
          },
        },
      ],
    },
  ],
});
