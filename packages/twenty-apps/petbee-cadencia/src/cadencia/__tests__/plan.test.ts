import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  computePlan,
  etapaParaDevolver,
  type EventoOportunidade,
  type OppDoFunil,
  type PlanInput,
  type PlanOp,
  travaValeParaFunil,
} from '../plan.ts';

const AGORA = new Date('2026-08-19T13:00:00.000Z');

function entrada(parcial: Partial<PlanInput>): PlanInput {
  return {
    agora: AGORA,
    funil: [],
    abertas: [],
    perdidasSemMotivo: [],
    foraDoFunil: {},
    ...parcial,
  };
}

function oppDe(parcial: Partial<OppDoFunil>): OppDoFunil {
  return {
    id: 'opp-1',
    name: 'Luc Test',
    stage: 'EM_NEGOCIACAO',
    fupNumero: 0,
    whatsapp: '+55 41 99999-8888',
    tarefas: [],
    ...parcial,
  };
}

function criacoes(ops: PlanOp[]): Extract<PlanOp, { kind: 'createTask' }>[] {
  return ops.filter((op): op is Extract<PlanOp, { kind: 'createTask' }> => op.kind === 'createTask');
}

test('negócio novo em Em Negociação ganha a FUP 1 imediata com zap; sem dono, cai na Vitória', () => {
  const ops = computePlan(entrada({ funil: [oppDe({})] }));
  const criadas = criacoes(ops);

  assert.equal(criadas.length, 1);
  assert.equal(criadas[0].data.title, 'FUP 1 (mensagem, abordar agora) — Luc Test');
  assert.equal(criadas[0].data.dueAt, AGORA.toISOString());
  assert.equal(criadas[0].data.assigneeId, '69572821-c2f4-4923-9c68-23381b665a49');
  assert.equal(criadas[0].data.whatsapp?.primaryLinkUrl, 'https://wpp.petbeetools.com.br/?tel=5541999998888');
});

test('card com dono: a FUP nova vai para o dono do card', () => {
  const ops = computePlan(entrada({ funil: [oppDe({ ownerId: 'membro-rodrigo' })] }));
  const criadas = criacoes(ops);

  assert.equal(criadas.length, 1);
  assert.equal(criadas[0].data.assigneeId, 'membro-rodrigo');
});

test('trocou o dono: a FUP aberta muda de responsável, sem mexer em link nem vencimento', () => {
  const opp = oppDe({
    ownerId: 'membro-rodrigo',
    tarefas: [
      {
        id: 't1',
        title: 'FUP 1 (mensagem, abordar agora) — Luc Test',
        status: 'TODO',
        assigneeId: '69572821-c2f4-4923-9c68-23381b665a49',
        whatsapp: { primaryLinkUrl: 'https://wpp.petbeetools.com.br/?tel=5541999998888' },
      },
    ],
  });

  assert.deepEqual(computePlan(entrada({ funil: [opp] })), [
    { kind: 'updateTask', taskId: 't1', data: { assigneeId: 'membro-rodrigo' } },
  ]);
});

test('task aberta lida sem o campo assigneeId não é tocada', () => {
  const opp = oppDe({
    ownerId: 'membro-rodrigo',
    tarefas: [
      {
        id: 't1',
        title: 'FUP 1 (mensagem, abordar agora) — Luc Test',
        status: 'TODO',
        whatsapp: { primaryLinkUrl: 'https://wpp.petbeetools.com.br/?tel=5541999998888' },
      },
    ],
  });

  assert.deepEqual(computePlan(entrada({ funil: [opp] })), []);
});

