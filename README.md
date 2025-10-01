# Gerenciador de Ordens de Serviço - Studio SMD

Sistema de gestão profissional para o Studio SMD || Studio Sonata Música e Dança, desenvolvido para otimizar o controle de clientes e ordens de serviço.

## 📋 Sobre o Projeto

O **Studio SMD Manager** é uma aplicação web moderna que permite gerenciar de forma eficiente todas as operações do Studio Sonata Música e Dança, desde o cadastro de clientes até a criação e controle de ordens de serviço completas.

### Principais Funcionalidades

- **Gestão de Clientes**
  - Cadastro completo com dados pessoais (Nome, CPF, RG, Data de Nascimento)
  - Controle de informações de contato (Email, Endereço completo)
  - Busca e filtros avançados
  - Interface responsiva e intuitiva

- **Ordens de Serviço**
  - Criação de OS com numeração automática
  - Categorização de serviços (Pré-produção, Produção, Pós-produção)
  - Agendamento com profissional responsável
  - Controle financeiro e formas de pagamento
  - Geração de documentos para impressão

- **Autenticação e Segurança**
  - Login seguro com Firebase Authentication
  - Suporte a login com Google
  - Dados protegidos por usuário
  - Sincronização em tempo real

## 🚀 Tecnologias Utilizadas

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Firebase (Firestore Database, Authentication)
- **Hospedagem**: Firebase Hosting / GitHub Pages
- **Design**: Interface moderna com tons de azul profissional

## 📦 Estrutura do Projeto

```
OSManager/
├── index.html              # Página principal da aplicação
├── app.js                  # Lógica principal e integração Firebase
├── styles.css              # Estilos e design responsivo
├── firebase-config.js      # Configurações do Firebase (local)
├── firebase-config.example.js # Exemplo de configuração
└── .github/
    └── workflows/
        └── deploy.yml      # CI/CD para GitHub Pages
```

## ⚙️ Configuração e Instalação

### Pré-requisitos

- Conta no [Firebase Console](https://console.firebase.google.com/)
- Servidor web local (Python, Node.js, ou similar)

### Passos para Configuração

1. **Clone o repositório**
   ```bash
   git clone https://github.com/ilmoretto/StudioSMD.git
   cd StudioSMD
   ```

2. **Configure o Firebase**
   - Crie um novo projeto no Firebase Console
   - Ative Authentication (Email/Password e Google)
   - Ative Firestore Database
   - Copie as credenciais para `firebase-config.js`

3. **Execute localmente**
   ```bash
   # Python
   python -m http.server 8000
   
   # Node.js
   npx http-server
   
   # PHP
   php -S localhost:8000
   ```

4. **Acesse a aplicação**
   - Abra http://localhost:8000 no navegador
   - Crie uma conta ou faça login
   - Comece a gerenciar seus clientes e ordens de serviço

## 🎯 Como Usar

### Primeiro Acesso
1. Acesse a aplicação e crie uma conta
2. Faça login com suas credenciais
3. Cadastre seus primeiros clientes
4. Crie ordens de serviço associadas aos clientes

### Gerenciamento de Clientes
- Use o botão "Novo Cliente" para cadastrar
- Preencha todos os campos obrigatórios
- Use a busca para encontrar clientes rapidamente
- Clique em um cliente para selecioná-lo para uma OS

### Criação de Ordens de Serviço
- Selecione um cliente cadastrado
- Escolha os serviços desejados nas categorias
- Defina datas, valores e forma de pagamento
- Gere a OS para impressão

## 🛡️ Segurança

- Todas as informações são criptografadas pelo Firebase
- Cada usuário acessa apenas seus próprios dados
- Autenticação robusta com suporte a 2FA (Google)
- Backup automático em nuvem

## 🌐 Deploy

O projeto está configurado para deploy automático no GitHub Pages através de GitHub Actions. A cada push na branch main, a aplicação é automaticamente atualizada.

### URL de Produção
- **GitHub Pages**: https://ilmoretto.github.io/StudioSMD/

## 📞 Suporte

Para suporte técnico ou dúvidas sobre o sistema:
- Abra uma [issue no GitHub](https://github.com/ilmoretto/StudioSMD/issues)
- Entre em contato através do repositório

## 📄 Licença

Este projeto é proprietário e destinado ao uso específico do Studio SMD || Studio Sonata Música e Dança.

---

**Studio SMD Manager** - Gestão profissional para Studio Sonata Música e Dança
*Desenvolvido com tecnologias modernas para máxima eficiência e confiabilidade*