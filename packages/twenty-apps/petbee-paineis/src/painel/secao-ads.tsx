// A visão Ads: uma tabela só, com um seletor de dimensão em cima. Trocar de
// dimensão refaz a tabela inteira, em vez de encher a tela de quadros.
import { useState } from 'react';

import {
  agruparPorDimensao,
  type Ads,
  chaveNaDimensao,
  type Dimensao,
  type LinhaDeMidia,
  somarMidia,
} from 'src/painel/ads';
import { Cartao, Titulo } from 'src/painel/cartoes';
import { ComoLer } from 'src/painel/como-ler';
import {
  formatarInteiro,
  formatarPercentual,
  formatarReais,
} from 'src/painel/formato';
import { GUIA_ADS } from 'src/painel/guias';
import { rotuloCanal, rotuloOrigem } from 'src/painel/rotulos';
import { TabelasPercurso } from 'src/painel/tabelas-percurso';
import { type Tema } from 'src/painel/tema';

const OPCOES: { valor: Dimensao; rotulo: string }[] = [
  { valor: 'origem', rotulo: 'Origem' },
  { valor: 'canal', rotulo: 'Canal' },
  { valor: 'utmSource', rotulo: 'Source' },
  { valor: 'utmMedium', rotulo: 'Medium' },
  { valor: 'utmCampaign', rotulo: 'Campanha' },
  { valor: 'utmContent', rotulo: 'Conteúdo' },
  { valor: 'utmTerm', rotulo: 'Termo' },
  { valor: 'testeLp', rotulo: 'Teste LP' },
];

const MAXIMO_DE_LINHAS = 25;
const GRADE =
  'minmax(150px, 1.9fr) repeat(2, minmax(60px, 0.8fr)) minmax(72px, 0.8fr) minmax(60px, 0.8fr) minmax(72px, 0.9fr) minmax(92px, 1.05fr) minmax(92px, 1.05fr)';
const COLUNAS = [
  '',
  'Leads',
  'Qualificados',
  '% qualificou',
  'Vendas',
  'Conversão',
  'Receita',
  'Ticket médio',
];

// Os enums têm rótulo bonito; o resto é texto da UTM e vai como veio, só em
// minúsculas. O CRM guarda o enum em maiúsculas, então desfaço a limpeza aqui.
const rotularEnum = (dimensao: Dimensao, chave: string): string => {
  if (dimensao === 'origem') return rotuloOrigem(chave.toUpperCase());
  if (dimensao === 'canal') return rotuloCanal(chave.toUpperCase());
  if (dimensao === 'testeLp') {
    return chave
      .replace(/_/g, ' ')
      .replace(/^\w/, (letra) => letra.toUpperCase());
  }

  return chave;
};

