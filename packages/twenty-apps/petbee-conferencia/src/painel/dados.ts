// As perguntas que a conferência faz ao CRM, todas de uma vez.
//
// Duas regras de filtro, e só duas:
//   VENDA      → etapa Ganho + data de FECHAMENTO no período (qualquer funil)
//   ASSINATURA → data de INÍCIO no período (qualquer status)
//
// Fechamento, e não criação, de propósito: a venda acontece quando fecha. Um
// negócio criado em agosto e ganho em setembro é venda de setembro, e é assim
// que o bônus conta. Qualquer funil e qualquer status porque a pergunta é "o
// que existe de cada lado"; as fichas da tela recortam depois.
import { resumir, porVendedor, type LinhaVendedor, type Resumo } from 'src/painel/contas';
import { ASSINATURAS, deMicros, type Filtro, listar, NEGOCIOS } from 'src/painel/crm';
import { diaEmBrasilia, limitesIso, type Periodo } from 'src/painel/periodo';

export type VereditoVenda =
  | 'CONFERIDA'
  | 'VALOR_DIVERGENTE'
  | 'SEM_ASSINATURA'
  | 'AGUARDANDO';

export type VereditoAssinatura =
  | 'COM_VENDA'
  | 'SEM_VENDA'
  | 'CORTESIA'
  | 'AGUARDANDO';

export type Venda = {
  id: string;
  cliente: string;
  // Dia de Brasília do fechamento, AAAA-MM-DD.
  fechamento: string;
  vendedorId: string | null;
  tutorId: string | null;
  tutorNome: string | null;
  origem: string | null;
  tipoFechamento: string | null;
  funil: string | null;
  veredito: VereditoVenda;
  valorCrm: number | null;
  // Soma das assinaturas que a conciliação encontrou para esta venda.
  valorBanco: number | null;
};

export type Assinatura = {
  id: string;
  pet: string;
  tutorId: string | null;
  tutorNome: string | null;
  inicio: string;
  status: string | null;
  cortesia: boolean;
  veredito: VereditoAssinatura;
  mrr: number | null;
  idPetbee: string | null;
};

// Um quadro que falha não derruba a página: guardamos o motivo e seguimos com
// os outros. Sem isto, uma consulta recusada apagaria o painel inteiro.
export type Falha = { onde: string; motivo: string };

export const tentar = <TDados,>(
  onde: string,
  promessa: Promise<TDados>,
  padrao: TDados,
  falhas: Falha[],
): Promise<TDados> =>
  promessa.catch((erro: unknown) => {
    falhas.push({
      onde,
      motivo: erro instanceof Error ? erro.message : String(erro),
    });

    return padrao;
  });

type Nome = { firstName: string | null; lastName: string | null } | null;

const nomeCompleto = (nome: Nome): string | null => {
  const partes = [nome?.firstName, nome?.lastName].filter(
    (parte): parte is string => typeof parte === 'string' && parte.trim() !== '',
  );

  return partes.length === 0 ? null : partes.join(' ');
};

type NoVenda = {
  id: string;
  name: string | null;
  closeDate: string | null;
  createdAt: string;
  ownerId: string | null;
  pointOfContactId: string | null;
  origem: string | null;
  fechamento: string | null;
  funnel: string | null;
  conferenciaBanco: string | null;
  amount: { amountMicros: number | null } | null;
  valorBanco: { amountMicros: number | null } | null;
  pointOfContact: { id: string; name: Nome } | null;
};

const CAMPOS_VENDA =
  'id name closeDate createdAt ownerId pointOfContactId origem fechamento funnel conferenciaBanco amount { amountMicros } valorBanco { amountMicros } pointOfContact { id name { firstName lastName } }';

const vereditoDaVenda = (bruto: string | null): VereditoVenda =>
  bruto === 'CONFERIDA' ||
  bruto === 'VALOR_DIVERGENTE' ||
  bruto === 'SEM_ASSINATURA'
    ? bruto
    : 'AGUARDANDO';

