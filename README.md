# 🎵 Gerenciador de Ordens de Serviço

Sistema web para gerenciamento de ordens de serviço de estúdio de áudio com integração Firebase.

[![Deploy](https://img.shields.io/badge/deploy-GitHub%20Pages-blue)](https://ilmoretto.github.io/gerenciador-ordens-servico/)
[![Firebase](https://img.shields.io/badge/backend-Firebase-orange)](https://firebase.google.com/)

## 🌐 Demo Online

**Acesse:** [https://ilmoretto.github.io/gerenciador-ordens-servico/](https://ilmoretto.github.io/gerenciador-ordens-servico/)

## 🚀 Funcionalidades

- ✅ **Autenticação de usuários** (E-mail/Senha e Google)
- ✅ **Cadastro de clientes** sincronizado na nuvem
- ✅ **Busca de clientes** em tempo real
- ✅ **Geração de ordens de serviço**
- ✅ **Página de impressão** profissional
- ✅ **Sincronização automática** entre dispositivos
- ✅ **Backup em nuvem** (Firebase Firestore)
- ✅ **Deploy automático** via GitHub Pages

## 🛠️ Tecnologias

- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **Backend:** Firebase Authentication & Firestore
- **Deploy:** GitHub Pages
- **CI/CD:** GitHub Actions

## 📦 Instalação Local

### 1. Clone o repositório
```bash
git clone https://github.com/ilmoretto/gerenciador-ordens-servico.git
cd gerenciador-ordens-servico
```

### 2. Configure o Firebase

#### 2.1. Criar Projeto Firebase
1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Clique em "Adicionar projeto"
3. Nome: `gerenciador-ordens-servico`
4. Clique em "Criar projeto"

#### 2.2. Habilitar Authentication
1. Menu lateral → **Authentication** → "Começar"
2. Ative:
   - ✅ **E-mail/senha**
   - ✅ **Google** (recomendado)

#### 2.3. Criar Firestore Database
1. Menu lateral → **Firestore Database** → "Criar banco de dados"
2. Modo: **Produção**
3. Localização: `southamerica-east1` (São Paulo)

#### 2.4. Configurar Regras de Segurança
No Firestore, aba "Regras", cole:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

#### 2.5. Obter Credenciais
1. ⚙️ Configurações do projeto
2. Role até "Seus aplicativos"
3. Clique em `</>` (Web)
4. Apelido: `gerenciador-os-web`
5. **Copie as credenciais**

#### 2.6. Configurar Domínio Autorizado
No Firebase Console:
1. **Authentication** → **Settings** → **Authorized domains**
2. Adicione: `ilmoretto.github.io`

### 3. Criar arquivo de configuração

```bash
cp firebase-config.example.js firebase-config.js
```

Edite `firebase-config.js` com suas credenciais:

```javascript
const firebaseConfig = {
  apiKey: "SUA_API_KEY_AQUI",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto-id",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

### 4. Testar localmente

```bash
# Python 3
python -m http.server 8000

# Node.js
npx http-server

# PHP
php -S localhost:8000
```

Acesse: `http://localhost:8000`

## 🚢 Deploy no GitHub Pages

### Opção 1: Deploy Automático (Recomendado)

O projeto já está configurado com GitHub Actions. Basta fazer push:

```bash
git add .
git commit -m "Configura Firebase e adiciona workflow"
git push origin main
```

O deploy acontece automaticamente! ✨

### Opção 2: Habilitar Manualmente

1. Vá em **Settings** do repositório
2. Menu lateral → **Pages**
3. **Source:** Deploy from a branch
4. **Branch:** `main` → `/ (root)` → Save

Aguarde alguns minutos e acesse:
```
https://ilmoretto.github.io/gerenciador-ordens-servico/
```

## ⚠️ IMPORTANTE: Configurar Firebase Config para Produção

### Método 1: Usar GitHub Secrets (Mais Seguro)

1. Crie o arquivo `firebase-config.js` diretamente no repositório com suas credenciais
2. **Isso é seguro** porque as credenciais do Firebase podem ser expostas no frontend
3. O Firebase usa regras de segurança no backend para proteger os dados

### Método 2: Criar Branches Separadas (Avançado)

```bash
# Branch de desenvolvimento (com config local)
git checkout -b dev

# Branch main (com config de produção)
git checkout main
```

## 📖 Como Usar

### 1️⃣ Primeiro Acesso
- Acesse a aplicação
- Crie conta ou faça login com Google
- Seus dados ficam salvos na nuvem

### 2️⃣ Cadastrar Cliente
1. Clique em **"➕ Novo Cliente"**
2. Preencha os dados
3. Clique em **"💾 Salvar Cliente"**
4. Cliente sincronizado automaticamente ✅

### 3️⃣ Buscar Cliente
- Use a barra de busca 🔍
- Clique no cliente para selecioná-lo

### 4️⃣ Gerar Ordem de Serviço
1. Selecione um cliente
2. Preencha **Nº da OS** e **Data**
3. Marque os **serviços** (checkboxes)
4. Preencha **agenda**, **valores** e **forma de pagamento**
5. Clique em **"🖨️ Gerar Ordem de Serviço"**
6. **Imprima** (Ctrl+P) ou **Salve como PDF**

## 🔒 Segurança

✅ **Autenticação obrigatória** - Apenas usuários logados acessam  
✅ **Dados isolados** - Cada usuário vê apenas seus dados  
✅ **Regras Firestore** - Proteção no backend  
✅ **HTTPS** - GitHub Pages usa SSL automaticamente  
✅ **Sem API Keys secretas** - Firebase usa regras de segurança  

## 📁 Estrutura do Projeto

```
gerenciador-ordens-servico/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions (deploy automático)
├── index.html                  # Página principal
├── styles.css                  # Estilos da aplicação
├── app.js                      # Lógica JavaScript + Firebase
├── firebase-config.js          # Credenciais Firebase (criar)
├── firebase-config.example.js  # Exemplo de configuração
├── .gitignore                  # Arquivos ignorados
├── FIREBASE_SETUP.md          # Guia de configuração Firebase
└── README.md                   # Esta documentação
```

## 🐛 Troubleshooting

### Erro: "Firebase not defined"
**Solução:** Verifique se o arquivo `firebase-config.js` existe e está configurado corretamente.

### Erro: "Permission denied" no Firestore
**Solução:** Verifique as regras de segurança do Firestore e se o usuário está autenticado.

### Login com Google não funciona
**Solução:** Adicione `ilmoretto.github.io` aos domínios autorizados no Firebase Console.

### Página em branco após deploy
**Solução:** Abra o Console do navegador (F12) e verifique erros. Geralmente é problema de configuração do Firebase.

## 🆕 Próximas Funcionalidades

- [ ] Histórico de ordens de serviço
- [ ] Relatórios financeiros
- [ ] Exportação para PDF automática
- [ ] Envio de OS por e-mail
- [ ] Agendamento de serviços com calendário
- [ ] Dashboard com métricas
- [ ] Modo offline (PWA)
- [ ] Temas claro/escuro

## 🤝 Contribuindo

Contribuições são bem-vindas! Para contribuir:

1. Fork este repositório
2. Crie uma branch: `git checkout -b feature/nova-funcionalidade`
3. Commit suas mudanças: `git commit -m 'Adiciona nova funcionalidade'`
4. Push para a branch: `git push origin feature/nova-funcionalidade`
5. Abra um Pull Request

## 📝 Licença

MIT License - veja [LICENSE](LICENSE) para detalhes.

## 👤 Autor

**ilmoretto**
- GitHub: [@ilmoretto](https://github.com/ilmoretto)
- Projeto: [gerenciador-ordens-servico](https://github.com/ilmoretto/gerenciador-ordens-servico)

## 🌟 Apoie o Projeto

Se este projeto foi útil para você, considere dar uma ⭐ no repositório!

---

**Desenvolvido com ❤️ para estúdios de áudio**