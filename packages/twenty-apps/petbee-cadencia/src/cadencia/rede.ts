// Falhas na chamada ao CRM: quando repetir e como descrever o erro no alerta.
// Módulo puro (sem fetch), testado em __tests__/rede.test.ts.
//
// Caso real (16 e 18/11/2026): o alerta chegava só como "fetch failed", 3 vezes
// em 3 dias, e a rodada seguinte, 5 min depois, passava normal. O Node guarda o
// motivo de verdade (tempo esgotado, conexão recusada, DNS…) em `cause`, e ele
// se perdia. E uma falha de rede passageira virava alerta sem uma segunda tentativa.

// Esperas antes da 2ª e da 3ª tentativa. Cabe folgado no timeout de 120 s das funções.
export const ESPERAS_MS: readonly number[] = [2000, 5000];

// A conexão nem abriu: o pedido não chegou ao CRM, então repetir é seguro até
// numa escrita (não tem como a tarefa ter sido criada).
const SEM_CONEXAO = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'UND_ERR_CONNECT_TIMEOUT',
]);

// Proxy na frente do CRM sem conseguir falar com ele (CRM reiniciando, por exemplo).
const HTTP_PASSAGEIRO = new Set([502, 503, 504]);

const MOTIVOS: Record<string, string> = {
  ECONNREFUSED: 'conexão recusada',
  ECONNRESET: 'conexão derrubada no meio',
  ETIMEDOUT: 'tempo esgotado',
  UND_ERR_CONNECT_TIMEOUT: 'tempo esgotado ao conectar',
  UND_ERR_HEADERS_TIMEOUT: 'o CRM não respondeu a tempo',
  UND_ERR_BODY_TIMEOUT: 'o CRM parou no meio da resposta',
  UND_ERR_SOCKET: 'conexão fechada pelo outro lado',
  ENOTFOUND: 'falha de DNS',
  EAI_AGAIN: 'falha de DNS',
  EHOSTUNREACH: 'servidor inalcançável',
  ENETUNREACH: 'rede inalcançável',
  EPIPE: 'conexão fechada pelo outro lado',
};

// Resposta do CRM que não é JSON (página de erro do proxy, corpo vazio). Antes
// virava "Unexpected end of JSON input", sem dizer o HTTP.
export class RespostaSemJson extends Error {
  status: number;

  constructor(status: number, trecho: string) {
    const amostra = trecho.trim().replace(/\s+/g, ' ').slice(0, 80);
    super(`o CRM respondeu HTTP ${status} sem JSON${amostra ? `: "${amostra}"` : ' (corpo vazio)'}`);
    this.name = 'RespostaSemJson';
    this.status = status;
  }
}

type ComCausa = { cause?: unknown; code?: unknown; message?: unknown };

// O código da causa de rede ("ECONNRESET"…), procurado na corrente de `cause`.
export function codigoDaCausa(erro: unknown): string | null {
  let atual: unknown = erro;

  for (let nivel = 0; nivel < 4 && atual && typeof atual === 'object'; nivel += 1) {
    const { code, cause } = atual as ComCausa;

    if (typeof code === 'string' && code) return code;
    atual = cause;
  }

  return null;
}

// O fetch falhou antes de chegar qualquer resposta.
function ehFalhaDeRede(erro: unknown): boolean {
  if (codigoDaCausa(erro)) return true;

  return erro instanceof TypeError && /fetch failed/i.test(erro.message);
}

// Repetir? Leitura repete em qualquer falha de rede e em 502/503/504. Escrita só
// quando a conexão nem abriu: se o pedido chegou e só a resposta se perdeu,
// repetir podia criar a mesma tarefa duas vezes.
export function podeRepetir(erro: unknown, leitura: boolean): boolean {
  if (erro instanceof RespostaSemJson) {
    return leitura && HTTP_PASSAGEIRO.has(erro.status);
  }
  if (!ehFalhaDeRede(erro)) return false;
  if (leitura) return true;

  const codigo = codigoDaCausa(erro);

  return codigo !== null && SEM_CONEXAO.has(codigo);
}

const dormir = (ms: number): Promise<void> =>
  new Promise((resolver) => setTimeout(resolver, ms));

// Roda a chamada com até 3 tentativas. Esgotadas, o erro diz quantas foram.
export async function comTentativas<T>(
  executar: () => Promise<T>,
  leitura: boolean,
  esperar: (ms: number) => Promise<void> = dormir,
): Promise<T> {
  for (let tentativa = 1; ; tentativa += 1) {
    try {
      return await executar();
    } catch (erro) {
      const espera = ESPERAS_MS[tentativa - 1];

      if (espera === undefined || !podeRepetir(erro, leitura)) {
        if (tentativa === 1) throw erro;
        throw new Error(`${descreverErro(erro)}, em ${tentativa} tentativas`, {
          cause: erro,
        });
      }

      await esperar(espera);
    }
  }
}

// Texto do alerta: a mensagem e, se houver, a causa de rede com o motivo em português.
export function descreverErro(erro: unknown): string {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  const codigo = codigoDaCausa(erro);

  if (!codigo || mensagem.includes(codigo)) return mensagem;

  const motivo = MOTIVOS[codigo];

  return `${mensagem} (${codigo}${motivo ? `: ${motivo}` : ''})`;
}
