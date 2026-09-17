// Quem pode abrir a página.
//
// A regra vem de dois lugares, nesta ordem:
//   1. a variável do app CONFERENCIA_LIBERADO_PARA, SE o CRM entregar o valor
//      legível: "todos" libera para qualquer membro; senão, e-mails separados
//      por vírgula. Edita-se em Settings → Applications, sem republicar.
//   2. a lista LIBERADOS_NO_CODIGO abaixo, quando a variável não vem legível
//      ou está vazia. Vazia = todos. Mudar aqui exige republicar o app.
//
// Por que a lista no código existe: nesta versão do CRM o valor de toda
// variável de app é gravado cifrado ("enc:v2:…") e o componente de tela o
// recebe ASSIM, sem decifrar (as funções de servidor recebem decifrado; a
// tela não). Foi o que fez a página abrir em "Sem acesso" no primeiro
// publish: o texto cifrado foi lido como lista de e-mails. Enquanto for
// assim, a variável não manda; a lista no código manda. Quando o CRM passar
// a decifrar para a tela, a variável passa a valer sem mexer aqui.
//
// Isto esconde a página, não tranca o dado: o que o painel busca vem com o
// papel do app, não com o de quem olha. Ver README.
import { getApplicationVariable } from 'twenty-sdk/front-component';

import { type Membro } from 'src/painel/crm';

export const VARIAVEL_LIBERADO_PARA = 'CONFERENCIA_LIBERADO_PARA';
export const TODOS = 'todos';

// Vazia = todos. Para restringir: ['lucas@petbee.com.br', 'x@petbee.com.br'].
export const LIBERADOS_NO_CODIGO: string[] = [];

export type Liberados = 'todos' | string[];

const PREFIXO_CIFRADO = 'enc:';

// O valor pode chegar de três jeitos legíveis, e a regra lê os três:
//   todos                   texto puro, como está no código
//   "todos"                 o mesmo valor embrulhado em JSON
//   ["a@x.com","b@x.com"]   lista em JSON, se alguém editar assim na tela
// Cifrado (enc:…) é ilegível: devolve null, e a lista do código vale.
const desembrulhar = (bruto: unknown): string | string[] | null => {
  if (Array.isArray(bruto)) return bruto.map(String);
  if (typeof bruto !== 'string') return '';

  const texto = bruto.trim();

  if (texto.startsWith(PREFIXO_CIFRADO)) return null;

  if (texto.startsWith('"') || texto.startsWith('[')) {
    try {
      return desembrulhar(JSON.parse(texto));
    } catch {
      return texto;
    }
  }

  return texto;
};

const normalizar = (valor: string | string[]): Liberados => {
  const itens = (Array.isArray(valor) ? valor : valor.split(','))
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item !== '');

  if (itens.length === 0 || itens.includes(TODOS)) return 'todos';

  return itens;
};

export const lerLiberados = (): Liberados => {
  let valor: string | string[] | null = null;

  try {
    valor = desembrulhar(getApplicationVariable(VARIAVEL_LIBERADO_PARA));
  } catch {
    valor = null;
  }

  // Ilegível, ausente ou vazia: vale a lista do código, que por padrão
  // libera para todos.
  const vazia = valor === '' || (Array.isArray(valor) && valor.length === 0);

  if (valor === null || vazia) return normalizar(LIBERADOS_NO_CODIGO);

  return normalizar(valor);
};

export type Acesso = 'liberado' | 'negado' | 'verificando';

export const decidirAcesso = (
  liberados: Liberados,
  userId: string | null,
  membros: Membro[] | null,
): Acesso => {
  if (liberados === 'todos') return 'liberado';
  if (membros === null) return 'verificando';

  const email = membros
    .find((membro) => membro.userId === userId)
    ?.email?.toLowerCase();

  return email !== undefined && liberados.includes(email)
    ? 'liberado'
    : 'negado';
};
