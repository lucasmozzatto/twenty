// A visão Ads: uma tabela só, com um seletor de dimensão em cima. Trocar de
// dimensão refaz a tabela inteira, em vez de encher a tela de quadros.
import { useState } from 'react';

import {
  agruparPorDimensao,
  type Ads,
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
  'minmax(160px, 2fr) repeat(2, minmax(60px, 0.8fr)) minmax(72px, 0.9fr) minmax(96px, 1.1fr) minmax(96px, 1.1fr)';
const COLUNAS = ['', 'Leads', 'Vendas', 'Conversão', 'Receita', 'Ticket médio'];

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

  const linhas = agruparPorDimensao(ads.negocios, dimensao, rotularEnum);
  const total = somarMidia(linhas);
  const visiveis = linhas.slice(0, MAXIMO_DE_LINHAS);
  const resto = linhas.slice(MAXIMO_DE_LINHAS);

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
      }}
    >
      {celula(linha.rotulo, linha.chave === '' ? tema.suave : tema.texto, destaque, true)}
      {celula(formatarInteiro(linha.leads), tema.texto, destaque)}
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
        nota="Leads: criados no período. Vendas: desses mesmos leads, os que estão em Ganho hoje. Conversão: vendas sobre leads. Texto da UTM vai em minúsculas, para 'Google' e 'google' não contarem separado."
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
              onClick={() => setDimensao(opcao.valor)}
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
                {formatarInteiro(somarMidia(resto).leads)} leads e{' '}
                {formatarInteiro(somarMidia(resto).vendas)} vendas.
              </div>
            )}
            {fileira(total, true)}
          </>
        )}
      </Cartao>
    </>
  );
};
