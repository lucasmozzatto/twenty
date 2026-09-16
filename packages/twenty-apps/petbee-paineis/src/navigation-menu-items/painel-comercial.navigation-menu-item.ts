import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';

import {
  COMERCIAL_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  NAV_PAINEL_COMERCIAL_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Sem isto o painel existe mas é invisível: o `definePageLayout` cria a página
// (abas e widgets) e nada mais. Quem coloca a página no menu lateral é um item
// de navegação do tipo PAGE_LAYOUT apontando para ela.
//
// Não confundir com os dashboards da lista "Dashboards": aqueles são registros
// criados pela tela. Este é metadado do app — por isso não precisa de permissão
// de escrita e volta igual em cada `apply`.
export default defineNavigationMenuItem({
  universalIdentifier: NAV_PAINEL_COMERCIAL_UNIVERSAL_IDENTIFIER,
  type: NavigationMenuItemType.PAGE_LAYOUT,
  name: 'Painel Comercial',
  icon: 'IconChartHistogram',
  // Alto de propósito, para entrar no fim do menu e não empurrar o que já existe.
  position: 100,
  pageLayoutUniversalIdentifier: COMERCIAL_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
});
