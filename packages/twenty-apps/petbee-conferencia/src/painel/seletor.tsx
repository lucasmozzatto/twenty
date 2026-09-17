// O seletor de período: botões prontos, De/Até, as setas de mês em mês e a
// linha que diz em português o que está sendo mostrado. É o seletor do
// painéis sem o botão de comparar e com as setas, porque a conferência anda
// mês a mês: fecha-se agosto estando em setembro.
import { formatarDia } from 'src/painel/formato';
import {
  contarDias,
  mesVizinho,
  type Periodo,
  type Predefinido,
  PREDEFINIDOS,
  primeiroDiaDoMes,
  rotuloDoMes,
  ultimoDiaDoMes,
} from 'src/painel/periodo';
import { type Tema } from 'src/painel/tema';

const dias = (periodo: Periodo): string => {
  const total = contarDias(periodo);

  return `${total} ${total === 1 ? 'dia' : 'dias'}`;
};

// Se o período é um mês do calendário (inteiro, ou este mês até hoje), o
// cabeçalho diz o nome do mês, que é como o time fala do fechamento.
const nomeDoMes = (periodo: Periodo, hoje: string): string | null => {
  const inteiro = periodo.ate === ultimoDiaDoMes(periodo.de);
  const ateHoje =
    periodo.ate === hoje && periodo.de.slice(0, 7) === hoje.slice(0, 7);

  return periodo.de === primeiroDiaDoMes(periodo.de) && (inteiro || ateHoje)
    ? rotuloDoMes(periodo.de)
    : null;
};

export const Seletor = ({
  predefinido,
  periodo,
  hoje,
  carregando,
  periodoInvalido,
  tema,
  aoEscolherPredefinido,
  aoEditarData,
  aoEscolherPeriodo,
  aoAtualizar,
}: {
  predefinido: Predefinido;
  periodo: Periodo;
  hoje: string;
  carregando: boolean;
  periodoInvalido: boolean;
  tema: Tema;
  aoEscolherPredefinido: (qual: Predefinido) => void;
  aoEditarData: (campo: keyof Periodo, valor: string) => void;
  aoEscolherPeriodo: (periodo: Periodo) => void;
  aoAtualizar: () => void;
}) => {
  const botao = (
    rotulo: string,
    ativo: boolean,
    aoClicar: () => void,
    desabilitado = false,
  ) => (
    <button
      key={rotulo}
      onClick={aoClicar}
      disabled={desabilitado}
      style={{
        padding: '5px 10px',
        borderRadius: '6px',
        border: `1px solid ${ativo ? tema.texto : tema.borda}`,
        background: ativo ? tema.destaque : 'transparent',
        color: tema.texto,
        fontWeight: ativo ? 700 : 500,
        fontSize: '12px',
        cursor: desabilitado ? 'default' : 'pointer',
        opacity: desabilitado ? 0.4 : 1,
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

  const anterior = mesVizinho(periodo, -1, hoje);
  const seguinte = mesVizinho(periodo, 1, hoje);
  const mes = nomeDoMes(periodo, hoje);

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
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
          {botao(
            '◀ mês',
            false,
            () => {
              if (anterior !== null) aoEscolherPeriodo(anterior);
            },
            anterior === null,
          )}
          {botao(
            'mês ▶',
            false,
            () => {
              if (seguinte !== null) aoEscolherPeriodo(seguinte);
            },
            seguinte === null,
          )}
        </span>
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
            {mes === null ? null : (
              <>
                <b style={{ color: tema.texto }}>{mes}</b> ·{' '}
              </>
            )}
            {formatarDia(periodo.de)} a {formatarDia(periodo.ate)} ·{' '}
            {dias(periodo)} · horário de Brasília
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
