import {
  definePageLayoutTab,
  PageLayoutTabLayoutMode,
} from 'twenty-sdk/define';

import {
  OPPORTUNITY_RECORD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  REGUA_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  REGUA_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
  REGUA_WIDGET_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Aba "Régua" adicionada à página padrão do negócio (não substitui nada).
export default definePageLayoutTab({
  universalIdentifier: REGUA_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
  pageLayoutUniversalIdentifier:
    OPPORTUNITY_RECORD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  title: 'Régua',
  icon: 'IconChecklist',
  // Abas padrão: Home=10, Timeline=20, Tasks=30... — 15 = logo depois da Home.
  position: 15,
  layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
  widgets: [
    {
      universalIdentifier: REGUA_WIDGET_UNIVERSAL_IDENTIFIER,
      title: 'Régua Petbee',
      type: 'FRONT_COMPONENT',
      configuration: {
        configurationType: 'FRONT_COMPONENT',
        frontComponentUniversalIdentifier:
          REGUA_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
      },
    },
  ],
});
