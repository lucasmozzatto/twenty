// Quadro com seletor de período: a única forma de ter filtro de data global no
// painel, porque os gráficos nativos só leem o filtro gravado em cada um.
//
// Um seletor em cima e quatro visões embaixo (Visão geral, Funil, Vendedores,
// Cohort), como abas DENTRO do quadro: abas do CRM seriam quadros separados,
// cada um com o próprio seletor. No Cohort o período muda de sentido (é a
// data em que o lead chegou no vendedor) e a visão avisa isso na primeira
// linha. Este arquivo só busca os dados; quem desenha são os `secao-*.tsx`.
//
// Lê o GraphQL do CRM direto: o runtime injeta TWENTY_API_URL e o token do
// app, cujo papel é somente leitura. Nem por bug este código altera algo.
import { useCallback, useEffect, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { useColorScheme } from 'twenty-sdk/front-component';

import { PAINEL_PERIODO_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { Abas, AvisoDeErro, AvisoDeFalhas } from 'src/painel/avisos';
import { ComoLer } from 'src/painel/como-ler';
import { buscarNomes } from 'src/painel/crm';
import { buscarComparacao, type Comparacao } from 'src/painel/comparacao';
import { buscarDados, type Dados, type Falha } from 'src/painel/dados';
import { buscarDesfechos, type Desfechos } from 'src/painel/desfechos';
import { buscarFunil, type Funil } from 'src/painel/funil';
import { GUIA_PAINEL, GUIA_VISAO_GERAL } from 'src/painel/guias';
import { buscarJornada, type Jornada } from 'src/painel/jornada';
import { buscarPerdas, type Perdas } from 'src/painel/perdas';
import { buscarSemanas, type Semanas } from 'src/painel/semanas';
import {
  buscarCohort,
  type Cohort,
  incluirVendasSemNegociacao,
} from 'src/painel/cohort';
import {
  hojeEmBrasilia,
  periodoAnterior,
  periodoPredefinido,
  type Periodo,
  type Predefinido,
} from 'src/painel/periodo';
import {
  GraficosComerciais,
  NumerosComerciais,
} from 'src/painel/secao-comercial';
import { SecaoFunil } from 'src/painel/secao-funil';
import { SecaoCohort } from 'src/painel/secao-cohort';
import { SecaoVendedores } from 'src/painel/secao-vendedores';
import { Seletor } from 'src/painel/seletor';
import { construirTema } from 'src/painel/tema';

type Visao = 'geral' | 'funil' | 'vendedores' | 'cohort';

const VISOES: { valor: Visao; rotulo: string }[] = [
  { valor: 'geral', rotulo: 'Visão geral' },
  { valor: 'funil', rotulo: 'Funil' },
  { valor: 'vendedores', rotulo: 'Vendedores' },
  { valor: 'cohort', rotulo: 'Cohort' },
];

const PainelPeriodo = () => {
  const tema = construirTema(useColorScheme() === 'dark');
  const hoje = hojeEmBrasilia();

  const [predefinido, setPredefinido] = useState<Predefinido>('este-mes');
  const [periodo, setPeriodo] = useState<Periodo>(() =>
    periodoPredefinido('este-mes', hoje),
  );
  const [dados, setDados] = useState<Dados | null>(null);
  const [comparar, setComparar] = useState(false);
  const [comparacao, setComparacao] = useState<Comparacao | null>(null);
  const [funil, setFunil] = useState<Funil | null>(null);
  const [desfechos, setDesfechos] = useState<Desfechos | null>(null);
  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [jornada, setJornada] = useState<Jornada | null>(null);
  const [perdas, setPerdas] = useState<Perdas | null>(null);
  const [semanas, setSemanas] = useState<Semanas | null>(null);
  // Falhas das buscas que não dependem do período, para elas também aparecerem.
  const [falhasFixas, setFalhasFixas] = useState<Falha[]>([]);
  const [visao, setVisao] = useState<Visao>('geral');
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const periodoInvalido = periodo.de > periodo.ate;

  const anterior = periodoAnterior(predefinido, periodo);

  const recarregar = useCallback(async () => {
    if (periodoInvalido) return;
    setCarregando(true);
    setErro(null);
    try {
      // As duas buscas vão juntas: o painel aparece de uma vez, sem os
      // rodapés de comparação chegando depois e empurrando a tela.
      const [
        novosDados,
        novaComparacao,
        novoFunil,
        novosDesfechos,
        novoCohort,
        novaJornada,
        novasPerdas,
      ] = await Promise.all([
        buscarDados(periodo),
        comparar ? buscarComparacao(anterior) : Promise.resolve(null),
        buscarFunil(periodo),
        buscarDesfechos(periodo),
        buscarCohort(periodo),
        buscarJornada(periodo),
        buscarPerdas(periodo),
      ]);

      setDados(novosDados);
      setComparacao(novaComparacao);
      setFunil(novoFunil);
      setDesfechos(novosDesfechos);
      setCohort(novoCohort);
      setJornada(novaJornada);
      setPerdas(novasPerdas);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : String(falha));
    } finally {
      setCarregando(false);
    }
    // `anterior` sai de `predefinido` e `periodo`, então não entra na lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, periodoInvalido, comparar, predefinido]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  // Os nomes dos vendedores não dependem do período: uma busca por sessão.
  useEffect(() => {
    buscarNomes()
      .then(setNomes)
      .catch(() =>
        setFalhasFixas((antes) => [
          ...antes,
          { onde: 'nomes dos vendedores', motivo: 'não carregou' },
        ]),
      );
  }, []);

  // O acompanhamento semanal é fixo: não depende do filtro de período, então
  // é buscado uma vez só, quando o painel abre.
  useEffect(() => {
    buscarSemanas(hoje)
      .then(setSemanas)
      .catch(() =>
        setFalhasFixas((antes) => [
          ...antes,
          { onde: 'semana a semana', motivo: 'não carregou' },
        ]),
      );
    // `hoje` não muda enquanto a tela está aberta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const escolherPredefinido = (qual: Predefinido) => {
    setPredefinido(qual);
    setPeriodo(periodoPredefinido(qual, hoje));
  };

  const editarData = (campo: keyof Periodo, valor: string) => {
    if (valor === '') return;
    setPredefinido('personalizado');
    setPeriodo((atual) => ({ ...atual, [campo]: valor }));
  };

  // As vendas que pularam a etapa de negociação entram no cohort no dia da
  // venda, e as duas visões (Vendedores e Cohort) leem o mesmo lote.
  const cohortCompleto =
    cohort === null
      ? null
      : incluirVendasSemNegociacao(cohort, desfechos?.vendasSemNegociacao ?? []);

  const falhas = [
    ...falhasFixas,
    ...(dados?.falhas ?? []),
    ...(comparacao?.falhas ?? []),
    ...(funil?.falhas ?? []),
    ...(desfechos?.falhas ?? []),
    ...(cohort?.falhas ?? []),
    ...(jornada?.falhas ?? []),
    ...(perdas?.falhas ?? []),
    ...(semanas?.falhas ?? []),
  ];

  return (
    <div
      style={{
        padding: '12px 16px',
        fontFamily: 'inherit',
        color: tema.texto,
        fontSize: '13px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <Seletor
        predefinido={predefinido}
        periodo={periodo}
        anterior={anterior}
        hoje={hoje}
        comparar={comparar}
        carregando={carregando}
        periodoInvalido={periodoInvalido}
        tema={tema}
        aoEscolherPredefinido={escolherPredefinido}
        aoEditarData={editarData}
        aoAlternarComparar={() => setComparar((ligado) => !ligado)}
        aoAtualizar={recarregar}
      />

      {erro ? (
        <AvisoDeErro erro={erro} aoTentarDeNovo={recarregar} tema={tema} />
      ) : null}

      <AvisoDeFalhas falhas={falhas} tema={tema} />

      <ComoLer titulo="Como ler este painel" itens={GUIA_PAINEL} tema={tema} />

      {/* As visões, como abas dentro do quadro. */}
      <Abas opcoes={VISOES} ativa={visao} aoEscolher={setVisao} tema={tema} />

      {/* Enquanto recarrega, os números velhos ficam esmaecidos em vez de
          desaparecer: trocar o período não faz a tela pular. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          opacity: carregando ? 0.6 : 1,
        }}
      >
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
            cohort={cohortCompleto}
            desfechos={desfechos}
            perdas={perdas}
            semanas={semanas}
            nomes={nomes}
            tema={tema}
          />
        ) : null}

        {visao === 'cohort' && cohortCompleto && !periodoInvalido ? (
          <SecaoCohort
            cohort={cohortCompleto}
            funil={funil}
            periodo={periodo}
            hoje={hoje}
            nomes={nomes}
            tema={tema}
          />
        ) : null}

        {visao !== 'geral' && dados === null ? (
          <div style={{ fontSize: '12px', color: tema.suave }}>Carregando…</div>
        ) : null}
      </div>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: PAINEL_PERIODO_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'painel-periodo',
  description:
    'Painel comercial e de vendedores com seletor de período: números, linhas por dia, barras por origem, canal e vendedor, e pipeline por etapa e dono.',
  component: PainelPeriodo,
});
