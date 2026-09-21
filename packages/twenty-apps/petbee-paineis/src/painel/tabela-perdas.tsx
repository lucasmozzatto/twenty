// As duas tabelas de "De onde saem as perdas": em cima quem perdeu, embaixo
// por quê. As colunas são as mesmas nas duas, as etapas do funil, para o olho
// não precisar mudar de régua no meio do bloco.
import { useState } from 'react';

import { Cartao } from 'src/painel/cartoes';
import { formatarInteiro, formatarPercentual } from 'src/painel/formato';
import { Cabecalho, Fileira, rotuloDaEtapa } from 'src/painel/grade-de-perdas';
import {
  type EtapaDeSaida,
  type PerdaClassificada,
  perdasPorMotivo,
  perdasPorVendedor,
  somarLinhas,
} from 'src/painel/perdas';
import { ListaDePerdas } from 'src/painel/lista-de-perdas';
import { rotuloMotivoLost } from 'src/painel/rotulos';
import { type Tema } from 'src/painel/tema';

// Qual célula está aberta embaixo da tabela. `tabela` separa as duas, porque
// a chave de uma é o vendedor e a da outra é o motivo.
type Celula = {
  tabela: 'vendedor' | 'motivo';
  chave: string | null;
  etapa: EtapaDeSaida;
};

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
  const [aberta, setAberta] = useState<Celula | null>(null);

  const abrir = (celula: Celula) =>
    setAberta((atual) =>
      atual !== null &&
      atual.tabela === celula.tabela &&
      atual.chave === celula.chave &&
      atual.etapa === celula.etapa
        ? null
        : celula,
    );

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
        nota={`Cada perda do período pela etapa em que o lead estava antes de virar Perdido. As duas primeiras colunas, em itálico, são descarte antes de o lead chegar num vendedor. "Sem registro" é perda sem a mudança de etapa gravada, herança da migração do CRM. Mesma régua da tabela de cima: o lead foi criado no período e está em Perdido hoje. Neste período, ${formatarInteiro(comVendedor)} de ${formatarInteiro(totalGeral.total)} perdas (${formatarPercentual(comVendedor, totalGeral.total)}) aconteceram com o lead já na mão de alguém. Clique num número para ver quais negócios são, com link para o card e para a conversa.`}
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
                aoEscolher={(etapa) =>
                  abrir({ tabela: 'vendedor', chave: linha.chave, etapa })
                }
                tema={tema}
              />
            ))}
            <Fileira rotulo="Total" linha={totalGeral} destaque tema={tema} />
          </>
        )}
        {aberta?.tabela === 'vendedor' ? (
          <ListaDePerdas
            titulo={`${nomeDe(aberta.chave)} · ${rotuloDaEtapa(aberta.etapa)}`}
            itens={itens.filter(
              (item) => item.ownerId === aberta.chave && item.etapa === aberta.etapa,
            )}
            aoFechar={() => setAberta(null)}
            tema={tema}
          />
        ) : null}
      </Cartao>

      <Cartao
        titulo="Por que as perdas acontecem"
        nota="O mesmo período e as mesmas colunas da tabela de cima, agora por motivo. O motivo é o que está no negócio hoje; a etapa é de onde ele saiu. Os botões trocam de quem são as perdas. Clique num número para ver os negócios daquela célula."
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
                aoEscolher={(etapa) =>
                  abrir({ tabela: 'motivo', chave: linha.chave, etapa })
                }
                tema={tema}
              />
            ))}
            <Fileira rotulo="Total" linha={totalDoMotivo} destaque tema={tema} />
          </>
        )}
        {aberta?.tabela === 'motivo' ? (
          <ListaDePerdas
            titulo={`${rotuloMotivoLost(aberta.chave)} · ${rotuloDaEtapa(aberta.etapa)}${
              dono === 'time' ? '' : ` · ${nomeDe(dono)}`
            }`}
            itens={itens.filter(
              (item) =>
                item.motivo === aberta.chave &&
                item.etapa === aberta.etapa &&
                (dono === 'time' || item.ownerId === dono),
            )}
            aoFechar={() => setAberta(null)}
            tema={tema}
          />
        ) : null}
      </Cartao>
    </>
  );
};
