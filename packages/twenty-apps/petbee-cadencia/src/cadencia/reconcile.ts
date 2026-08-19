// Lê a fotografia do CRM, calcula o plano (plan.ts) e — fora do modo sombra — executa.
// Toda entrada do motor (cron ou evento) passa por aqui; falhas disparam o alerta.
//
// As chamadas usam GraphQL cru (fetch + token do app) em vez do cliente tipado:
// o validador do twenty-client-sdk não enxerga o campo custom `whatsapp` da Task
// aninhada via taskTargets, e estas queries são as mesmas já provadas no motor n8n.
import { PADRAO_DECISAO, PADRAO_FUP, PADRAO_MOTIVO } from './regua.ts';
import {
  computePlan,
  type OppDoFunil,
  type OppForaDoFunil,
  type PlanOp,
  type TaskAberta,
  type TaskDoFunil,
} from './plan.ts';

type Edge<T> = { node: T };
type Conexao<T> = { edges: Edge<T>[] } | null | undefined;

function nodesDe<T>(conexao: Conexao<T>): T[] {
  return (conexao?.edges ?? []).map((edge) => edge.node);
}

async function gql<TData>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<TData> {
  const url = `${process.env.TWENTY_API_URL}/graphql`;
  const resposta = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.TWENTY_APP_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const corpo = (await resposta.json()) as {
    data?: TData;
    errors?: { message: string }[];
  };

  if (corpo.errors?.length) {
    throw new Error(`GraphQL: ${corpo.errors[0].message}`);
  }
  if (!corpo.data) {
    throw new Error(`GraphQL sem data (HTTP ${resposta.status})`);
  }

  return corpo.data;
}

const GERENCIADA = (titulo: string): boolean =>
  PADRAO_FUP.test(titulo) || PADRAO_DECISAO.test(titulo) || PADRAO_MOTIVO.test(titulo);

async function carregarFunil(): Promise<OppDoFunil[]> {
  const dados = await gql<{
    opportunities: Conexao<{
      id: string;
      name: string;
      stage: string;
      fupNumero?: number | null;
      whatsapp?: string | null;
      taskTargets: Conexao<{ task: TaskDoFunil | null }>;
    }>;
  }>(
    'query { opportunities(filter: {or: [{stage: {eq: "EM_NEGOCIACAO"}}, {stage: {eq: "BREAK"}}]}, first: 200) { edges { node { id name stage fupNumero whatsapp taskTargets { edges { node { task { id title status dueAt whatsapp { primaryLinkUrl } } } } } } } } }',
  );

  return nodesDe(dados.opportunities).map((opp) => ({
    id: opp.id,
    name: opp.name,
    stage: opp.stage,
    fupNumero: opp.fupNumero,
    whatsapp: opp.whatsapp,
    tarefas: nodesDe(opp.taskTargets)
      .map((alvo) => alvo.task)
      .filter((task): task is TaskDoFunil => task != null),
  }));
}

async function carregarAbertas(): Promise<TaskAberta[]> {
  const dados = await gql<{
    tasks: Conexao<{
      id: string;
      title: string;
      taskTargets: Conexao<{ targetOpportunityId: string | null }>;
    }>;
  }>(
    'query { tasks(filter: {status: {eq: "TODO"}}, first: 300) { edges { node { id title taskTargets { edges { node { targetOpportunityId } } } } } } }',
  );

  return nodesDe(dados.tasks).map((task) => ({
    id: task.id,
    title: task.title,
    targetOpportunityId:
      nodesDe(task.taskTargets)[0]?.targetOpportunityId ?? null,
  }));
}

async function carregarPerdidasSemMotivo(): Promise<
  { id: string; name: string }[]
> {
  const dados = await gql<{
    opportunities: Conexao<{ id: string; name: string }>;
  }>(
    'query { opportunities(filter: {stage: {eq: "LOST"}, motivoLost: {is: NULL}}, first: 50) { edges { node { id name } } } }',
  );

  return nodesDe(dados.opportunities);
}

