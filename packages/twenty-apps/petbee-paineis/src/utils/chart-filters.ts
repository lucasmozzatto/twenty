// Formato dos filtros conferido em 16/09/2026 lendo os filtros reais da view
// "Vendas × banco (conferência)" do workspace, via API de metadados.
// Campo de lista  -> operand 'IS',          value '["WON"]'  (array JSON como texto)
// Campo de data   -> operand 'IS_RELATIVE', value 'THIS_1_MONTH;;America/Sao_Paulo;;MONDAY;;'
//
// O formato relativo vem de `relativeDateFilterStringifiedSchema` no twenty-shared:
// DIRECAO_QUANTIDADE_UNIDADE;;fuso;;primeiro-dia-da-semana;;
// "THIS_1_MONTH" resolve para [dia 1 do mês atual, dia 1 do próximo mês), com o
// "hoje" calculado no fuso informado. Virou o mês, o painel vira junto.

// Fixar o fuso deixa o número igual para todo mundo. Sem isso o CRM agrupa
// pelo fuso de quem está olhando, e duas pessoas veem dias diferentes.
export const FUSO = 'America/Sao_Paulo';

export const ESTE_MES = `THIS_1_MONTH;;${FUSO};;MONDAY;;`;
export const ESTE_MES_LABEL = 'este mês';

type RecordFilter = {
  type: string;
  label: string;
  value: string;
  displayValue: string;
  operand: string;
  fieldMetadataUniversalIdentifier: string;
  recordFilterGroupId: string;
};

type FilterSpec = Omit<RecordFilter, 'recordFilterGroupId'>;

export const selectIs = ({
  field,
  label,
  values,
  displayValue,
}: {
  field: string;
  label: string;
  values: string[];
  displayValue?: string;
}): FilterSpec => ({
  type: 'SELECT',
  label,
  value: JSON.stringify(values),
  displayValue: displayValue ?? values.join(', '),
  operand: 'IS',
  fieldMetadataUniversalIdentifier: field,
});

export const selectIsNot = ({
  field,
  label,
  values,
  displayValue,
}: {
  field: string;
  label: string;
  values: string[];
  displayValue?: string;
}): FilterSpec => ({
  type: 'SELECT',
  label,
  value: JSON.stringify(values),
  displayValue: displayValue ?? values.join(', '),
  operand: 'IS_NOT',
  fieldMetadataUniversalIdentifier: field,
});

// Antes era uma data fixa (IS_AFTER 01/09/2026). Trocado por "este mês" para o
// painel andar sozinho sem ninguém editar o corte a cada virada.
export const dateEsteMes = ({
  field,
  label,
}: {
  field: string;
  label: string;
}): FilterSpec => ({
  type: 'DATE_TIME',
  label,
  value: ESTE_MES,
  displayValue: ESTE_MES_LABEL,
  operand: 'IS_RELATIVE',
  fieldMetadataUniversalIdentifier: field,
});

export const isEmpty = ({
  field,
  label,
  type = 'SELECT',
}: {
  field: string;
  label: string;
  type?: string;
}): FilterSpec => ({
  type,
  label,
  value: '',
  displayValue: '',
  operand: 'IS_EMPTY',
  fieldMetadataUniversalIdentifier: field,
});

export const buildFilter = (groupId: string, specs: FilterSpec[]) => ({
  recordFilters: specs.map((spec) => ({
    ...spec,
    recordFilterGroupId: groupId,
  })),
  recordFilterGroups: [{ id: groupId, logicalOperator: 'AND' }],
});
