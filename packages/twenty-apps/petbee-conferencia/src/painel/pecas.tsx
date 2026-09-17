// Peças pequenas das listas: etiqueta colorida, ligação para o registro no
// CRM, fichas de filtro e o "mostrar mais".
import { AppPath, navigate } from 'twenty-sdk/front-component';

import { type Tema } from 'src/painel/tema';

// As listas crescem de 40 em 40: o quadro tem altura fixa na grade, e uma
// lista inteira de um mês cheio não caberia sem rolagem interna.
export const PASSO = 40;

export const Etiqueta = ({ texto, cor }: { texto: string; cor: string }) => (
  <span
    style={{
      display: 'inline-block',
      padding: '1px 7px',
      borderRadius: '10px',
      border: `1px solid ${cor}`,
      color: cor,
      fontSize: '11px',
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}
  >
    {texto}
  </span>
);

// Abre o registro na própria aba do CRM. `navigate` é o jeito oficial de o
// componente pedir navegação ao CRM; um link comum não sai do quadro.
export const Ligacao = ({
  objeto,
  id,
  texto,
  tema,
}: {
  objeto: 'opportunity' | 'assinatura' | 'person';
  id: string;
  texto: string;
  tema: Tema;
}) => (
  <a
    onClick={() => {
      void navigate(AppPath.RecordShowPage, {
        objectNameSingular: objeto,
        objectRecordId: id,
      });
    }}
    title="Abrir no CRM"
    style={{
      color: tema.azul,
      cursor: 'pointer',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }}
  >
    {texto}
  </a>
);

export type Ficha<TValor extends string> = {
  valor: TValor;
  rotulo: string;
  quantidade: number;
};

export const Fichas = <TValor extends string,>({
  fichas,
  ativa,
  tema,
  aoEscolher,
}: {
  fichas: Ficha<TValor>[];
  ativa: TValor;
  tema: Tema;
  aoEscolher: (valor: TValor) => void;
}) => (
  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
    {fichas.map((ficha) => {
      const ligada = ficha.valor === ativa;

      return (
        <button
          key={ficha.valor}
          onClick={() => aoEscolher(ficha.valor)}
          style={{
            padding: '3px 9px',
            borderRadius: '12px',
            border: `1px solid ${ligada ? tema.texto : tema.borda}`,
            background: ligada ? tema.destaque : 'transparent',
            color: tema.texto,
            fontSize: '11px',
            fontWeight: ligada ? 700 : 500,
            cursor: 'pointer',
          }}
        >
          {ficha.rotulo} <span style={{ color: tema.suave }}>{ficha.quantidade}</span>
        </button>
      );
    })}
  </div>
);

export const MostrarMais = ({
  restantes,
  tema,
  aoClicar,
}: {
  restantes: number;
  tema: Tema;
  aoClicar: () => void;
}) =>
  restantes <= 0 ? null : (
    <a
      onClick={aoClicar}
      style={{
        display: 'inline-block',
        marginTop: '8px',
        cursor: 'pointer',
        color: tema.suave,
        fontSize: '12px',
      }}
    >
      mostrar mais {Math.min(restantes, PASSO)} (faltam {restantes})
    </a>
  );

export const Cabecalho = ({
  colunas,
  grade,
  tema,
}: {
  colunas: string[];
  grade: string;
  tema: Tema;
}) => (
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
    {colunas.map((coluna) => (
      <div key={coluna} style={{ whiteSpace: 'nowrap' }}>
        {coluna}
      </div>
    ))}
  </div>
);
