@echo off
echo 🔄 Sincronizando homologação com projeto principal...
echo.

copy index.html homolog\index-homolog.html
copy src\js\app.js homolog\app-homolog.js
copy src\css\styles.css homolog\styles-homolog.css
copy src\config\firebase-config.js homolog\firebase-config-homolog.js

echo.
echo ✅ Arquivos sincronizados!
echo.
echo 📝 Próximos passos:
echo 1. Edite os arquivos *-homolog.* conforme necessário
echo 2. Teste em: http://localhost:8000/homolog/index-homolog.html
echo 3. Após aprovação, copie mudanças de volta para produção
echo.
pause