test('guarda de motivo vai para o dono do card perdido, e a aberta segue o dono', () => {
  const perdida = { id: 'opp-9', name: 'Perdida X', ownerId: 'membro-rodrigo' };
  const criada = criacoes(computePlan(entrada({ perdidasSemMotivo: [perdida] })));

  assert.equal(criada.length, 1);
  assert.equal(criada[0].oppId, 'opp-9');
  assert.equal(criada[0].data.assigneeId, 'membro-rodrigo');

  const ops = computePlan(
    entrada({
      perdidasSemMotivo: [perdida],
      abertas: [
        {
          id: 'tm',
          title: criada[0].data.title,
          targetOpportunityId: 'opp-9',
          assigneeId: '69572821-c2f4-4923-9c68-23381b665a49',
        },
      ],
      foraDoFunil: { 'opp-9': { id: 'opp-9', stage: 'LOST', motivoLost: null } },
    }),
  );

  assert.deepEqual(ops, [
    { kind: 'updateTask', taskId: 'tm', data: { assigneeId: 'membro-rodrigo' } },
  ]);
});

test('FUP 9 concluída sem mover o card cobra a decisão (guarda pós-régua)', () => {
  const opp = oppDe({
    fupNumero: 8,
    tarefas: [{ id: 't9', title: 'FUP 9 (mensagem, manhã) — Luc Test', status: 'DONE' }],
  });
  const ops = computePlan(entrada({ funil: [opp] }));

  assert.ok(
    ops.find(
      (op) => op.kind === 'updateOpportunity' && op.data.fupNumero === 9,
    ),
    'fupNumero deve sincronizar para 9',
  );

  const criadas = criacoes(ops);

  assert.equal(criadas.length, 1);
  assert.equal(criadas[0].data.title, 'Decidir: Break ou Perdido? — Luc Test');
  assert.ok(criadas[0].data.bodyV2?.markdown.includes('9 toques feitos'));
});

test('decisão concluída sem mover o card é recriada (guarda insiste)', () => {
  const opp = oppDe({
    fupNumero: 9,
    tarefas: [
      { id: 'td', title: 'Decidir: Break ou Perdido? — Luc Test', status: 'DONE' },
    ],
  });
  const criadas = criacoes(computePlan(entrada({ funil: [opp] })));

  assert.equal(criadas.length, 1);
  assert.equal(criadas[0].data.title, 'Decidir: Break ou Perdido? — Luc Test');
});

test('mover pro Break apaga decisão e FUPs abertas e agenda a FUP final (+25d, 11h SP)', () => {
  const opp = oppDe({
    stage: 'BREAK',
    fupNumero: 9,
    tarefas: [
      { id: 'td', title: 'Decidir: Break ou Perdido? — Luc Test', status: 'TODO' },
      { id: 't9', title: 'FUP 9 (mensagem, manhã) — Luc Test', status: 'TODO' },
    ],
  });
  const ops = computePlan(entrada({ funil: [opp] }));

  assert.deepEqual(
    ops.filter((op) => op.kind === 'deleteTask').map((op) => op.taskId).sort(),
    ['t9', 'td'],
  );

  const criadas = criacoes(ops);

  assert.equal(criadas.length, 1);
  assert.equal(criadas[0].data.title, 'FUP final (antes do lost) — Luc Test');
  assert.equal(criadas[0].data.dueAt, '2026-09-13T14:00:00.000Z');
});

test('duplicata aberta da mesma FUP (corrida) é removida', () => {
  const opp = oppDe({
    tarefas: [
      { id: 'a', title: 'FUP 1 (mensagem, abordar agora) — Luc Test', status: 'TODO' },
      { id: 'b', title: 'FUP 1 (mensagem, abordar agora) — Luc Test', status: 'TODO' },
    ],
  });
  const ops = computePlan(entrada({ funil: [opp] }));

  assert.deepEqual(
    ops.filter((op) => op.kind === 'deleteTask').map((op) => op.taskId),
    ['b'],
  );
  assert.equal(criacoes(ops).length, 0);
});

test('task manual (título fora dos padrões) nunca é tocada', () => {
  const opp = oppDe({
    fupNumero: 1,
    tarefas: [
      { id: 'm', title: 'Ligar pro veterinário parceiro', status: 'TODO' },
      { id: 't2', title: 'FUP 2 (ligação, ~1h30 depois) — Luc Test', status: 'TODO' },
    ],
  });
  const ops = computePlan(entrada({ funil: [opp] }));

  assert.ok(!ops.find((op) => op.kind === 'deleteTask' && op.taskId === 'm'));
  assert.ok(!ops.find((op) => op.kind === 'updateTask' && op.taskId === 'm'));
});