async function carregarForaDoFunil(
  abertas: TaskAberta[],
  idsDoFunil: Set<string>,
): Promise<Record<string, OppForaDoFunil>> {
  const candidatas = new Set<string>();

  for (const task of abertas) {
    if (!GERENCIADA(task.title)) continue;
    if (task.targetOpportunityId && !idsDoFunil.has(task.targetOpportunityId)) {
      candidatas.add(task.targetOpportunityId);
    }
  }

  const ids = [...candidatas].slice(0, 100);

  if (!ids.length) return {};

  const dados = await gql<{ opportunities: Conexao<OppForaDoFunil> }>(
    'query L($f: OpportunityFilterInput) { opportunities(filter: $f, first: 100) { edges { node { id stage motivoLost } } } }',
    { f: { id: { in: ids } } },
  );

  const mapa: Record<string, OppForaDoFunil> = {};

  for (const opp of nodesDe(dados.opportunities)) mapa[opp.id] = opp;

  return mapa;
}

async function executarOp(op: PlanOp): Promise<void> {
  if (op.kind === 'createTask') {
    const criada = await gql<{ createTask: { id: string } }>(
      'mutation C($data: TaskCreateInput!) { createTask(data: $data) { id } }',
      { data: op.data },
    );

    await gql(
      'mutation V($data: TaskTargetCreateInput!) { createTaskTarget(data: $data) { id } }',
      { data: { taskId: criada.createTask.id, targetOpportunityId: op.oppId } },
    );

    return;
  }

  if (op.kind === 'updateTask') {
    await gql(
      `mutation A($data: TaskUpdateInput!) { updateTask(id: "${op.taskId}", data: $data) { id } }`,
      { data: op.data },
    );

    return;
  }

  if (op.kind === 'deleteTask') {
    await gql(`mutation { deleteTask(id: "${op.taskId}") { id } }`);

    return;
  }

  await gql(
    `mutation O($data: OpportunityUpdateInput!) { updateOpportunity(id: "${op.oppId}", data: $data) { id } }`,
    { data: op.data },
  );
}

function resumoDe(op: PlanOp): string {
  if (op.kind === 'createTask') return `createTask: ${op.data.title}`;
  if (op.kind === 'updateTask') return `updateTask ${op.taskId}: ${JSON.stringify(op.data)}`;
  if (op.kind === 'deleteTask') return `deleteTask ${op.taskId}`;

  return `updateOpportunity ${op.oppId}: fupNumero=${op.data.fupNumero}`;
}

async function avisarFalha(erro: unknown): Promise<void> {
  const webhook = (process.env.CADENCIA_ALERT_WEBHOOK_URL ?? '').trim();

  if (!webhook) return;

  const mensagem = erro instanceof Error ? erro.message : String(erro);

  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: `🚨 Cadência Petbee (app): falha na reconciliação — ${mensagem}`,
      }),
    });
  } catch {
    // O alerta nunca pode mascarar o erro original.
  }
}

export type ResultadoReconcile = {
  gatilho: string;
  dryRun: boolean;
  totalOps: number;
  executadas: number;
  ops: string[];
};

export async function reconcile(gatilho: string): Promise<ResultadoReconcile> {
  // Sombra por padrão: só escreve quando a variável for exatamente "false".
  const dryRun = (process.env.CADENCIA_DRY_RUN ?? 'true').trim() !== 'false';

  try {
    const funil = await carregarFunil();
    const abertas = await carregarAbertas();
    const perdidasSemMotivo = await carregarPerdidasSemMotivo();
    const foraDoFunil = await carregarForaDoFunil(
      abertas,
      new Set(funil.map((opp) => opp.id)),
    );

    const ops = computePlan({
      agora: new Date(),
      funil,
      abertas,
      perdidasSemMotivo,
      foraDoFunil,
    });

    let executadas = 0;

    if (!dryRun) {
      for (const op of ops) {
        await executarOp(op);
        executadas += 1;
      }
    }

    const resultado: ResultadoReconcile = {
      gatilho,
      dryRun,
      totalOps: ops.length,
      executadas,
      ops: ops.map(resumoDe),
    };

    console.log(`[cadencia] ${JSON.stringify(resultado)}`);

    return resultado;
  } catch (erro) {
    await avisarFalha(erro);
    throw erro;
  }
}
