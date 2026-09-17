// O lado do banco: uma linha por assinatura iniciada no período. Abre em
// "sem venda", que é a pergunta "esqueceu de dar Ganho?".
import { type ReactNode, useState } from 'react';

import { Cartao } from 'src/painel/cartoes';
import { type Assinatura, type VereditoAssinatura } from 'src/painel/dados';
import { formatarDia, formatarReais } from 'src/painel/formato';
import {
  Cabecalho,
  Etiqueta,
  type Ficha,
  Fichas,
  Ligacao,
  MostrarMais,
  PASSO,
} from 'src/painel/pecas';
import {
  corDoStatusAssinatura,
  corDoVereditoAssinatura,
  ROTULO_VEREDITO_ASSINATURA,
  rotuloStatusAssinatura,
} from 'src/painel/rotulos';
import { type Tema } from 'src/painel/tema';

type Filtro = 'todas' | VereditoAssinatura;

const passaNoFiltro = (assinatura: Assinatura, filtro: Filtro): boolean =>
  filtro === 'todas' || assinatura.veredito === filtro;

const COLUNAS = [
  'Pet',
  'Tutor',
  'Início',
  'Valor mensal',
  'Status',
  'Conferência',
  'ID Petbee',
];

const GRADE =
  'minmax(120px, 1.3fr) minmax(150px, 1.8fr) 80px 100px 90px minmax(130px, 1.2fr) 90px';

export const ListaAssinaturas = ({
  assinaturas,
  tema,
}: {
  assinaturas: Assinatura[];
  tema: Tema;
}) => {
  const [filtro, setFiltro] = useState<Filtro>('SEM_VENDA');
  const [limite, setLimite] = useState(PASSO);

  const filtradas = assinaturas.filter((assinatura) =>
    passaNoFiltro(assinatura, filtro),
  );
  const visiveis = filtradas.slice(0, limite);
  const contar = (qual: Filtro) =>
    assinaturas.filter((assinatura) => passaNoFiltro(assinatura, qual)).length;

  const fichas: Ficha<Filtro>[] = [
    { valor: 'SEM_VENDA', rotulo: 'Sem venda', quantidade: contar('SEM_VENDA') },
    { valor: 'AGUARDANDO', rotulo: 'Aguardando', quantidade: contar('AGUARDANDO') },
    { valor: 'COM_VENDA', rotulo: 'Com venda', quantidade: contar('COM_VENDA') },
    { valor: 'CORTESIA', rotulo: 'Cortesia', quantidade: contar('CORTESIA') },
    { valor: 'todas', rotulo: 'Todas', quantidade: assinaturas.length },
  ];

  const escolher = (qual: Filtro) => {
    setFiltro(qual);
    setLimite(PASSO);
  };

  const celula = (conteudo: ReactNode, direita = false, cor?: string) => (
    <div
      style={{
        textAlign: direita ? 'right' : 'left',
        color: cor ?? tema.texto,
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        minWidth: 0,
      }}
    >
      {conteudo}
    </div>
  );

  const tutor = (assinatura: Assinatura) =>
    assinatura.tutorId === null ? (
      <span style={{ color: tema.suave }}>{assinatura.tutorNome ?? 'Sem tutor'}</span>
    ) : (
      <Ligacao
        objeto="person"
        id={assinatura.tutorId}
        texto={assinatura.tutorNome ?? 'Sem nome'}
        tema={tema}
      />
    );

  return (
    <Cartao
      titulo="Assinaturas do banco"
      nota="Uma linha por assinatura iniciada no período, como o robô de sync trouxe do banco da Petbee. Conferência é o veredito da conciliação: tem venda ganha no CRM para este tutor? Clique no pet para abrir a assinatura, no tutor para abrir a pessoa."
      tema={tema}
    >
      <Fichas fichas={fichas} ativa={filtro} tema={tema} aoEscolher={escolher} />
      {filtradas.length === 0 ? (
        <div style={{ fontSize: '12px', color: tema.suave }}>
          {filtro === 'SEM_VENDA'
            ? 'Nenhuma assinatura sem venda no período.'
            : 'Nada aqui.'}
        </div>
      ) : (
        <>
          <Cabecalho colunas={COLUNAS} grade={GRADE} tema={tema} />
          {visiveis.map((assinatura) => (
            <div
              key={assinatura.id}
              style={{
                display: 'grid',
                gridTemplateColumns: GRADE,
                gap: '8px',
                padding: '5px 0',
                borderTop: `1px solid ${tema.borda}`,
                fontSize: '12px',
                alignItems: 'center',
              }}
            >
              {celula(
                <Ligacao objeto="assinatura" id={assinatura.id} texto={assinatura.pet} tema={tema} />,
              )}
              {celula(tutor(assinatura))}
              {celula(formatarDia(assinatura.inicio))}
              {celula(
                assinatura.mrr === null ? '—' : formatarReais(assinatura.mrr),
                true,
                assinatura.cortesia ? tema.suave : tema.texto,
              )}
              {celula(
                rotuloStatusAssinatura(assinatura.status),
                false,
                corDoStatusAssinatura(assinatura.status, tema),
              )}
              {celula(
                <Etiqueta
                  texto={ROTULO_VEREDITO_ASSINATURA[assinatura.veredito]}
                  cor={corDoVereditoAssinatura(assinatura.veredito, tema)}
                />,
              )}
              {celula(assinatura.idPetbee ?? '—', false, tema.suave)}
            </div>
          ))}
          <MostrarMais
            restantes={filtradas.length - visiveis.length}
            tema={tema}
            aoClicar={() => setLimite((atual) => atual + PASSO)}
          />
        </>
      )}
    </Cartao>
  );
};
