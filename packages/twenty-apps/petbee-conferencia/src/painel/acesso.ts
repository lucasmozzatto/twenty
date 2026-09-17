// Quem pode abrir a página. A regra vem da variável do app
// CONFERENCIA_LIBERADO_PARA: "todos" libera para qualquer membro; senão, só
// os e-mails listados, separados por vírgula. Editável em Settings →
// Applications → Conferência Petbee, sem republicar.
//
// Isto esconde a página, não tranca o dado: o que o painel busca vem com o
// papel do app, não com o de quem olha. Serve para tirar da frente de quem
// não precisa, que é o caso comum. Ver README.
import { getApplicationVariable } from 'twenty-sdk/front-component';

import { type Membro } from 'src/painel/crm';

export const VARIAVEL_LIBERADO_PARA = 'CONFERENCIA_LIBERADO_PARA';
export const TODOS = 'todos';

export type Liberados = 'todos' | string[];

export const lerLiberados = (): Liberados => {
  let bruto = '';

  // Sem a variável (app recém-instalado, valor apagado) a página abre para
  // todos, que é o padrão declarado no app.
  try {
    bruto = (getApplicationVariable(VARIAVEL_LIBERADO_PARA) ?? '').trim();
  } catch {
    bruto = '';
  }

  if (bruto === '' || bruto.toLowerCase() === TODOS) return 'todos';

  return bruto
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email !== '');
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
