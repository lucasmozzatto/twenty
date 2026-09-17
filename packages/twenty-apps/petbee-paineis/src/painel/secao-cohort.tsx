// A visão Cohort: o período do topo aqui é a data em que o lead chegou no
// vendedor, e a pergunta é "desse lote, quantos viraram venda". É a medida
// justa de conversão por pessoa: em cima e embaixo da fração estão os mesmos
// leads, e a limpeza de leads antigos pela cadência não mexe na taxa.
import { useState } from 'react';

import { Titulo } from 'src/painel/cartoes';
import { ComoLer } from 'src/painel/como-ler';
import { GUIA_COHORT } from 'src/painel/guias';
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
  // Quem está aberto no detalhe. "Sem dono" vira texto para caber no estado.
  const [escolhido, setEscolhido] = useState<string | null>(null);

  // O período que vale aqui é o já recortado no piso do histórico.
  const periodoContado = cohort.periodo;
  const cohorts = agruparCohorts(cohort.negocios, periodoContado, agrupamento, hoje);
  const grade = gradePorVendedor(cohort.negocios, cohorts);

  // Se a pessoa escolhida sumiu do período (ou nada foi escolhido), abre a
  // primeira da grade, que é quem mais recebeu.
  const chaveDe = (dono: string | null) => dono ?? 'sem-dono';
  const vendedorAberto =
    grade.find((linha) => chaveDe(linha.chave) === escolhido) ?? grade[0];
  const negociosDoVendedor =
    vendedorAberto === undefined
      ? []
      : cohort.negocios.filter((negocio) => negocio.ownerId === vendedorAberto.chave);
  const nomeDe = (dono: string | null) =>
    dono === null ? 'Sem dono' : (nomes[dono] ?? 'Membro removido');

  const botao = (rotulo: string, ativo: boolean, aoClicar: () => void) => (
    <button
      key={rotulo}
      onClick={aoClicar}
      style={{
        padding: '5px 10px',
        borderRadius: '6px',
        border: `1px solid ${ativo ? tema.texto : tema.borda}`,
        background: ativo ? tema.destaque : 'transparent',
        color: tema.texto,
        fontWeight: ativo ? 700 : 500,
        fontSize: '12px',
        cursor: 'pointer',
      }}
    >
      {rotulo}
    </button>
  );

  const aviso = (texto: string) => (
    <div style={{ fontSize: '12px', color: tema.laranja }}>
      <b>Atenção:</b> {texto}
    </div>
  );

  return (
    <>
      <Titulo
        texto="Cohort"
        nota={`Aqui o período é a data em que o lead ENTROU EM NEGOCIAÇÃO, ou seja, chegou num vendedor: ${formatarDia(periodoContado.de)} a ${formatarDia(periodoContado.ate)}. A situação de cada lead é a de hoje. Venda direta, que não passa por vendedor, fica fora.`}
        tema={tema}
      />

      <ComoLer itens={GUIA_COHORT} tema={tema} />

      {cohort.cortadoNoInicio
        ? aviso(
            `contando a partir de ${formatarDia(periodoContado.de)}, por decisão do dono do painel: antes disso o processo ainda estava sendo ajustado. O período escolhido (desde ${formatarDia(periodo.de)}) foi recortado.`,
          )
        : null}

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
        {AGRUPAMENTOS.map((item) =>
          botao(item.rotulo, agrupamento === item.valor, () =>
            setAgrupamento(item.valor),
          ),
        )}
      </div>

      <TabelaCohorts
        linhas={cohorts}
        total={resumirCohort(cohort.negocios)}
        tema={tema}
      />

      <GradeCohorts linhas={grade} cohorts={cohorts} nomes={nomes} tema={tema} />

      {/* O detalhe de uma pessoa: a mesma tabela do time, só com os leads
          dela, mais a coluna que a compara com o time no mesmo cohort. */}
      {vendedorAberto === undefined ? null : (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: '12px', color: tema.suave }}>Detalhe de</span>
            {grade.map((linha) =>
              botao(
                nomeDe(linha.chave),
                chaveDe(linha.chave) === chaveDe(vendedorAberto.chave),
                () => setEscolhido(chaveDe(linha.chave)),
              ),
            )}
          </div>
          <TabelaCohorts
            titulo={`Cohorts de ${nomeDe(vendedorAberto.chave)}`}
            nota={`Só os leads que chegaram em ${nomeDe(vendedorAberto.chave)}, cohort a cohort. "vs. time": a conversão dela ou dele menos a do time inteiro no mesmo cohort, em pontos percentuais. Verde é acima do time, vermelho é abaixo.`}
            linhas={agruparCohorts(negociosDoVendedor, periodoContado, agrupamento, hoje)}
            total={resumirCohort(negociosDoVendedor)}
            time={{ linhas: cohorts, total: resumirCohort(cohort.negocios) }}
            tema={tema}
          />
        </>
      )}

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