test('vencimento editado à mão é respeitado (sem updateTask de dueAt)', () => {
  const opp = oppDe({
    fupNumero: 1,
    tarefas: [
      {
        id: 't2',
        title: 'FUP 2 (ligação, ~1h30 depois) — Luc Test',
        status: 'TODO',
        dueAt: '2026-08-25T12:00:00.000Z',
        whatsapp: { primaryLinkUrl: 'https://wpp.petbeetools.com.br/?tel=5541999998888' },
      },
    ],
  });
  const ops = computePlan(entrada({ funil: [opp] }));

  assert.deepEqual(ops, []);
});

test('link wa.me antigo ganha self-heal para a conversa', () => {
  const opp = oppDe({
    fupNumero: 1,
    tarefas: [
      {
        id: 't2',
        title: 'FUP 2 (ligação, ~1h30 depois) — Luc Test',
        status: 'TODO',
        whatsapp: { primaryLinkUrl: 'https://wa.me/5541999998888' },
      },
    ],
  });
  const ops = computePlan(entrada({ funil: [opp] }));

  assert.equal(ops.length, 1);
  assert.equal(ops[0].kind, 'updateTask');
});

test('link da inbox V1 (sem ?tel=) é curado para o endereço novo', () => {
  const opp = oppDe({
    fupNumero: 1,
    tarefas: [
      {
        id: 't2',
        title: 'FUP 2 (ligação, ~1h30 depois) — Luc Test',
        status: 'TODO',
        whatsapp: { primaryLinkUrl: 'https://inbox.petbeetools.com.br/' },
      },
    ],
  });
  const ops = computePlan(entrada({ funil: [opp] }));

  assert.equal(ops.length, 1);
  assert.equal(ops[0].kind, 'updateTask');
  // `data` é um saco genérico (Record<string, unknown>); o teste sabe o formato.
  const data = (ops[0] as Extract<PlanOp, { kind: 'updateTask' }>).data as {
    whatsapp?: { primaryLinkUrl?: string };
  };

  assert.equal(
    data.whatsapp?.primaryLinkUrl,
    'https://wpp.petbeetools.com.br/?tel=5541999998888',
  );
});

test('task gerenciada de negócio que saiu do funil (Ganhou/Perdido) é apagada', () => {
  const ops = computePlan(
    entrada({
      abertas: [
        { id: 'x', title: 'FUP 3 (mensagem + ligação, manhã) — Fulano', targetOpportunityId: 'opp-won' },
        { id: 'y', title: 'Decidir: Break ou Perdido? — Fulano', targetOpportunityId: 'opp-won' },
        { id: 'z', title: 'Task manual solta', targetOpportunityId: 'opp-won' },
      ],
      foraDoFunil: { 'opp-won': { id: 'opp-won', stage: 'WON' } },
    }),
  );

  assert.deepEqual(
    ops.filter((op) => op.kind === 'deleteTask').map((op) => op.taskId).sort(),
    ['x', 'y'],
  );
});

test('Perdido sem motivo ganha a guarda; com motivo preenchido a guarda cai', () => {
  const criando = computePlan(
    entrada({ perdidasSemMotivo: [{ id: 'opp-lost', name: 'Fulano' }] }),
  );
  const criadas = criacoes(criando);

  assert.equal(criadas.length, 1);
  assert.equal(criadas[0].data.title, 'Preencher motivo da perda — Fulano');

  const limpando = computePlan(
    entrada({
      abertas: [
        { id: 'g', title: 'Preencher motivo da perda — Fulano', targetOpportunityId: 'opp-lost' },
      ],
      foraDoFunil: {
        'opp-lost': { id: 'opp-lost', stage: 'LOST', motivoLost: 'SEM_ORCAMENTO' },
      },
    }),
  );

  assert.deepEqual(
    limpando.filter((op) => op.kind === 'deleteTask').map((op) => op.taskId),
    ['g'],
  );
});

