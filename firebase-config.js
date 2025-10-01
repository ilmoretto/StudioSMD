// Firebase Configuration for OSManager
// Configuração do Firebase para o Gerenciador de OS

const firebaseConfig = {
  apiKey: "AIzaSyBybt5MZbpR_1VIUBkaEV792ovgg5OAq5k",
  authDomain: "studio-osmanager.firebaseapp.com",
  projectId: "studio-osmanager",
  storageBucket: "studio-osmanager.firebasestorage.app",
  messagingSenderId: "744261949235",
  appId: "1:744261949235:web:942f98d9b52c43e9c41046"
};

// Verificar domínio autorizado
const currentDomain = window.location.hostname;
const authorizedDomains = [
  'localhost',
  '127.0.0.1',
  'studio-osmanager.firebaseapp.com',
  'ilmoretto.github.io'
];

console.log('🌐 Domínio atual:', currentDomain);
console.log('🔒 Domínios autorizados:', authorizedDomains);

if (!authorizedDomains.includes(currentDomain)) {
  console.warn('⚠️ Domínio não autorizado:', currentDomain);
  console.log('💡 Adicione este domínio no Firebase Console > Authentication > Settings > Authorized domains');
}

// Disponibilizar globalmente para o app.js
window.firebaseConfig = firebaseConfig;