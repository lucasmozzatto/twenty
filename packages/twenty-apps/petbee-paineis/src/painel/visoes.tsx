// O conteúdo de cada visão, separado do quadro por uma razão prática: o
// orquestrador precisa caber em 300 linhas e já carrega o estado, as buscas e
// o seletor. Aqui só se escolhe o que desenhar.
import { type ReactNode } from 'react';

import { type Ads } from 'src/painel/ads';
import { type Cohort } from 'src/painel/cohort';
import { type Comparacao } from 'src/painel/comparacao';
import { ComoLer } from 'src/painel/como-ler';
import { type Dados } from 'src/painel/dados';
import { type Desfechos } from 'src/painel/desfechos';
import { type Funil } from 'src/painel/funil';
import { GUIA_VISAO_GERAL } from 'src/painel/guias';
import { type Jornada } from 'src/painel/jornada';
import { type Perdas } from 'src/painel/perdas';
import { type Periodo } from 'src/painel/periodo';
import { SecaoAds } from 'src/painel/secao-ads';
import {
  GraficosComerciais,
  NumerosComerciais,
} from 'src/painel/secao-comercial';
import { SecaoCohort } from 'src/painel/secao-cohort';
import { SecaoFunil } from 'src/painel/secao-funil';
import { SecaoVendedores } from 'src/painel/secao-vendedores';
import { type Semanas } from 'src/painel/semanas';
import { type Tema } from 'src/painel/tema';

export type Visao = 'geral' | 'funil' | 'vendedores' | 'cohort' | 'ads';

export const VISOES: { valor: Visao; rotulo: string }[] = [
  { valor: 'geral', rotulo: 'Visão geral' },
  { valor: 'funil', rotulo: 'Funil' },
  { valor: 'vendedores', rotulo: 'Vendedores' },
  { valor: 'cohort', rotulo: 'Cohort' },
  { valor: 'ads', rotulo: 'Ads' },
];

export type DadosDoPainel = {
  dados: Dados | null;
  comparacao: Comparacao | null;
  funil: Funil | null;
  desfechos: Desfechos | null;
  cohort: Cohort | null;
  jornada: Jornada | null;
  perdas: Perdas | null;
  semanas: Semanas | null;
  ads: Ads | null;
};

export const ConteudoDaVisao = ({
  visao,
  periodo,
  periodoInvalido,
  hoje,
  nomes,
  tema,
  dados,
  comparacao,
  funil,
  desfechos,
  cohort,
  jornada,
  perdas,
  semanas,
  ads,
}: DadosDoPainel & {
  visao: Visao;
  periodo: Periodo;
  periodoInvalido: boolean;
  hoje: string;
  nomes: Record<string, string>;
  tema: Tema;
}): ReactNode => (
  <>
    {visao === 'geral' ? (
      <>
        <ComoLer itens={GUIA_VISAO_GERAL} tema={tema} />
        <NumerosComerciais dados={dados} comparacao={comparacao} tema={tema} />
        {dados && !periodoInvalido ? (
          <GraficosComerciais
            dados={dados}
            comparacao={comparacao}
            periodo={periodo}
            tema={tema}
          />
        ) : null}
      </>
    ) : null}

    {visao === 'funil' && dados && funil && !periodoInvalido ? (
      <SecaoFunil
        funil={funil}
        jornada={jornada}
        criadosNoPeriodo={dados.numeros.criados}
        tema={tema}
      />
    ) : null}

    {visao === 'vendedores' && dados && !periodoInvalido ? (
      <SecaoVendedores
        dados={dados}
        comparacao={comparacao}
        cohort={cohort}
        desfechos={desfechos}
        perdas={perdas}
        semanas={semanas}
        nomes={nomes}
        tema={tema}
      />
    ) : null}

    {visao === 'cohort' && cohort && !periodoInvalido ? (
      <SecaoCohort
        cohort={cohort}
        funil={funil}
        periodo={periodo}
        hoje={hoje}
        nomes={nomes}
        tema={tema}
      />
    ) : null}

    {visao === 'ads' && ads && !periodoInvalido ? (
      <SecaoAds ads={ads} tema={tema} />
    ) : null}

  </>
);
