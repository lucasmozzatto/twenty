import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  codigoDaCausa,
  comTentativas,
  descreverErro,
  ESPERAS_MS,
  podeRepetir,
  RespostaSemJson,
} from '../rede.ts';

// Mesmo formato do erro do fetch do Node: "fetch failed" com o motivo em `cause`.
function falhaDeRede(codigo: string): TypeError {
  const causa = Object.assign(new Error(`connect ${codigo} 203.0.113.10:443`), { code: codigo });

  return new TypeError('fetch failed', { cause: causa });
}

const semEspera = async (): Promise<void> => {};

test('acha o código da causa dentro do "fetch failed"', () => {
  assert.equal(codigoDaCausa(falhaDeRede('ECONNRESET')), 'ECONNRESET');
  assert.equal(codigoDaCausa(new Error('GraphQL: campo inválido')), null);
});

test('o alerta mostra a causa real, não só "fetch failed"', () => {
  assert.equal(
    descreverErro(falhaDeRede('UND_ERR_CONNECT_TIMEOUT')),
    'fetch failed (UND_ERR_CONNECT_TIMEOUT: tempo esgotado ao conectar)',
  );
  assert.equal(descreverErro(falhaDeRede('ESTRANHO')), 'fetch failed (ESTRANHO)');
  assert.equal(descreverErro(new Error('GraphQL: campo inválido')), 'GraphQL: campo inválido');
});

test('resposta sem JSON diz o HTTP em vez de "Unexpected end of JSON input"', () => {
  assert.equal(new RespostaSemJson(502, '').message, 'o CRM respondeu HTTP 502 sem JSON (corpo vazio)');
  assert.equal(
    new RespostaSemJson(502, '<html>\n  <body>Bad Gateway</body>').message,
    'o CRM respondeu HTTP 502 sem JSON: "<html> <body>Bad Gateway</body>"',
  );
});

test('leitura repete em qualquer falha de rede e em 502/503/504', () => {
  assert.equal(podeRepetir(falhaDeRede('ECONNRESET'), true), true);
  assert.equal(podeRepetir(new TypeError('fetch failed'), true), true);
  assert.equal(podeRepetir(new RespostaSemJson(502, ''), true), true);
  assert.equal(podeRepetir(new RespostaSemJson(504, ''), true), true);
  assert.equal(podeRepetir(new RespostaSemJson(500, ''), true), false);
  assert.equal(podeRepetir(new Error('GraphQL: campo inválido'), true), false);
});

test('escrita só repete quando a conexão nem abriu', () => {
  assert.equal(podeRepetir(falhaDeRede('ECONNREFUSED'), false), true);
  assert.equal(podeRepetir(falhaDeRede('UND_ERR_CONNECT_TIMEOUT'), false), true);
  assert.equal(podeRepetir(falhaDeRede('EAI_AGAIN'), false), true);
  // O pedido pode ter chegado e só a resposta se perdeu: repetir criaria a tarefa duas vezes.
  assert.equal(podeRepetir(falhaDeRede('ECONNRESET'), false), false);
  assert.equal(podeRepetir(falhaDeRede('UND_ERR_HEADERS_TIMEOUT'), false), false);
  assert.equal(podeRepetir(new TypeError('fetch failed'), false), false);
  assert.equal(podeRepetir(new RespostaSemJson(502, ''), false), false);
});

test('falha passageira: a 2ª tentativa passa e não sobe erro', async () => {
  let chamadas = 0;
  const esperas: number[] = [];

  const resultado = await comTentativas(
    async () => {
      chamadas += 1;
      if (chamadas === 1) throw falhaDeRede('ECONNRESET');

      return 'ok';
    },
    true,
    async (ms) => {
      esperas.push(ms);
    },
  );

  assert.equal(resultado, 'ok');
  assert.equal(chamadas, 2);
  assert.deepEqual(esperas, [ESPERAS_MS[0]]);
});

test('falha que persiste: 3 tentativas e o erro diz a causa e quantas foram', async () => {
  let chamadas = 0;

  await assert.rejects(
    comTentativas(
      async () => {
        chamadas += 1;
        throw falhaDeRede('ECONNREFUSED');
      },
      true,
      semEspera,
    ),
    (erro: Error) => {
      assert.equal(erro.message, 'fetch failed (ECONNREFUSED: conexão recusada), em 3 tentativas');
      // O alerta não repete o código que já está na mensagem.
      assert.equal(descreverErro(erro), erro.message);

      return true;
    },
  );
  assert.equal(chamadas, 3);
});

test('erro que não é de rede sobe na hora, sem repetir', async () => {
  let chamadas = 0;

  await assert.rejects(
    comTentativas(
      async () => {
        chamadas += 1;
        throw new Error('GraphQL: campo inválido');
      },
      true,
      semEspera,
    ),
    /^Error: GraphQL: campo inválido$/,
  );
  assert.equal(chamadas, 1);
});

test('escrita com conexão derrubada no meio não repete', async () => {
  let chamadas = 0;

  await assert.rejects(
    comTentativas(
      async () => {
        chamadas += 1;
        throw falhaDeRede('ECONNRESET');
      },
      false,
      semEspera,
    ),
    /fetch failed/,
  );
  assert.equal(chamadas, 1);
});
