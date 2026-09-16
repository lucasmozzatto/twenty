// Barras horizontais, simples e empilhadas.
import { Cartao } from 'src/painel/cartoes';
import { formatarInteiro, formatarVariacao, variacao } from 'src/painel/formato';
import { type Tema } from 'src/painel/tema';

export type Barra = { chave: string | null; valor: number };

type BarraComparada = Barra & { antes: number | undefined };

const LARGURA_ROTULO = '130px';
const LARGURA_VALOR = '80px';
const LARGURA_COMPARACAO = '128px';

// Junta os dois períodos numa lista só. Uma categoria que existia antes e
// sumiu agora **continua na lista**, com barra vazia: um canal que morreu é
// justamente o que se quer ver, e some se olharmos só o período de agora.
const juntarPeriodos = (
  barras: Barra[],
  anteriores: Barra[] | undefined,
): BarraComparada[] => {
  const agora = new Map(barras.map((barra) => [barra.chave, barra.valor]));
  const antes = new Map((anteriores ?? []).map((barra) => [barra.chave, barra.valor]));

  const chaves = [...new Set([...agora.keys(), ...antes.keys()])].filter(
    (chave) => (agora.get(chave) ?? 0) > 0 || (antes.get(chave) ?? 0) > 0,
  );

  return chaves
    .map((chave) => ({
      chave,
      valor: agora.get(chave) ?? 0,
      antes: anteriores === undefined ? undefined : (antes.get(chave) ?? 0),
    }))
    // Maior de agora primeiro; entre os zerados, o que era maior antes.
    .sort((a, b) => b.valor - a.valor || (b.antes ?? 0) - (a.antes ?? 0));
};

export const Barras = ({
  titulo,
  nota,
  barras,
  anteriores,
  rotulo,
  cor,
  formatar = formatarInteiro,
  // 'negativo' para o que é ruim quando sobe, como motivos de perda.
  sentido,
  tema,
}: {
  titulo: string;
  nota?: string;
  barras: Barra[];
  anteriores?: Barra[];
  rotulo: (chave: string | null) => string;
  cor: string;
  formatar?: (valor: number) => string;
  sentido?: 'positivo' | 'negativo';
  tema: Tema;
}) => {
  const ordenadas = juntarPeriodos(barras, anteriores);
  // A escala inclui o período anterior, senão as barras de agora encheriam a
  // largura toda e a queda não apareceria.
  const maximo = Math.max(
    ...ordenadas.map((barra) => Math.max(barra.valor, barra.antes ?? 0)),
    1,
  );

  const corDaVariacao = (diferenca: number | null): string => {
    if (diferenca === null || diferenca === 0) return tema.suave;

    return diferenca > 0 === (sentido !== 'negativo') ? tema.verde : tema.vermelho;
  };

  return (
    <Cartao titulo={titulo} nota={nota} tema={tema}>
      {ordenadas.length === 0 ? (
        <div style={{ fontSize: '12px', color: tema.suave }}>Nada no período.</div>
      ) : (
        ordenadas.map((barra) => (
          <div
            key={barra.chave ?? '__vazio__'}
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
                color: barra.chave === null ? tema.suave : tema.texto,
                fontStyle: barra.chave === null ? 'italic' : 'normal',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {rotulo(barra.chave)}
            </div>
            <div
              style={{
                flex: '1 1 auto',
                position: 'relative',
                height: '14px',
                background: tema.destaque,
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              {/* O período anterior fica como um traço fino atrás, na mesma
                  escala: dá para ver de onde saiu sem poluir a barra. */}
              {barra.antes === undefined ? null : (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    bottom: 0,
                    width: `${(barra.antes / maximo) * 100}%`,
                    height: '4px',
                    background: tema.suave,
                    opacity: 0.55,
                  }}
                />
              )}
              <div
                style={{
                  width: `${(barra.valor / maximo) * 100}%`,
                  height: barra.antes === undefined ? '100%' : '10px',
                  background: cor,
                  borderRadius: '4px',
                }}
              />
            </div>
            <div
              style={{
                width: LARGURA_VALOR,
                flex: `0 0 ${LARGURA_VALOR}`,
                textAlign: 'right',
                color: tema.texto,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatar(barra.valor)}
            </div>
            {barra.antes === undefined ? null : (
              <div
                style={{
                  width: LARGURA_COMPARACAO,
                  flex: `0 0 ${LARGURA_COMPARACAO}`,
                  textAlign: 'right',
                  fontSize: '11px',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <span style={{ color: tema.suave }}>antes {formatar(barra.antes)}</span>{' '}
                <span
                  style={{
                    color: corDaVariacao(variacao(barra.valor, barra.antes)),
                    fontWeight: 700,
                  }}
                >
                  {variacao(barra.valor, barra.antes) === null
                    ? ''
                    : formatarVariacao(variacao(barra.valor, barra.antes) as number)}
                </span>
              </div>
            )}
          </div>
        ))
      )}
    </Cartao>
  );
};
