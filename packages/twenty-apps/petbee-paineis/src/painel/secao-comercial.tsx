// A parte de cima do quadro: os seis números, as duas linhas do tempo e as
// barras por origem e canal. Tudo obedece ao período escolhido.
import { type Barra, Barras } from 'src/painel/barras';
import { type ComparacaoDoNumero, Numero } from 'src/painel/cartoes';
import { type Grupo } from 'src/painel/crm';
import { type Comparacao } from 'src/painel/comparacao';
import { type Dados } from 'src/painel/dados';
import {
  formatarInteiro,
  formatarPercentual,
  formatarPontos,
  formatarReais,
  taxa,
  variacao,
} from 'src/painel/formato';
import { GRADE_DE_CARTOES } from 'src/painel/grade';
import { Linha } from 'src/painel/linha';
import { type Periodo } from 'src/painel/periodo';
import { rotuloCanal, rotuloOrigem } from 'src/painel/rotulos';
import { type Tema } from 'src/painel/tema';

const contagens = (grupos: Grupo[]): Barra[] =>
  grupos.map((grupo) => ({ chave: grupo.chaves[0], valor: grupo.contagem }));

const somas = (grupos: Grupo[]): Barra[] =>
  grupos.map((grupo) => ({ chave: grupo.chaves[0], valor: grupo.somaReais }));

export const NumerosComerciais = ({
  dados,
  comparacao,
  tema,
}: {
  dados: Dados | null;
  comparacao: Comparacao | null;
  tema: Tema;
}) => {
  const n = dados?.numeros ?? null;
  const antes = comparacao?.numeros ?? null;

  // Monta o rodapé de comparação de um número, ou nada quando a comparação
  // está desligada. `formatar` é o mesmo do valor de cima, para os dois
  // ficarem na mesma unidade.
  const contra = (
    agora: number,
    anterior: number | undefined,
    formatar: (valor: number) => string,
    sentido?: 'positivo' | 'negativo',
  ): ComparacaoDoNumero | undefined =>
    anterior === undefined
      ? undefined
      : {
          antes: formatar(anterior),
          variacao: variacao(agora, anterior),
          sentido,
        };

  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
      <Numero
        rotulo="Negócios criados"
        valor={n ? formatarInteiro(n.criados) : null}
        cor={tema.rosa}
        nota="funil Vendas, pela data de criação"
        comparacao={n ? contra(n.criados, antes?.criados, formatarInteiro) : undefined}
        tema={tema}
      />
      <Numero
        rotulo="Vendas"
        valor={n ? formatarInteiro(n.vendas) : null}
        cor={tema.verde}
        nota="etapa Ganho, pela data de fechamento"
        comparacao={n ? contra(n.vendas, antes?.vendas, formatarInteiro) : undefined}
        tema={tema}
      />
      <Numero
        rotulo="Receita"
        valor={n ? formatarReais(n.receita) : null}
        cor={tema.verde}
        nota="soma do valor das vendas"
        comparacao={n ? contra(n.receita, antes?.receita, formatarReais) : undefined}
        tema={tema}
      />
      <Numero
        rotulo="Ticket médio"
        valor={n ? (n.ticketMedio === null ? '—' : formatarReais(n.ticketMedio)) : null}
        cor={tema.verde}
        nota="média do valor por venda"
        comparacao={
          n && n.ticketMedio !== null && antes?.ticketMedio != null
            ? contra(n.ticketMedio, antes.ticketMedio, formatarReais)
            : undefined
        }
        tema={tema}
      />
      <Numero
        rotulo="Conversão"
        valor={n ? formatarPercentual(n.ganhosDaSafra, n.criados) : null}
        cor={tema.texto}
        nota={
          n
            ? `${formatarInteiro(n.ganhosDaSafra)} ganhos entre os ${formatarInteiro(n.criados)} criados`
            : 'ganhos entre os criados no período'
        }
        comparacao={
          n && antes
            ? {
                antes: formatarPercentual(antes.ganhosDaSafra, antes.criados),
                variacao:
                  taxa(n.ganhosDaSafra, n.criados) -
                  taxa(antes.ganhosDaSafra, antes.criados),
                texto: formatarPontos(
                  taxa(n.ganhosDaSafra, n.criados) -
                    taxa(antes.ganhosDaSafra, antes.criados),
                ),
              }
            : undefined
        }
        tema={tema}
      />
      <Numero
        rotulo="Sem origem"
        valor={n ? formatarInteiro(n.semOrigem) : null}
        cor={tema.texto}
        nota="criados no período sem origem preenchida"
        comparacao={
          n ? contra(n.semOrigem, antes?.semOrigem, formatarInteiro, 'negativo') : undefined
        }
        tema={tema}
      />
    </div>
  );
};

export const GraficosComerciais = ({
  dados,
  comparacao,
  periodo,
  tema,
}: {
  dados: Dados;
  comparacao: Comparacao | null;
  periodo: Periodo;
  tema: Tema;
}) => (
  <>
    <Linha
      titulo="Negócios criados por dia"
      grupos={dados.criadosPorDia}
      periodo={periodo}
      cor={tema.rosa}
      anterior={
        comparacao
          ? { grupos: comparacao.criadosPorDia, periodo: comparacao.periodo }
          : undefined
      }
      tema={tema}
    />
    <Linha
      titulo="Vendas por dia"
      grupos={dados.vendasPorDia}
      periodo={periodo}
      cor={tema.verde}
      anterior={
        comparacao
          ? { grupos: comparacao.vendasPorDia, periodo: comparacao.periodo }
          : undefined
      }
      tema={tema}
    />

    <div style={GRADE_DE_CARTOES}>
      <Barras
        titulo="Negócios por origem"
        barras={contagens(dados.negociosPorOrigem)}
        rotulo={rotuloOrigem}
        cor={tema.rosa}
        tema={tema}
      />
      <Barras
        titulo="Vendas por origem"
        barras={contagens(dados.vendasPorOrigem)}
        rotulo={rotuloOrigem}
        cor={tema.verde}
        tema={tema}
      />
      <Barras
        titulo="Negócios por canal"
        barras={contagens(dados.negociosPorCanal)}
        rotulo={rotuloCanal}
        cor={tema.rosa}
        tema={tema}
      />
      <Barras
        titulo="Vendas por canal"
        barras={contagens(dados.vendasPorCanal)}
        rotulo={rotuloCanal}
        cor={tema.verde}
        tema={tema}
      />
      <Barras
        titulo="Receita por origem"
        barras={somas(dados.vendasPorOrigem)}
        rotulo={rotuloOrigem}
        cor={tema.verde}
        formatar={formatarReais}
        tema={tema}
      />
    </div>
  </>
);
