import { defineApplicationRole } from 'twenty-sdk/define';

import {
  APP_DISPLAY_NAME,
  DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// A conferência só lê. Nenhuma permissão de escrita, de propósito: quem julga
// e grava os vereditos é a conciliação diária no n8n; este app só mostra.
export default defineApplicationRole({
  universalIdentifier: DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
  label: `${APP_DISPLAY_NAME} — somente leitura`,
  description:
    'Lê negócios, assinaturas, pessoas e membros para montar a conferência. Não cria, não atualiza e não apaga nada.',
  canReadAllObjectRecords: true,
  canUpdateAllObjectRecords: false,
  canSoftDeleteAllObjectRecords: false,
  canDestroyAllObjectRecords: false,
});
