// O funil pelo histórico de etapa. Duas medidas diferentes, separadas de
// propósito na tela: o FLUXO do período e o COHORT dos que negociaram.
import { BarrasEmpilhadas } from 'src/painel/barras-empilhadas';
import { Cartao, Numero, Titulo } from 'src/painel/cartoes';
import { ComoLer } from 'src/painel/como-ler';
import { GUIA_FUNIL } from 'src/painel/guias';
import { formatarDia, formatarInteiro, formatarPercentual } from 'src/painel/formato';
import { type Funil } from 'src/painel/funil';
import { type Jornada } from 'src/painel/jornada';
import { TabelaJornada } from 'src/painel/tabela-jornada';
import { type Tema } from 'src/painel/tema';

type Degrau = { rotulo: string; valor: number; nota?: string };

// Barras na ordem do funil, sem reordenar por tamanho: a ordem é a informação.
const Degraus = ({
  titulo,
  nota,
  degraus,
  cor,
  tema,
}: {
  titulo: string;
  nota: string;
  degraus: Degrau[];
  cor: string;
  tema: Tema;
}) => {
  const maximo = Math.max(...degraus.map((degrau) => degrau.valor), 1);

  return (
    <Cartao titulo={titulo} nota={nota} tema={tema}>
      {degraus.map((degrau) => (
        <div
          key={degrau.rotulo}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '6px',
            fontSize: '12px',
          }}
        >
          <div
            style={{
              width: '190px',
              flex: '0 0 190px',
              color: tema.texto,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {degrau.rotulo}
          </div>
          <div
            style={{
              flex: '1 1 auto',
              height: '14px',
              background: tema.destaque,
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${(degrau.valor / maximo) * 100}%`,
                height: '100%',
                background: cor,
                borderRadius: '4px',
              }}
            />
          </div>
          <div
            style={{
              width: '70px',
              flex: '0 0 70px',
              textAlign: 'right',
              color: tema.texto,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatarInteiro(degrau.valor)}
          </div>
        </div>
      ))}
    </Cartao>
  );
};

export const SecaoFunil = ({
  funil,
  jornada,
  criadosNoPeriodo,
  tema,
}: {
  funil: Funil;
  jornada: Jornada | null;
  criadosNoPeriodo: number;
  tema: Tema;
}) => (
  <>
    <Titulo
      texto="Funil por etapa"
      nota="Lido do histórico de mudanças de etapa, que o gráfico comum não alcança. Conta negócios distintos: quem voltou para negociação depois de um Break conta uma vez só."
      tema={tema}
    />

    <ComoLer itens={GUIA_FUNIL} tema={tema} />

    {funil.cortadoNoInicio ? (
      <div
        style={{
          padding: '8px 10px',
          borderRadius: '6px',
          border: `1px solid ${tema.laranja}`,
          color: tema.laranja,
          fontSize: '12px',
        }}
      >
        <b>Atenção:</b> contando a partir de {formatarDia(funil.periodo.de)}, por
        decisão do dono do painel: antes disso o processo ainda estava sendo
        ajustado. O período escolhido começava antes e foi recortado.
      </div>
    ) : null}

    {funil.periodoIncompleto && funil.historicoComecaEm !== null ? (
      <div
        style={{
          padding: '8px 10px',
          borderRadius: '6px',
          border: `1px solid ${tema.laranja}`,
          color: tema.laranja,
          fontSize: '12px',
        }}
      >
        <b>Atenção:</b> o histórico de etapas só existe a partir de{' '}
        {formatarDia(funil.historicoComecaEm)}. O período escolhido começa antes
        disso, então estes números estão por baixo — o que aconteceu antes não
        foi gravado.
      </div>
    ) : null}

    {funil.truncado ? (
      <div
        style={{
          padding: '8px 10px',
          borderRadius: '6px',
          border: `1px solid ${tema.laranja}`,
          color: tema.laranja,
          fontSize: '12px',
        }}
      >
        <b>Atenção:</b> o período tem mudanças demais para ler de uma vez. Estes
        números estão por baixo; escolha um intervalo menor.
      </div>
    ) : null}

    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
      <Numero
        rotulo="Entraram em negociação"
        valor={formatarInteiro(funil.entrouNegociacao)}
        cor={tema.azul}
        nota="negócios que chegaram a negociação ou fechamento no período"
        tema={tema}
      />
      <Numero
        rotulo="Conversão dos qualificados"
        valor={formatarPercentual(funil.negociacaoGanhos, funil.negociacaoTotal)}
        cor={tema.texto}
        nota={`${formatarInteiro(funil.negociacaoGanhos)} ganhos entre os ${formatarInteiro(
          funil.negociacaoTotal,
        )} que negociaram`}
        tema={tema}
      />
      <Numero
        rotulo="Ainda em aberto"
        valor={formatarInteiro(funil.negociacaoEmAberto)}
        cor={tema.azul}
        nota="do mesmo cohort, sem desfecho até agora"
        tema={tema}
      />
    </div>

    <Degraus
      titulo="O que aconteceu no período"
      nota="Cada degrau conta os negócios que passaram por ele DENTRO do período. Não é conversão: um negócio ganho agora pode ter entrado em negociação no mês passado."
      degraus={[
        { rotulo: 'Negócios criados', valor: criadosNoPeriodo },
        { rotulo: 'Entraram em qualificação', valor: funil.entrouQualificacao },
        { rotulo: 'Entraram em negociação', valor: funil.entrouNegociacao },
        { rotulo: 'Viraram Ganho', valor: funil.virouGanho },
        { rotulo: 'Viraram Perdido', valor: funil.virouPerdido },
      ]}
      cor={tema.rosa}
      tema={tema}
    />

    {jornada === null ? null : <TabelaJornada jornada={jornada} tema={tema} />}

    <BarrasEmpilhadas
      titulo="Dos que entraram em negociação no período, como estão hoje"
      nota="Esta sim é conversão: o mesmo cohort de negócios, olhado agora. Quem está em aberto ainda pode virar qualquer coisa."
      linhas={[
        {
          rotulo: 'Situação hoje',
          pedacos: [
            { chave: 'GANHO', valor: funil.negociacaoGanhos },
            { chave: 'PERDIDO', valor: funil.negociacaoPerdidos },
            { chave: 'ABERTO', valor: funil.negociacaoEmAberto },
          ],
        },
      ]}
      series={[
        { chave: 'GANHO', rotulo: 'Ganho', cor: tema.verde },
        { chave: 'PERDIDO', rotulo: 'Perdido', cor: tema.vermelho },
        { chave: 'ABERTO', rotulo: 'Ainda em aberto', cor: tema.azul },
      ]}
      tema={tema}
    />
  </>
);
