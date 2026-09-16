// Linha do tempo por dia.
import { type Grupo } from 'src/painel/crm';
import { formatarInteiro } from 'src/painel/formato';
import { Cartao } from 'src/painel/cartoes';
import { listarDias, type Periodo } from 'src/painel/periodo';
import { type Tema } from 'src/painel/tema';

// O gráfico precisa esticar na largura e manter a altura. Um SVG que estica
// deforma texto e bolinhas, então o SVG desenha só o traço (em percentual,
// com espessura fixa) e pontos e rótulos são HTML posicionado por cima.
export const Linha = ({
  titulo,
  grupos,
  periodo,
  cor,
  tema,
}: {
  titulo: string;
  grupos: Grupo[];
  periodo: Periodo;
  cor: string;
  tema: Tema;
}) => {
  const dias = listarDias(periodo);
  const porDia = new Map(grupos.map((grupo) => [grupo.chaves[0], grupo.contagem]));
  const valores = dias.map((dia) => porDia.get(dia) ?? 0);
  const total = valores.reduce((soma, valor) => soma + valor, 0);
  const maximo = Math.max(...valores, 1);

  const xPorcento = (indice: number) => ((indice + 0.5) * 100) / dias.length;
  // Sobra em cima para o número e embaixo para o ponto não encostar na linha.
  const yPorcento = (valor: number) => 12 + (1 - valor / maximo) * 82;

  const caminho = valores
    .map(
      (valor, indice) =>
        `${indice === 0 ? 'M' : 'L'}${xPorcento(indice).toFixed(2)},${yPorcento(valor).toFixed(2)}`,
    )
    .join(' ');

  // Com muitos dias os rótulos se atropelam: mostra um a cada N.
  const passoRotulo = Math.max(1, Math.ceil(dias.length / 31));
  const mostrarValores = dias.length <= 31;

  return (
    <Cartao titulo={`${titulo} · ${formatarInteiro(total)} no período`} tema={tema}>
      <div
        style={{
          position: 'relative',
          height: '150px',
          borderBottom: `1px solid ${tema.borda}`,
        }}
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            display: 'block',
            overflow: 'visible',
          }}
        >
          <path
            d={caminho}
            fill="none"
            stroke={cor}
            strokeWidth="2"
            strokeLinejoin="round"
            style={{ vectorEffect: 'non-scaling-stroke' }}
          />
        </svg>
        {valores.map((valor, indice) => (
          <div key={dias[indice]}>
            <div
              style={{
                position: 'absolute',
                left: `${xPorcento(indice)}%`,
                top: `${yPorcento(valor)}%`,
                width: '7px',
                height: '7px',
                marginLeft: '-3.5px',
                marginTop: '-3.5px',
                borderRadius: '50%',
                background: cor,
              }}
            />
            {mostrarValores && valor > 0 ? (
              <div
                style={{
                  position: 'absolute',
                  left: `${xPorcento(indice)}%`,
                  top: `calc(${yPorcento(valor)}% - 20px)`,
                  transform: 'translateX(-50%)',
                  fontSize: '11px',
                  color: tema.texto,
                  whiteSpace: 'nowrap',
                }}
              >
                {valor}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', marginTop: '4px' }}>
        {dias.map((dia, indice) => (
          <div
            key={dia}
            style={{
              flex: '1 1 0',
              textAlign: 'center',
              fontSize: '10px',
              color: tema.suave,
            }}
          >
            {indice % passoRotulo === 0 ? dia.slice(8, 10) : ''}
          </div>
        ))}
      </div>
    </Cartao>
  );
};
