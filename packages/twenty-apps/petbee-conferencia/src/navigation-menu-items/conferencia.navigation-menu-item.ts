import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';

import {
  CONFERENCIA_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  NAV_CONFERENCIA_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Sem isto a página existe mas é invisível: o `definePageLayout` cria a página
// e nada mais. Quem a coloca no menu lateral é este item, do tipo PAGE_LAYOUT.
//
// Posição alta de propósito, logo depois do Painel Comercial (100), para
// entrar no fim do menu e não empurrar o que já existe.
export default defineNavigationMenuItem({
  universalIdentifier: NAV_CONFERENCIA_UNIVERSAL_IDENTIFIER,
  type: NavigationMenuItemType.PAGE_LAYOUT,
  name: 'Conferência',
  icon: 'IconChecklist',
  position: 101,
  pageLayoutUniversalIdentifier: CONFERENCIA_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
});
