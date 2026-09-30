import { defineLogicFunction } from 'twenty-sdk/define';

import { OPPORTUNITY_UPDATED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  etapaParaDevolver,
  type EventoOportunidade,
  travaValeParaFunil,
} from 'src/cadencia/plan.ts';
import {
  devolverEtapa,
  funilDoNegocio,
  reconcile,
  type ResultadoReconcile,
} from 'src/cadencia/reconcile.ts';

// Campainha: arrastar o card (stage), corrigir o número (whatsapp), preencher o motivo
// da perda ou ajustar o fupNumero reconcilia na hora. updatedFields evita disparo em
// edições irrelevantes (nota, valor etc.).
//
// Trava do Perdido: humano arrastou pro LOST sem preencher o motivo → o card volta
// sozinho pra etapa anterior (~2s). Só vale para gente; API/inbox passa direto.
const handler = async (
  evento: EventoOportunidade,
): Promise<ResultadoReconcile> => {
  const devolver = etapaParaDevolver(evento);

  if (devolver) {
    // Evento sem o campo funil: pergunta ao CRM antes de devolver, porque um
    // card de Referidos arrastado para Perdido é assunto de quem cuida dele.
    const funil =
      evento.properties?.after?.funnel === undefined
        ? await funilDoNegocio(devolver.oppId)
        : evento.properties.after.funnel;

    if (travaValeParaFunil(funil)) {
      await devolverEtapa(devolver.oppId, devolver.etapa);

      return reconcile('trava-motivo');
    }
  }

  return reconcile('opportunity.updated');
};

export default defineLogicFunction({
  universalIdentifier: OPPORTUNITY_UPDATED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'cadencia-on-opportunity-updated',
  description:
    'Reconcilia a cadência quando etapa, fupNumero, motivo da perda ou WhatsApp mudam; devolve arrasto humano pro Perdido sem motivo.',
  timeoutSeconds: 120,
  databaseEventTriggerSettings: {
    eventName: 'opportunity.updated',
    updatedFields: ['stage', 'fupNumero', 'motivoLost', 'whatsapp'],
  },
  handler,
});
