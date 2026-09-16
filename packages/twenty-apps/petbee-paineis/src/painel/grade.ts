// Grade que quebra sozinha: uma coluna no celular, quantas couberem na tela
// larga. Sem isto cada cartão viraria uma tira estreita nos monitores grandes.
export const GRADE_DE_CARTOES = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: '10px',
} as const;
