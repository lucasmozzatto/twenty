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
      // Lista vertical, não grade: na grade o quadro tem altura fixa em linhas
      // de 55px, e cada visão nova obrigava a chutar de novo (24, 38, 42, 53…),
      // com sobra em branco numa visão e barra de rolagem interna na outra. Na
      // lista o quadro fica com a altura do conteúdo. É o mesmo modo da aba
      // "Régua" do app de cadência, que já roda assim.
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier: W_PAINEL_PERIODO,
          title: 'Comercial',
          type: 'FRONT_COMPONENT',
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
