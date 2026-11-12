// RÉGUA OFICIAL v2 (18/08/2026) — horários America/Sao_Paulo (UTC-3, sem horário de verão desde 2019).
// 9 toques em ~6 dias: 2/dia nos 3 primeiros, 1/dia depois. Concluir a FUP N cria a N+1,
// com prazo ancorado na CONCLUSÃO REAL (quem adianta, acelera; quem atrasa, reancora).
// Toque "tarde do mesmo dia" concluído após as 16h empurra para amanhã às 16h.
// Fonte da verdade compartilhada com o motor n8n "Cadência Twenty (nativa)" v10 —
// qualquer mudança de régua precisa ser aplicada nos dois até o n8n ser aposentado.

export const VITORIA_WORKSPACE_MEMBER_ID =
  '69572821-c2f4-4923-9c68-23381b665a49';
// A inbox mudou de casa: inbox.petbeetools.com.br (V1, aposentada) → wpp.petbeetools.com.br.
export const WPP_URL = 'https://wpp.petbeetools.com.br/';

// Canais oficiais (19/08): 1 msg · 2 ligação · 3-4 msg+ligação · 5-9 só msg.
export const TOQUES: Record<number, string> = {
  1: 'FUP 1 (mensagem, abordar agora)',
  2: 'FUP 2 (ligação, ~1h30 depois)',
  3: 'FUP 3 (mensagem + ligação, manhã)',
  4: 'FUP 4 (mensagem + ligação, tarde)',
  5: 'FUP 5 (mensagem, manhã)',
  6: 'FUP 6 (mensagem, tarde)',
  7: 'FUP 7 (mensagem, manhã)',
  8: 'FUP 8 (mensagem, tarde)',
  9: 'FUP 9 (mensagem, manhã)',
};

export const PADRAO_FUP = /^FUP (\d+|final) /;
export const PADRAO_MOTIVO = /^Preencher motivo da perda — /;
// As duas decisões: a de Em negociação (depois da FUP 9) e a de Fechamento
// (depois do toque 30). Título exato, para nunca pegar uma task manual.
export const PADRAO_DECISAO = /^Decidir: (Break ou Perdido|Ganho, Break ou Perdido)\? — /;
export const PADRAO_FECHAMENTO = /^Fechamento (\d+)\/\d+ /;

const SP_OFFSET_MS = 3 * 3600000;

function spDe(instante: Date): Date {
  return new Date(instante.getTime() - SP_OFFSET_MS);
}

// Data/hora de São Paulo (dia de `base` + addDias, às hora:minuto SP) em ISO UTC.
export function horarioSP(
  base: Date,
  addDias: number,
  hora: number,
  minuto: number,
): string {
  const sp = spDe(base);

  return new Date(
    Date.UTC(
      sp.getUTCFullYear(),
      sp.getUTCMonth(),
      sp.getUTCDate() + addDias,
      hora + 3,
      minuto,
    ),
  ).toISOString();
}

// "Tarde do dia": 16h SP de hoje — a menos que já passem das 16h, aí amanhã 16h.
export function tardeDoDia(base: Date): string {
  const sp = spDe(base);

  return sp.getUTCHours() < 16
    ? horarioSP(base, 0, 16, 0)
    : horarioSP(base, 1, 16, 0);
}

export type ToqueEsperado = { titulo: string; dueAt: string };

// Próximo(s) toque(s) esperados dado o último FUP concluído, ancorado em `base`.
export function proximas(
  nome: string,
  fup: number,
  base: Date,
): ToqueEsperado[] {
  const t = (n: number): string => `${TOQUES[n]} — ${nome}`;

  if (fup <= 0) return [{ titulo: t(1), dueAt: base.toISOString() }];
  if (fup === 1)
    return [
      { titulo: t(2), dueAt: new Date(base.getTime() + 90 * 60000).toISOString() },
    ];
  if (fup === 2) return [{ titulo: t(3), dueAt: horarioSP(base, 1, 9, 30) }];
  if (fup === 3) return [{ titulo: t(4), dueAt: tardeDoDia(base) }];
  if (fup === 4) return [{ titulo: t(5), dueAt: horarioSP(base, 1, 9, 30) }];
  if (fup === 5) return [{ titulo: t(6), dueAt: tardeDoDia(base) }];
  if (fup === 6) return [{ titulo: t(7), dueAt: horarioSP(base, 1, 9, 30) }];
  if (fup === 7) return [{ titulo: t(8), dueAt: horarioSP(base, 1, 16, 0) }];
  if (fup === 8) return [{ titulo: t(9), dueAt: horarioSP(base, 1, 9, 30) }];

  return [];
}

