import { defineApplication } from 'twenty-sdk/define';

import {
  APP_DESCRIPTION,
  APP_DISPLAY_NAME,
  APPLICATION_UNIVERSAL_IDENTIFIER,
  LIBERADO_PARA_VARIABLE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: APP_DISPLAY_NAME,
  description: APP_DESCRIPTION,
  applicationVariables: {
    // "todos" libera a página para qualquer membro. Para restringir, troque
    // por e-mails separados por vírgula em Settings → Applications →
    // Conferência Petbee, sem republicar nada. Isto esconde a página; não é
    // trava de dado: o que o painel lê vem com o papel do app (ver README).
    CONFERENCIA_LIBERADO_PARA: {
      universalIdentifier: LIBERADO_PARA_VARIABLE_UNIVERSAL_IDENTIFIER,
      description:
        'Quem pode abrir a Conferência: "todos", ou e-mails separados por vírgula.',
      value: 'todos',
      isSecret: false,
    },
  },
});
