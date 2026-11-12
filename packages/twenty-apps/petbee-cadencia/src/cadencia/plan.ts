// Reconciliação de estado desejado — porte fiel do nó "Plano de cadência" (n8n v10).
// Entrada: fotografia do funil vivo + tasks abertas. Saída: lista de operações que
// tornam o CRM igual ao estado desejado. Função PURA: nada de rede ou relógio próprio.
import {
  markdownDecisao,
  markdownDecisaoFechamento,
  numeroFechamentoDe,
  PADRAO_DECISAO,
  PADRAO_FECHAMENTO,
  PADRAO_FUP,
  PADRAO_MOTIVO,
  proximas,
  proximoHorarioFechamento,
  TOQUES_FECHAMENTO,
  tituloDecisaoDe,
  tituloDecisaoFechamentoDe,
  tituloFechamentoDe,
  tituloFinalDe,
  tituloMotivoDe,
  horarioSP,
  VITORIA_WORKSPACE_MEMBER_ID,
  zapDe,
  type Zap,
} from './regua.ts';

export type TaskDoFunil = {
  id: string;
  title: string;
  status: string;
  dueAt?: string | null;
  whatsapp?: { primaryLinkUrl?: string | null } | null;
  // Ausente (undefined) quando a leitura não trouxe o campo: aí não se cura.
  assigneeId?: string | null;
};

export type OppDoFunil = {
  id: string;
  name: string;
  stage: string;
  fupNumero?: number | null;
  whatsapp?: string | null;
  ownerId?: string | null;
  tarefas: TaskDoFunil[];
};

export type TaskAberta = {
  id: string;
  title: string;
  targetOpportunityId: string | null;
  assigneeId?: string | null;
};

export type OppForaDoFunil = {
  id: string;
  stage: string;
  motivoLost?: string | null;
};

export type PlanInput = {
  agora: Date;
  funil: OppDoFunil[];
  abertas: TaskAberta[];
  perdidasSemMotivo: { id: string; name: string; ownerId?: string | null }[];
  // Negócios (fora do funil vivo) que são alvo de alguma task gerenciada aberta, por id.
  foraDoFunil: Record<string, OppForaDoFunil>;
};

// Etapas em que a cadência trabalha. Fechamento entrou em 12/11/2026.
export const ETAPAS_DO_FUNIL_VIVO = ['EM_NEGOCIACAO', 'FECHAMENTO', 'BREAK'];

export type TaskCreateData = {
  title: string;
  status: 'TODO';
  dueAt: string;
  assigneeId: string;
  whatsapp?: { primaryLinkLabel: string; primaryLinkUrl: string };
  bodyV2?: { markdown: string };
};

export type PlanOp =
  | { kind: 'createTask'; oppId: string; data: TaskCreateData }
  | { kind: 'updateTask'; taskId: string; data: Record<string, unknown> }
  | { kind: 'deleteTask'; taskId: string }
  | { kind: 'updateOpportunity'; oppId: string; data: { fupNumero: number } };

export type EventoOportunidade = {
  workspaceMemberId?: string | null;
  recordId?: string | null;
  properties?: {
    before?: { stage?: string | null } | null;
    after?: {
      id?: string | null;
      stage?: string | null;
      motivoLost?: string | null;
      funnel?: string | null;
    } | null;
  } | null;
};

// A régua inteira é do funil Vendas. Funil desconhecido (evento sem o campo)
// passa: quem decide nesse caso é o handler, depois de perguntar ao CRM.
export function travaValeParaFunil(funil: string | null | undefined): boolean {
  return funil === undefined || funil === null || funil === 'VENDAS';
}

// Trava do Perdido: humano arrastou pro LOST sem motivo → devolve pra etapa anterior.
// Só vale para gente (workspaceMemberId presente) — API/inbox passa direto e a
// guarda "Preencher motivo" cobra. Retorna o que restaurar, ou null pra deixar passar.
export function etapaParaDevolver(
  evento: EventoOportunidade,
): { oppId: string; etapa: string } | null {
  if (!evento?.workspaceMemberId) return null;

  const antes = evento.properties?.before;
  const depois = evento.properties?.after;
  const oppId = depois?.id ?? evento.recordId ?? null;

  if (!oppId) return null;
  if (depois?.stage !== 'LOST') return null;
  if (depois?.motivoLost) return null;
  if (!travaValeParaFunil(depois?.funnel)) return null;

  const etapaAnterior = antes?.stage;

  if (!etapaAnterior || etapaAnterior === 'LOST') return null;

  return { oppId, etapa: etapaAnterior };
}

