// A grade vendedor × cohort: cada pessoa em cada lote, lado a lado. É o
// quadro que compara vendedores com a mesma régua. O botão "Mostrar" troca
// o número da célula sem nova consulta: a célula já carrega tudo.
import { useState } from 'react';

import { Cartao } from 'src/painel/cartoes';
import {
  formatarInteiro,
  formatarPercentual,
  formatarReais,
} from 'src/painel/formato';
import {
  type Celula,
  type LinhaCohort,
  type LinhaDaGrade,
  POUCOS_LEADS,
} from 'src/painel/cohorts';
import { type Tema } from 'src/painel/tema';

type Metrica =
  | 'conversao'
  | 'decididos'
  | 'recebidos'
  | 'ganhos'
  | 'emAberto'
  | 'receita';

const METRICAS: { valor: Metrica; rotulo: string }[] = [
  { valor: 'conversao', rotulo: 'Conversão' },
  { valor: 'decididos', rotulo: 'Sobre decididos' },
  { valor: 'recebidos', rotulo: 'Recebidos' },
  { valor: 'ganhos', rotulo: 'Ganhos' },
  { valor: 'emAberto', rotulo: 'Em aberto' },
  { valor: 'receita', rotulo: 'Receita' },
];

// Só as taxas dependem de volume para valer alguma coisa. Contagem é contagem.
const E_TAXA: Record<Metrica, boolean> = {
  conversao: true,
  decididos: true,
  recebidos: false,
  ganhos: false,
  emAberto: false,
  receita: false,
};

const valorDaCelula = (celula: Celula, metrica: Metrica): string => {
  switch (metrica) {
    case 'conversao':
      return formatarPercentual(celula.ganhos, celula.recebidos);
    case 'decididos':
      return formatarPercentual(celula.ganhos, celula.ganhos + celula.perdidos);
    case 'recebidos':
      return formatarInteiro(celula.recebidos);
    case 'ganhos':
      return formatarInteiro(celula.ganhos);
    case 'emAberto':
      return formatarInteiro(celula.recebidos - celula.ganhos - celula.perdidos);
    case 'receita':
      return formatarReais(celula.receita);
  }
};

// A fração embaixo do número: de onde a taxa saiu.
const legendaDaCelula = (celula: Celula, metrica: Metrica): string =>
  metrica === 'decididos'
    ? `${celula.ganhos}/${celula.ganhos + celula.perdidos}`
    : `${celula.ganhos}/${celula.recebidos}`;

export const GradeCohorts = ({
  linhas,
  cohorts,
  nomes,
  tema,
}: {
  linhas: LinhaDaGrade[];
  cohorts: LinhaCohort[];
  nomes: Record<string, string>;
  tema: Tema;
}) => {
  const [metrica, setMetrica] = useState<Metrica>('conversao');

  const grade = `minmax(100px, 1.3fr) repeat(${cohorts.length + 1}, minmax(64px, 1fr))`;

  const rotulo = (chave: string | null) =>
    chave === null ? 'Sem dono' : (nomes[chave] ?? 'Membro removido');

  const celula = (valores: Celula | undefined, destaque = false) => {
    if (valores === undefined || valores.recebidos === 0) {
      return <div style={{ textAlign: 'right', color: tema.suave }}>—</div>;
    }

    const poucos = E_TAXA[metrica] && valores.recebidos < POUCOS_LEADS;
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
          {valorDaCelula(valores, metrica)}
        </div>
        <div style={{ fontSize: '10px', color: tema.suave }}>
          {legendaDaCelula(valores, metrica)}
        </div>
      </div>
    );
  };

  const botao = (item: { valor: Metrica; rotulo: string }) => (
    <button
      key={item.valor}
      onClick={() => setMetrica(item.valor)}
      style={{
        padding: '4px 9px',
        borderRadius: '6px',
        border: `1px solid ${metrica === item.valor ? tema.texto : tema.borda}`,
        background: metrica === item.valor ? tema.destaque : 'transparent',
        color: tema.texto,
        fontWeight: metrica === item.valor ? 700 : 500,
        fontSize: '11px',
        cursor: 'pointer',
      }}
    >
      {item.rotulo}
    </button>
  );

  return (
    <Cartao
      titulo="Conversão por vendedor, cohort a cohort"
      nota={`Em cada célula, o número escolhido em "Mostrar" e, embaixo, ganhos/recebidos. "Sobre decididos" tira os em aberto da conta: serve para cohort que ainda não amadureceu. Taxa em cinza e itálico: menos de ${POUCOS_LEADS} leads, é sorte, não desempenho. Total: o período inteiro.`}
      tema={tema}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flexWrap: 'wrap',
          marginBottom: '10px',
        }}
      >
        <span style={{ fontSize: '11px', color: tema.suave }}>Mostrar</span>
        {METRICAS.map(botao)}
      </div>
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
            {cohorts.map((cohort) => (
              <div key={cohort.chave} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                {cohort.rotulo}
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
              {cohorts.map((cohort) => (
                <div key={cohort.chave}>{celula(linha.porCohort[cohort.chave])}</div>
              ))}
              {celula(linha.total, true)}
            </div>
          ))}
        </>
      )}
    </Cartao>
  );
};
