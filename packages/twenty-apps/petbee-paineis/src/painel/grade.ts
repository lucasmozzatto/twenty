// Grade que quebra sozinha: uma coluna no celular, quantas couberem na tela
// larga. Sem isto cada cartão viraria uma tira estreita nos monitores grandes.
//
// Com a comparação ligada cada linha ganha a coluna do "antes", então a
// largura mínima sobe — senão a barra em si fica espremida entre os números.
export const gradeDeCartoes = (comparando = false) =>
  ({
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fit, minmax(${comparando ? 460 : 320}px, 1fr))`,
    gap: '10px',
  }) as const;