function camposZap(zap: Zap): {
  whatsapp: { primaryLinkLabel: string; primaryLinkUrl: string };
  bodyV2: { markdown: string };
} {
  return {
    whatsapp: { primaryLinkLabel: zap.label, primaryLinkUrl: zap.url },
    bodyV2: { markdown: zap.markdown },
  };
}

// Responsável pela task = dono do card (decisão do dono do painel, 30/09/2026;
// até então toda task ia para a Vitoria). Card sem dono cai na Vitoria para
// nenhuma task ficar sem responsável.
export function responsavelDe(ownerId: string | null | undefined): string {
  return ownerId ?? VITORIA_WORKSPACE_MEMBER_ID;
}

function opCreate(
  oppId: string,
  responsavel: string,
  titulo: string,
  dueAt: string,
  zap: Zap | null,
  markdown?: string,
): PlanOp {
  const data: TaskCreateData = {
    title: titulo,
    status: 'TODO',
    dueAt,
    assigneeId: responsavel,
  };

  if (zap) Object.assign(data, camposZap(zap));
  if (markdown) data.bodyV2 = { markdown };

  return { kind: 'createTask', oppId, data };
}

// Self-heal de task aberta: link do WhatsApp velho e responsável diferente do
// dono do card, numa op só. Trocou o dono, as tasks abertas vão junto;
// vencimento editado à mão continua respeitado. Task sem o campo assigneeId
// na leitura não é tocada.
function opCurar(task: TaskDoFunil, zap: Zap | null, responsavel: string): PlanOp | null {
  const data: Record<string, unknown> = {};

  if (zap && linkDesatualizado(task)) Object.assign(data, camposZap(zap));
  if (task.assigneeId !== undefined && task.assigneeId !== responsavel) {
    data.assigneeId = responsavel;
  }

  return Object.keys(data).length ? { kind: 'updateTask', taskId: task.id, data } : null;
}

function numDe(titulo: string): number | null {
  const m = titulo.match(/^FUP (\d+) /);

  return m ? parseInt(m[1], 10) : null;
}

// Régua de Fechamento: um toque aberto por vez, o próximo nasce quando o anterior
// é concluído, no horário seguinte (8h, 14h, 17h). A base é o vencimento do toque
// concluído ou agora, o que vier depois: adiantar o toque das 8h não puxa o das
// 14h para as 8h, e atrasar pula para o próximo horário que ainda não passou.
// Depois do toque 30, a decisão fica aberta até alguém mover o card.
function planoFechamento(
  opp: OppDoFunil,
  tarefas: TaskDoFunil[],
  agora: Date,
  zap: Zap | null,
  responsavel: string,
): PlanOp[] {
  const ops: PlanOp[] = [];
  const concluidos = tarefas.filter(
    (t) => t.status === 'DONE' && numeroFechamentoDe(t.title) != null,
  );
  const feitos = concluidos.length
    ? Math.max(...concluidos.map((t) => numeroFechamentoDe(t.title) as number))
    : 0;
  const tituloDecisao = tituloDecisaoFechamentoDe(opp.name);

  // A régua de negociação e a do Break não valem aqui.
  for (const t of tarefas) {
    if (t.status === 'DONE') continue;
    if (PADRAO_FUP.test(t.title)) ops.push({ kind: 'deleteTask', taskId: t.id });
    if (
      PADRAO_DECISAO.test(t.title) &&
      (t.title !== tituloDecisao || feitos < TOQUES_FECHAMENTO)
    ) {
      ops.push({ kind: 'deleteTask', taskId: t.id });
    }
  }

  const esperado = feitos < TOQUES_FECHAMENTO ? feitos + 1 : null;
  let jaTemEsperado: TaskDoFunil | null = null;

  for (const t of tarefas) {
    const numero = numeroFechamentoDe(t.title);

    if (t.status === 'DONE' || numero == null) continue;
    if (numero === esperado) {
      jaTemEsperado = t;
    } else if (numero <= feitos) {
      ops.push({ kind: 'updateTask', taskId: t.id, data: { status: 'DONE' } });
    } else {
      ops.push({ kind: 'deleteTask', taskId: t.id });
    }
  }

  if (esperado != null && jaTemEsperado) {
    const cura = opCurar(jaTemEsperado, zap, responsavel);

    if (cura) ops.push(cura);
  } else if (esperado != null) {
    const ultimo = concluidos.find((t) => numeroFechamentoDe(t.title) === feitos);
    const vencimento = ultimo?.dueAt ? new Date(ultimo.dueAt).getTime() : 0;
    const base = new Date(Math.max(agora.getTime(), vencimento));
    const horario = proximoHorarioFechamento(base);

    ops.push(
      opCreate(
        opp.id,
        responsavel,
        tituloFechamentoDe(esperado, horario.rotulo, opp.name),
        horario.dueAt,
        zap,
      ),
    );
  }

  if (esperado == null) {
    const decisaoAberta = tarefas.find(
      (t) => t.title === tituloDecisao && t.status !== 'DONE',
    );

    if (!decisaoAberta) {
      ops.push(
        opCreate(
          opp.id,
          responsavel,
          tituloDecisao,
          agora.toISOString(),
          zap,
          markdownDecisaoFechamento(zap),
        ),
      );
    } else {
      const cura = opCurar(decisaoAberta, zap, responsavel);

      if (cura) ops.push(cura);
    }
  }

  return ops;
}

