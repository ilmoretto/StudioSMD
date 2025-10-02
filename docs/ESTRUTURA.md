# Estrutura do Projeto OSManager

```
OSManager/
├── 📁 src/                    # Código fonte
│   ├── 📁 js/                 # Arquivos JavaScript
│   │   └── app.js            # Lógica principal da aplicação
│   ├── 📁 css/               # Arquivos de estilo
│   │   ├── styles.css        # Estilos principais
│   │   └── styles-backup.css # Backup dos estilos
│   └── 📁 config/            # Configurações
│       ├── firebase-config.js        # Configuração do Firebase
│       └── firebase-config.example.js # Exemplo de configuração
├── 📁 assets/                # Recursos estáticos
│   └── 📁 images/            # Imagens do projeto
├── 📁 docs/                  # Documentação
├── 📁 .github/               # Configurações do GitHub
├── index.html                # Página principal
├── README.md                 # Documentação principal
└── .gitignore               # Arquivos ignorados pelo Git
```

## 📋 Descrição das Pastas

### `/src` - Código Fonte
- **`/js`**: Contém toda a lógica JavaScript da aplicação
- **`/css`**: Arquivos de estilo e temas
- **`/config`**: Configurações do Firebase e outras configurações

### `/assets` - Recursos
- **`/images`**: Logos, ícones e imagens utilizadas na aplicação

### `/docs` - Documentação
- Documentação técnica, manuais de setup e deployment

### `/` - Raiz
- `index.html`: Ponto de entrada da aplicação
- `README.md`: Documentação principal do projeto

## 🔄 Benefícios da Nova Estrutura

1. **Separação de Responsabilidades**: Cada tipo de arquivo em sua pasta específica
2. **Facilidade de Manutenção**: Fácil localização e organização dos arquivos
3. **Escalabilidade**: Estrutura preparada para crescimento do projeto
4. **Padrões da Indústria**: Segue convenções amplamente aceitas
5. **Deploy Limpo**: Estrutura organizada facilita CI/CD