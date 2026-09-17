// Quem do workspace NÃO é vendedor.
//
// A tabela por vendedor dá linha fixa a todo membro do time, mesmo zerado:
// num dia parado, uma pessoa que some da tabela parece erro. Quem está nesta
// lista fica de fora dessa regra: só aparece se algum número cair no nome
// dele no período, e aí a linha é justamente o aviso de que um lead ou uma
// venda foi parar em quem não vende.
//
// É uma lista no código porque o CRM não tem onde guardar isso: "Membros do
// workspace" é objeto de sistema e não aceita campo novo, e as Funções do CRM
// são de permissão, num endereço que o papel somente-leitura do painel não lê.
// Quando alguém entrar ou sair do comercial, edite aqui e publique.
//
// Para achar o id de uma pessoa: abra o perfil dela no CRM e copie o trecho
// do endereço depois de /object/workspaceMember/.
export const NAO_SAO_VENDEDORES = new Set<string>([
  // Guilherme Chaves, pedido do dono do painel em 17/09/2026.
  '9c3fbc68-fe67-46d2-932f-b575c4439836',
]);
