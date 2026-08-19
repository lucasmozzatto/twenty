import {
  definePageLayoutTab,
  PageLayoutTabLayoutMode,
} from 'twenty-sdk/define';

import {
  REGUA_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  REGUA_TASK_TAB_UNIVERSAL_IDENTIFIER,
  REGUA_TASK_WIDGET_UNIVERSAL_IDENTIFIER,
  TASK_RECORD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Mesma aba Régua, na página da TASK: a vendedora clica na tarefa da Fila e
// decide dali, sem abrir o card do negócio. O componente resolve o negócio dono.
export default definePageLayoutTab({
  universalIdentifier: REGUA_TASK_TAB_UNIVERSAL_IDENTIFIER,
  pageLayoutUniversalIdentifier: TASK_RECORD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  title: 'Régua',
  icon: 'IconChecklist',
  position: 15,
  layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
  widgets: [
    {
      universalIdentifier: REGUA_TASK_WIDGET_UNIVERSAL_IDENTIFIER,
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
