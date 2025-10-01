# Configuração do Firebase

## 📋 Passo 1: Criar Projeto no Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Clique em "Adicionar projeto"
3. Nome do projeto: `gerenciador-ordens-servico`
4. Desabilite o Google Analytics (opcional)
5. Clique em "Criar projeto"

## 📋 Passo 2: Configurar Firebase Authentication

1. No menu lateral, clique em "Authentication"
2. Clique em "Começar"
3. Habilite o método de login:
   - **E-mail/senha**: Ative
   - Ou **Google**: Ative (recomendado para facilidade)

## 📋 Passo 3: Configurar Firestore Database

1. No menu lateral, clique em "Firestore Database"
2. Clique em "Criar banco de dados"
3. Escolha "Iniciar no modo de produção"
4. Selecione a localização (escolha `southamerica-east1` - São Paulo)
5. Clique em "Ativar"

## 📋 Passo 4: Configurar Regras de Segurança

No Firestore, vá em "Regras" e cole:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permitir leitura/escrita apenas para usuários autenticados
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 📋 Passo 5: Obter Credenciais

1. Clique no ícone de engrenagem ⚙️ ao lado de "Visão geral do projeto"
2. Selecione "Configurações do projeto"
3. Role até "Seus aplicativos"
4. Clique no ícone `</> Web`
5. Apelido do app: `gerenciador-os-web`
6. NÃO marque "Firebase Hosting"
7. Clique em "Registrar app"
8. Copie as credenciais fornecidas (firebaseConfig)

## 📋 Passo 6: Adicionar Credenciais ao Projeto

Crie o arquivo `firebase-config.js` na raiz do projeto com suas credenciais:

```javascript
// Substitua com suas credenciais do Firebase Console
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJECT_ID.firebaseapp.com",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_PROJECT_ID.appspot.com",
  messagingSenderId: "SEU_MESSAGING_ID",
  appId: "SEU_APP_ID"
};
```

⚠️ **IMPORTANTE:** Adicione `firebase-config.js` ao `.gitignore` para não expor suas credenciais!

## 🔒 Segurança

Nunca commite suas credenciais do Firebase diretamente no repositório público!
Use variáveis de ambiente ou crie um arquivo de exemplo.