function eventoDe(parcial: {
  humano?: boolean;
  antes?: string | null;
  depois?: string | null;
  motivo?: string | null;
  funil?: string | null;
}): EventoOportunidade {
  return {
    workspaceMemberId: parcial.humano === false ? null : 'membro-vitoria',
    recordId: 'opp-1',
    properties: {
      before: { stage: parcial.antes ?? 'EM_NEGOCIACAO' },
      after: {
        id: 'opp-1',
        stage: parcial.depois ?? 'LOST',
        motivoLost: parcial.motivo ?? null,
        ...('funil' in parcial ? { funnel: parcial.funil } : {}),
      },
    },
  };
}

test('trava: card do funil Referidos arrastado pro Perdido não é devolvido', () => {
  assert.equal(etapaParaDevolver(eventoDe({ funil: 'REFERIDOS' })), null);
});

test('trava: card do funil Vendas, ou evento sem o campo funil, segue a regra', () => {
  assert.deepEqual(etapaParaDevolver(eventoDe({ funil: 'VENDAS' })), {
    oppId: 'opp-1',
    etapa: 'EM_NEGOCIACAO',
  });
  assert.deepEqual(etapaParaDevolver(eventoDe({})), {
    oppId: 'opp-1',
    etapa: 'EM_NEGOCIACAO',
  });
  assert.equal(travaValeParaFunil('REFERIDOS'), false);
  assert.equal(travaValeParaFunil(null), true);
});

test('trava: humano arrasta pro Perdido sem motivo → devolve pra etapa anterior', () => {
  assert.deepEqual(etapaParaDevolver(eventoDe({})), {
    oppId: 'opp-1',
    etapa: 'EM_NEGOCIACAO',
  });
});

test('trava: com motivo preenchido, o Perdido passa', () => {
  assert.equal(etapaParaDevolver(eventoDe({ motivo: 'SEM_ORCAMENTO' })), null);
});

test('trava: máquina (API/inbox) sem motivo passa direto — a guarda cobra', () => {
  assert.equal(etapaParaDevolver(eventoDe({ humano: false })), null);
});

test('trava: edição dentro do Perdido (antes já era LOST) não devolve', () => {
  assert.equal(etapaParaDevolver(eventoDe({ antes: 'LOST' })), null);
});

test('trava: mudança para etapa que não é Perdido passa', () => {
  assert.equal(etapaParaDevolver(eventoDe({ depois: 'BREAK' })), null);
});

test('concluir várias FUPs de uma vez agenda só a próxima certa', () => {
  const opp = oppDe({
    fupNumero: 0,
    tarefas: [
      { id: 't1', title: 'FUP 1 (mensagem, abordar agora) — Luc Test', status: 'DONE' },
      { id: 't2', title: 'FUP 2 (ligação, ~1h30 depois) — Luc Test', status: 'DONE' },
      { id: 't3', title: 'FUP 3 (mensagem + ligação, manhã) — Luc Test', status: 'DONE' },
    ],
  });
  const ops = computePlan(entrada({ funil: [opp] }));
  const criadas = criacoes(ops);

  assert.equal(criadas.length, 1);
  assert.ok(criadas[0].data.title.startsWith('FUP 4 '));
  assert.ok(
    ops.find((op) => op.kind === 'updateOpportunity' && op.data.fupNumero === 3),
  );
});

const ZAP_OK = { primaryLinkUrl: 'https://wpp.petbeetools.com.br/?tel=5541999998888' };

