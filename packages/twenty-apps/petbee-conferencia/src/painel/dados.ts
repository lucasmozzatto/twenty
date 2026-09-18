// As perguntas que a conferência faz ao CRM, todas de uma vez.
//
// Duas regras de filtro, e só duas:
//   VENDA      → etapa Ganho + data de FECHAMENTO no período (qualquer funil)
//   ASSINATURA → data de INÍCIO no período (qualquer status)
//
// Fechamento, e não criação, de propósito: a venda acontece quando fecha. Um
// negócio criado em agosto e ganho em setembro é venda de setembro. Qualquer
// funil e qualquer status porque a pergunta é "o que existe de cada lado"; as
// fichas da tela recortam depois.
import { resumir, porVendedor, type LinhaVendedor, type Resumo } from 'src/painel/contas';
import { ASSINATURAS, deMicros, type Filtro, listar, NEGOCIOS } from 'src/painel/crm';
import { diaCivil, limitesIso, type Periodo } from 'src/painel/periodo';

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
  // Dia civil do fechamento, AAAA-MM-DD (ver `diaCivil`).
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
  // Há outro negócio ganho do mesmo cliente no período.
  duplicada: boolean;
  // Todas as assinaturas do cliente no período foram canceladas dentro do
  // mesmo mês: pela regra do fechamento, esta venda deveria ir para Perdido.
  assinaturaCanceladaNoMes: boolean;
};

