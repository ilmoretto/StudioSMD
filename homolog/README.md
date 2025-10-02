# 🧪 Ambiente de Homologação Local

## ✅ Status: Sincronizado com Produção

A pasta de homologação agora está sincronizada com o projeto principal e pronta para desenvolvimento de novas funcionalidades.

### 📁 Arquivos Sincronizados
- `index-homolog.html` ← `index.html`
- `app-homolog.js` ← `src/js/app.js`
- `styles-homolog.css` ← `src/css/styles.css`
- `firebase-config-homolog.js` ← `src/config/firebase-config.js`

### 🔄 Como Usar

**1. Sincronizar com produção:**
```bash
.\sync-homolog.bat
```

**2. Desenvolver funcionalidades:**
- Edite os arquivos `*-homolog.*`
- Teste localmente: `http://localhost:8000/homolog/index-homolog.html`

**3. Aplicar para produção:**
```bash
copy homolog\index-homolog.html index.html
copy homolog\app-homolog.js src\js\app.js
copy homolog\styles-homolog.css src\css\styles.css
# (firebase-config normalmente não precisa copiar)
```

### 🎯 Ambiente Identificado
- Banner amarelo indica ambiente de homologação
- Console mostra mensagens específicas de teste
- Título da página indica "HOMOLOGAÇÃO"

### 🚀 Servidor Local
```bash
python -m http.server 8000
```

**Produção**: http://localhost:8000/
**Homologação**: http://localhost:8000/homolog/index-homolog.html