/* =========================================================
   FinControl · configuração
   ---------------------------------------------------------
   Preencha o bloco "firebase" abaixo com os dados do seu
   projeto gratuito (Console Firebase → Configurações do
   projeto → Seus apps → Configuração do SDK).

   Enquanto "apiKey" estiver vazio, o site roda em MODO LOCAL:
   login e dados salvos apenas neste navegador (ideal para
   testar). Assim que você colar as chaves, ele passa a usar
   Firebase Authentication + Cloud Firestore (plano Spark,
   gratuito).
   ========================================================= */
window.APP_CONFIG = {
  nome: "FinControl",
  modo: "auto", // "auto" | "firebase" | "local"

  firebase: {
    apiKey: "AIzaSyDe8kJh4Xvt2BF7Vf7yFRZKRM6XFoKzpuk",
    authDomain: "rm-controle-financeiro-a8d83.firebaseapp.com",
    projectId: "rm-controle-financeiro-a8d83",
    storageBucket: "rm-controle-financeiro-a8d83.firebasestorage.app",
    messagingSenderId: "577296865629",
    appId: "1:577296865629:web:139ce4ac145781189eb0b4"
  },

  // limite de itens importados por operação
  limiteImportacao: 3000,
  // itens por página na tabela
  porPagina: 15
};
