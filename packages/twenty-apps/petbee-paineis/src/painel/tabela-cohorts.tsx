// A tabela de cohorts: uma linha por semana ou mês, e o que virou de cada
// lote de leads entregues aos vendedores. Serve para o time inteiro e, com
// `time` preenchido, para uma pessoa só, com a coluna "vs. time" que diz se
// ela foi melhor ou pior que a média naquele cohort.
import { type ReactNode } from 'react';

import { Cartao } from 'src/painel/cartoes';
import {
  formatarInteiro,
  formatarPercentual,
  formatarPontos,
  formatarReais,
  taxa,
} from 'src/painel/formato';
import {
  DIAS_PARA_AMADURECER,
  type LinhaCohort,
  type ResumoDoCohort,
} from 'src/painel/cohorts';
import { type Tema } from 'src/painel/tema';

const formatarDias = (dias: number | null): string =>
  dias === null
    ? '—'
    : `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(dias)} d`;

const NOTA_PADRAO = `Cada linha é um lote de leads que chegou nos vendedores naquela semana ou mês, olhado como está hoje. Conversão: ganhos sobre recebidos. "Maduro" = fechou há ${DIAS_PARA_AMADURECER} dias ou mais; antes disso o número ainda muda. "Até vender": dias médios entre chegar no vendedor e virar venda.`;

export const TabelaCohorts = ({
  linhas,
  total,
  time,
  titulo = 'Cohorts do time',
  nota = NOTA_PADRAO,
  tema,
}: {
  linhas: LinhaCohort[];
  total: ResumoDoCohort;
  // Os mesmos cohorts para o time inteiro; liga a coluna "vs. time".
  time?: { linhas: LinhaCohort[]; total: ResumoDoCohort };
  titulo?: string;
  nota?: string;
  tema: Tema;
}) => {
  const comparando = time !== undefined;
  const colunas = [
    'Cohort',
    'Recebidos',
    'Ganhos',
    'Perdidos',
    'Em aberto',
    'Conversão',
    ...(comparando ? ['vs. time'] : []),
    'Receita',
    'Ticket médio',
    'Até vender',
    'Maturidade',
  ];
  const grade = [
    'minmax(92px, 1.2fr)',
    'repeat(5, minmax(62px, 1fr))',
    comparando ? 'minmax(72px, 1fr)' : '',
    'repeat(2, minmax(86px, 1.1fr))',
    'minmax(68px, 1fr)',
    'minmax(150px, 1.6fr)',
  ].join(' ');

  const celula = (
    texto: string,
    cor: string,
    negrito = false,
    esquerda = false,
  ) => (
    <div
      style={{
        textAlign: esquerda ? 'left' : 'right',
        color: cor,
        fontWeight: negrito ? 700 : 400,
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {texto}
    </div>
  );

  // Diferença em pontos percentuais para a conversão do time no mesmo
  // cohort. Sem leads de um dos lados não há o que comparar.
  const contraOTime = (pessoa: ResumoDoCohort, doTime: ResumoDoCohort | undefined) => {
    if (doTime === undefined || pessoa.recebidos === 0 || doTime.recebidos === 0) {
      return celula('—', tema.suave);
    }

    const diferenca =
      taxa(pessoa.ganhos, pessoa.recebidos) - taxa(doTime.ganhos, doTime.recebidos);
    const cor = diferenca > 0 ? tema.verde : diferenca < 0 ? tema.vermelho : tema.suave;

    return celula(formatarPontos(diferenca), cor, true);
  };

  const maturidade = (linha: LinhaCohort) => {
    const decididos = formatarPercentual(
      linha.ganhos + linha.perdidos,
      linha.recebidos,
    );

    if (linha.recebidos === 0) return celula('—', tema.suave);
    if (linha.maturidade === 'maduro') return celula('maduro', tema.verde, true);
    if (linha.maturidade === 'em-andamento') {
      return celula(`em andamento · ${decididos} decididos`, tema.suave);
    }

    return celula(`${decididos} decididos`, tema.laranja, true);
  };

  const fileira = (
    rotulo: string,
    valores: ResumoDoCohort,
    doTime: ResumoDoCohort | undefined,
    ultimaColuna: ReactNode,
    destaque: boolean,
    parcial = false,
  ) => (
    <div
      key={rotulo}
      style={{
        display: 'grid',
        gridTemplateColumns: grade,
        gap: '8px',
        padding: '6px 0',
        borderTop: `1px solid ${tema.borda}`,
        fontSize: '12px',
      }}
    >
      {celula(parcial ? `${rotulo} (parcial)` : rotulo, parcial ? tema.suave : tema.texto, destaque, true)}
      {celula(formatarInteiro(valores.recebidos), tema.texto, destaque)}
      {celula(formatarInteiro(valores.ganhos), tema.verde, destaque)}
      {celula(formatarInteiro(valores.perdidos), tema.vermelho, destaque)}
      {celula(formatarInteiro(valores.emAberto), tema.azul, destaque)}
      {celula(formatarPercentual(valores.ganhos, valores.recebidos), tema.texto, true)}
      {comparando ? contraOTime(valores, doTime) : null}
      {celula(formatarReais(valores.receita), tema.verde, destaque)}
      {celula(
        valores.ticketMedio === null ? '—' : formatarReais(valores.ticketMedio),
        tema.texto,
        destaque,
      )}
      {celula(formatarDias(valores.diasAteVender), tema.texto, destaque)}
      {ultimaColuna}
    </div>
  );

  const doTimeNoCohort = (chave: string) =>
    time?.linhas.find((linha) => linha.chave === chave);

  return (
    <Cartao titulo={titulo} nota={nota} tema={tema}>
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
            {colunas.map((coluna, indice) => (
              <div key={coluna} style={{ textAlign: indice === 0 ? 'left' : 'right' }}>
                {coluna}
              </div>
            ))}
          </div>
          {linhas.map((linha) =>
            fileira(
              linha.rotulo,
              linha,
              doTimeNoCohort(linha.chave),
              maturidade(linha),
              false,
              linha.parcial,
            ),
          )}
          {fileira('Total', total, time?.total, celula('', tema.suave), true)}
        </>
      )}
    </Cartao>
  );
};
