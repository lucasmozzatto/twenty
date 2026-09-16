// Barras empilhadas: uma linha por etapa, dividida em pedaços por dono.
import { Cartao } from 'src/painel/cartoes';
import { formatarInteiro } from 'src/painel/formato';
import { type Tema } from 'src/painel/tema';

const LARGURA_ROTULO = '130px';

export type Serie = { chave: string | null; rotulo: string; cor: string };

// Uma barra por linha, dividida em pedaços coloridos por série (o dono).
// Cada pedaço é proporcional ao total da maior linha, então o comprimento das
// barras é comparável entre linhas.
export const BarrasEmpilhadas = ({
  titulo,
  nota,
  linhas,
  series,
  tema,
}: {
  titulo: string;
  nota?: string;
  linhas: { rotulo: string; pedacos: { chave: string | null; valor: number }[] }[];
  series: Serie[];
  tema: Tema;
}) => {
  const totais = linhas.map((linha) =>
    linha.pedacos.reduce((soma, pedaco) => soma + pedaco.valor, 0),
  );
  const maximo = Math.max(...totais, 1);
  const comDados = linhas.filter((_, indice) => totais[indice] > 0);

  return (
    <Cartao titulo={titulo} nota={nota} tema={tema}>
      {comDados.length === 0 ? (
        <div style={{ fontSize: '12px', color: tema.suave }}>Nada em aberto.</div>
      ) : (
        <>
          {linhas.map((linha, indice) =>
            totais[indice] === 0 ? null : (
              <div
                key={linha.rotulo}
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
                    width: LARGURA_ROTULO,
                    flex: `0 0 ${LARGURA_ROTULO}`,
                    color: tema.texto,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {linha.rotulo}
                </div>
                <div
                  style={{
                    flex: '1 1 auto',
                    height: '14px',
                    background: tema.destaque,
                    borderRadius: '4px',
                    overflow: 'hidden',
                    display: 'flex',
                  }}
                >
                  {linha.pedacos
                    .filter((pedaco) => pedaco.valor > 0)
                    .map((pedaco) => (
                      <div
                        key={pedaco.chave ?? '__vazio__'}
                        title={`${
                          series.find((serie) => serie.chave === pedaco.chave)?.rotulo ?? ''
                        }: ${pedaco.valor}`}
                        style={{
                          width: `${(pedaco.valor / maximo) * 100}%`,
                          height: '100%',
                          background:
                            series.find((serie) => serie.chave === pedaco.chave)?.cor ??
                            tema.suave,
                        }}
                      />
                    ))}
                </div>
                <div
                  style={{
                    width: '60px',
                    flex: '0 0 60px',
                    textAlign: 'right',
                    color: tema.texto,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatarInteiro(totais[indice])}
                </div>
              </div>
            ),
          )}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              marginTop: '10px',
              fontSize: '11px',
              color: tema.suave,
            }}
          >
            {series.map((serie) => (
              <span
                key={serie.chave ?? '__vazio__'}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <span
                  style={{
                    width: '9px',
                    height: '9px',
                    borderRadius: '2px',
                    background: serie.cor,
                  }}
                />
                {serie.rotulo}
              </span>
            ))}
          </div>
        </>
      )}
    </Cartao>
  );
};