// RÉGUA DE FECHAMENTO (12/11/2026, pedido do dono do painel): 3 toques por dia,
// às 8h, 14h e 17h de São Paulo, 30 toques no total (10 dias se ninguém atrasar).
// Conta por número de toques, não pelo calendário: quem atrasa estica a régua,
// do mesmo jeito que a régua de negociação. Fim de semana conta normal.
export const TOQUES_FECHAMENTO = 30;

const HORARIOS_FECHAMENTO: { hora: number; rotulo: string }[] = [
  { hora: 8, rotulo: 'manhã' },
  { hora: 14, rotulo: 'tarde' },
  { hora: 17, rotulo: 'fim do dia' },
];

// Primeiro horário da régua de Fechamento estritamente depois de `base`.
export function proximoHorarioFechamento(base: Date): { dueAt: string; rotulo: string } {
  for (let dia = 0; dia <= 1; dia += 1) {
    for (const horario of HORARIOS_FECHAMENTO) {
      const dueAt = horarioSP(base, dia, horario.hora, 0);

      if (new Date(dueAt).getTime() > base.getTime()) {
        return { dueAt, rotulo: horario.rotulo };
      }
    }
  }

  // Inalcançável: amanhã às 8h é sempre depois de `base`.
  return { dueAt: horarioSP(base, 1, 8, 0), rotulo: 'manhã' };
}

export function tituloFechamentoDe(numero: number, rotulo: string, nome: string): string {
  return `Fechamento ${numero}/${TOQUES_FECHAMENTO} (${rotulo}) — ${nome}`;
}

export function numeroFechamentoDe(titulo: string): number | null {
  const m = titulo.match(PADRAO_FECHAMENTO);

  return m ? parseInt(m[1], 10) : null;
}

export type Zap = { label: string; url: string; markdown: string };

// Dados de WhatsApp do negócio, prontos pros campos da task. null quando não há número usável.
export function zapDe(whatsappBruto: string | null | undefined): Zap | null {
  const bruto = String(whatsappBruto ?? '').trim();

  if (!bruto) return null;

  const digitos = bruto.replace(/\D/g, '');

  if (digitos.length < 10) return null;

  // Link FUNDO: abre a inbox JÁ na conversa do lead, em vez da tela inicial. O
  // resolvedor do wpp tolera com/sem DDI e com/sem o 9º dígito, então o número
  // cru do CRM serve como está.
  const url = `${WPP_URL}?tel=${digitos}`;

  return {
    label: bruto,
    url,
    markdown: `**WhatsApp:** ${bruto} — [abrir conversa](${url})`,
  };
}

export function tituloDecisaoDe(nome: string): string {
  return `Decidir: Break ou Perdido? — ${nome}`;
}

export function tituloFinalDe(nome: string): string {
  return `FUP final (antes do lost) — ${nome}`;
}

export function tituloMotivoDe(nome: string): string {
  return `Preencher motivo da perda — ${nome}`;
}

export function tituloDecisaoFechamentoDe(nome: string): string {
  return `Decidir: Ganho, Break ou Perdido? — ${nome}`;
}

export function markdownDecisaoFechamento(zap: Zap | null): string {
  const corpo =
    `**${TOQUES_FECHAMENTO} toques de fechamento feitos.** Decida o destino deste negócio:\n\n` +
    '- Fechou → arraste o card para **Ganho**.\n' +
    '- Ainda não decidiu → arraste para **Break** → o motor agenda um FUP final em 25 dias.\n' +
    '- Desistiu → arraste para **Perdido** e preencha o **motivo** (obrigatório).\n\n' +
    'Esta task some sozinha quando o card mudar de coluna.';

  return zap ? `${corpo}\n\n${zap.markdown}` : corpo;
}

export function markdownDecisao(zap: Zap | null): string {
  const corpo =
    '**9 toques feitos, sem resposta.** Decida o destino deste negócio:\n\n' +
    '- Arraste o card para **Break** → o motor agenda um FUP final em 25 dias.\n' +
    '- Arraste para **Perdido** → preencha o **motivo** (obrigatório).\n\n' +
    'Esta task some sozinha quando o card mudar de coluna.';

  return zap ? `${corpo}\n\n${zap.markdown}` : corpo;
}
