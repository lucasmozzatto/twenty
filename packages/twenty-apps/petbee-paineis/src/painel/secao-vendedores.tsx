// A parte de baixo do quadro: tudo que a aba Vendedores mostra.
//
// Atenção à mistura de tempos, que está escrita na tela de propósito: os
// gráficos de PIPELINE são foto de agora e não mudam com o período, porque
// "quantos estavam em aberto em agosto" não se responde olhando o estado
// atual do CRM. Vendas, perdas e motivos seguem o período.
import { BarrasEmpilhadas } from 'src/painel/barras-empilhadas';
import { type Barra, Barras } from 'src/painel/barras';
import { Numero, Titulo } from 'src/painel/cartoes';
import { type Grupo } from 'src/painel/crm';
import { type Comparacao } from 'src/painel/comparacao';
import { ComoLer } from 'src/painel/como-ler';
import { GUIA_VENDEDORES } from 'src/painel/guias';
import { type Contagem, type Dados } from 'src/painel/dados';
import { formatarDia, formatarInteiro, variacao } from 'src/painel/formato';
import { type Desfechos } from 'src/painel/desfechos';
import { type Cohort } from 'src/painel/cohort';
import { recebidosPorVendedor } from 'src/painel/cohorts';
import { gradeDeCartoes } from 'src/painel/grade';
import { rotuloEtapa, rotuloMotivoLost } from 'src/painel/rotulos';
import { montarLinhas, TabelaVendedores } from 'src/painel/tabela-vendedores';
import { corDaSerie, type Tema } from 'src/painel/tema';

export const SecaoVendedores = ({
  dados,
  comparacao,
  cohort,
  desfechos,
  nomes,
  tema,
}: {
  dados: Dados;
  comparacao: Comparacao | null;
  cohort: Cohort | null;
  desfechos: Desfechos | null;
  nomes: Record<string, string>;
  tema: Tema;
}) => {
  const { pipeline } = dados;

  const rotuloVendedor = (chave: string | null) =>
    chave === null ? 'Sem dono' : (nomes[chave] ?? 'Membro removido');

  const comoBarras = (itens: Contagem[]): Barra[] =>
    itens.map((item) => ({ chave: item.chave, valor: item.valor }));

  const contagens = (grupos: Grupo[]): Barra[] =>
    grupos.map((grupo) => ({ chave: grupo.chaves[0], valor: grupo.contagem }));

  const series = pipeline.donos.map((dono, indice) => ({
    chave: dono,
    rotulo: rotuloVendedor(dono),
    cor: dono === null ? tema.suave : corDaSerie(indice),
  }));

  return (
    <>
      <Titulo
        texto="Vendedores"
        nota="A tabela e as vendas seguem o período. Pipeline é foto de agora e não muda com o período."
        tema={tema}
      />

      <ComoLer itens={GUIA_VENDEDORES} tema={tema} />

      {cohort?.cortadoNoInicio ? (
        <div
          style={{
            padding: '8px 10px',
            borderRadius: '6px',
            border: `1px solid ${tema.laranja}`,
            color: tema.laranja,
            fontSize: '12px',
          }}
        >
          <b>Atenção:</b> Recebidos, Perdidos e Em aberto contam a partir de{' '}
          {formatarDia(cohort.periodo.de)}, por decisão do dono do painel: antes
          disso o processo ainda estava sendo ajustado. O período escolhido
          começava antes e foi recortado. Ganhos seguem o período inteiro.
        </div>
      ) : null}

      {cohort === null && desfechos === null ? null : (
        <TabelaVendedores
          linhas={montarLinhas(
            recebidosPorVendedor(cohort?.negocios ?? []),
            desfechos?.porVendedor ?? [],
            Object.keys(nomes),
          )}
          nomes={nomes}
          semClassificacao={desfechos?.semClassificacao ?? []}
          truncado={(cohort?.truncado ?? false) || (desfechos?.truncado ?? false)}
          tema={tema}
        />
      )}

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <Numero
          rotulo="Negócios em aberto"
          valor={formatarInteiro(pipeline.aberto)}
          cor={tema.azul}
          nota="agora, fora Ganho e Perdido"
          tema={tema}
        />
        <Numero
          rotulo="Sem dono"
          valor={formatarInteiro(pipeline.semDono)}
          cor={tema.azul}
          nota="em aberto agora, sem ninguém"
          tema={tema}
        />
        <Numero
          rotulo="Em negociação"
          valor={formatarInteiro(pipeline.emNegociacao)}
          cor={tema.azul}
          nota="agora, em negociação ou fechamento"
          tema={tema}
        />
        <Numero
          rotulo="Perdas com conversa"
          valor={formatarInteiro(dados.perdasComConversa)}
          cor={tema.vermelho}
          nota="perdidos do período, só motivos com contato real"
          comparacao={
            comparacao
              ? {
                  antes: formatarInteiro(comparacao.perdasComConversa),
                  variacao: variacao(
                    dados.perdasComConversa,
                    comparacao.perdasComConversa,
                  ),
                  sentido: 'negativo',
                }
              : undefined
          }
          tema={tema}
        />
      </div>

      <div style={gradeDeCartoes(comparacao !== null)}>
        <Barras
          titulo="Pipeline por dono"
          nota="foto de agora, sem período"
          barras={comoBarras(pipeline.porDono)}
          rotulo={rotuloVendedor}
          cor={tema.azul}
          tema={tema}
        />
        <Barras
          titulo="Vendas por vendedor"
          nota="do período, pela data de fechamento"
          barras={contagens(dados.vendasPorVendedor)}
          anteriores={
            comparacao ? contagens(comparacao.vendasPorVendedor) : undefined
          }
          rotulo={rotuloVendedor}
          cor={tema.verde}
          tema={tema}
        />
      </div>

      <BarrasEmpilhadas
        titulo="Pipeline por etapa e dono"
        nota="foto de agora, sem período · etapas na ordem do funil"
        linhas={pipeline.porEtapaEDono.map((linha) => ({
          rotulo: rotuloEtapa(linha.etapa),
          pedacos: linha.pedacos,
        }))}
        series={series}
        tema={tema}
      />

      <Barras
        titulo="Motivos de perda"
        nota="perdidos criados no período"
        barras={contagens(dados.motivosPerda)}
        rotulo={rotuloMotivoLost}
        cor={tema.laranja}
        sentido="negativo"
        tema={tema}
      />

      <div
        style={{
          padding: '12px 14px',
          borderRadius: '8px',
          border: `1px solid ${tema.borda}`,
          background: tema.fundo,
          fontSize: '12px',
          color: tema.suave,
          lineHeight: 1.6,
        }}
      >
        <b style={{ color: tema.texto }}>Lucas não é um vendedor.</b> É o dono
        padrão de todo negócio até alguém clicar em "Assumir" na inbox. O que
        aparece no nome dele são vendas diretas, sem vendedor: compra pelo site ou
        recompra. As vendas com vendedor de verdade, que comissionam, são as das
        outras pessoas.
        <br />O dono contado é o dono <b style={{ color: tema.texto }}>atual</b> do
        negócio. Se alguém assumiu depois, o negócio conta para quem assumiu.
      </div>
    </>
  );
};