export type Assinatura = {
  id: string;
  pet: string;
  tutorId: string | null;
  tutorNome: string | null;
  inicio: string;
  cancelamento: string | null;
  status: string | null;
  cortesia: boolean;
  // Cancelada dentro do mesmo mês em que começou. Não é venda do mês.
  canceladaNoMes: boolean;
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

// Duas vendas ganhas do mesmo cliente no período quase sempre são o mesmo
// negócio cadastrado duas vezes (o card do vendedor e o que o checkout cria;
// em agosto de 2026 foram 25 pares). Contam duas vezes na receita e casam com
// as mesmas assinaturas, então a página avisa para alguém apagar uma.
const marcarDuplicadas = (vendas: Venda[]): Venda[] => {
  const porCliente = new Map<string, number>();

  for (const venda of vendas) {
    if (venda.tutorId === null) continue;
    porCliente.set(venda.tutorId, (porCliente.get(venda.tutorId) ?? 0) + 1);
  }

  return vendas.map((venda) => ({
    ...venda,
    duplicada: venda.tutorId !== null && (porCliente.get(venda.tutorId) ?? 0) > 1,
  }));
};

export const buscarVendas = async (
  periodo: Periodo,
): Promise<{ vendas: Venda[]; truncado: boolean }> => {
  const { inicioSoData, fim } = limitesIso(periodo);
  // Um operador por campo, em entradas separadas do `and`: o servidor recusa
  // `{ gte, lt }` no mesmo objeto ("must have exactly one operator").
  // A busca começa 3 horas antes do período para alcançar o fechamento "só
  // data" do primeiro dia; o dia civil, abaixo, recorta o que sobrou de fora.
  const filter: Filtro = {
    and: [
      { stage: { eq: 'WON' } },
      { closeDate: { gte: inicioSoData } },
      { closeDate: { lt: fim } },
    ],
  };

  const { nos, truncado } = await listar<NoVenda>(
    NEGOCIOS,
    filter,
    '{ closeDate: DescNullsLast }',
    CAMPOS_VENDA,
  );

  const vendas = nos
    .map((no): Venda => {
      const tutorNome = nomeCompleto(no.pointOfContact?.name ?? null);

      return {
        id: no.id,
        cliente: no.name?.trim() || tutorNome || 'Sem nome',
        fechamento: diaCivil(no.closeDate ?? no.createdAt),
        vendedorId: no.ownerId,
        tutorId: no.pointOfContactId,
        tutorNome,
        origem: no.origem,
        tipoFechamento: no.fechamento,
        funil: no.funnel,
        veredito: vereditoDaVenda(no.conferenciaBanco),
        valorCrm: deMicros(no.amount?.amountMicros),
        valorBanco: deMicros(no.valorBanco?.amountMicros),
        duplicada: false,
        assinaturaCanceladaNoMes: false,
      };
    })
    .filter((venda) => venda.fechamento >= periodo.de && venda.fechamento <= periodo.ate);

  return { vendas: marcarDuplicadas(vendas), truncado };
};

type NoAssinatura = {
  id: string;
  name: string | null;
  status: string | null;
  dataInicio: string | null;
  dataCancelamento: string | null;
  cortesia: boolean | null;
  conferenciaFunil: string | null;
  subsIdPetbee: string | null;
  tutorId: string | null;
  valorMensal: { amountMicros: number | null } | null;
  tutor: { id: string; name: Nome } | null;
};

const CAMPOS_ASSINATURA =
  'id name status dataInicio dataCancelamento cortesia conferenciaFunil subsIdPetbee tutorId valorMensal { amountMicros } tutor { id name { firstName lastName } }';

// Só o valor manda, igual à conciliação desde 17/09/2026: assinatura a R$ 0
// fica fora da conta de dinheiro; a marca "cortesia" do banco com valor
// cobrado é assinatura normal e precisa bater com a venda.
export const ehCortesia = (mrr: number | null): boolean => (mrr ?? 0) === 0;

// Assinatura cancelada dentro do mesmo mês em que começou não é venda do mês:
// o time tira a venda do funil e o negócio vai para Perdido. Cancelamento no
// mês seguinte não mexe em nada, porque o mês já fechou.
//
// Exige o status, não só a data: o banco guarda a data de um cancelamento
// revertido, e existem assinaturas ATIVAS com data preenchida (LOLLA, Lully e
// Chanel em 18/09/2026). Só a data marcaria venda boa como cancelada.
export const ehCanceladaNoMes = (
  status: string | null,
  inicio: string,
  cancelamento: string | null,
): boolean =>
  status === 'CANCELADA' &&
  cancelamento !== null &&
  cancelamento.slice(0, 7) === inicio.slice(0, 7);

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

      const inicio = no.dataInicio ?? periodo.de;

      return {
        id: no.id,
        pet: no.name?.trim() || 'Sem nome',
        tutorId: no.tutorId,
        tutorNome: nomeCompleto(no.tutor?.name ?? null),
        inicio,
        cancelamento: no.dataCancelamento,
        status: no.status,
        cortesia: ehCortesia(mrr),
        canceladaNoMes: ehCanceladaNoMes(no.status, inicio, no.dataCancelamento),
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

// Marca a venda cujo cliente só tem assinatura cancelada no mês. Só quando
// TODAS foram canceladas: se sobrou uma ativa, a venda continua de pé e a
// diferença de valor, se houver, aparece na coluna Diferença.
const marcarVendasCanceladas = (
  vendas: Venda[],
  assinaturas: Assinatura[],
): Venda[] => {
  const porTutor = new Map<string, Assinatura[]>();

  for (const assinatura of assinaturas) {
    if (assinatura.tutorId === null) continue;
    const lista = porTutor.get(assinatura.tutorId) ?? [];

    lista.push(assinatura);
    porTutor.set(assinatura.tutorId, lista);
  }

  return vendas.map((venda) => {
    const doCliente = venda.tutorId === null ? [] : (porTutor.get(venda.tutorId) ?? []);

    return {
      ...venda,
      assinaturaCanceladaNoMes:
        doCliente.length > 0 && doCliente.every((assinatura) => assinatura.canceladaNoMes),
    };
  });
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

  const vendasMarcadas = marcarVendasCanceladas(
    vendas.vendas,
    assinaturas.assinaturas,
  );

  return {
    vendas: vendasMarcadas,
    assinaturas: assinaturas.assinaturas,
    resumo: resumir(vendasMarcadas, assinaturas.assinaturas),
    porVendedor: porVendedor(vendasMarcadas),
    truncado: { vendas: vendas.truncado, assinaturas: assinaturas.truncado },
    falhas,
  };
};
