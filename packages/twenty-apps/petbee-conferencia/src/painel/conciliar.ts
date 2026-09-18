// O botão "atualizar" pede a conciliação na hora. A página não fala com o
// n8n: ela chama uma rota do próprio CRM, e quem tem a URL e a chave do robô
// é a função de servidor em src/logic-functions/conciliar.ts. Assim o segredo
// nunca chega ao navegador.
import { ROTA_CONCILIAR } from 'src/constants/universal-identifiers';

export type Conciliacao =
  | { estado: 'feita' }
  | { estado: 'sem-configuracao' }
  | { estado: 'falhou'; motivo: string };

export const pedirConciliacao = async (): Promise<Conciliacao> => {
  try {
    // Rotas de função de app ficam sob /s no mesmo domínio do CRM.
    const resposta = await fetch(
      `${process.env.TWENTY_API_URL}/s${ROTA_CONCILIAR}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${process.env.TWENTY_APP_ACCESS_TOKEN}`,
        },
        body: '{}',
      },
    );

    const corpo = (await resposta.json().catch(() => null)) as {
      ok?: boolean;
      detalhe?: string;
    } | null;

    if (!resposta.ok) {
      return {
        estado: 'falhou',
        motivo: corpo?.detalhe ?? `o CRM respondeu HTTP ${resposta.status}`,
      };
    }

    if (corpo?.ok === true) return { estado: 'feita' };
    if (corpo?.detalhe === 'sem-configuracao') return { estado: 'sem-configuracao' };

    return { estado: 'falhou', motivo: corpo?.detalhe ?? 'resposta inesperada' };
  } catch (erro) {
    return {
      estado: 'falhou',
      motivo: erro instanceof Error ? erro.message : String(erro),
    };
  }
};
