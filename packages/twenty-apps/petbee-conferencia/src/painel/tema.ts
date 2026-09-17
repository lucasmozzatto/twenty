// Cores do quadro, claras e escuras. As mesmas do painéis, para as duas
// páginas parecerem uma só.

export type Tema = {
  texto: string;
  suave: string;
  borda: string;
  fundo: string;
  destaque: string;
  vermelho: string;
  rosa: string;
  verde: string;
  azul: string;
  laranja: string;
};

export const construirTema = (escuro: boolean): Tema => ({
  texto: escuro ? '#ebebeb' : '#333',
  suave: escuro ? '#a0a0a0' : '#777',
  borda: escuro ? '#3a3a3a' : '#e5e5e5',
  fundo: escuro ? '#1d1d1d' : '#fafafa',
  destaque: escuro ? '#2e2e2e' : '#ececec',
  vermelho: '#e05252',
  rosa: '#c2417b',
  verde: '#3f7a4f',
  azul: '#3b6fb6',
  laranja: '#b87413',
});
