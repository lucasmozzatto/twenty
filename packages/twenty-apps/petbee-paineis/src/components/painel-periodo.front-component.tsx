// Quadro com seletor de período: a única forma de ter filtro de data global no
// painel, porque os gráficos nativos só leem o filtro gravado em cada um.
//
// Um seletor de período em cima e três visões embaixo: Visão geral, Funil e
// Vendedores. São abas DENTRO do quadro, não abas do CRM, de propósito: cada
// aba do CRM seria um quadro independente com o próprio seletor, e a pessoa
// escolheria o período três vezes. Aqui escolhe uma vez e troca de visão.
// Este arquivo cuida só do seletor e de buscar os dados; quem desenha são
// os arquivos `secao-*.tsx` em `src/painel/`.
//
// Busca os dados direto do GraphQL do CRM, como a régua da cadência faz: o
// runtime injeta TWENTY_API_URL e o token do app. O papel do app é somente
// leitura, então este código não consegue alterar nada nem por bug.
import { useCallback, useEffect, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { useColorScheme } from 'twenty-sdk/front-component';

import { PAINEL_PERIODO_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { buscarNomes } from 'src/painel/crm';
import { buscarComparacao, type Comparacao } from 'src/painel/comparacao';
import { buscarDados, type Dados } from 'src/painel/dados';
import { buscarDesfechos, type Desfechos } from 'src/painel/desfechos';
import { buscarFunil, type Funil } from 'src/painel/funil';
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
import { SecaoVendedores } from 'src/painel/secao-vendedores';
import { Seletor } from 'src/painel/seletor';
import { construirTema } from 'src/painel/tema';

type Visao = 'geral' | 'funil' | 'vendedores';

const VISOES: { valor: Visao; rotulo: string }[] = [
  { valor: 'geral', rotulo: 'Visão geral' },
  { valor: 'funil', rotulo: 'Funil' },
  { valor: 'vendedores', rotulo: 'Vendedores' },
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
      const [novosDados, novaComparacao, novoFunil, novosDesfechos] =
        await Promise.all([
          buscarDados(periodo),
          comparar ? buscarComparacao(anterior) : Promise.resolve(null),
          buscarFunil(periodo),
          buscarDesfechos(periodo),
        ]);

      setDados(novosDados);
      setComparacao(novaComparacao);
      setFunil(novoFunil);
      setDesfechos(novosDesfechos);
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
      .catch(() => setNomes({}));
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

  const falhas = [
    ...(dados?.falhas ?? []),
    ...(comparacao?.falhas ?? []),
    ...(funil?.falhas ?? []),
    ...(desfechos?.falhas ?? []),
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
        <div style={{ color: tema.vermelho, fontSize: '12px' }}>
          Não consegui ler o CRM ({erro}).{' '}
          <a
            onClick={recarregar}
            style={{ cursor: 'pointer', textDecoration: 'underline' }}
          >
            Tentar de novo
          </a>
        </div>
      ) : null}

      {/* Um quadro que falhou aparece zerado, então o aviso é obrigatório:
          sem ele um zero por erro pareceria um zero de verdade. */}
      {falhas.length > 0 ? (
        <div
          style={{
            padding: '8px 10px',
            borderRadius: '6px',
            border: `1px solid ${tema.laranja}`,
            color: tema.laranja,
            fontSize: '12px',
          }}
        >
          <b>Atenção:</b> estes quadros não carregaram e estão zerados —{' '}
          {falhas.map((falha) => falha.onde).join(', ')}. Motivo do primeiro:{' '}
          {falhas[0].motivo}
        </div>
      ) : null}

      {/* As visões, como abas dentro do quadro. */}
      <div
        style={{
          display: 'flex',
          gap: '2px',
          borderBottom: `1px solid ${tema.borda}`,
        }}
      >
        {VISOES.map((item) => (
          <button
            key={item.valor}
            onClick={() => setVisao(item.valor)}
            style={{
              padding: '8px 14px',
              border: 'none',
              borderBottom: `2px solid ${visao === item.valor ? tema.texto : 'transparent'}`,
              marginBottom: '-1px',
              background: 'transparent',
              color: visao === item.valor ? tema.texto : tema.suave,
              fontWeight: visao === item.valor ? 700 : 500,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            {item.rotulo}
          </button>
        ))}
      </div>

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
            criadosNoPeriodo={dados.numeros.criados}
            tema={tema}
          />
        ) : null}

        {visao === 'vendedores' && dados && !periodoInvalido ? (
          <SecaoVendedores
            dados={dados}
            comparacao={comparacao}
            funil={funil}
            desfechos={desfechos}
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
