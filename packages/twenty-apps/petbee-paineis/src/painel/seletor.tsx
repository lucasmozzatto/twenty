// O seletor de período: os botões prontos, os campos De/Até, o botão de
// comparar e a linha que diz em português o que está sendo mostrado.
import { formatarDia } from 'src/painel/formato';
import {
  contarDias,
  type Periodo,
  type Predefinido,
  PREDEFINIDOS,
} from 'src/painel/periodo';
import { type Tema } from 'src/painel/tema';

const dias = (periodo: Periodo): string => {
  const total = contarDias(periodo);

  return `${total} ${total === 1 ? 'dia' : 'dias'}`;
};

export const Seletor = ({
  predefinido,
  periodo,
  anterior,
  hoje,
  comparar,
  carregando,
  periodoInvalido,
  tema,
  aoEscolherPredefinido,
  aoEditarData,
  aoAlternarComparar,
  aoAtualizar,
}: {
  predefinido: Predefinido;
  periodo: Periodo;
  anterior: Periodo;
  hoje: string;
  comparar: boolean;
  carregando: boolean;
  periodoInvalido: boolean;
  tema: Tema;
  aoEscolherPredefinido: (qual: Predefinido) => void;
  aoEditarData: (campo: keyof Periodo, valor: string) => void;
  aoAlternarComparar: () => void;
  aoAtualizar: () => void;
}) => {
  const botao = (
    rotulo: string,
    ativo: boolean,
    aoClicar: () => void,
    alinharAoFim = false,
  ) => (
    <button
      key={rotulo}
      onClick={aoClicar}
      style={{
        ...(alinharAoFim ? { marginLeft: 'auto' } : {}),
        padding: '5px 10px',
        borderRadius: '6px',
        border: `1px solid ${ativo ? tema.texto : tema.borda}`,
        background: ativo ? tema.destaque : 'transparent',
        color: tema.texto,
        fontWeight: ativo ? 700 : 500,
        fontSize: '12px',
        cursor: 'pointer',
      }}
    >
      {rotulo}
    </button>
  );

  const campoData = (campo: keyof Periodo, rotulo: string) => (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '12px',
        color: tema.suave,
      }}
    >
      {rotulo}
      <input
        type="date"
        value={periodo[campo]}
        max={hoje}
        onChange={(evento) => aoEditarData(campo, evento.target.value)}
        style={{
          padding: '4px 6px',
          borderRadius: '6px',
          border: `1px solid ${tema.borda}`,
          background: tema.fundo,
          color: tema.texto,
          fontSize: '12px',
        }}
      />
    </label>
  );

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flexWrap: 'wrap',
        }}
      >
        {PREDEFINIDOS.map((item) =>
          botao(item.rotulo, predefinido === item.valor, () =>
            aoEscolherPredefinido(item.valor),
          ),
        )}
        <span style={{ width: '8px' }} />
        {campoData('de', 'De')}
        {campoData('ate', 'Até')}
        {botao(
          `${comparar ? '✓ ' : ''}Comparar com o período anterior`,
          comparar,
          aoAlternarComparar,
          true,
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          color: tema.suave,
        }}
      >
        {periodoInvalido ? (
          <span style={{ color: tema.vermelho }}>
            A data inicial está depois da final.
          </span>
        ) : (
          <span>
            {formatarDia(periodo.de)} a {formatarDia(periodo.ate)} ·{' '}
            {dias(periodo)} · horário de Brasília
            {comparar ? (
              <>
                {' '}
                · comparando com{' '}
                <b style={{ color: tema.texto }}>
                  {formatarDia(anterior.de)} a {formatarDia(anterior.ate)}
                </b>{' '}
                ({dias(anterior)})
              </>
            ) : null}
          </span>
        )}
        <a
          onClick={aoAtualizar}
          style={{ marginLeft: 'auto', cursor: 'pointer', color: tema.suave }}
        >
          {carregando ? 'carregando…' : '↻ atualizar'}
        </a>
      </div>
    </>
  );
};
