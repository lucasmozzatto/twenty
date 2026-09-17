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
    // "todos" libera a página para qualquer membro; e-mails separados por
    // vírgula restringem. Ressalva desta versão do CRM: o valor chega ao
    // componente de tela CIFRADO, então hoje quem manda é a lista
    // LIBERADOS_NO_CODIGO em src/painel/acesso.ts (ver README). A variável
    // passa a valer sozinha quando o CRM entregar o valor legível à tela.
    CONFERENCIA_LIBERADO_PARA: {
      universalIdentifier: LIBERADO_PARA_VARIABLE_UNIVERSAL_IDENTIFIER,
      description:
        'Quem pode abrir a Conferência: "todos", ou e-mails separados por vírgula.',
      value: 'todos',
      isSecret: false,
    },
  },
});
