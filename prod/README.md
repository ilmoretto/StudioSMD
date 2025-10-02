# OSManager - Produção

Esta pasta contém a versão de produção com estrutura separada por responsabilidade (HTML/CSS/JS/Config).

Estrutura:
- index.html: página principal
- css/styles.css: estilos do app (pode conviver com Bootstrap via CDN)
- js/app.js: lógica principal do app (Firebase Auth/Firestore, clientes, OS, impressão)
- config/firebase-config.js: configuração do Firebase para produção

Publicação (GitHub Pages):
O workflow `.github/workflows/deploy.yml` foi ajustado para publicar a pasta `prod/`.

Desenvolvimento local:
- Abra um servidor estático apontando para `prod/` e acesse http://localhost:PORT

Boas práticas aplicadas:
- Separação clara de camadas (HTML/CSS/JS)
- Políticas de senha forte e logs de segurança locais
- Impressão de OS com layout limpo
- Regras de domínio para Firebase em `config/firebase-config.js` (complemente no console do Firebase)
