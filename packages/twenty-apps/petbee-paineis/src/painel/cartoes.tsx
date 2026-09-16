// Moldura dos quadros: cartão, número grande e título de seção.
import { type ReactNode } from 'react';

import { formatarVariacao } from 'src/painel/formato';
import { type Tema } from 'src/painel/tema';

export type ComparacaoDoNumero = {
  // Já formatado, porque quem sabe se é real ou contagem é quem chama.
  antes: string;
  // Fração: 0.12 é doze por cento a mais. `null` quando antes era zero.
  variacao: number | null;
  // 'negativo' para o que é ruim quando sobe, como perdas e sem origem.
  sentido?: 'positivo' | 'negativo';
  // Substitui o texto padrão. Serve para taxa, onde a diferença honesta é em
  // pontos percentuais: 7% para 8% é "+1 p.p.", e chamar isso de "+14%" só
  // confunde.
  texto?: string;
};

export const Cartao = ({
  titulo,
  nota,
  tema,
  children,
}: {
  titulo: string;
  nota?: string;
  tema: Tema;
  children: ReactNode;
}) => (
  <div
    style={{
      padding: '12px 14px',
      borderRadius: '8px',
      border: `1px solid ${tema.borda}`,
      background: tema.fundo,
      minWidth: 0,
    }}
  >
    <div style={{ marginBottom: '10px' }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: tema.texto }}>
        {titulo}
      </div>
      {nota === undefined ? null : (
        <div style={{ fontSize: '11px', color: tema.suave, marginTop: '2px' }}>
          {nota}
        </div>
      )}
    </div>
    {children}
  </div>
);

const corDaVariacao = (
  { variacao, sentido }: ComparacaoDoNumero,
  tema: Tema,
): string => {
  if (variacao === null || variacao === 0) return tema.suave;

  const subiu = variacao > 0;
  const subirEBom = sentido !== 'negativo';

  return subiu === subirEBom ? tema.verde : tema.vermelho;
};

export const Numero = ({
  rotulo,
  valor,
  cor,
  nota,
  comparacao,
  tema,
}: {
  rotulo: string;
  valor: string | null;
  cor: string;
  nota: string;
  comparacao?: ComparacaoDoNumero;
  tema: Tema;
}) => (
  <div
    style={{
      flex: '1 1 150px',
      padding: '12px 14px',
      borderRadius: '8px',
      border: `1px solid ${tema.borda}`,
      background: tema.fundo,
    }}
  >
    <div style={{ fontSize: '12px', color: tema.suave, marginBottom: '4px' }}>
      {rotulo}
    </div>
    <div
      style={{
        fontSize: '26px',
        fontWeight: 700,
        color: cor,
        lineHeight: 1.1,
        whiteSpace: 'nowrap',
      }}
    >
      {valor ?? '—'}
    </div>
    <div style={{ fontSize: '11px', color: tema.suave, marginTop: '4px' }}>
      {nota}
    </div>
    {comparacao === undefined ? null : (
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '6px',
          marginTop: '6px',
          paddingTop: '6px',
          borderTop: `1px solid ${tema.borda}`,
          fontSize: '11px',
        }}
      >
        <span style={{ color: tema.suave }}>antes {comparacao.antes}</span>
        {comparacao.variacao === null ? null : (
          <span style={{ color: corDaVariacao(comparacao, tema), fontWeight: 700 }}>
            {comparacao.texto ?? formatarVariacao(comparacao.variacao)}
          </span>
        )}
      </div>
    )}
  </div>
);

export const Titulo = ({ texto, nota, tema }: { texto: string; nota: string; tema: Tema }) => (
  <div style={{ marginTop: '6px', paddingTop: '14px', borderTop: `1px solid ${tema.borda}` }}>
    <div style={{ fontSize: '15px', fontWeight: 700, color: tema.texto }}>{texto}</div>
    <div style={{ fontSize: '12px', color: tema.suave, marginTop: '2px' }}>{nota}</div>
  </div>
);
