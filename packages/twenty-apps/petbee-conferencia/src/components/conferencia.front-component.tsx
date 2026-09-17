// A Conferência: o lado do CRM (negócios ganhos) e o lado do banco da Petbee
// (assinaturas sincronizadas) no mesmo período, com o veredito da conciliação
// diária em cada linha. Serve para fechar o mês, e o bônus de cada vendedor,
// com os dois lados iguais.
//
// Este arquivo cuida do seletor, do acesso e de buscar os dados; quem desenha
// são os arquivos em `src/painel/`. Os dados vêm do GraphQL do CRM com o token
// do app (somente leitura), do mesmo jeito que o Painel Comercial faz.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { useColorScheme, useUserId } from 'twenty-sdk/front-component';

import { CONFERENCIA_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { decidirAcesso, lerLiberados } from 'src/painel/acesso';
import { Titulo } from 'src/painel/cartoes';
import { buscarMembros, type Membro } from 'src/painel/crm';
import { buscarDados, type Dados } from 'src/painel/dados';
import { ListaAssinaturas } from 'src/painel/lista-assinaturas';
import { ListaVendas } from 'src/painel/lista-vendas';
import {
  hojeEmBrasilia,
  type Periodo,
  periodoPredefinido,
  type Predefinido,
  reconhecerPredefinido,
} from 'src/painel/periodo';
import { Resumo } from 'src/painel/resumo';
import { Seletor } from 'src/painel/seletor';
import { TabelaVendedores } from 'src/painel/tabela-vendedores';
import { construirTema } from 'src/painel/tema';

const Conferencia = () => {
  const tema = construirTema(useColorScheme() === 'dark');
  const hoje = hojeEmBrasilia();
  const userId = useUserId();

  const [predefinido, setPredefinido] = useState<Predefinido>('este-mes');
  const [periodo, setPeriodo] = useState<Periodo>(() =>
    periodoPredefinido('este-mes', hoje),
  );
  const [membros, setMembros] = useState<Membro[] | null>(null);
  const [dados, setDados] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const liberados = useMemo(lerLiberados, []);
  const acesso = decidirAcesso(liberados, userId, membros);
  const periodoInvalido = periodo.de > periodo.ate;

  const nomes = useMemo(
    () => Object.fromEntries((membros ?? []).map((membro) => [membro.id, membro.nome])),
    [membros],
  );

  // Os membros não dependem do período: uma busca por sessão. Servem para o
  // nome do vendedor e para saber quem está olhando.
  useEffect(() => {
    buscarMembros()
      .then(setMembros)
      .catch(() => setMembros([]));
  }, []);

  const recarregar = useCallback(async () => {
    if (periodoInvalido || acesso !== 'liberado') return;
    setCarregando(true);
    setErro(null);
    try {
      setDados(await buscarDados(periodo));
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : String(falha));
    } finally {
      setCarregando(false);
    }
  }, [periodo, periodoInvalido, acesso]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  const escolherPredefinido = (qual: Predefinido) => {
    setPredefinido(qual);
    setPeriodo(periodoPredefinido(qual, hoje));
  };

  const escolherPeriodo = (novo: Periodo) => {
    setPeriodo(novo);
    setPredefinido(reconhecerPredefinido(novo, hoje));
  };

  const editarData = (campo: keyof Periodo, valor: string) => {
    if (valor === '') return;
    setPredefinido('personalizado');
    setPeriodo((atual) => ({ ...atual, [campo]: valor }));
  };

  const aviso = (texto: string) => (
    <div
      style={{
        padding: '8px 10px',
        borderRadius: '6px',
        border: `1px solid ${tema.laranja}`,
        color: tema.laranja,
        fontSize: '12px',
      }}
    >
      {texto}
    </div>
  );

  const truncado =
    dados !== null && (dados.truncado.vendas || dados.truncado.assinaturas);

  if (acesso === 'negado') {
    return (
      <div style={{ padding: '16px', color: tema.texto, fontSize: '13px' }}>
        <b>Sem acesso.</b> A Conferência está liberada só para algumas pessoas.
        Quem administra o CRM ajusta isso em Settings → Applications →
        Conferência Petbee.
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '12px 16px',
        fontFamily: 'inherit',
        color: tema.texto,
        fontSize: '13px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <Seletor
        predefinido={predefinido}
        periodo={periodo}
        hoje={hoje}
        carregando={carregando}
        periodoInvalido={periodoInvalido}
        tema={tema}
        aoEscolherPredefinido={escolherPredefinido}
        aoEditarData={editarData}
        aoEscolherPeriodo={escolherPeriodo}
        aoAtualizar={recarregar}
      />

      {acesso === 'verificando' ? (
        <div style={{ fontSize: '12px', color: tema.suave }}>Verificando acesso…</div>
      ) : null}

      {erro ? (
        <div style={{ color: tema.vermelho, fontSize: '12px' }}>
          Não consegui ler o CRM ({erro}).{' '}
          <a
            onClick={recarregar}
            style={{ cursor: 'pointer', textDecoration: 'underline' }}
          >
            Tentar de novo
          </a>
        </div>
      ) : null}

      {/* Um lado que falhou aparece vazio, então o aviso é obrigatório: sem
          ele uma lista vazia por erro pareceria um mês sem pendência. */}
      {dados !== null && dados.falhas.length > 0
        ? aviso(
            `Atenção: não carregou ${dados.falhas.map((falha) => falha.onde).join(' e ')}, e esse lado está vazio. Motivo: ${dados.falhas[0].motivo}`,
          )
        : null}

      {truncado
        ? aviso(
            'Atenção: o período tem registros demais para ler de uma vez e as listas estão incompletas. Escolha um intervalo menor.',
          )
        : null}

      {/* Enquanto recarrega, os números velhos ficam esmaecidos em vez de
          desaparecer: trocar o período não faz a tela pular. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          opacity: carregando ? 0.6 : 1,
        }}
      >
        <Resumo resumo={dados?.resumo ?? null} tema={tema} />

        <Titulo
          texto="Por vendedor"
          nota="Vendas ganhas no período, pelo dono atual do negócio, e o que o banco confirma de cada uma. É a base do bônus."
          tema={tema}
        />
        <TabelaVendedores linhas={dados?.porVendedor ?? []} nomes={nomes} tema={tema} />

        <Titulo
          texto="Vendas do CRM"
          nota="Negócios ganhos no período, com o veredito da conciliação em cada um."
          tema={tema}
        />
        <ListaVendas vendas={dados?.vendas ?? []} nomes={nomes} tema={tema} />

        <Titulo
          texto="Assinaturas do banco"
          nota="Assinaturas iniciadas no período no banco da Petbee, com o veredito da conciliação em cada uma."
          tema={tema}
        />
        <ListaAssinaturas assinaturas={dados?.assinaturas ?? []} tema={tema} />
      </div>

      <div style={{ fontSize: '11px', color: tema.suave }}>
        Os vereditos são gravados pela conciliação diária (n8n, todo dia às
        07:00) nos campos "Conferência banco" do negócio e "Conferência funil"
        da assinatura. Esta página só lê; para mudar um veredito, corrija o
        registro no CRM e espere a próxima rodada.
      </div>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: CONFERENCIA_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'conferencia',
  description:
    'Conferência funil × banco por período: totais dos dois lados, tabela por vendedor e as listas de vendas e assinaturas com o veredito da conciliação diária.',
  component: Conferencia,
});
