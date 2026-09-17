// A grade vendedor × safra: a conversão de cada pessoa em cada lote, lado a
// lado. É o quadro que compara vendedores com a mesma régua.
import { Cartao } from 'src/painel/cartoes';
import { formatarPercentual } from 'src/painel/formato';
import {
  type Celula,
  type LinhaDaGrade,
  type LinhaSafra,
  POUCOS_LEADS,
} from 'src/painel/safras';
import { type Tema } from 'src/painel/tema';

export const GradeSafras = ({
  linhas,
  safras,
  nomes,
  tema,
}: {
  linhas: LinhaDaGrade[];
  safras: LinhaSafra[];
  nomes: Record<string, string>;
  tema: Tema;
}) => {
  const grade = `minmax(100px, 1.3fr) repeat(${safras.length + 1}, minmax(64px, 1fr))`;

  const rotulo = (chave: string | null) =>
    chave === null ? 'Sem dono' : (nomes[chave] ?? 'Membro removido');

  const celula = (valores: Celula | undefined, destaque = false) => {
    if (valores === undefined || valores.recebidos === 0) {
      return <div style={{ textAlign: 'right', color: tema.suave }}>—</div>;
    }

    const poucos = valores.recebidos < POUCOS_LEADS;
    const cor = poucos ? tema.suave : valores.ganhos > 0 ? tema.verde : tema.texto;

    return (
      <div
        style={{
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          fontStyle: poucos ? 'italic' : 'normal',
        }}
      >
        <div style={{ color: cor, fontWeight: destaque || !poucos ? 700 : 400 }}>
          {formatarPercentual(valores.ganhos, valores.recebidos)}
        </div>
        <div style={{ fontSize: '10px', color: tema.suave }}>
          {valores.ganhos}/{valores.recebidos}
        </div>
      </div>
    );
  };

  return (
    <Cartao
      titulo="Conversão por vendedor, safra a safra"
      nota={`Em cada célula, a conversão e, embaixo, ganhos/recebidos. Em cinza e itálico: menos de ${POUCOS_LEADS} leads, a taxa ali é sorte, não desempenho. Total: o período inteiro.`}
      tema={tema}
    >
      {linhas.length === 0 ? (
        <div style={{ fontSize: '12px', color: tema.suave }}>Nada no período.</div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: grade,
              gap: '8px',
              paddingBottom: '4px',
              fontSize: '11px',
              color: tema.suave,
            }}
          >
            <div>Vendedor</div>
            {safras.map((safra) => (
              <div key={safra.chave} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                {safra.rotulo}
              </div>
            ))}
            <div style={{ textAlign: 'right' }}>Total</div>
          </div>
          {linhas.map((linha) => (
            <div
              key={linha.chave ?? 'sem-dono'}
              style={{
                display: 'grid',
                gridTemplateColumns: grade,
                gap: '8px',
                padding: '6px 0',
                borderTop: `1px solid ${tema.borda}`,
                fontSize: '12px',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  color: linha.chave === null ? tema.suave : tema.texto,
                  fontStyle: linha.chave === null ? 'italic' : 'normal',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {rotulo(linha.chave)}
              </div>
              {safras.map((safra) => (
                <div key={safra.chave}>{celula(linha.porSafra[safra.chave])}</div>
              ))}
              {celula(linha.total, true)}
            </div>
          ))}
        </>
      )}
    </Cartao>
  );
};
