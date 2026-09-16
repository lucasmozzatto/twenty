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
      // Grade, não lista vertical. A lista foi tentada em 16/09/2026 e o quadro
      // saiu com largura de coluna lateral e altura fixa com rolagem interna:
      // aquele modo é feito para a página do registro, não para uma página
      // inteira. Na grade a altura é fixa em linhas de 55px, então o valor
      // abaixo precisa caber a visão mais alta; as outras sobram em branco.
      layoutMode: PageLayoutTabLayoutMode.GRID,
      widgets: [
        {
          universalIdentifier: W_PAINEL_PERIODO,
          title: 'Comercial',
          type: 'FRONT_COMPONENT',
          // 30 linhas ≈ 1.650px: cabe a visão geral com comparação ligada,
          // que é a mais alta. Se uma visão crescer e aparecer barra de
          // rolagem dentro do quadro, é aqui que se mexe.
          ...posicao(30, 12),
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
