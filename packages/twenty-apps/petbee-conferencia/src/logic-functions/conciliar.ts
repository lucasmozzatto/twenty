// O atalho do botão "atualizar": roda a conciliação agora, em vez de esperar a
// rodada das 07:00. Existe para a página não precisar conhecer o n8n — ela
// chama esta rota no próprio CRM, e a URL e a chave do robô ficam aqui, no
// servidor, onde as variáveis do app chegam decifradas.
import { defineLogicFunction, HTTPMethod } from 'twenty-sdk/define';

import {
  CONCILIAR_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  ROTA_CONCILIAR,
} from 'src/constants/universal-identifiers';

// O webhook só responde quando a conciliação termina, e ela leva uns 2
// segundos. O teto é folga para um dia de fila no n8n, e fica abaixo do
// timeout da função para o erro sair legível na tela em vez de estourar.
const ESPERA_MAXIMA_MS = 60_000;

type Resposta = { ok: boolean; detalhe: string };

const handler = async (): Promise<Resposta> => {
  const url = (process.env.CONFERENCIA_CONCILIACAO_URL ?? '').trim();
  const chave = (process.env.CONFERENCIA_CONCILIACAO_CHAVE ?? '').trim();

  // Sem as duas variáveis o botão vira o que era antes, um "reler": a página
  // avisa em vez de fingir que rodou.
  if (url === '' || chave === '') return { ok: false, detalhe: 'sem-configuracao' };

  const cancelamento = new AbortController();
  const relogio = setTimeout(() => cancelamento.abort(), ESPERA_MAXIMA_MS);

  try {
    const resposta = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chave, origem: 'botao-conferencia' }),
      signal: cancelamento.signal,
    });

    // 2xx aqui significa que os vereditos já foram gravados: a página pode
    // reler em seguida e mostrar o resultado da rodada.
    return resposta.ok
      ? { ok: true, detalhe: 'conciliacao-executada' }
      : { ok: false, detalhe: `o robô respondeu HTTP ${resposta.status}` };
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);

    return { ok: false, detalhe: `não consegui falar com o robô (${motivo})` };
  } finally {
    clearTimeout(relogio);
  }
};

export default defineLogicFunction({
  universalIdentifier: CONCILIAR_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'conferencia-conciliar',
  description:
    'Roda a conciliação funil × banco sob demanda, para o botão "atualizar" da Conferência. Guarda no servidor a URL e a chave do robô no n8n.',
  timeoutSeconds: 120,
  httpRouteTriggerSettings: {
    path: ROTA_CONCILIAR,
    httpMethod: HTTPMethod.POST,
    isAuthRequired: true,
  },
  handler,
});