test('card entra em Fechamento: FUP aberta some e nasce o toque 1 no próximo horário', () => {
  // AGORA = 10h SP → próximo horário 14h SP (17h UTC).
  const opp = oppDe({
    stage: 'FECHAMENTO',
    ownerId: 'membro-rodrigo',
    tarefas: [
      { id: 'f3', title: 'FUP 3 (mensagem + ligação, manhã) — Luc Test', status: 'TODO', whatsapp: ZAP_OK },
      { id: 'f2', title: 'FUP 2 (ligação, ~1h30 depois) — Luc Test', status: 'DONE', whatsapp: ZAP_OK },
    ],
  });
  const ops = computePlan(entrada({ funil: [opp] }));

  assert.deepEqual(
    ops.filter((op) => op.kind === 'deleteTask'),
    [{ kind: 'deleteTask', taskId: 'f3' }],
  );
  assert.equal(ops.some((op) => op.kind === 'updateOpportunity'), false);

  const criadas = criacoes(ops);

  assert.equal(criadas.length, 1);
  assert.equal(criadas[0].data.title, 'Fechamento 1/30 (tarde) — Luc Test');
  assert.equal(criadas[0].data.dueAt, '2026-08-19T17:00:00.000Z');
  assert.equal(criadas[0].data.assigneeId, 'membro-rodrigo');
  assert.equal(criadas[0].data.whatsapp?.primaryLinkUrl, ZAP_OK.primaryLinkUrl);
});

test('Fechamento: toque concluído no horário cria o seguinte; o aberto não é recriado', () => {
  const concluido = {
    id: 'c1',
    title: 'Fechamento 1/30 (manhã) — Luc Test',
    status: 'DONE',
    dueAt: '2026-08-19T11:00:00.000Z',
  };
  const criadas = criacoes(
    computePlan(entrada({ funil: [oppDe({ stage: 'FECHAMENTO', tarefas: [concluido] })] })),
  );

  assert.equal(criadas.length, 1);
  assert.equal(criadas[0].data.title, 'Fechamento 2/30 (tarde) — Luc Test');
  assert.equal(criadas[0].data.dueAt, '2026-08-19T17:00:00.000Z');

  // Um tick depois, já às 15h SP: o toque 2 aberto (com rótulo "tarde") fica como está.
  const aberto = {
    id: 'c2',
    title: 'Fechamento 2/30 (tarde) — Luc Test',
    status: 'TODO',
    dueAt: '2026-08-19T17:00:00.000Z',
    whatsapp: ZAP_OK,
  };
  const depois = computePlan(
    entrada({
      agora: new Date('2026-08-19T18:00:00.000Z'),
      funil: [oppDe({ stage: 'FECHAMENTO', tarefas: [concluido, aberto] })],
    }),
  );

  assert.deepEqual(depois, []);
});

test('Fechamento: adiantar o toque não puxa o seguinte para o mesmo horário', () => {
  // Toque das 14h concluído às 10h: o próximo é o das 17h, não o das 14h.
  const ops = computePlan(
    entrada({
      funil: [
        oppDe({
          stage: 'FECHAMENTO',
          tarefas: [
            {
              id: 'c2',
              title: 'Fechamento 2/30 (tarde) — Luc Test',
              status: 'DONE',
              dueAt: '2026-08-19T17:00:00.000Z',
            },
          ],
        }),
      ],
    }),
  );

  assert.equal(criacoes(ops)[0].data.title, 'Fechamento 3/30 (fim do dia) — Luc Test');
  assert.equal(criacoes(ops)[0].data.dueAt, '2026-08-19T20:00:00.000Z');
});

test('Fechamento: atrasar pula para o próximo horário que ainda não passou', () => {
  // Toque das 8h concluído às 17h SP: o próximo é amanhã às 8h.
  const ops = computePlan(
    entrada({
      agora: new Date('2026-08-19T20:00:00.000Z'),
      funil: [
        oppDe({
          stage: 'FECHAMENTO',
          tarefas: [
            {
              id: 'c1',
              title: 'Fechamento 1/30 (manhã) — Luc Test',
              status: 'DONE',
              dueAt: '2026-08-19T11:00:00.000Z',
            },
          ],
        }),
      ],
    }),
  );

  assert.equal(criacoes(ops)[0].data.title, 'Fechamento 2/30 (manhã) — Luc Test');
  assert.equal(criacoes(ops)[0].data.dueAt, '2026-08-20T11:00:00.000Z');
});

