// O bloco "Como ler": um guia curto, fechado por padrão, para quem abre a
// visão pela primeira vez. Fica fechado para não ocupar a tela de quem já
// sabe; o título convida quem não sabe.
import { useState } from 'react';

import { type Tema } from 'src/painel/tema';

export const ComoLer = ({
  titulo = 'Primeira vez aqui? Como ler esta visão',
  itens,
  tema,
  abertoPorPadrao = false,
}: {
  titulo?: string;
  itens: string[];
  tema: Tema;
  abertoPorPadrao?: boolean;
}) => {
  const [aberto, setAberto] = useState(abertoPorPadrao);

  return (
    <div
      style={{
        border: `1px dashed ${tema.borda}`,
        borderRadius: '6px',
        padding: '8px 10px',
        fontSize: '12px',
      }}
    >
      <a
        onClick={() => setAberto((estava) => !estava)}
        style={{ cursor: 'pointer', color: tema.texto, fontWeight: 600 }}
      >
        {aberto ? '▾' : '▸'} {titulo}
      </a>
      {aberto ? (
        <div
          style={{
            marginTop: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            color: tema.suave,
            lineHeight: 1.4,
          }}
        >
          {itens.map((item) => (
            <div key={item} style={{ display: 'flex', gap: '6px' }}>
              <span>•</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};
