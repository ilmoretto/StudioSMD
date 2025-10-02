// Configuração Firebase (produção)
// Observação: para produção real, o ideal é carregar isso via variáveis de ambiente ou arquivo separado
// e restrições de domínio na console do Firebase.

const firebaseConfig = {
  apiKey: "AIzaSyBybt5MZbpR_1VIUBkaEV792ovgg5OAq5k",
  authDomain: "studio-osmanager.firebaseapp.com",
  projectId: "studio-osmanager",
  storageBucket: "studio-osmanager.firebasestorage.app",
  messagingSenderId: "744261949235",
  appId: "1:744261949235:web:942f98d9b52c43e9c41046"
};

// Validação simples de domínio
(function() {
  const currentDomain = window.location.hostname;
  const allowed = [
    'sonatoads.github.io', // GitHub Pages
    'ilmoretto.github.io',
    'localhost', '127.0.0.1'
  ];
  if (!allowed.includes(currentDomain)) {
    console.warn('Domínio não incluído na lista permitida para Firebase Auth:', currentDomain);
  }
})();

window.firebaseConfig = firebaseConfig;