test('Fechamento: depois do toque 30, nasce a decisão Ganho, Break ou Perdido', () => {
  const opp = oppDe({
    stage: 'FECHAMENTO',
    tarefas: [
      {
        id: 'c30',
        title: 'Fechamento 30/30 (fim do dia) — Luc Test',
        status: 'DONE',
        dueAt: '2026-08-18T20:00:00.000Z',
      },
    ],
  });
  const criadas = criacoes(computePlan(entrada({ funil: [opp] })));

  assert.equal(criadas.length, 1);
  assert.equal(criadas[0].data.title, 'Decidir: Ganho, Break ou Perdido? — Luc Test');
  assert.equal(criadas[0].data.dueAt, AGORA.toISOString());
  assert.match(criadas[0].data.bodyV2?.markdown ?? '', /30 toques de fechamento/);

  // Com a decisão aberta, nada muda.
  const aberta = {
    id: 'd1',
    title: 'Decidir: Ganho, Break ou Perdido? — Luc Test',
    status: 'TODO',
    whatsapp: ZAP_OK,
  };

  assert.deepEqual(
    computePlan(entrada({ funil: [{ ...opp, tarefas: [...opp.tarefas, aberta] }] })),
    [],
  );
});

test('card volta de Fechamento para negociação: toque de Fechamento e decisão abertos somem', () => {
  const opp = oppDe({
    stage: 'EM_NEGOCIACAO',
    fupNumero: 9,
    tarefas: [
      { id: 'fx', title: 'Fechamento 5/30 (tarde) — Luc Test', status: 'TODO', whatsapp: ZAP_OK },
      { id: 'dx', title: 'Decidir: Ganho, Break ou Perdido? — Luc Test', status: 'TODO', whatsapp: ZAP_OK },
      { id: 'f9', title: 'FUP 9 (mensagem, manhã) — Luc Test', status: 'DONE', whatsapp: ZAP_OK },
    ],
  });
  const ops = computePlan(entrada({ funil: [opp] }));
  const apagadas = ops.filter((op) => op.kind === 'deleteTask').map((op) => op.taskId);

  assert.deepEqual(apagadas.sort(), ['dx', 'fx']);
  assert.equal(criacoes(ops)[0].data.title, 'Decidir: Break ou Perdido? — Luc Test');
});

test('card de Fechamento vai para o Break: toque aberto some e nasce a FUP final', () => {
  const opp = oppDe({
    stage: 'BREAK',
    tarefas: [
      { id: 'fx', title: 'Fechamento 5/30 (tarde) — Luc Test', status: 'TODO', whatsapp: ZAP_OK },
    ],
  });
  const ops = computePlan(entrada({ funil: [opp] }));

  assert.deepEqual(
    ops.filter((op) => op.kind === 'deleteTask'),
    [{ kind: 'deleteTask', taskId: 'fx' }],
  );
  assert.equal(criacoes(ops)[0].data.title, 'FUP final (antes do lost) — Luc Test');
});

test('card de Fechamento ganho: o toque aberto vira órfão e é apagado', () => {
  const ops = computePlan(
    entrada({
      abertas: [
        { id: 'fx', title: 'Fechamento 5/30 (tarde) — Luc Test', targetOpportunityId: 'opp-7' },
      ],
      foraDoFunil: { 'opp-7': { id: 'opp-7', stage: 'WON' } },
    }),
  );

  assert.deepEqual(ops, [{ kind: 'deleteTask', taskId: 'fx' }]);
});

test('Fechamento: duplicata do mesmo toque com rótulo diferente é removida', () => {
  const opp = oppDe({
    stage: 'FECHAMENTO',
    tarefas: [
      { id: 'a', title: 'Fechamento 1/30 (tarde) — Luc Test', status: 'TODO', whatsapp: ZAP_OK },
      { id: 'b', title: 'Fechamento 1/30 (fim do dia) — Luc Test', status: 'TODO', whatsapp: ZAP_OK },
    ],
  });

  assert.deepEqual(computePlan(entrada({ funil: [opp] })), [{ kind: 'deleteTask', taskId: 'b' }]);
});
