import { defineApplication } from 'twenty-sdk/define';

import {
  APP_DESCRIPTION,
  APP_DISPLAY_NAME,
  APPLICATION_UNIVERSAL_IDENTIFIER,
  CONCILIACAO_CHAVE_VARIABLE_UNIVERSAL_IDENTIFIER,
  CONCILIACAO_URL_VARIABLE_UNIVERSAL_IDENTIFIER,
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
    // As duas seguintes são o atalho do botão "atualizar": sem elas ele só
    // relê a tela e avisa. Segredo não carrega valor no código; preencher em
    // Settings → Applications → Conferência Petbee (ver README). Só a função
    // de servidor as recebe decifradas, então não chegam ao navegador.
    CONFERENCIA_CONCILIACAO_URL: {
      universalIdentifier: CONCILIACAO_URL_VARIABLE_UNIVERSAL_IDENTIFIER,
      description:
        'URL do webhook da "Conciliação diária — funil × banco" no n8n, que o botão "atualizar" dispara. Vazio = o botão só relê a tela.',
      isSecret: true,
    },
    CONFERENCIA_CONCILIACAO_CHAVE: {
      universalIdentifier: CONCILIACAO_CHAVE_VARIABLE_UNIVERSAL_IDENTIFIER,
      description:
        'Chave que o webhook da conciliação exige no corpo da chamada (nó "Conferir a chave do botão" no n8n).',
      isSecret: true,
    },
  },
});
