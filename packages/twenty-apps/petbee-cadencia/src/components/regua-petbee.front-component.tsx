// Painel "Régua Petbee" na página do negócio: raio-x das FUPs + decisão em um clique.
// O botão Perdido exige motivo por construção; Break e Ganhou pedem confirmação.
// Quem cria/apaga as tasks depois do clique é o motor (logic functions) — o painel
// só muda etapa/motivo e recarrega. Estilos inline (padrão dos apps de exemplo).
import { useCallback, useEffect, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import {
  enqueueSnackbar,
  useColorScheme,
  useSelectedRecordIds,
} from 'twenty-sdk/front-component';

import { REGUA_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const INBOX_URL = 'https://inbox.petbeetools.com.br/';

const MOTIVOS: { valor: string; rotulo: string }[] = [
  { valor: 'PAROU_DE_RESPONDER', rotulo: 'Parou de responder' },
  { valor: 'NAO_GOSTOU_SEM_INTERESSE', rotulo: 'Não gostou / sem interesse' },
  { valor: 'BUDGET_FORA_DO_ORCAMENTO', rotulo: 'Fora do orçamento' },
  { valor: 'TIMING_VAI_FECHAR_PRA_FRENTE', rotulo: 'Timing — fecha mais pra frente' },
  { valor: 'CONCORRENTE', rotulo: 'Fechou com concorrente' },
  { valor: 'SEM_INTERESSE_JA_TEM_PLANO_OT', rotulo: 'Já tem outro plano' },
  { valor: 'FALTA_DE_COBERTURA_ESPECIFICA', rotulo: 'Falta de cobertura específica' },
  { valor: 'FORMA_DE_PAGAMENTO', rotulo: 'Forma de pagamento' },
  { valor: 'CLINICA', rotulo: 'Preferiu clínica' },
  { valor: 'PET_10', rotulo: 'Pet acima da idade (10+)' },
  { valor: 'JA_E_CLIENTE_FECHOU_COM_OUTRO_NOME', rotulo: 'Já é cliente / outro nome' },
  { valor: 'FALTA_DE_RETORNO_QF', rotulo: 'Falta de retorno (qualificação)' },
  { valor: 'REGIAO_NAO_ATENDIDA_QF', rotulo: 'Região não atendida' },
  { valor: 'PET_DESQUALIFICADO_QF', rotulo: 'Pet desqualificado' },
  { valor: 'LEAD_DESQUALIFICADO_QF', rotulo: 'Lead desqualificado' },
  { valor: 'NUMERO_INVALIDO_QF', rotulo: 'Número inválido' },
];

const ETAPAS: Record<string, string> = {
  NOVO_LEAD: 'Novo Lead',
  EM_QUALIFICACAO: 'Em Qualificação',
  EM_NEGOCIACAO: 'Em Negociação',
  FECHAMENTO: 'Fechamento',
  BREAK: 'Break',
  WON: 'Ganhou',
  LOST: 'Perdido',
};

type TaskResumo = {
  id: string;
  title: string;
  status: string;
  dueAt?: string | null;
};

type Negocio = {
  id: string;
  name: string;
  stage: string;
  fupNumero?: number | null;
  whatsapp?: string | null;
  motivoLost?: string | null;
  tarefas: TaskResumo[];
};

async function gql<TData>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<TData> {
  const resposta = await fetch(`${process.env.TWENTY_API_URL}/graphql`, {
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

  if (corpo.errors?.length) throw new Error(corpo.errors[0].message);
  if (!corpo.data) throw new Error(`HTTP ${resposta.status}`);

  return corpo.data;
}

async function carregarNegocio(id: string): Promise<Negocio | null> {
  const dados = await gql<{
    opportunity: {
      id: string;
      name: string;
      stage: string;
      fupNumero?: number | null;
      whatsapp?: string | null;
      motivoLost?: string | null;
      taskTargets?: {
        edges?: { node?: { task?: TaskResumo | null } | null }[];
      } | null;
    } | null;
  }>(
    `query { opportunity(filter: {id: {eq: "${id}"}}) { id name stage fupNumero whatsapp motivoLost taskTargets { edges { node { task { id title status dueAt } } } } } }`,
  );

  const opp = dados.opportunity;

  if (!opp) return null;

  const tarefas = (opp.taskTargets?.edges ?? [])
    .map((edge) => edge?.node?.task)
    .filter((task): task is TaskResumo => Boolean(task))
    .filter((task) => /^(FUP |Decidir: |Preencher motivo)/.test(task.title));

  return { ...opp, tarefas };
}

function formatarSP(iso?: string | null): string {
  if (!iso) return '';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso));
}

function numeroDaFup(titulo: string): number | null {
  const m = titulo.match(/^FUP (\d+) /);

  return m ? parseInt(m[1], 10) : null;
}

type Decisao = 'break' | 'perdido' | 'ganhou' | null;

const ReguaPetbee = () => {
  const ids = useSelectedRecordIds();
  const esquema = useColorScheme();
  const escuro = esquema === 'dark';
  const recordId = ids.length === 1 ? ids[0] : null;

  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [decisao, setDecisao] = useState<Decisao>(null);
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);

  const cores = {
    texto: escuro ? '#ebebeb' : '#333',
    suave: escuro ? '#a0a0a0' : '#777',
    borda: escuro ? '#3a3a3a' : '#e5e5e5',
    fundo: escuro ? '#1d1d1d' : '#fafafa',
    vermelho: '#e05252',
    verde: '#3f7a4f',
    mel: '#b87413',
  };

  const recarregar = useCallback(async () => {
    if (!recordId) {
      setCarregando(false);
      return;
    }
    try {
      setErro(null);
      setNegocio(await carregarNegocio(recordId));
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : String(falha));
    } finally {
      setCarregando(false);
    }
  }, [recordId]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  // O motor cria/apaga tasks ~2s após a mudança: recarrega duas vezes pra tela acompanhar.
  const recarregarAposMotor = useCallback(() => {
    setTimeout(recarregar, 2500);
    setTimeout(recarregar, 7000);
  }, [recarregar]);

  const decidir = useCallback(
    async (etapa: 'BREAK' | 'LOST' | 'WON', motivoEscolhido?: string) => {
      if (!recordId) return;
      setSalvando(true);
      try {
        const data: Record<string, unknown> = { stage: etapa };

        if (etapa === 'LOST' && motivoEscolhido) data.motivoLost = motivoEscolhido;

        await gql(
          `mutation D($data: OpportunityUpdateInput!) { updateOpportunity(id: "${recordId}", data: $data) { id } }`,
          { data },
        );
        await enqueueSnackbar({
          message:
            etapa === 'BREAK'
              ? 'Break registrado — FUP final agendada pra +25 dias.'
              : etapa === 'WON'
                ? 'Ganhou! 🏆'
                : 'Perdido registrado com motivo.',
          variant: 'success',
        });
        setDecisao(null);
        setMotivo('');
        recarregarAposMotor();
        await recarregar();
      } catch (falha) {
        await enqueueSnackbar({
          message: `Não consegui registrar: ${falha instanceof Error ? falha.message : falha}`,
          variant: 'error',
        });
      } finally {
        setSalvando(false);
      }
    },
    [recordId, recarregar, recarregarAposMotor],
  );

  const botao = (rotulo: string, cor: string, aoClicar: () => void) => (
    <button
      onClick={aoClicar}
      disabled={salvando}
      style={{
        padding: '8px 14px',
        borderRadius: '6px',
        border: `1px solid ${cor}`,
        background: 'transparent',
        color: cor,
        fontWeight: 600,
        fontSize: '13px',
        cursor: salvando ? 'wait' : 'pointer',
      }}
    >
      {rotulo}
    </button>
  );

  if (!recordId) {
    return <div style={{ padding: '16px', color: cores.suave }}>Abra um negócio pra ver a régua.</div>;
  }
  if (carregando) {
    return <div style={{ padding: '16px', color: cores.suave }}>Carregando a régua…</div>;
  }
  if (erro || !negocio) {
    return (
      <div style={{ padding: '16px', color: cores.vermelho, fontSize: '13px' }}>
        Não consegui ler o negócio ({erro ?? 'não encontrado'}).{' '}
        <a onClick={recarregar} style={{ cursor: 'pointer', textDecoration: 'underline' }}>
          Tentar de novo
        </a>
      </div>
    );
  }

  const agora = Date.now();
  const feitas = negocio.tarefas
    .filter((t) => t.status === 'DONE' && numeroDaFup(t.title) != null)
    .sort((a, b) => (numeroDaFup(a.title) ?? 0) - (numeroDaFup(b.title) ?? 0));
  const abertas = negocio.tarefas.filter((t) => t.status !== 'DONE');
  const emJogo = negocio.stage === 'EM_NEGOCIACAO' || negocio.stage === 'BREAK' || negocio.stage === 'FECHAMENTO';

  return (
    <div style={{ padding: '16px', fontFamily: 'inherit', color: cores.texto, fontSize: '13px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: '14px' }}>Régua Petbee</span>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: '999px',
            border: `1px solid ${cores.borda}`,
            color: cores.suave,
          }}
        >
          {ETAPAS[negocio.stage] ?? negocio.stage}
        </span>
        {negocio.whatsapp ? (
          <a
            href={INBOX_URL}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: '12px', color: cores.mel, textDecoration: 'none', fontWeight: 600 }}
          >
            💬 {negocio.whatsapp} — abrir inbox
          </a>
        ) : null}
        <a onClick={recarregar} style={{ marginLeft: 'auto', cursor: 'pointer', color: cores.suave, fontSize: '12px' }}>
          ↻ atualizar
        </a>
      </div>

      {feitas.length > 0 ? (
        <div style={{ marginBottom: '10px', color: cores.verde, fontSize: '12px' }}>
          {feitas.map((t) => `✓ FUP ${numeroDaFup(t.title)}`).join('  ·  ')}
        </div>
      ) : (
        <div style={{ marginBottom: '10px', color: cores.suave, fontSize: '12px' }}>
          Nenhum toque concluído ainda.
        </div>
      )}

      {abertas.map((t) => {
        const atrasada = t.status === 'TODO' && t.dueAt != null && new Date(t.dueAt).getTime() < agora;

        return (
          <div
            key={t.id}
            style={{
              padding: '8px 10px',
              marginBottom: '6px',
              borderRadius: '6px',
              border: `1px solid ${atrasada ? cores.vermelho : cores.borda}`,
              background: cores.fundo,
              display: 'flex',
              justifyContent: 'space-between',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontWeight: 600 }}>{t.title.split(' — ')[0]}</span>
            <span style={{ color: atrasada ? cores.vermelho : cores.suave, fontWeight: atrasada ? 700 : 400 }}>
              {atrasada ? '⚠ ' : ''}
              {formatarSP(t.dueAt)}
            </span>
          </div>
        );
      })}

      {negocio.stage === 'WON' ? (
        <div style={{ color: cores.verde, fontWeight: 700, marginTop: '8px' }}>🏆 Negócio ganho!</div>
      ) : null}
      {negocio.stage === 'LOST' ? (
        <div style={{ color: cores.suave, marginTop: '8px' }}>
          ✖ Perdido — motivo:{' '}
          <b>{MOTIVOS.find((m) => m.valor === negocio.motivoLost)?.rotulo ?? negocio.motivoLost ?? 'pendente (preencha!)'}</b>
        </div>
      ) : null}

      {emJogo ? (
        <div style={{ marginTop: '14px', borderTop: `1px solid ${cores.borda}`, paddingTop: '12px' }}>
          {decisao === null ? (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {negocio.stage !== 'BREAK' ? botao('☕ Break', cores.mel, () => setDecisao('break')) : null}
              {botao('✖ Perdido', cores.vermelho, () => setDecisao('perdido'))}
              {botao('🏆 Ganhou', cores.verde, () => setDecisao('ganhou'))}
            </div>
          ) : null}

          {decisao === 'break' ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span>Estacionar no Break (FUP final em +25 dias)?</span>
              {botao('Confirmar', cores.mel, () => decidir('BREAK'))}
              {botao('Cancelar', cores.suave, () => setDecisao(null))}
            </div>
          ) : null}

          {decisao === 'ganhou' ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span>Marcar como ganho?</span>
              {botao('Confirmar 🏆', cores.verde, () => decidir('WON'))}
              {botao('Cancelar', cores.suave, () => setDecisao(null))}
            </div>
          ) : null}

          {decisao === 'perdido' ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={motivo}
                onChange={(evento) => setMotivo(evento.target.value)}
                style={{
                  padding: '8px',
                  borderRadius: '6px',
                  border: `1px solid ${cores.borda}`,
                  background: cores.fundo,
                  color: cores.texto,
                  fontSize: '13px',
                  maxWidth: '260px',
                }}
              >
                <option value="">Motivo da perda (obrigatório)…</option>
                {MOTIVOS.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.rotulo}
                  </option>
                ))}
              </select>
              {motivo ? botao('Confirmar perda', cores.vermelho, () => decidir('LOST', motivo)) : null}
              {botao('Cancelar', cores.suave, () => setDecisao(null))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: REGUA_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'regua-petbee',
  description: 'Raio-x da régua comercial + decisão em um clique (Break, Perdido com motivo, Ganhou).',
  component: ReguaPetbee,
});
