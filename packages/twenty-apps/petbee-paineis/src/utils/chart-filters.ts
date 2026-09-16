// Formato dos filtros conferido em 16/09/2026 lendo os filtros reais da view
// "Vendas × banco (conferência)" do workspace, via API de metadados.
// Campo de lista  -> operand 'IS',       value '["WON"]'      (array JSON como texto)
// Campo de data   -> operand 'IS_AFTER', value '2026-09-01T03:00:00.000Z'
//
// A data de corte é 01/09/2026 00:00 no horário de Brasília, que em UTC é 03:00.
export const CORTE = '2026-09-01T03:00:00.000Z';
export const CORTE_LABEL = '01/09/2026';

// Fixar o fuso deixa o número igual para todo mundo. Sem isso o CRM agrupa
// pelo fuso de quem está olhando, e duas pessoas veem dias diferentes.
export const FUSO = 'America/Sao_Paulo';

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

export const dateIsAfter = ({
  field,
  label,
}: {
  field: string;
  label: string;
}): FilterSpec => ({
  type: 'DATE_TIME',
  label,
  value: CORTE,
  displayValue: CORTE_LABEL,
  operand: 'IS_AFTER',
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
