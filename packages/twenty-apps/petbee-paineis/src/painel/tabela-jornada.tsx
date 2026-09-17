// A tabela "de cada etapa, para onde foi": uma linha por etapa de partida,
// uma coluna por destino, e o botão que troca a lente entre "próximo passo"
// e "situação hoje". Os dois lados da conta são os mesmos negócios.
import { useState } from 'react';

import { Cartao } from 'src/painel/cartoes';
import { formatarInteiro, formatarPercentual } from 'src/painel/formato';
import {
  type Destino,
  DESTINOS,
  type Jornada,
  type LinhaJornada,
} from 'src/painel/jornada';
import { rotuloEtapa } from 'src/painel/rotulos';
import { type Tema } from 'src/painel/tema';

type Lente = 'proximo-passo' | 'situacao-hoje';

const LENTES: { valor: Lente; rotulo: string }[] = [
  { valor: 'proximo-passo', rotulo: 'Próximo passo' },
  { valor: 'situacao-hoje', rotulo: 'Situação hoje' },
];

const GRADE = `minmax(110px, 1.3fr) repeat(${DESTINOS.length}, minmax(58px, 1fr)) minmax(64px, 1fr)`;

// Na lente "próximo passo" o destino é para onde FOI, com seta. Na lente
// "situação hoje" é onde ESTÁ, e a seta enganava: "→ Perdido" parecia "foi
// perdido nesta etapa", quando é "está perdido hoje, perdido onde for".
const ONDE_ESTA: Record<Destino, string> = {
  NOVO_LEAD: 'em Novo Lead',
  EM_QUALIFICACAO: 'em qualificação',
  EM_NEGOCIACAO: 'em negociação',
  FECHAMENTO: 'em Fechamento',
  BREAK: 'no Break',
  WON: 'Ganho',
  LOST: 'Perdido',
  AINDA_AQUI: 'Ainda aqui',
};

const rotuloDestino = (destino: Destino, lente: Lente): string => {
  if (lente === 'situacao-hoje') return ONDE_ESTA[destino];

  return destino === 'AINDA_AQUI' ? 'Ainda aqui' : `→ ${rotuloEtapa(destino)}`;
};

const LEITURA: Record<Lente, string> = {
  'proximo-passo':
    'Leia cada célula como "entrou nesta etapa e a primeira porta que pegou foi esta". Conta entradas: quem voltou para negociação depois de um Break conta duas vezes na linha Em negociação.',
  'situacao-hoje':
    'Leia cada célula como "entrou nesta etapa no período e hoje está aqui". É uma foto de agora, não importa o caminho: um lead perdido depois de passar por negociação aparece como Perdido também na linha Em qualificação.',
};

export const TabelaJornada = ({
  jornada,
  tema,
}: {
  jornada: Jornada;
  tema: Tema;
}) => {
  const [lente, setLente] = useState<Lente>('proximo-passo');

  const linhas = lente === 'proximo-passo' ? jornada.proximoPasso : jornada.situacaoHoje;

  const corDoDestino = (destino: Destino): string => {
    if (destino === 'WON') return tema.verde;
    if (destino === 'LOST') return tema.vermelho;
    if (destino === 'AINDA_AQUI') return tema.azul;

    return tema.texto;
  };

  const celula = (linha: LinhaJornada, destino: Destino) => {
    const valor = linha.destinos[destino];

    if (valor === 0) {
      return (
        <div key={destino} style={{ textAlign: 'right', color: tema.suave }}>
          —
        </div>
      );
    }

    return (
      <div
        key={destino}
        style={{
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}
      >
        <div style={{ color: corDoDestino(destino), fontWeight: 700 }}>
          {formatarInteiro(valor)}
        </div>
        <div style={{ fontSize: '10px', color: tema.suave }}>
          {formatarPercentual(valor, linha.entraram)}
        </div>
      </div>
    );
  };

  const botao = (item: { valor: Lente; rotulo: string }) => (
    <button
      key={item.valor}
      onClick={() => setLente(item.valor)}
      style={{
        padding: '4px 9px',
        borderRadius: '6px',
        border: `1px solid ${lente === item.valor ? tema.texto : tema.borda}`,
        background: lente === item.valor ? tema.destaque : 'transparent',
        color: tema.texto,
        fontWeight: lente === item.valor ? 700 : 500,
        fontSize: '11px',
        cursor: 'pointer',
      }}
    >
      {item.rotulo}
    </button>
  );

  return (
    <Cartao
      titulo="De cada etapa, para onde foi"
      nota='Cada linha soma 100%: são os negócios que entraram naquela etapa dentro do período. "Entrar em Novo Lead" é ser criado. Próximo passo mostra a primeira porta que o lead pegou; Situação hoje mostra a sala onde ele está agora. As duas lentes não se subtraem.'
      tema={tema}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flexWrap: 'wrap',
          marginBottom: '10px',
        }}
      >
        <span style={{ fontSize: '11px', color: tema.suave }}>Mostrar</span>
        {LENTES.map(botao)}
      </div>

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
        <div>Entrou em</div>
        {DESTINOS.map((destino) => (
          <div key={destino} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
            {rotuloDestino(destino, lente)}
          </div>
        ))}
        <div style={{ textAlign: 'right' }}>Entraram</div>
      </div>

      {linhas.map((linha) => (
        <div
          key={linha.etapa}
          style={{
            display: 'grid',
            gridTemplateColumns: GRADE,
            gap: '8px',
            padding: '6px 0',
            borderTop: `1px solid ${tema.borda}`,
            fontSize: '12px',
            alignItems: 'center',
          }}
        >
          <div style={{ color: tema.texto, fontWeight: 600 }}>{rotuloEtapa(linha.etapa)}</div>
          {DESTINOS.map((destino) => celula(linha, destino))}
          <div
            style={{
              textAlign: 'right',
              color: tema.texto,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatarInteiro(linha.entraram)}
          </div>
        </div>
      ))}

      <div style={{ fontSize: '11px', color: tema.suave, marginTop: '8px' }}>
        {LEITURA[lente]}
      </div>

      {jornada.criadosEmOutraEtapa.length > 0 ? (
        <div style={{ fontSize: '11px', color: tema.suave, marginTop: '8px' }}>
          Criados já em outra etapa, sem passar por Novo Lead:{' '}
          {jornada.criadosEmOutraEtapa
            .map((item) => `${rotuloEtapa(item.etapa)} ${formatarInteiro(item.quantos)}`)
            .join(', ')}
          . Eles contam na linha da etapa em que nasceram.
        </div>
      ) : null}
    </Cartao>
  );
};
