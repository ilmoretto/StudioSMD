# 🚀 Guia de Deploy - GitHub Pages

## Passo a Passo Completo

### 1️⃣ Preparar o Repositório

```bash
# Se ainda não criou o repositório, crie agora:
# Vá em: https://github.com/new

# Clone o repositório (se já criou)
git clone https://github.com/ilmoretto/gerenciador-ordens-servico.git
cd gerenciador-ordens-servico
```

### 2️⃣ Adicionar os Arquivos

Crie todos os arquivos do projeto:

1. ✅ `index.html`
2. ✅ `styles.css`
3. ✅ `app.js`
4. ✅ `firebase-config.example.js`
5. ✅ `firebase-config.js` (com suas credenciais)
6. ✅ `.gitignore`
7. ✅ `README.md`
8. ✅ `FIREBASE_SETUP.md`
9. ✅ `.github/workflows/deploy.yml`

### 3️⃣ Configurar Firebase

Siga o arquivo [FIREBASE_SETUP.md](FIREBASE_SETUP.md) para:

1. ✅ Criar projeto no Firebase
2. ✅ Habilitar Authentication (E-mail e Google)
3. ✅ Criar Firestore Database
4. ✅ Configurar regras de segurança
5. ✅ **IMPORTANTE:** Adicionar domínio autorizado:
   - Firebase Console → Authentication → Settings → Authorized domains
   - Adicione: `ilmoretto.github.io`

### 4️⃣ Criar Arquivo de Configuração

```bash
# Copie o exemplo
cp firebase-config.example.js firebase-config.js

# Edite com suas credenciais (use seu editor favorito)
nano firebase-config.js
# ou
code firebase-config.js
```

Cole suas credenciais do Firebase:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",              // Sua API Key
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto-id",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### 5️⃣ Commit e Push

```bash
# Adicionar todos os arquivos
git add .

# Commit
git commit -m "Initial commit: Sistema gerenciador de OS com Firebase"

# Push para GitHub
git push origin main
```

### 6️⃣ Habilitar GitHub Pages

#### Opção A: Via Interface do GitHub (Recomendado)

1. Vá para: `https://github.com/ilmoretto/gerenciador-ordens-servico`
2. Clique em **Settings** (⚙️)
3. Menu lateral → **Pages**
4. Em **Build and deployment:**
   - **Source:** GitHub Actions
5. O workflow `.github/workflows/deploy.yml` será detectado automaticamente
6. Aguarde o deploy (aba **Actions** para acompanhar)

#### Opção B: Via Configuração Manual

1. **Settings** → **Pages**
2. **Source:** Deploy from a branch
3. **Branch:** `main` → `/ (root)` → **Save**

### 7️⃣ Verificar Deploy

```bash
# Ver status do workflow
# Vá em: https://github.com/ilmoretto/gerenciador-ordens-servico/actions

# Quando o workflow terminar (✅), acesse:
# https://ilmoretto.github.io/gerenciador-ordens-servico/
```

### 8️⃣ Testar a Aplicação

1. ✅ Acesse a URL do GitHub Pages
2. ✅ Crie uma conta ou faça login com Google
3. ✅ Cadastre um cliente de teste
4. ✅ Gere uma ordem de serviço
5. ✅ Teste a impressão

## 🔄 Fazer Atualizações

Sempre que quiser atualizar o site:

```bash
# Faça suas alterações nos arquivos
# Exemplo: editar app.js, styles.css, etc.

# Commit
git add .
git commit -m "Descrição da mudança"

# Push
git push origin main

# O deploy automático acontece em ~2 minutos
```

## ⚡ Deploy Rápido (Resumo)

```bash
# 1. Criar arquivos do projeto
# 2. Configurar Firebase
# 3. Criar firebase-config.js

# 4. Git
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/ilmoretto/gerenciador-ordens-servico.git
git push -u origin main

# 5. GitHub: Settings → Pages → Source: GitHub Actions
# 6. Aguardar deploy (2-3 min)
# 7. Acessar: https://ilmoretto.github.io/gerenciador-ordens-servico/
```

## 🎯 Checklist Completo

### Antes do Deploy
- [ ] Todos os arquivos criados
- [ ] Projeto Firebase configurado
- [ ] Authentication habilitado (E-mail + Google)
- [ ] Firestore Database criado
- [ ] Regras de segurança configuradas
- [ ] Domínio `ilmoretto.github.io` autorizado no Firebase
- [ ] `firebase-config.js` criado com credenciais corretas

### Deploy
- [ ] Repositório criado no GitHub
- [ ] Arquivos commitados e pushed
- [ ] GitHub Pages habilitado
- [ ] Workflow executado com sucesso
- [ ] Site acessível na URL do GitHub Pages

### Teste Final
- [ ] Login funciona
- [ ] Google Sign-In funciona
- [ ] Cadastro de cliente funciona
- [ ] Busca de clientes funciona
- [ ] Geração de OS funciona
- [ ] Impressão funciona
- [ ] Dados sincronizam no Firestore

## 🐛 Problemas Comuns

### "Firebase is not defined"
**Causa:** Arquivo `firebase-config.js` não encontrado  
**Solução:** Certifique-se de criar o arquivo e fazer commit

### "auth/unauthorized-domain"
**Causa:** Domínio não autorizado no Firebase  
**Solução:** Adicione `ilmoretto.github.io` em Authentication → Settings → Authorized domains

### Página 404
**Causa:** GitHub Pages não habilitado ou deploy falhou  
**Solução:** Verifique Settings → Pages e a aba Actions

### Mudanças não aparecem
**Causa:** Cache do navegador  
**Solução:** Ctrl+Shift+R (hard refresh) ou limpe o cache

## 📞 Suporte

Se tiver problemas:
1. Verifique a aba **Actions** no GitHub para logs
2. Abra o Console do navegador (F12) para erros
3. Verifique o Firebase Console para problemas de configuração

## 🎉 Pronto!

Seu sistema está no ar e acessível em:
**https://ilmoretto.github.io/gerenciador-ordens-servico/**

Compartilhe o link com sua equipe! 🚀