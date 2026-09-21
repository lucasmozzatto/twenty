// A lista que abre quando alguém clica num número da tabela de perdas.
// Serve para conferir se o motivo registrado bate com a conversa: cada linha
// tem o código do negócio, que abre o card, e o link da conversa no WhatsApp.
// O número do cliente nunca aparece escrito, vai só dentro do endereço.
import { conversaNoWhatsapp, type PerdaClassificada } from 'src/painel/perdas';
import { rotuloMotivoLost } from 'src/painel/rotulos';
import { type Tema } from 'src/painel/tema';

const MAXIMO = 30;

export const ListaDePerdas = ({
  titulo,
  itens,
  aoFechar,
  tema,
}: {
  titulo: string;
  itens: PerdaClassificada[];
  aoFechar: () => void;
  tema: Tema;
}) => (
  <div
    style={{
      marginTop: '10px',
      padding: '10px 12px',
      borderRadius: '6px',
      border: `1px dashed ${tema.borda}`,
      fontSize: '12px',
      color: tema.suave,
    }}
  >
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '10px',
        marginBottom: '6px',
      }}
    >
      <b style={{ color: tema.texto }}>{titulo}</b>
      <a onClick={aoFechar} style={{ cursor: 'pointer', color: tema.suave }}>
        fechar
      </a>
    </div>

    {itens.slice(0, MAXIMO).map((item) => {
      const conversa = conversaNoWhatsapp(item.whatsapp);

      return (
        <div
          key={item.id}
          style={{
            display: 'flex',
            gap: '10px',
            padding: '3px 0',
            borderTop: `1px solid ${tema.borda}`,
          }}
        >
          <a
            href={`/object/opportunity/${item.id}`}
            target="_blank"
            style={{
              color: tema.texto,
              textDecoration: 'underline',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {item.id.slice(0, 8)}
          </a>
          <span style={{ flex: 1 }}>{rotuloMotivoLost(item.motivo)}</span>
          {conversa === null ? (
            <span style={{ color: tema.borda }}>sem WhatsApp</span>
          ) : (
            <a
              href={conversa}
              target="_blank"
              style={{ color: tema.verde, textDecoration: 'underline' }}
            >
              conversa
            </a>
          )}
        </div>
      );
    })}

    {itens.length > MAXIMO ? (
      <div style={{ marginTop: '6px' }}>
        Mostrando os {MAXIMO} primeiros de {itens.length}.
      </div>
    ) : null}
  </div>
);
