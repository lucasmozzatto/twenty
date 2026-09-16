// Moldura dos quadros: cartão, número grande e título de seção.
import { type ReactNode } from 'react';

import { type Tema } from 'src/painel/tema';

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

export const Numero = ({
  rotulo,
  valor,
  cor,
  nota,
  tema,
}: {
  rotulo: string;
  valor: string | null;
  cor: string;
  nota: string;
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
  </div>
);

export const Titulo = ({ texto, nota, tema }: { texto: string; nota: string; tema: Tema }) => (
  <div style={{ marginTop: '6px', paddingTop: '14px', borderTop: `1px solid ${tema.borda}` }}>
    <div style={{ fontSize: '15px', fontWeight: 700, color: tema.texto }}>{texto}</div>
    <div style={{ fontSize: '12px', color: tema.suave, marginTop: '2px' }}>{nota}</div>
  </div>
);
