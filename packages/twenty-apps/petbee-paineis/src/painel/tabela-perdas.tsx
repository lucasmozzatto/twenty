// As duas tabelas de "De onde saem as perdas": em cima quem perdeu, embaixo
// por quê. As colunas são as mesmas nas duas, as etapas do funil, para o olho
// não precisar mudar de régua no meio do bloco.
import { useState } from 'react';

import { Cartao } from 'src/painel/cartoes';
import { formatarInteiro, formatarPercentual } from 'src/painel/formato';
import {
  ETAPAS_ANTES_DO_VENDEDOR,
  ETAPAS_DE_SAIDA,
  type EtapaDeSaida,
  type LinhaDePerdas,
  type PerdaClassificada,
  perdasPorMotivo,
  perdasPorVendedor,
  somarLinhas,
} from 'src/painel/perdas';
import { rotuloEtapa, rotuloMotivoLost } from 'src/painel/rotulos';
import { type Tema } from 'src/painel/tema';

const GRADE = 'minmax(130px, 1.6fr) repeat(6, minmax(58px, 1fr)) minmax(64px, 0.9fr)';

const rotuloDaEtapa = (etapa: EtapaDeSaida) =>
  etapa === 'SEM_REGISTRO' ? 'Sem registro' : rotuloEtapa(etapa);

const Cabecalho = ({ tema }: { tema: Tema }) => (
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

const Fileira = ({
  rotulo,
  linha,
  destaque,
  tema,
}: {
  rotulo: string;
  linha: LinhaDePerdas;
  destaque: boolean;
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

      return (
        <div
          key={etapa}
          style={{
            textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
            fontWeight: destaque ? 700 : 400,
            color:
              valor === 0
                ? tema.borda
                : etapa === 'SEM_REGISTRO'
                  ? tema.suave
                  : ETAPAS_ANTES_DO_VENDEDOR.includes(etapa)
                    ? tema.suave
                    : tema.vermelho,
          }}
        >
          {formatarInteiro(valor)}
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

const Botao = ({
  rotulo,
  ativo,
  aoClicar,
  tema,
}: {
  rotulo: string;
  ativo: boolean;
  aoClicar: () => void;
  tema: Tema;
}) => (
  <button
    onClick={aoClicar}
    style={{
      padding: '4px 9px',
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

export const TabelasDePerdas = ({
  itens,
  membros,
  ignorar,
  nomes,
  truncado,
  tema,
}: {
  itens: PerdaClassificada[];
  membros: string[];
  ignorar: (dono: string) => boolean;
  nomes: Record<string, string>;
  truncado: boolean;
  tema: Tema;
}) => {
  const [dono, setDono] = useState<string | null | 'time'>('time');

  const nomeDe = (chave: string | null) =>
    chave === null ? 'Sem dono' : (nomes[chave] ?? 'Membro removido');

  const porVendedor = perdasPorVendedor(itens, membros, ignorar);
  const totalGeral = somarLinhas(porVendedor);
  const porMotivo = perdasPorMotivo(itens, dono);
  const totalDoMotivo = somarLinhas(porMotivo);
  const comVendedor = totalGeral.total - totalGeral.porEtapa.NOVO_LEAD -
    totalGeral.porEtapa.EM_QUALIFICACAO - totalGeral.porEtapa.SEM_REGISTRO;

  const escolhas: { valor: string | null | 'time'; rotulo: string }[] = [
    { valor: 'time', rotulo: 'Time' },
    ...porVendedor
      .filter((linha) => linha.total > 0)
      .map((linha) => ({ valor: linha.chave, rotulo: nomeDe(linha.chave) })),
  ];

  return (
    <>
      <Cartao
        titulo="De onde saem as perdas"
        nota={`Cada perda do período pela etapa em que o lead estava antes de virar Perdido. As duas primeiras colunas, em itálico, são descarte antes de o lead chegar num vendedor. "Sem registro" é perda sem a mudança de etapa gravada, herança da migração do CRM. Mesma régua da tabela de cima: está em Perdido hoje e a data de fechamento cai no período. Neste período, ${formatarInteiro(comVendedor)} de ${formatarInteiro(totalGeral.total)} perdas (${formatarPercentual(comVendedor, totalGeral.total)}) aconteceram com o lead já na mão de alguém.`}
        tema={tema}
      >
        {truncado ? (
          <div style={{ fontSize: '12px', color: tema.laranja, marginBottom: '8px' }}>
            <b>Atenção:</b> o período tem registros demais para ler de uma vez; estes
            números estão por baixo. Escolha um intervalo menor.
          </div>
        ) : null}
        {itens.length === 0 ? (
          <div style={{ fontSize: '12px', color: tema.suave }}>Nada no período.</div>
        ) : (
          <>
            <Cabecalho tema={tema} />
            {porVendedor.map((linha) => (
              <Fileira
                key={linha.chave ?? 'sem-dono'}
                rotulo={nomeDe(linha.chave)}
                linha={linha}
                destaque={false}
                tema={tema}
              />
            ))}
            <Fileira rotulo="Total" linha={totalGeral} destaque tema={tema} />
          </>
        )}
      </Cartao>

      <Cartao
        titulo="Por que as perdas acontecem"
        nota="O mesmo período e as mesmas colunas da tabela de cima, agora por motivo. O motivo é o que está no negócio hoje; a etapa é de onde ele saiu. Os botões trocam de quem são as perdas."
        tema={tema}
      >
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
          {escolhas.map((escolha) => (
            <Botao
              key={escolha.valor ?? 'sem-dono'}
              rotulo={escolha.rotulo}
              ativo={dono === escolha.valor}
              aoClicar={() => setDono(escolha.valor)}
              tema={tema}
            />
          ))}
        </div>
        {porMotivo.length === 0 ? (
          <div style={{ fontSize: '12px', color: tema.suave }}>Nada no período.</div>
        ) : (
          <>
            <Cabecalho tema={tema} />
            {porMotivo.map((linha) => (
              <Fileira
                key={linha.chave ?? 'sem-motivo'}
                rotulo={rotuloMotivoLost(linha.chave)}
                linha={linha}
                destaque={false}
                tema={tema}
              />
            ))}
            <Fileira rotulo="Total" linha={totalDoMotivo} destaque tema={tema} />
          </>
        )}
      </Cartao>
    </>
  );
};