export const SecaoAds = ({ ads, tema }: { ads: Ads; tema: Tema }) => {
  const [dimensao, setDimensao] = useState<Dimensao>('utmSource');
  // A linha escolhida para a jornada embaixo; null é "todos os leads".
  const [escolhida, setEscolhida] = useState<string | null>(null);

  const linhas = agruparPorDimensao(ads.negocios, dimensao, rotularEnum);
  const total = somarMidia(linhas);
  const visiveis = linhas.slice(0, MAXIMO_DE_LINHAS);
  const resto = linhas.slice(MAXIMO_DE_LINHAS);
  const linhaEscolhida = linhas.find((linha) => linha.chave === escolhida);
  const rotuloDaDimensao = OPCOES.find((opcao) => opcao.valor === dimensao)?.rotulo ?? '';

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

  // O nome da linha vira link: escolhe o tráfego da jornada embaixo, e
  // clicar de novo volta para todos. A linha do total não filtra nada.
  const nomeDaLinha = (linha: LinhaDeMidia, destaque: boolean) => {
    const cor = linha.chave === '' ? tema.suave : tema.texto;

    if (destaque) return celula(linha.rotulo, cor, true, true);

    return (
      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        <a
          onClick={() => setEscolhida((antes) => (antes === linha.chave ? null : linha.chave))}
          style={{
            cursor: 'pointer',
            color: cor,
            fontWeight: escolhida === linha.chave ? 700 : 400,
            textDecoration: escolhida === linha.chave ? 'underline' : 'none',
          }}
        >
          {linha.rotulo}
        </a>
      </div>
    );
  };

  const fileira = (linha: LinhaDeMidia, destaque: boolean) => (
    <div
      key={linha.chave}
      style={{
        display: 'grid',
        gridTemplateColumns: GRADE,
        gap: '8px',
        padding: '6px 0',
        borderTop: `1px solid ${tema.borda}`,
        fontSize: '12px',
        fontStyle: linha.chave === '' ? 'italic' : 'normal',
        background: !destaque && escolhida === linha.chave ? tema.destaque : 'transparent',
      }}
    >
      {nomeDaLinha(linha, destaque)}
      {celula(formatarInteiro(linha.leads), tema.texto, destaque)}
      {celula(formatarInteiro(linha.qualificados), tema.azul, destaque)}
      {celula(formatarPercentual(linha.qualificados, linha.leads), tema.azul, true)}
      {celula(formatarInteiro(linha.vendas), tema.verde, destaque)}
      {celula(formatarPercentual(linha.vendas, linha.leads), tema.texto, true)}
      {celula(formatarReais(linha.receita), tema.verde, destaque)}
      {celula(
        linha.vendas === 0 ? '—' : formatarReais(linha.receita / linha.vendas),
        tema.texto,
        destaque,
      )}
    </div>
  );

  return (
    <>
      <Titulo
        texto="Ads"
        nota="De onde vieram os leads criados no período e quantos deles já viraram venda. Aqui entram todas as vendas, inclusive direta e recompra: quem trouxe o lead trouxe."
        tema={tema}
      />

      <ComoLer itens={GUIA_ADS} tema={tema} />

      <Cartao
        titulo="Leads e vendas por origem de mídia"
        nota="Leads: criados no período. Qualificados: desses, os que passaram por negociação ou fechamento em alguma data; % qualificou é qualificados sobre leads. Vendas: desses mesmos leads, os que estão em Ganho hoje. Conversão: vendas sobre leads. Texto da UTM vai em minúsculas, para 'Google' e 'google' não contarem separado."
        tema={tema}
      >
        {ads.truncado ? (
          <div style={{ fontSize: '12px', color: tema.laranja, marginBottom: '8px' }}>
            <b>Atenção:</b> o período tem registros demais para ler de uma vez; estes
            números estão por baixo. Escolha um intervalo menor.
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
          {OPCOES.map((opcao) => (
            <button
              key={opcao.valor}
              onClick={() => {
                setDimensao(opcao.valor);
                setEscolhida(null);
              }}
              style={{
                padding: '4px 9px',
                borderRadius: '6px',
                border: `1px solid ${dimensao === opcao.valor ? tema.texto : tema.borda}`,
                background: dimensao === opcao.valor ? tema.destaque : 'transparent',
                color: tema.texto,
                fontWeight: dimensao === opcao.valor ? 700 : 500,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              {opcao.rotulo}
            </button>
          ))}
        </div>

        {linhas.length === 0 ? (
          <div style={{ fontSize: '12px', color: tema.suave }}>Nada no período.</div>
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
                <div key={coluna || 'vazio'} style={{ textAlign: indice === 0 ? 'left' : 'right' }}>
                  {coluna}
                </div>
              ))}
            </div>
            {visiveis.map((linha) => fileira(linha, false))}
            {resto.length === 0 ? null : (
              <div style={{ fontSize: '11px', color: tema.suave, padding: '6px 0' }}>
                  e mais {formatarInteiro(resto.length)} com menos leads, somando{' '}
                {formatarInteiro(somarMidia(resto).leads)} leads,{' '}
                {formatarInteiro(somarMidia(resto).qualificados)} qualificados e{' '}
                {formatarInteiro(somarMidia(resto).vendas)} vendas.
              </div>
            )}
            {fileira(total, true)}
          </>
        )}
      </Cartao>

      <TabelasPercurso
        negocios={
          linhaEscolhida === undefined
            ? ads.negocios
            : ads.negocios.filter((negocio) => chaveNaDimensao(negocio, dimensao) === linhaEscolhida.chave)
        }
        filtro={
          linhaEscolhida === undefined ? null : `${linhaEscolhida.rotulo} (${rotuloDaDimensao})`
        }
        aoLimpar={() => setEscolhida(null)}
        antesDoHistorico={ads.antesDoHistorico}
        tema={tema}
      />
    </>
  );
};
