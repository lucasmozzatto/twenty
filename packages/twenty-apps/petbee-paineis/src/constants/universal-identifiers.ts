export const APP_DISPLAY_NAME = 'Painéis Petbee';
export const APP_DESCRIPTION =
  'Painéis comerciais declarados em código. Somente leitura: não escreve nada no CRM.';

export const APPLICATION_UNIVERSAL_IDENTIFIER =
  '783fafb2-d99c-4114-9f04-b6e58ccc09bb';
export const DEFAULT_ROLE_UNIVERSAL_IDENTIFIER =
  '72b5489f-d058-4a1e-9119-a7373ef03aa6';

export const COMERCIAL_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER =
  'fc931acc-bc1e-4307-bcdd-e4056f21fba5';
export const TAB_COMERCIAL_UNIVERSAL_IDENTIFIER =
  '4e33f75a-47ae-441a-94e0-0bacaf10a408';
export const TAB_VENDEDORES_UNIVERSAL_IDENTIFIER =
  'e261ad38-b846-4d13-8f75-af2be4c4931e';
export const TAB_PERIODO_UNIVERSAL_IDENTIFIER =
  '824e03ec-6afa-4746-9632-229bdeeea5b8';

// --- Aba Por período (quadro próprio, com seletor de datas) ---
export const PAINEL_PERIODO_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  '2f101399-a270-4c7d-9793-19020e80773f';
export const W_PAINEL_PERIODO = 'e3309836-5560-49ef-8b2d-6a99238a515c';

// --- Aba Comercial ---
export const W_NEGOCIOS_CRIADOS = '9e4c3924-ce7a-44f5-85b4-4236eb4381c6';
export const W_VENDAS = 'fd387733-b974-481b-a79a-0826ce8acfce';
export const W_RECEITA = '54f6148f-8104-40a5-a888-b45a01fe58a2';
export const W_TICKET = '7b887b70-ffd2-4c05-a5a8-4f748c634d17';
export const W_CONVERSAO = '6b528c6d-bf27-41b2-970a-1379b0a8fb62';
export const W_SEM_ORIGEM = '56220576-34ff-4639-a5a2-b86091c069ad';
export const W_CRIADOS_DIA = 'd9172c65-61a9-4b63-b0d4-7e447f8cdf8c';
export const W_VENDAS_DIA = 'eef2ad2e-92d4-4eb2-aaeb-857d5c56f6d2';
export const W_NEG_ORIGEM = 'f2d7812f-ef44-4906-9c9d-052e82fddea3';
export const W_VENDAS_ORIGEM = '38da2095-113e-4252-8f46-c0223695c77e';
export const W_NEG_CANAL = '8a41e61a-7f30-47b7-9e69-fcd5bf379441';
export const W_VENDAS_CANAL = '81b05d96-75ac-461c-bc48-7315b25086d6';
export const W_RECEITA_ORIGEM = 'f5b64c00-e419-45a7-a69f-983f709aab26';
export const W_VENDAS_VENDEDOR = '2b3d4847-3aa1-4e51-ad95-ed3331ec3554';

// --- Aba Vendedores ---
export const W_PIPE_ABERTO = '7c808293-b9c3-40b9-b869-4aa210542797';
export const W_PIPE_SEM_DONO = '24da5172-00b9-4bc1-81d3-864055e8c9ff';
export const W_PIPE_NEGOCIACAO = '792a6e45-130f-4db5-8267-d6b698e9e879';
export const W_PERDAS_CONVERSA = '4b1e2b8c-8e48-4bea-8c7a-c25129e9afa8';
export const W_PIPE_POR_DONO = 'fa3de8ea-5d8f-4033-a7a1-9307b146680c';
export const W_PIPE_ETAPA_DONO = '81e1ce07-de0b-4b38-aa85-2f56c0324b0c';
export const W_VENDAS_VENDEDOR_PIPE = 'a03c75e4-c9d1-4848-b8ae-063f78a8dc04';
export const W_MOTIVOS_PERDA = 'fd5953d2-1bb9-488c-926e-2f607b83b8ce';
export const W_NOTA_VENDEDOR = '675944de-29aa-45d5-aba9-3c31257b06f0';

// Cada widget com filtro precisa de um id de grupo estável, senão cada
// sincronização geraria um grupo novo e duplicaria o filtro.
export const FG = {
  negociosCriados: '11f80071-c412-49bc-9b1c-dab9728bba9b',
  vendas: '11c83d91-be86-4882-889c-39053a16b750',
  receita: '28d5e5ca-25cc-4195-a487-80f26c7c4a72',
  ticket: '5c0204f8-a20f-4612-af77-94b4f379b4ee',
  conversao: 'd09ac884-1a5a-4214-9315-b2d2cbd5329f',
  semOrigem: '6c3c17fa-7359-4e69-bfa7-9546bf1cd538',
  criadosDia: '5fabf5cf-d631-4258-9bca-c9aedc2e1415',
  vendasDia: '1a05e5b2-446e-41f7-b091-1ea37ecf9e61',
  negOrigem: 'e8ce72f9-44af-4c9e-85c0-59492a5c707d',
  vendasOrigem: '6cda7d41-32ee-438a-aa72-4b931e970203',
  negCanal: '12cb044c-ee50-4a2c-b0f7-0680665d6d14',
  vendasCanal: '9d8b51e4-b19b-4367-800f-3c365d144ed3',
  receitaOrigem: '5f1c5347-8f56-4cb1-a0ea-641ec00a9985',
  vendasVendedor: 'f81799a0-6867-406e-b600-4efe98dcfe0d',
  pipeAberto: '3f6fe4db-5aa1-4254-b3a3-88ac512f8ff9',
  pipeSemDono: '287d0a42-d133-4a49-a680-24cda422db64',
  pipeNegociacao: '32bb6d38-ad55-463f-82a1-b3052be6775b',
  perdasConversa: 'a2e50735-cbcf-473e-aa4b-cf6cf95cf7d1',
  pipePorDono: '419430ed-f99f-42f5-b3e6-467578b925c7',
  pipeEtapaDono: '20fbf3ed-438a-4dff-b99c-1b5d61344131',
  vendasVendedorPipe: '1634d434-8471-40c7-8b34-73db400f1b22',
  motivosPerda: 'f68e45cd-e37e-4fcb-95d1-15da557ababf',
} as const;

// Identificadores universais lidos da API de metadados do workspace em 16/09/2026.
export const OBJ = {
  opportunity: '20202020-9549-49dd-b2b2-883999db8938',
} as const;

export const FIELD = {
  name: '20202020-8609-4f65-a2d9-44009eb422b5',
  amount: '20202020-583e-4642-8533-db761d5fa82f',
  closeDate: '20202020-527e-44d6-b1ac-c4158d307b97',
  createdAt: '20202020-d01b-4132-9b32-123456789abc',
  stage: '20202020-6f76-477d-8551-28cd65b2b4b9',
  owner: '20202020-be7e-4d1e-8e19-3d5c7c4b9f2a',
  funnel: 'b9a2e592-7534-47dd-bb34-0bc76de32660',
  origem: 'adf6c963-daf1-484e-878d-c3cdccb881fb',
  canal: 'bda0ae13-76c7-4970-bc03-cb0487b513df',
  motivoLost: 'e62365a9-559b-4c5e-b3c7-309ea955f895',
} as const;

export const NAV_PAINEL_COMERCIAL_UNIVERSAL_IDENTIFIER =
  '8a368b99-7325-4981-8a4c-3fc6e60f1b8f';
