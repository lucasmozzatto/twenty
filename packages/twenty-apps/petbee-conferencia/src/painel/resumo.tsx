// Os números do período: o lado do CRM, o que o banco confirma dessas vendas
// e a diferença; ao lado, o que existe no banco; embaixo os vereditos da
// conciliação. Se a diferença é zero e nada está pendente, o mês bate.
import { Numero } from 'src/painel/cartoes';
import { type Resumo as Totais } from 'src/painel/contas';
import {
  formatarDiferenca,
  formatarInteiro,
  formatarReais,
} from 'src/painel/formato';
import { type Tema } from 'src/painel/tema';

const LINHA = { display: 'flex', gap: '10px', flexWrap: 'wrap' } as const;

export const Resumo = ({
  resumo,
  tema,
}: {
  resumo: Totais | null;
  tema: Tema;
}) => {
  const inteiro = (valor: number | undefined) =>
    valor === undefined ? null : formatarInteiro(valor);
  const reais = (valor: number | undefined) =>
    valor === undefined ? null : formatarReais(valor);

  const notaDoBanco =
    resumo === null
      ? 'Iniciadas no período, fora as de valor zero'
      : `Iniciadas no período, fora ${formatarInteiro(resumo.cortesias)} de valor zero` +
        (resumo.canceladas > 0
          ? `; ${formatarInteiro(resumo.canceladas)} já cancelada(s)`
          : '');

  const bate = resumo !== null && Math.abs(resumo.diferenca) < 0.005;

  const notaDaDiferenca =
    resumo !== null && resumo.duplicadas > 0
      ? `Receita do CRM menos o valor no banco das mesmas vendas. ${formatarInteiro(resumo.duplicadas)} venda(s) duplicada(s) contam duas vezes aqui`
      : 'Receita do CRM menos o valor no banco das mesmas vendas. Zero é o objetivo';

  const pendentes =
    resumo === null
      ? null
      : resumo.vereditosVenda.VALOR_DIVERGENTE +
        resumo.vereditosVenda.SEM_ASSINATURA +
        resumo.vereditosVenda.AGUARDANDO +
        resumo.vereditosAssinatura.SEM_VENDA +
        resumo.vereditosAssinatura.AGUARDANDO +
        resumo.duplicadas;

  const aguardando =
    resumo === null
      ? undefined
      : resumo.vereditosVenda.AGUARDANDO + resumo.vereditosAssinatura.AGUARDANDO;

  return (
    <>
      <div style={LINHA}>
        <Numero
          rotulo="Vendas no CRM"
          valor={inteiro(resumo?.vendas)}
          cor={tema.texto}
          nota="Negócios ganhos, pela data de fechamento"
          tema={tema}
        />
        <Numero
          rotulo="Receita no CRM"
          valor={reais(resumo?.receita)}
          cor={tema.verde}
          nota="Soma do valor dos negócios ganhos"
          tema={tema}
        />
        <Numero
          rotulo="No banco, das vendas"
          valor={reais(resumo?.valorBanco)}
          cor={tema.azul}
          nota="Soma do valor no banco encontrado para essas vendas"
          tema={tema}
        />
        <Numero
          rotulo="Diferença CRM − banco"
          valor={resumo === null ? null : formatarDiferenca(resumo.diferenca)}
          cor={bate ? tema.verde : tema.vermelho}
          nota={notaDaDiferenca}
          tema={tema}
        />
        <Numero
          rotulo="Assinaturas no banco"
          valor={inteiro(resumo?.assinaturas)}
          cor={tema.texto}
          nota={notaDoBanco}
          tema={tema}
        />
        <Numero
          rotulo="MRR no banco"
          valor={reais(resumo?.mrr)}
          cor={tema.azul}
          nota="Soma do valor mensal das assinaturas cobradas"
          tema={tema}
        />
      </div>

      <div style={LINHA}>
        <Numero
          rotulo="Conferidas"
          valor={inteiro(resumo?.vereditosVenda.CONFERIDA)}
          cor={tema.verde}
          nota="Venda com assinatura do mesmo valor"
          tema={tema}
        />
        <Numero
          rotulo="Valor divergente"
          valor={inteiro(resumo?.vereditosVenda.VALOR_DIVERGENTE)}
          cor={tema.vermelho}
          nota="Venda e assinatura com valores diferentes"
          tema={tema}
        />
        <Numero
          rotulo="Sem assinatura"
          valor={inteiro(resumo?.vereditosVenda.SEM_ASSINATURA)}
          cor={tema.laranja}
          nota="Venda ganha sem assinatura no banco"
          tema={tema}
        />
        <Numero
          rotulo="Sem venda no funil"
          valor={inteiro(resumo?.vereditosAssinatura.SEM_VENDA)}
          cor={tema.vermelho}
          nota="Assinatura no banco sem venda ganha no CRM"
          tema={tema}
        />
        <Numero
          rotulo="Aguardando"
          valor={inteiro(aguardando)}
          cor={tema.suave}
          nota="Ainda sem veredito: a conciliação roda às 07:00"
          tema={tema}
        />
      </div>

      {pendentes === 0 ? (
        <div style={{ fontSize: '12px', color: tema.verde }}>
          ✓ Nada pendente no período.
        </div>
      ) : null}
    </>
  );
};