// Toques de Fechamento abertos num card que saiu da etapa somem.
function apagarFechamentoAberto(tarefas: TaskDoFunil[]): PlanOp[] {
  return tarefas
    .filter((t) => t.status !== 'DONE' && PADRAO_FECHAMENTO.test(t.title))
    .map((t): PlanOp => ({ kind: 'deleteTask', taskId: t.id }));
}

function linkDesatualizado(task: TaskDoFunil): boolean {
  const url = task.whatsapp?.primaryLinkUrl;

  // Velho = sem link, wa.me, a inbox V1 (aposentada) ou sem o `?tel=` que abre
  // direto na conversa. Assim as tasks antigas se curam sozinhas na reconciliação.
  return (
    !url ||
    url.indexOf('wa.me') !== -1 ||
    url.indexOf('inbox.petbeetools') !== -1 ||
    url.indexOf('?tel=') === -1
  );
}

export function computePlan(input: PlanInput): PlanOp[] {
  const { agora, funil, abertas, perdidasSemMotivo, foraDoFunil } = input;
  const ops: PlanOp[] = [];

  for (const opp of funil) {
    // Dedup anti-corrida: segunda task gerenciada ABERTA com mesmo título é excluída.
    // Toque de Fechamento é comparado pelo número: o rótulo do horário pode mudar.
    const vistos: Record<string, boolean> = {};
    const tarefas: TaskDoFunil[] = [];

    for (const t of opp.tarefas) {
      const numeroFechamento = numeroFechamentoDe(t.title);
      const gerenciadaAberta =
        t.status !== 'DONE' &&
        (PADRAO_FUP.test(t.title) ||
          PADRAO_DECISAO.test(t.title) ||
          numeroFechamento != null);
      const chave = numeroFechamento != null ? `fechamento:${numeroFechamento}` : t.title;

      if (gerenciadaAberta && vistos[chave]) {
        ops.push({ kind: 'deleteTask', taskId: t.id });
        continue;
      }
      if (gerenciadaAberta) vistos[chave] = true;
      tarefas.push(t);
    }

    const feitos = tarefas
      .filter((t) => t.status === 'DONE')
      .map((t) => numDe(t.title))
      .filter((n): n is number => n != null);
    const maxFeito = feitos.length ? Math.max(...feitos) : 0;
    const zap = zapDe(opp.whatsapp);
    const responsavel = responsavelDe(opp.ownerId);

    if (opp.stage === 'FECHAMENTO') {
      ops.push(...planoFechamento(opp, tarefas, agora, zap, responsavel));
      continue;
    }

    ops.push(...apagarFechamentoAberto(tarefas));

    if (opp.stage === 'EM_NEGOCIACAO') {
      const fupCampo = opp.fupNumero == null ? 0 : opp.fupNumero;
      const fupReal = Math.max(fupCampo, maxFeito);

      // fupNumero acompanha o maior FUP realmente concluído (teto 9).
      if (fupCampo !== Math.min(fupReal, 9)) {
        ops.push({
          kind: 'updateOpportunity',
          oppId: opp.id,
          data: { fupNumero: Math.min(fupReal, 9) },
        });
      }

      const esperadas = proximas(opp.name, fupReal, agora);
      const titulosEsperados = new Set(esperadas.map((e) => e.titulo));

      // FUP aberta que não é a esperada: nº já alcançado vira DONE, futura órfã é excluída.
      for (const t of tarefas) {
        if (
          t.status === 'DONE' ||
          !PADRAO_FUP.test(t.title) ||
          titulosEsperados.has(t.title)
        )
          continue;

        const n = numDe(t.title);

        if (n != null && n <= fupReal) {
          ops.push({ kind: 'updateTask', taskId: t.id, data: { status: 'DONE' } });
        } else {
          ops.push({ kind: 'deleteTask', taskId: t.id });
        }
      }

      // Esperada faltando é criada; aberta existente só ganha self-heal (link
      // e responsável) — vencimento editado à mão é respeitado.
      for (const esperada of esperadas) {
        const jaTem = tarefas.find((t) => t.title === esperada.titulo);

        if (!jaTem) {
          ops.push(opCreate(opp.id, responsavel, esperada.titulo, esperada.dueAt, zap));
        } else if (jaTem.status !== 'DONE') {
          const cura = opCurar(jaTem, zap, responsavel);

          if (cura) ops.push(cura);
        }
      }

      // Guarda pós-FUP 9: card parado em Em Negociação cobra a decisão até mover.
      const tituloDecisao = tituloDecisaoDe(opp.name);

      for (const t of tarefas) {
        if (t.status === 'DONE' || !PADRAO_DECISAO.test(t.title)) continue;
        if (fupReal < 9 || t.title !== tituloDecisao) {
          ops.push({ kind: 'deleteTask', taskId: t.id });
        }
      }

      const decisaoAberta = tarefas.find(
        (t) => t.title === tituloDecisao && t.status !== 'DONE',
      );

      if (fupReal >= 9 && !decisaoAberta) {
        ops.push(
          opCreate(
            opp.id,
            responsavel,
            tituloDecisao,
            agora.toISOString(),
            zap,
            markdownDecisao(zap),
          ),
        );
      } else if (fupReal >= 9 && decisaoAberta) {
        const cura = opCurar(decisaoAberta, zap, responsavel);

        if (cura) ops.push(cura);
      }
    } else {
      // BREAK: só a "FUP final" (+25 dias, 11h SP) fica de pé; decisão e FUPs somem.
      const tituloFinal = tituloFinalDe(opp.name);

      for (const t of tarefas) {
        if (t.status === 'DONE') continue;

        const fupIndevida = PADRAO_FUP.test(t.title) && t.title !== tituloFinal;

        if (fupIndevida || PADRAO_DECISAO.test(t.title)) {
          ops.push({ kind: 'deleteTask', taskId: t.id });
        }
      }

      const jaFinal = tarefas.find((t) => t.title === tituloFinal);

      if (!jaFinal) {
        ops.push(opCreate(opp.id, responsavel, tituloFinal, horarioSP(agora, 25, 11, 0), zap));
      } else if (jaFinal.status !== 'DONE') {
        const cura = opCurar(jaFinal, zap, responsavel);

        if (cura) ops.push(cura);
      }
    }
  }

  // Órfãs: task gerenciada aberta apontando pra negócio que saiu do funil vivo.
  for (const t of abertas) {
    if (
      !PADRAO_FUP.test(t.title) &&
      !PADRAO_DECISAO.test(t.title) &&
      !PADRAO_FECHAMENTO.test(t.title)
    )
      continue;
    if (!t.targetOpportunityId) continue;

    const opp = foraDoFunil[t.targetOpportunityId];

    if (!opp) continue;
    if (!ETAPAS_DO_FUNIL_VIVO.includes(opp.stage)) {
      ops.push({ kind: 'deleteTask', taskId: t.id });
    }
  }

  // Perdido sem motivo ganha a task-guarda (due imediato, sem zap), para o
  // dono do card perdido.
  const donoDaPerdida: Record<string, string> = {};

  for (const perdida of perdidasSemMotivo) {
    const titulo = tituloMotivoDe(perdida.name);

    donoDaPerdida[perdida.id] = responsavelDe(perdida.ownerId);

    if (!abertas.find((t) => t.title === titulo)) {
      ops.push(
        opCreate(perdida.id, donoDaPerdida[perdida.id], titulo, agora.toISOString(), null),
      );
    }
  }

  // Guarda de motivo some quando o motivo entra (ou o card sai de Perdido); dedup.
  // A que fica segue o dono do card, como as outras.
  const vistosMotivo: Record<string, boolean> = {};

  for (const t of abertas) {
    if (!PADRAO_MOTIVO.test(t.title)) continue;
    if (!t.targetOpportunityId) continue;

    const opp = foraDoFunil[t.targetOpportunityId];

    if (!opp) continue;
    if (opp.stage !== 'LOST' || opp.motivoLost || vistosMotivo[t.title]) {
      ops.push({ kind: 'deleteTask', taskId: t.id });
    } else {
      vistosMotivo[t.title] = true;

      const responsavel = donoDaPerdida[t.targetOpportunityId];

      if (
        responsavel !== undefined &&
        t.assigneeId !== undefined &&
        t.assigneeId !== responsavel
      ) {
        ops.push({ kind: 'updateTask', taskId: t.id, data: { assigneeId: responsavel } });
      }
    }
  }

  return ops;
}
