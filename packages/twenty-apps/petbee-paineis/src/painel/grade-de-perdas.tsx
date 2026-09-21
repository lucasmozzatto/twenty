// As linhas das tabelas de perdas: um cabeçalho com as etapas e uma fileira
// com os números, que viram link quando têm conteúdo. Fica em arquivo próprio
// porque as duas tabelas desenham exatamente igual.
import {
  ETAPAS_ANTES_DO_VENDEDOR,
  ETAPAS_DE_SAIDA,
  type EtapaDeSaida,
  type LinhaDePerdas,
} from 'src/painel/perdas';
import { formatarInteiro } from 'src/painel/formato';
import { rotuloEtapa } from 'src/painel/rotulos';
import { type Tema } from 'src/painel/tema';

export const GRADE = 'minmax(130px, 1.6fr) repeat(6, minmax(58px, 1fr)) minmax(64px, 0.9fr)';

export const rotuloDaEtapa = (etapa: EtapaDeSaida) =>
  etapa === 'SEM_REGISTRO' ? 'Sem registro' : rotuloEtapa(etapa);

export const Cabecalho = ({ tema }: { tema: Tema }) => (
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
    <div />
    {ETAPAS_DE_SAIDA.map((etapa) => (
      <div
        key={etapa}
        style={{
          textAlign: 'right',
          fontStyle: ETAPAS_ANTES_DO_VENDEDOR.includes(etapa) ? 'italic' : 'normal',
        }}
      >
        {rotuloDaEtapa(etapa)}
      </div>
    ))}
    <div style={{ textAlign: 'right' }}>Total</div>
  </div>
);

export const Fileira = ({
  rotulo,
  linha,
  destaque,
  aoEscolher,
  tema,
}: {
  rotulo: string;
  linha: LinhaDePerdas;
  destaque: boolean;
  aoEscolher?: (etapa: EtapaDeSaida) => void;
  tema: Tema;
}) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: GRADE,
      gap: '8px',
      padding: '6px 0',
      borderTop: `1px solid ${tema.borda}`,
      fontSize: '12px',
    }}
  >
    <div
      style={{
        color: tema.texto,
        fontWeight: destaque ? 700 : 400,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {rotulo}
    </div>
    {ETAPAS_DE_SAIDA.map((etapa) => {
      const valor = linha.porEtapa[etapa];

      const cor =
        valor === 0
          ? tema.borda
          : etapa === 'SEM_REGISTRO' || ETAPAS_ANTES_DO_VENDEDOR.includes(etapa)
            ? tema.suave
            : tema.vermelho;
      // Número com conteúdo vira link: abre a lista dos negócios daquela
      // célula, para conferir motivo por motivo na conversa.
      const clicavel = valor > 0 && aoEscolher !== undefined;

      return (
        <div
          key={etapa}
          style={{
            textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
            fontWeight: destaque ? 700 : 400,
            color: cor,
          }}
        >
          {clicavel ? (
            <a
              onClick={() => aoEscolher(etapa)}
              style={{ cursor: 'pointer', color: cor, textDecoration: 'underline' }}
            >
              {formatarInteiro(valor)}
            </a>
          ) : (
            formatarInteiro(valor)
          )}
        </div>
      );
    })}
    <div
      style={{
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
        fontWeight: 700,
        color: tema.texto,
      }}
    >
      {formatarInteiro(linha.total)}
    </div>
  </div>
);

