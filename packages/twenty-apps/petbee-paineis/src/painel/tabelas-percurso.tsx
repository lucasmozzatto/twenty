// A jornada dos leads na visão Ads: três quadros pequenos lado a lado, todos
// sobre os mesmos leads da tabela de cima. Clicar numa linha lá em cima troca
// os leads daqui para só aquele tráfego.
import { type NegocioDeMidia } from 'src/painel/ads';
import { Cartao } from 'src/painel/cartoes';
import { formatarInteiro, formatarPercentual } from 'src/painel/formato';
import { rotuloDaEtapa } from 'src/painel/grade-de-perdas';
import { ETAPAS_DE_HOJE, montarJornada } from 'src/painel/percurso';
import { ETAPAS_ANTES_DO_VENDEDOR } from 'src/painel/perdas';
import { rotuloEtapa } from 'src/painel/rotulos';
import { type Tema } from 'src/painel/tema';

type Celula = { texto: string; cor?: string };
type Linha = { rotulo: string; celulas: Celula[]; destaque?: boolean; italico?: boolean };

const GRADE = (colunas: number) =>
  `minmax(96px, 1.5fr) repeat(${colunas}, minmax(52px, 1fr))`;

const Tabela = ({
  colunas,
  linhas,
  tema,
}: {
  colunas: string[];
  linhas: Linha[];
  tema: Tema;
}) => (
  <>
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: GRADE(colunas.length - 1),
        gap: '8px',
        paddingBottom: '4px',
        fontSize: '11px',
        color: tema.suave,
      }}
    >
      {colunas.map((coluna, indice) => (
        <div key={coluna || 'vazio'} style={{ textAlign: indice === 0 ? 'left' : 'right' }}>
          {coluna}
        </div>
      ))}
    </div>
    {linhas.map((linha) => (
      <div
        key={linha.rotulo}
        style={{
          display: 'grid',
          gridTemplateColumns: GRADE(colunas.length - 1),
          gap: '8px',
          padding: '6px 0',
          borderTop: `1px solid ${tema.borda}`,
          fontSize: '12px',
          fontWeight: linha.destaque ? 700 : 400,
        }}
      >
        <div
          style={{
            color: tema.texto,
            fontStyle: linha.italico ? 'italic' : 'normal',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {linha.rotulo}
        </div>
        {linha.celulas.map((celula, indice) => (
          <div
            key={indice}
            style={{
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
              color: celula.cor ?? tema.texto,
            }}
          >
            {celula.texto}
          </div>
        ))}
      </div>
    ))}
  </>
);

const Rodape = ({ texto, tema }: { texto: string; tema: Tema }) => (
  <div style={{ fontSize: '11px', color: tema.suave, marginTop: '8px' }}>{texto}</div>
);

const ROTULO_DO_DEGRAU = ['Em qualificação', 'Em negociação', 'Fechamento', 'Ganho'];

export const TabelasPercurso = ({
  negocios,
  filtro,
  aoLimpar,
  antesDoHistorico,
  tema,
}: {
  negocios: NegocioDeMidia[];
  // Rótulo da linha escolhida lá em cima, ou null para todos os leads.
  filtro: string | null;
  aoLimpar: () => void;
  antesDoHistorico: boolean;
  tema: Tema;
}) => {
  const jornada = montarJornada(negocios);
  const { criados, chegaram } = jornada;
  const emAberto = ETAPAS_DE_HOJE.filter((etapa) => etapa !== 'WON' && etapa !== 'LOST').reduce(
    (soma, etapa) => soma + jornada.hoje[etapa],
    0,
  );
  const vendas = chegaram[chegaram.length - 1] + jornada.ganhoSemNegociacao;
  const numeroOuVazio = (valor: number) => (valor === 0 ? tema.borda : tema.texto);

  return (
    <div style={{ marginTop: '14px' }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: tema.texto }}>
        Jornada destes leads no funil
      </div>
      <div style={{ fontSize: '12px', color: tema.suave, margin: '2px 0 10px' }}>
        {filtro === null ? (
          'Todos os leads criados no período. Clique no nome de uma linha da tabela acima para ver só aquele tráfego.'
        ) : (
          <>
            Só os leads de <b style={{ color: tema.texto }}>{filtro}</b>.{' '}
            <a onClick={aoLimpar} style={{ cursor: 'pointer', textDecoration: 'underline' }}>
              Ver todos
            </a>
          </>
        )}
      </div>

      {antesDoHistorico ? (
        <div style={{ fontSize: '12px', color: tema.laranja, marginBottom: '8px' }}>
          <b>Atenção:</b> o período começa antes de 01/09/2026. O histórico de etapas dos leads
          mais antigos é incompleto, então a jornada deles sai por baixo.
        </div>
      ) : null}

      {criados === 0 ? (
        <div style={{ fontSize: '12px', color: tema.suave }}>Nenhum lead aqui.</div>
      ) : (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 300px', minWidth: 0 }}>
            <Cartao
              titulo="Até onde chegaram"
              nota='Cada linha conta quem chegou pelo menos até ali. "Passaram" é sobre a linha de cima: mostra onde o funil aperta. Em negociação é a coluna Qualificados.'
              tema={tema}
            >
              <Tabela
                colunas={['', 'Leads', '% dos criados', 'Passaram']}
                linhas={[
                  {
                    rotulo: 'Criados',
                    celulas: [{ texto: formatarInteiro(criados) }, { texto: '100%' }, { texto: '—' }],
                  },
                  ...ROTULO_DO_DEGRAU.map((rotulo, indice) => ({
                    rotulo,
                    celulas: [
                      {
                        texto: formatarInteiro(chegaram[indice]),
                        cor: indice === 3 ? tema.verde : numeroOuVazio(chegaram[indice]),
                      },
                      { texto: formatarPercentual(chegaram[indice], criados) },
                      {
                        texto: formatarPercentual(
                          chegaram[indice],
                          indice === 0 ? criados : chegaram[indice - 1],
                        ),
                      },
                    ],
                  })),
                ]}
                tema={tema}
              />
              {jornada.ganhoSemNegociacao === 0 ? null : (
                <Rodape
                  texto={`Mais ${formatarInteiro(jornada.ganhoSemNegociacao)} ${jornada.ganhoSemNegociacao === 1 ? 'venda' : 'vendas'} sem passar por negociação: compra direta ou card levado direto para Ganho. Somando, ${formatarInteiro(vendas)}, o número da coluna Vendas.`}
                  tema={tema}
                />
              )}
            </Cartao>
          </div>

          <div style={{ flex: '1 1 220px', minWidth: 0 }}>
            <Cartao titulo="Onde estão hoje" nota="A etapa de cada lead agora." tema={tema}>
              <Tabela
                colunas={['', 'Leads', '%']}
                linhas={ETAPAS_DE_HOJE.map((etapa) => {
                  const quantos = jornada.hoje[etapa];
                  const cor =
                    quantos === 0
                      ? tema.borda
                      : etapa === 'WON'
                        ? tema.verde
                        : etapa === 'LOST'
                          ? tema.vermelho
                          : tema.texto;

                  return {
                    rotulo: rotuloEtapa(etapa),
                    celulas: [
                      { texto: formatarInteiro(quantos), cor },
                      { texto: formatarPercentual(quantos, criados), cor },
                    ],
                  };
                })}
                tema={tema}
              />
              <Rodape
                texto={`Em aberto: ${formatarInteiro(emAberto)} (${formatarPercentual(emAberto, criados)}). Ainda podem virar venda ou perda; no mês corrente esse número é alto.`}
                tema={tema}
              />
            </Cartao>
          </div>

          <div style={{ flex: '1 1 300px', minWidth: 0 }}>
            <Cartao
              titulo="De onde saíram os perdidos"
              nota="Perda na etapa: de quem chegou na etapa, quantos foram perdidos saindo dela. Em itálico, descarte antes de o lead chegar num vendedor."
              tema={tema}
            >
              <Tabela
                colunas={['Saiu de', 'Perdidos', '% dos perdidos', 'Perda na etapa']}
                linhas={[
                  ...jornada.saidas
                    .filter((saida) => saida.etapa !== 'SEM_REGISTRO' || saida.perdidos > 0)
                    .map((saida) => ({
                      rotulo: rotuloDaEtapa(saida.etapa),
                      italico: ETAPAS_ANTES_DO_VENDEDOR.includes(saida.etapa),
                      celulas: [
                        {
                          texto: formatarInteiro(saida.perdidos),
                          cor: saida.perdidos === 0 ? tema.borda : tema.vermelho,
                        },
                        { texto: formatarPercentual(saida.perdidos, jornada.perdidos) },
                        {
                          texto:
                            saida.chegaram === null
                              ? '—'
                              : formatarPercentual(saida.perdidos, saida.chegaram),
                        },
                      ],
                    })),
                  {
                    rotulo: 'Total',
                    destaque: true,
                    celulas: [
                      { texto: formatarInteiro(jornada.perdidos) },
                      { texto: formatarPercentual(jornada.perdidos, jornada.perdidos) },
                      { texto: '' },
                    ],
                  },
                ]}
                tema={tema}
              />
            </Cartao>
          </div>
        </div>
      )}
    </div>
  );
};
