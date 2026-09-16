// Quadro com seletor de período: a única forma de ter filtro de data global no
// painel, porque os gráficos nativos só leem o filtro gravado em cada um.
//
// Tem duas seções. A de cima é a visão comercial e obedece ao período todo.
// A de baixo é a visão por vendedor, com os gráficos de pipeline que são foto
// de agora. Este arquivo cuida só do seletor e de buscar os dados; quem desenha
// é `src/painel/secao-comercial.tsx` e `src/painel/secao-vendedores.tsx`.
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
import { formatarDia } from 'src/painel/formato';
import {
  contarDias,
  hojeEmBrasilia,
  periodoAnterior,
  periodoPredefinido,
  PREDEFINIDOS,
  type Periodo,
  type Predefinido,
} from 'src/painel/periodo';
import {
  GraficosComerciais,
  NumerosComerciais,
} from 'src/painel/secao-comercial';
import { SecaoVendedores } from 'src/painel/secao-vendedores';
import { construirTema } from 'src/painel/tema';

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
      const [novosDados, novaComparacao] = await Promise.all([
        buscarDados(periodo),
        comparar ? buscarComparacao(anterior) : Promise.resolve(null),
      ]);

      setDados(novosDados);
      setComparacao(novaComparacao);
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

  const botaoPeriodo = (valor: Predefinido, rotulo: string) => {
    const ativo = predefinido === valor;

    return (
      <button
        key={valor}
        onClick={() => escolherPredefinido(valor)}
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
  };

  const campoData = (campo: keyof Periodo, rotulo: string) => (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '12px',
        color: tema.suave,
      }}
    >
      {rotulo}
      <input
        type="date"
        value={periodo[campo]}
        max={hoje}
        onChange={(evento) => editarData(campo, evento.target.value)}
        style={{
          padding: '4px 6px',
          borderRadius: '6px',
          border: `1px solid ${tema.borda}`,
          background: tema.fundo,
          color: tema.texto,
          fontSize: '12px',
        }}
      />
    </label>
  );

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
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}
      >
        {PREDEFINIDOS.map((item) => botaoPeriodo(item.valor, item.rotulo))}
        <span style={{ width: '8px' }} />
        {campoData('de', 'De')}
        {campoData('ate', 'Até')}
        <button
          onClick={() => setComparar((ligado) => !ligado)}
          style={{
            marginLeft: 'auto',
            padding: '5px 10px',
            borderRadius: '6px',
            border: `1px solid ${comparar ? tema.texto : tema.borda}`,
            background: comparar ? tema.destaque : 'transparent',
            color: tema.texto,
            fontWeight: comparar ? 700 : 500,
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          {comparar ? '✓ ' : ''}Comparar com o período anterior
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          color: tema.suave,
        }}
      >
        {periodoInvalido ? (
          <span style={{ color: tema.vermelho }}>
            A data inicial está depois da final.
          </span>
        ) : (
          <span>
            {formatarDia(periodo.de)} a {formatarDia(periodo.ate)} ·{' '}
            {contarDias(periodo)} {contarDias(periodo) === 1 ? 'dia' : 'dias'} ·
            horário de Brasília
            {comparar ? (
              <>
                {' '}
                · comparando com{' '}
                <b style={{ color: tema.texto }}>
                  {formatarDia(anterior.de)} a {formatarDia(anterior.ate)}
                </b>{' '}
                ({contarDias(anterior)}{' '}
                {contarDias(anterior) === 1 ? 'dia' : 'dias'})
              </>
            ) : null}
          </span>
        )}
        <a
          onClick={recarregar}
          style={{ marginLeft: 'auto', cursor: 'pointer', color: tema.suave }}
        >
          {carregando ? 'carregando…' : '↻ atualizar'}
        </a>
      </div>

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
      {dados && [...dados.falhas, ...(comparacao?.falhas ?? [])].length > 0 ? (
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
          {[...dados.falhas, ...(comparacao?.falhas ?? [])]
            .map((falha) => falha.onde)
            .join(', ')}
          . Motivo do primeiro:{' '}
          {[...dados.falhas, ...(comparacao?.falhas ?? [])][0].motivo}
        </div>
      ) : null}

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
        <NumerosComerciais dados={dados} comparacao={comparacao} tema={tema} />
        {dados && !periodoInvalido ? (
          <>
            <GraficosComerciais
              dados={dados}
              comparacao={comparacao}
              periodo={periodo}
              tema={tema}
            />
            <SecaoVendedores
              dados={dados}
              comparacao={comparacao}
              nomes={nomes}
              tema={tema}
            />
          </>
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
