// A nota discreta embaixo da tabela por vendedor: o termômetro do processo.
// Fechada, é uma linha cinza com as contagens; aberta, lista os negócios com
// link, para o gerente conferir no CRM. Discreta de propósito, pedido do dono
// do painel em 17/09/2026: é aviso, não alarme.
import { useState } from 'react';

import {
  type VendaSemClassificacao,
  type VendaSemNegociacao,
} from 'src/painel/desfechos';
import { type Tema } from 'src/painel/tema';

const MAXIMO_DE_LINKS = 20;

export const NotaDeVendas = ({
  semClassificacao,
  semNegociacao,
  tema,
}: {
  semClassificacao: VendaSemClassificacao[];
  semNegociacao: VendaSemNegociacao[];
  tema: Tema;
}) => {
  const [aberta, setAberta] = useState(false);

  if (semClassificacao.length === 0 && semNegociacao.length === 0) return null;

  const links = (ids: string[], marcar: (id: string) => string = () => '') => (
    <>
      {ids.slice(0, MAXIMO_DE_LINKS).map((id, indice) => (
        <span key={id}>
          {indice > 0 ? ', ' : ''}
          <a
            href={`/object/opportunity/${id}`}
            style={{ color: tema.suave, textDecoration: 'underline' }}
          >
            {id.slice(0, 8)}
          </a>
          {marcar(id)}
        </span>
      ))}
      {ids.length > MAXIMO_DE_LINKS ? ' e outras' : ''}.
    </>
  );

  const partes = [
    semNegociacao.length > 0
      ? `${semNegociacao.length} venda(s) pularam a etapa de negociação`
      : null,
    semClassificacao.length > 0
      ? `${semClassificacao.length} venda(s) sem o campo Fechamento`
      : null,
  ].filter((parte) => parte !== null);

  return (
    <div style={{ fontSize: '11px', color: tema.suave, marginTop: '8px', lineHeight: 1.5 }}>
      <a onClick={() => setAberta((estava) => !estava)} style={{ cursor: 'pointer', color: tema.suave }}>
        {aberta ? '▾' : '▸'} {partes.join(' · ')}
      </a>
      {aberta ? (
        <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {semNegociacao.length > 0 ? (
            <div>
              Pularam a etapa: o card foi para Ganho sem passar por "Em negociação".
              Contam em Ganhos e em Recebidos, no dia da venda. Quando esta lista
              zerar, o processo está redondo:{' '}
              {links(semNegociacao.map((venda) => venda.id))}
            </div>
          ) : null}
          {semClassificacao.length > 0 ? (
            <div>
              Sem o campo Fechamento:{' '}
              {semClassificacao.filter((venda) => venda.contada).length} contada(s)
              pela regra automática e{' '}
              {semClassificacao.filter((venda) => !venda.contada).length} fora da
              tabela. Preencha o campo no CRM para a comissão sair certa:{' '}
              {links(
                semClassificacao.map((venda) => venda.id),
                (id) =>
                  semClassificacao.find((venda) => venda.id === id)?.contada ? '' : ' (fora)',
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
