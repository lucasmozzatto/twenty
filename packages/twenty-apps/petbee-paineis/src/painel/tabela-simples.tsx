// Tabela pequena de rótulo mais números, no mesmo desenho das outras tabelas
// do painel. Serve aos quadros da jornada na visão Ads, que são vários e
// iguais na forma.
import { type Tema } from 'src/painel/tema';

export type Celula = { texto: string; cor?: string };
export type Linha = { rotulo: string; celulas: Celula[]; destaque?: boolean; italico?: boolean };

const GRADE = (colunas: number) =>
  `minmax(96px, 1.5fr) repeat(${colunas}, minmax(52px, 1fr))`;

export const Tabela = ({
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

export const Rodape = ({ texto, tema }: { texto: string; tema: Tema }) => (
  <div style={{ fontSize: '11px', color: tema.suave, marginTop: '8px' }}>{texto}</div>
);
