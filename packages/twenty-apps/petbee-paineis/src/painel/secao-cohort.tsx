// A visão Cohort: o período do topo aqui é a data em que o lead chegou no
// vendedor, e a pergunta é "desse lote, quantos viraram venda". É a medida
// justa de conversão por pessoa: em cima e embaixo da fração estão os mesmos
// leads, e a limpeza de leads antigos pela cadência não mexe na taxa.
import { useState } from 'react';

import { Titulo } from 'src/painel/cartoes';
import { formatarDia } from 'src/painel/formato';
import { type Funil } from 'src/painel/funil';
import { GradeCohorts } from 'src/painel/grade-cohorts';
import { type Periodo } from 'src/painel/periodo';
import { type Cohort } from 'src/painel/cohort';
import {
  type Agrupamento,
  agruparCohorts,
  gradePorVendedor,
  resumirCohort,
} from 'src/painel/cohorts';
import { TabelaCohorts } from 'src/painel/tabela-cohorts';
import { type Tema } from 'src/painel/tema';

const AGRUPAMENTOS: { valor: Agrupamento; rotulo: string }[] = [
  { valor: 'semana', rotulo: 'Semana (quarta a terça)' },
  { valor: 'mes', rotulo: 'Mês' },
];

export const SecaoCohort = ({
  cohort,
  funil,
  periodo,
  hoje,
  nomes,
  tema,
}: {
  cohort: Cohort;
  funil: Funil | null;
  periodo: Periodo;
  hoje: string;
  nomes: Record<string, string>;
  tema: Tema;
}) => {
  const [agrupamento, setAgrupamento] = useState<Agrupamento>('semana');

  const cohorts = agruparCohorts(cohort.negocios, periodo, agrupamento, hoje);
  const grade = gradePorVendedor(cohort.negocios, cohorts);

  const aviso = (texto: string) => (
    <div style={{ fontSize: '12px', color: tema.laranja }}>
      <b>Atenção:</b> {texto}
    </div>
  );

  return (
    <>
      <Titulo
        texto="Cohort"
        nota={`Aqui o período é a data em que o lead ENTROU EM NEGOCIAÇÃO, ou seja, chegou num vendedor: ${formatarDia(periodo.de)} a ${formatarDia(periodo.ate)}. A situação de cada lead é a de hoje. Venda direta, que não passa por vendedor, fica fora.`}
        tema={tema}
      />

      {funil?.periodoIncompleto && funil.historicoComecaEm !== null
        ? aviso(
            `o histórico de etapas começa em ${formatarDia(funil.historicoComecaEm)}; cohorts anteriores a isso saem zerados.`,
          )
        : null}
      {cohort.truncado
        ? aviso(
            'o período tem registros demais para ler de uma vez; estes números estão por baixo. Escolha um intervalo menor.',
          )
        : null}

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '12px', color: tema.suave }}>Agrupar por</span>
        {AGRUPAMENTOS.map((item) => (
          <button
            key={item.valor}
            onClick={() => setAgrupamento(item.valor)}
            style={{
              padding: '5px 10px',
              borderRadius: '6px',
              border: `1px solid ${agrupamento === item.valor ? tema.texto : tema.borda}`,
              background: agrupamento === item.valor ? tema.destaque : 'transparent',
              color: tema.texto,
              fontWeight: agrupamento === item.valor ? 700 : 500,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            {item.rotulo}
          </button>
        ))}
      </div>

      <TabelaCohorts
        linhas={cohorts}
        total={resumirCohort(cohort.negocios)}
        tema={tema}
      />

      <GradeCohorts linhas={grade} cohorts={cohorts} nomes={nomes} tema={tema} />

      <div style={{ fontSize: '11px', color: tema.suave }}>
        Regras: cada negócio conta uma vez, no cohort em que entrou em negociação
        pela primeira vez; quem já tinha entrado antes do período pertence à
        cohort de lá. Conta para o dono atual do negócio. Lead que voltou e
        ganhou negócio novo entra no cohort do negócio novo. Semana comercial de
        quarta a terça. Negócio apagado do CRM não aparece.
      </div>
    </>
  );
};
