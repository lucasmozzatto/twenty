// Os avisos do topo e as abas das visões. Saíram do componente principal só
// para ele caber no limite de linhas; não têm lógica própria.
import { type Falha } from 'src/painel/dados';
import { type Tema } from 'src/painel/tema';

export const AvisoDeErro = ({
  erro,
  aoTentarDeNovo,
  tema,
}: {
  erro: string;
  aoTentarDeNovo: () => void;
  tema: Tema;
}) => (
  <div style={{ color: tema.vermelho, fontSize: '12px' }}>
    Não consegui ler o CRM ({erro}).{' '}
    <a onClick={aoTentarDeNovo} style={{ cursor: 'pointer', textDecoration: 'underline' }}>
      Tentar de novo
    </a>
  </div>
);

// Um quadro que falhou aparece zerado, então o aviso é obrigatório: sem ele
// um zero por erro pareceria um zero de verdade.
export const AvisoDeFalhas = ({ falhas, tema }: { falhas: Falha[]; tema: Tema }) =>
  falhas.length === 0 ? null : (
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
  );

export const Abas = <TValor extends string>({
  opcoes,
  ativa,
  aoEscolher,
  tema,
}: {
  opcoes: { valor: TValor; rotulo: string }[];
  ativa: TValor;
  aoEscolher: (valor: TValor) => void;
  tema: Tema;
}) => (
  <div style={{ display: 'flex', gap: '2px', borderBottom: `1px solid ${tema.borda}` }}>
    {opcoes.map((item) => (
      <button
        key={item.valor}
        onClick={() => aoEscolher(item.valor)}
        style={{
          padding: '8px 14px',
          border: 'none',
          borderBottom: `2px solid ${ativa === item.valor ? tema.texto : 'transparent'}`,
          marginBottom: '-1px',
          background: 'transparent',
          color: ativa === item.valor ? tema.texto : tema.suave,
          fontWeight: ativa === item.valor ? 700 : 500,
          fontSize: '13px',
          cursor: 'pointer',
        }}
      >
        {item.rotulo}
      </button>
    ))}
  </div>
);
