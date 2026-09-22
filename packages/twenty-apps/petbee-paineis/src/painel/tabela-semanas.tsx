// O acompanhamento semanal fixo: uma linha por semana comercial, sempre as
// mesmas, independentes do filtro de período. Os botões trocam de quem são
// os números, como nas tabelas de perdas.
import { useState } from 'react';

import { Cartao } from 'src/painel/cartoes';
import {
  formatarInteiro,
  formatarPercentual,
  formatarReais,
} from 'src/painel/formato';
import {
  CHAVE_SEM_DONO,
  type CelulaSemana,
  type LinhaSemana,
  MAXIMO_DE_SEMANAS,
  type Semanas,
} from 'src/painel/semanas';
import { type Tema } from 'src/painel/tema';

const GRADE = 'minmax(120px, 1.3fr) repeat(2, minmax(64px, 0.8fr)) minmax(64px, 0.8fr) repeat(2, minmax(88px, 1fr)) minmax(96px, 1.1fr)';
const COLUNAS = ['Semana', 'Recebidos', 'Ganhos', 'Taxa', 'Receita', 'Ticket médio'];

const diaEMes = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

const rotuloDaSemana = (linha: LinhaSemana) =>
  linha.inicio.slice(0, 7) === linha.fim.slice(0, 7)
    ? `${linha.inicio.slice(8, 10)} a ${diaEMes(linha.fim)}`
    : `${diaEMes(linha.inicio)} a ${diaEMes(linha.fim)}`;

export const TabelaSemanas = ({
  semanas,
  nomes,
  tema,
}: {
  semanas: Semanas;
  nomes: Record<string, string>;
  tema: Tema;
}) => {
  const [dono, setDono] = useState<string>('time');

  const nomeDe = (chave: string) =>
    chave === CHAVE_SEM_DONO ? 'Sem dono' : (nomes[chave] ?? 'Membro removido');

  // Só entra no seletor quem tem algum número em alguma semana.
  const comNumeros = new Set<string>();

  for (const linha of semanas.linhas) {
    for (const [chave, celula] of Object.entries(linha.porDono)) {
      if (celula.recebidos > 0 || celula.ganhos > 0) comNumeros.add(chave);
    }
  }

  const escolhas = [
    { valor: 'time', rotulo: 'Time' },
    ...[...comNumeros].map((chave) => ({ valor: chave, rotulo: nomeDe(chave) })),
  ];

  const daLinha = (linha: LinhaSemana): CelulaSemana =>
    dono === 'time'
      ? linha.total
      : (linha.porDono[dono] ?? { recebidos: 0, ganhos: 0, receita: 0 });

  const celula = (texto: string, cor: string, negrito = false, esquerda = false) => (
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

  const fileira = (rotulo: string, valores: CelulaSemana, marca: string, destaque: boolean) => (
    <div
      key={rotulo}
      style={{
        display: 'grid',
        gridTemplateColumns: GRADE,
        gap: '8px',
        padding: '6px 0',
        borderTop: `1px solid ${tema.borda}`,
        fontSize: '12px',
      }}
    >
      <div style={{ color: tema.texto, fontWeight: destaque ? 700 : 400 }}>
        {rotulo}
        {marca === '' ? null : (
          <span style={{ color: tema.suave, fontWeight: 400 }}> · {marca}</span>
        )}
      </div>
      {celula(formatarInteiro(valores.recebidos), tema.texto, destaque)}
      {celula(formatarInteiro(valores.ganhos), tema.verde, destaque)}
      {celula(formatarPercentual(valores.ganhos, valores.recebidos), tema.texto, true)}
      {celula(formatarReais(valores.receita), tema.verde, destaque)}
      {celula(
        valores.ganhos === 0 ? '—' : formatarReais(valores.receita / valores.ganhos),
        tema.texto,
        destaque,
      )}
    </div>
  );

  const somaDeTudo = semanas.linhas.reduce(
    (soma, linha) => {
      const valores = daLinha(linha);

      return {
        recebidos: soma.recebidos + valores.recebidos,
        ganhos: soma.ganhos + valores.ganhos,
        receita: soma.receita + valores.receita,
      };
    },
    { recebidos: 0, ganhos: 0, receita: 0 },
  );

  return (
    <Cartao
      titulo="Semana a semana"
      nota={`Sempre as últimas ${MAXIMO_DE_SEMANAS} semanas comerciais, de quarta a terça, sem depender do filtro de período lá de cima. Começa em 01/09/2026, quando o histórico passou a valer, e ganha uma linha nova a cada quarta. Recebidos: leads que chegaram na pessoa naquela semana. Ganhos: vendas com Fechamento = Comercial pela data de fechamento. Taxa: ganhos sobre recebidos. A semana em andamento ainda vai mexer.`}
      tema={tema}
    >
      {semanas.truncado ? (
        <div style={{ fontSize: '12px', color: tema.laranja, marginBottom: '8px' }}>
          <b>Atenção:</b> há registros demais para ler de uma vez; estes números estão
          por baixo.
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
        {escolhas.map((escolha) => (
          <button
            key={escolha.valor}
            onClick={() => setDono(escolha.valor)}
            style={{
              padding: '4px 9px',
              borderRadius: '6px',
              border: `1px solid ${dono === escolha.valor ? tema.texto : tema.borda}`,
              background: dono === escolha.valor ? tema.destaque : 'transparent',
              color: tema.texto,
              fontWeight: dono === escolha.valor ? 700 : 500,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            {escolha.rotulo}
          </button>
        ))}
      </div>

      {semanas.linhas.length === 0 ? (
        <div style={{ fontSize: '12px', color: tema.suave }}>Sem semanas ainda.</div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: GRADE,
              gap: '8px',
              paddingBottom: '4px',
              fontSize: '11px',
              color: tema.suave,
            }}
          >
            {COLUNAS.map((coluna, indice) => (
              <div key={coluna} style={{ textAlign: indice === 0 ? 'left' : 'right' }}>
                {coluna}
              </div>
            ))}
          </div>
          {semanas.linhas.map((linha) =>
            fileira(
              rotuloDaSemana(linha),
              daLinha(linha),
              linha.emAndamento ? 'em andamento' : linha.parcial ? 'parcial' : '',
              false,
            ),
          )}
          {fileira('Total', somaDeTudo, '', true)}
        </>
      )}
    </Cartao>
  );
};
