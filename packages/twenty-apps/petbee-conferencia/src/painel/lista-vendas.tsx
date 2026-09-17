// O lado do CRM: uma linha por negócio ganho no período, com o que o banco
// diz de cada um. Abre em "com pendência", que é o que precisa de alguém.
import { type ReactNode, useState } from 'react';

import { Cartao } from 'src/painel/cartoes';
import { type Venda, type VereditoVenda } from 'src/painel/dados';
import { formatarDia, formatarDiferenca, formatarReais } from 'src/painel/formato';
import {
  Cabecalho,
  Etiqueta,
  type Ficha,
  Fichas,
  Ligacao,
  MostrarMais,
  PASSO,
} from 'src/painel/pecas';
import {
  corDoVereditoVenda,
  ROTULO_VEREDITO_VENDA,
  rotuloOrigem,
  rotuloTipoFechamento,
} from 'src/painel/rotulos';
import { type Tema } from 'src/painel/tema';

type Filtro = 'pendentes' | 'duplicadas' | 'todas' | VereditoVenda;

const PENDENTES: VereditoVenda[] = ['VALOR_DIVERGENTE', 'SEM_ASSINATURA', 'AGUARDANDO'];

// Duplicada é pendência mesmo quando "Conferida": o mesmo negócio cadastrado
// duas vezes casa com as mesmas assinaturas e conta duas vezes na receita.
const passaNoFiltro = (venda: Venda, filtro: Filtro): boolean => {
  if (filtro === 'todas') return true;
  if (filtro === 'duplicadas') return venda.duplicada;
  if (filtro === 'pendentes') return venda.duplicada || PENDENTES.includes(venda.veredito);

  return venda.veredito === filtro;
};

const COLUNAS = [
  'Cliente',
  'Vendedor',
  'Fechou em',
  'Valor CRM',
  'No banco',
  'Diferença',
  'Conferência',
  'Origem',
];

const GRADE =
  'minmax(150px, 1.8fr) minmax(90px, 1fr) 80px 92px 92px 92px minmax(130px, 1.2fr) minmax(110px, 1fr)';

export const ListaVendas = ({
  vendas,
  nomes,
  tema,
}: {
  vendas: Venda[];
  nomes: Record<string, string>;
  tema: Tema;
}) => {
  const [filtro, setFiltro] = useState<Filtro>('pendentes');
  const [limite, setLimite] = useState(PASSO);

  const filtradas = vendas.filter((venda) => passaNoFiltro(venda, filtro));
  const visiveis = filtradas.slice(0, limite);
  const contar = (qual: Filtro) =>
    vendas.filter((venda) => passaNoFiltro(venda, qual)).length;

  const duplicadas = contar('duplicadas');

  // A ficha de duplicados só aparece quando existe alguma: no mês limpo ela
  // seria só ruído.
  const fichas: Ficha<Filtro>[] = [
    { valor: 'pendentes', rotulo: 'Com pendência', quantidade: contar('pendentes') },
    { valor: 'VALOR_DIVERGENTE', rotulo: 'Valor divergente', quantidade: contar('VALOR_DIVERGENTE') },
    { valor: 'SEM_ASSINATURA', rotulo: 'Sem assinatura', quantidade: contar('SEM_ASSINATURA') },
    { valor: 'AGUARDANDO', rotulo: 'Aguardando', quantidade: contar('AGUARDANDO') },
    ...(duplicadas > 0
      ? [{ valor: 'duplicadas' as const, rotulo: 'Duplicados', quantidade: duplicadas }]
      : []),
    { valor: 'CONFERIDA', rotulo: 'Conferidas', quantidade: contar('CONFERIDA') },
    { valor: 'todas', rotulo: 'Todas', quantidade: vendas.length },
  ];

  const escolher = (qual: Filtro) => {
    setFiltro(qual);
    setLimite(PASSO);
  };

  const celula = (conteudo: ReactNode, direita = false, cor?: string) => (
    <div
      style={{
        textAlign: direita ? 'right' : 'left',
        color: cor ?? tema.texto,
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        minWidth: 0,
      }}
    >
      {conteudo}
    </div>
  );

  const diferenca = (venda: Venda): string =>
    venda.valorCrm === null || venda.valorBanco === null
      ? '—'
      : formatarDiferenca(venda.valorCrm - venda.valorBanco);

  const vendedor = (venda: Venda) =>
    venda.vendedorId === null
      ? 'Sem dono'
      : (nomes[venda.vendedorId] ?? 'Membro removido');

  const origem = (venda: Venda) =>
    venda.tipoFechamento === null
      ? rotuloOrigem(venda.origem)
      : `${rotuloOrigem(venda.origem)} · ${rotuloTipoFechamento(venda.tipoFechamento)}`;

  const cliente = (venda: Venda) => (
    <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', maxWidth: '100%' }}>
      <Ligacao objeto="opportunity" id={venda.id} texto={venda.cliente} tema={tema} />
      {venda.duplicada ? <Etiqueta texto="duplicado" cor={tema.laranja} /> : null}
    </span>
  );

  return (
    <Cartao
      titulo="Vendas × banco"
      nota="Uma linha por negócio ganho no período. Valor CRM é o Amount do negócio; No banco é a soma das assinaturas do cliente que a conciliação encontrou; Conferência é o veredito dela. A etiqueta 'duplicado' marca cliente com mais de um negócio ganho no período. Clique no cliente para abrir o negócio."
      tema={tema}
    >
      <Fichas fichas={fichas} ativa={filtro} tema={tema} aoEscolher={escolher} />
      {filtradas.length === 0 ? (
        <div style={{ fontSize: '12px', color: tema.suave }}>
          {filtro === 'pendentes'
            ? 'Nenhuma venda pendente no período.'
            : 'Nada aqui.'}
        </div>
      ) : (
        <>
          <Cabecalho colunas={COLUNAS} grade={GRADE} tema={tema} />
          {visiveis.map((venda) => (
            <div
              key={venda.id}
              style={{
                display: 'grid',
                gridTemplateColumns: GRADE,
                gap: '8px',
                padding: '5px 0',
                borderTop: `1px solid ${tema.borda}`,
                fontSize: '12px',
                alignItems: 'center',
              }}
            >
              {celula(cliente(venda))}
              {celula(vendedor(venda), false, venda.vendedorId === null ? tema.suave : tema.texto)}
              {celula(formatarDia(venda.fechamento))}
              {celula(venda.valorCrm === null ? '—' : formatarReais(venda.valorCrm), true)}
              {celula(venda.valorBanco === null ? '—' : formatarReais(venda.valorBanco), true)}
              {celula(
                diferenca(venda),
                true,
                venda.veredito === 'VALOR_DIVERGENTE' ? tema.vermelho : tema.suave,
              )}
              {celula(
                <Etiqueta
                  texto={ROTULO_VEREDITO_VENDA[venda.veredito]}
                  cor={corDoVereditoVenda(venda.veredito, tema)}
                />,
              )}
              {celula(origem(venda), false, tema.suave)}
            </div>
          ))}
          <MostrarMais
            restantes={filtradas.length - visiveis.length}
            tema={tema}
            aoClicar={() => setLimite((atual) => atual + PASSO)}
          />
        </>
      )}
    </Cartao>
  );
};
