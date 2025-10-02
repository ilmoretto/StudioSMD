# Guia de Desenvolvimento - OSManager

## 📁 Estrutura de Pastas

### Padrão Adotado
O projeto segue uma estrutura modular e escalável baseada em boas práticas:

```
OSManager/
├── src/              # Código fonte organizado
├── assets/           # Recursos estáticos
├── docs/             # Documentação técnica
└── index.html        # Ponto de entrada
```

## 🔧 Convenções de Código

### JavaScript
- **Classes**: PascalCase (`OSManager`)
- **Funções e variáveis**: camelCase (`saveClient`, `currentUser`)
- **Constantes**: UPPER_SNAKE_CASE (`MAX_PHONE_LENGTH`)
- **Arquivos**: kebab-case (`firebase-config.js`)

### CSS
- **Classes**: kebab-case (`.client-card`, `.form-group`)
- **Variáveis CSS**: kebab-case (`--primary-color`)
- **IDs**: camelCase (`#clientForm`)

### HTML
- **IDs**: camelCase (`id="clientName"`)
- **Classes**: kebab-case (`class="form-group"`)

## 📦 Organização de Arquivos

### `/src/js/`
- `app.js` - Lógica principal da aplicação
- `app-info.js` - Documentação e metadados

### `/src/css/`
- `styles.css` - Estilos principais
- `variables.css` - Variáveis CSS globais
- `styles-backup.css` - Backup para emergências

### `/src/config/`
- `firebase-config.js` - Configuração do Firebase
- `firebase-config.example.js` - Template para configuração

## 🚀 Benefícios da Estrutura

1. **Modularidade**: Cada componente em seu lugar
2. **Manutenibilidade**: Fácil localização e edição
3. **Escalabilidade**: Preparado para crescimento
4. **Colaboração**: Estrutura familiar para desenvolvedores
5. **Deploy**: Otimizado para CI/CD

## 📝 Próximos Passos

Para expandir o projeto, considere:
- Dividir `app.js` em módulos menores
- Criar componentes CSS reutilizáveis
- Implementar sistema de build (Webpack/Vite)
- Adicionar testes automatizados