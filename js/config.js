/* ============================================================
   RETRO ARCADE — CONFIGURAÇÃO CENTRAL
   ------------------------------------------------------------
   Único lugar com as credenciais públicas do site.
   A Publishable Key do Supabase é segura para o frontend.
   NUNCA coloque aqui a Secret Key.
   ============================================================ */
window.RETRO_CONFIG = {
  SUPABASE_URL: 'https://wnnznqintjxcgqlgtnrt.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_olBCHCxAo-fF8ngwUiXb7w_teA9HXw0',

  // Tabela do ranking no Supabase
  SCORES_TABLE: 'scores',

  // Lista de jogos aceitos (validação do ranking)
  VALID_GAMES: ['breakout', 'pong', 'asteroids', 'snake'],

  // Chave Pix do criador (usada apenas em js/apoio.js)
  PIX_KEY: 'f0b631bc-faac-4707-9c0c-8553fa3e8963'
};