export const buscarVendas = async (
  periodo: Periodo,
): Promise<{ vendas: Venda[]; truncado: boolean }> => {
  const { inicio, fim } = limitesIso(periodo);
  // Um operador por campo, em entradas separadas do `and`: o servidor recusa
  // `{ gte, lt }` no mesmo objeto ("must have exactly one operator").
  const filter: Filtro = {
    and: [
      { stage: { eq: 'WON' } },
      { closeDate: { gte: inicio } },
      { closeDate: { lt: fim } },
    ],
  };

  const { nos, truncado } = await listar<NoVenda>(
    NEGOCIOS,
    filter,
    '{ closeDate: DescNullsLast }',
    CAMPOS_VENDA,
  );

  return {
    vendas: nos.map((no) => {
      const tutorNome = nomeCompleto(no.pointOfContact?.name ?? null);

      return {
        id: no.id,
        cliente: no.name?.trim() || tutorNome || 'Sem nome',
        fechamento: diaEmBrasilia(no.closeDate ?? no.createdAt),
        vendedorId: no.ownerId,
        tutorId: no.pointOfContactId,
        tutorNome,
        origem: no.origem,
        tipoFechamento: no.fechamento,
        funil: no.funnel,
        veredito: vereditoDaVenda(no.conferenciaBanco),
        valorCrm: deMicros(no.amount?.amountMicros),
        valorBanco: deMicros(no.valorBanco?.amountMicros),
      };
    }),
    truncado,
  };
};

type NoAssinatura = {
  id: string;
  name: string | null;
  status: string | null;
  dataInicio: string | null;
  cortesia: boolean | null;
  conferenciaFunil: string | null;
  subsIdPetbee: string | null;
  tutorId: string | null;
  valorMensal: { amountMicros: number | null } | null;
  tutor: { id: string; name: Nome } | null;
};

const CAMPOS_ASSINATURA =
  'id name status dataInicio cortesia conferenciaFunil subsIdPetbee tutorId valorMensal { amountMicros } tutor { id name { firstName lastName } }';

// Cortesia é o que a conciliação chama de cortesia: marcada como tal, ou com
// valor zero. Fica fora da conta de dinheiro.
export const ehCortesia = (cortesia: boolean | null, mrr: number | null): boolean =>
  cortesia === true || (mrr ?? 0) === 0;

const vereditoDaAssinatura = (bruto: string | null): VereditoAssinatura =>
  bruto === 'COM_VENDA' || bruto === 'SEM_VENDA' || bruto === 'CORTESIA'
    ? bruto
    : 'AGUARDANDO';

export const buscarAssinaturas = async (
  periodo: Periodo,
): Promise<{ assinaturas: Assinatura[]; truncado: boolean }> => {
  // Data de início é campo de data pura, sem hora: o filtro recebe os dias.
  const filter: Filtro = {
    and: [{ dataInicio: { gte: periodo.de } }, { dataInicio: { lte: periodo.ate } }],
  };

  const { nos, truncado } = await listar<NoAssinatura>(
    ASSINATURAS,
    filter,
    '{ dataInicio: DescNullsLast }',
    CAMPOS_ASSINATURA,
  );

  return {
    assinaturas: nos.map((no) => {
      const mrr = deMicros(no.valorMensal?.amountMicros);

      return {
        id: no.id,
        pet: no.name?.trim() || 'Sem nome',
        tutorId: no.tutorId,
        tutorNome: nomeCompleto(no.tutor?.name ?? null),
        inicio: no.dataInicio ?? periodo.de,
        status: no.status,
        cortesia: ehCortesia(no.cortesia, mrr),
        veredito: vereditoDaAssinatura(no.conferenciaFunil),
        mrr,
        idPetbee: no.subsIdPetbee,
      };
    }),
    truncado,
  };
};

export type Dados = {
  vendas: Venda[];
  assinaturas: Assinatura[];
  resumo: Resumo;
  porVendedor: LinhaVendedor[];
  truncado: { vendas: boolean; assinaturas: boolean };
  falhas: Falha[];
};

export const buscarDados = async (periodo: Periodo): Promise<Dados> => {
  const falhas: Falha[] = [];

  // As duas buscas vão juntas: a tela aparece de uma vez.
  const [vendas, assinaturas] = await Promise.all([
    tentar('vendas do CRM', buscarVendas(periodo), { vendas: [], truncado: false }, falhas),
    tentar(
      'assinaturas do banco',
      buscarAssinaturas(periodo),
      { assinaturas: [], truncado: false },
      falhas,
    ),
  ]);

  return {
    vendas: vendas.vendas,
    assinaturas: assinaturas.assinaturas,
    resumo: resumir(vendas.vendas, assinaturas.assinaturas),
    porVendedor: porVendedor(vendas.vendas),
    truncado: { vendas: vendas.truncado, assinaturas: assinaturas.truncado },
    falhas,
  };
};
