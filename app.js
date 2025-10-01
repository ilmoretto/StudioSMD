// Inicializar Firebase
let app, auth, db;

// Verificar se o Firebase SDK foi carregado
if (typeof firebase === 'undefined') {
    console.error('❌ Firebase SDK não foi carregado');
    alert('Erro: Firebase SDK não encontrado. Verifique a conexão com a internet.');
} else if (typeof firebaseConfig === 'undefined') {
    console.error('❌ Configuração do Firebase não encontrada');
    alert('Erro: Configuração do Firebase não encontrada. Verifique o arquivo firebase-config.js');
} else {
    try {
        // Verificar se já foi inicializado
        if (firebase.apps.length === 0) {
            app = firebase.initializeApp(firebaseConfig);
        } else {
            app = firebase.app();
        }
        
        auth = firebase.auth();
        db = firebase.firestore();
        
        console.log('✅ Firebase inicializado com sucesso');
        console.log('🔑 Projeto:', firebaseConfig.projectId);
        
        // Testar conexão
        auth.onAuthStateChanged(() => {
            console.log('🔐 Auth listener ativo');
        });
        
    } catch (error) {
        console.error('❌ Erro ao inicializar Firebase:', error);
        alert(`Erro ao conectar com o Firebase: ${error.message}`);
    }
}

// Gerenciador de Ordens de Serviço com Firebase
class ServiceOrderManager {
    constructor() {
        this.currentUser = null;
        this.selectedClient = null;
        this.clients = [];
        this.orders = [];
        this.unsubscribeClients = null;
        this.unsubscribeOrders = null;
        this.init();
    }

    init() {
        this.setupAuthListener();
        this.setupEventListeners();
        this.setDefaultDate();
        this.generateNextOrderNumber();
    }

    // === AUTENTICAÇÃO ===
    
    setupAuthListener() {
        auth.onAuthStateChanged((user) => {
            console.log('🔐 Estado de autenticação mudou:', user ? 'Logado' : 'Deslogado');
            if (user) {
                this.currentUser = user;
                console.log('👤 Usuário logado:', user.email);
                this.showApp();
                this.loadClientsRealtime();
                this.loadOrdersRealtime();
                this.generateNextOrderNumber();
            } else {
                this.currentUser = null;
                console.log('🚪 Usuário deslogado');
                this.showLogin();
            }
        });
    }

    showLogin() {
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('appScreen').classList.add('hidden');
    }

    showApp() {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('appScreen').classList.remove('hidden');
        
        if (this.currentUser) {
            document.getElementById('userName').textContent = this.currentUser.displayName || this.currentUser.email;
        }
        
        // Teste de conectividade com Firestore
        this.testFirestoreConnection();
    }

    async testFirestoreConnection() {
        try {
            console.log('🔍 Testando conectividade com Firestore...');
            const testRef = db.collection('users').doc(this.currentUser.uid);
            await testRef.get();
            console.log('✅ Firestore conectado com sucesso');
        } catch (error) {
            console.error('❌ Erro de conectividade com Firestore:', error);
            this.showNotification('Erro de conexão com o banco de dados', 'error');
        }
    }

    setupEventListeners() {
        // === AUTH EVENTS ===
        document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('registerFormSubmit').addEventListener('submit', (e) => this.handleRegister(e));
        document.getElementById('btnGoogleLogin').addEventListener('click', () => this.handleGoogleLogin());
        document.getElementById('btnLogout').addEventListener('click', () => this.handleLogout());
        
        document.getElementById('showRegister').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('loginForm').parentElement.classList.add('hidden');
            document.getElementById('registerForm').classList.remove('hidden');
        });
        
        document.getElementById('showLogin').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('registerForm').classList.add('hidden');
            document.getElementById('loginForm').parentElement.classList.remove('hidden');
        });

        // === CLIENT EVENTS ===
        document.getElementById('btnNovoCliente').addEventListener('click', () => this.showClientForm());
        document.getElementById('btnCancelar').addEventListener('click', () => this.hideClientForm());
        document.getElementById('formCliente').addEventListener('submit', (e) => this.saveClient(e));
        document.getElementById('searchClient').addEventListener('input', (e) => this.searchClients(e.target.value));
        
        // Formatação de telefone
        document.getElementById('clientPhone').addEventListener('input', (e) => this.formatPhone(e));
        
        // === OS EVENTS ===
        document.getElementById('btnGerarOS').addEventListener('click', () => this.generateServiceOrder());
        document.getElementById('totalValue').addEventListener('input', (e) => this.formatCurrency(e));
    }

    async handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            await auth.signInWithEmailAndPassword(email, password);
            this.showNotification('Login realizado com sucesso!', 'success');
        } catch (error) {
            console.error('Erro no login:', error);
            this.showNotification(this.getErrorMessage(error.code), 'error');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;

        try {
            const result = await auth.createUserWithEmailAndPassword(email, password);
            await result.user.updateProfile({ displayName: name });
            this.showNotification('Conta criada com sucesso!', 'success');
        } catch (error) {
            console.error('Erro no registro:', error);
            this.showNotification(this.getErrorMessage(error.code), 'error');
        }
    }

    async handleGoogleLogin() {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });

        try {
            await auth.signInWithPopup(provider);
            this.showNotification('Login com Google realizado!', 'success');
        } catch (error) {
            console.error('Erro no login com Google:', error);
            this.showNotification(this.getErrorMessage(error.code), 'error');
        }
    }

    async handleLogout() {
        try {
            if (this.unsubscribeClients) {
                this.unsubscribeClients();
            }
            await auth.signOut();
            this.showNotification('Logout realizado com sucesso!', 'success');
        } catch (error) {
            console.error('Erro no logout:', error);
            this.showNotification('Erro ao fazer logout', 'error');
        }
    }

    getErrorMessage(code) {
        const messages = {
            'auth/user-not-found': 'Usuário não encontrado',
            'auth/wrong-password': 'Senha incorreta',
            'auth/email-already-in-use': 'E-mail já cadastrado',
            'auth/weak-password': 'Senha muito fraca (mínimo 6 caracteres)',
            'auth/invalid-email': 'E-mail inválido',
            'auth/popup-closed-by-user': 'Login cancelado',
        };
        return messages[code] || 'Erro ao processar solicitação';
    }

    // === GERENCIAMENTO DE CLIENTES (FIREBASE) ===

    loadClientsRealtime() {
        if (!this.currentUser) {
            console.warn('⚠️ Tentativa de carregar clientes sem usuário logado');
            return;
        }

        console.log('📂 Carregando clientes em tempo real...');
        const clientsRef = db.collection('users').doc(this.currentUser.uid).collection('clients');
        
        this.unsubscribeClients = clientsRef.orderBy('name').onSnapshot((snapshot) => {
            console.log('📊 Snapshot de clientes recebido:', snapshot.size, 'documentos');
            this.clients = [];
            snapshot.forEach((doc) => {
                this.clients.push({ id: doc.id, ...doc.data() });
            });
            console.log('👥 Clientes carregados:', this.clients.length);
            this.renderClients();
        }, (error) => {
            console.error('❌ Erro ao carregar clientes:', error);
            this.showNotification('Erro ao carregar clientes', 'error');
        });
    }

    loadOrdersRealtime() {
        if (!this.currentUser) return;

        const ordersRef = db.collection('users').doc(this.currentUser.uid).collection('orders');
        
        this.unsubscribeOrders = ordersRef.orderBy('createdAt', 'desc').onSnapshot((snapshot) => {
            this.orders = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            this.renderOrders();
        });
    }

    async generateNextOrderNumber() {
        if (!this.currentUser) return;

        try {
            const currentYear = new Date().getFullYear();
            const ordersRef = db.collection('users').doc(this.currentUser.uid).collection('orders');
            
            // Buscar a última OS do ano atual
            const snapshot = await ordersRef
                .where('year', '==', currentYear)
                .orderBy('orderNumber', 'desc')
                .limit(1)
                .get();
            
            let nextNumber = 1;
            if (!snapshot.empty) {
                const lastOrder = snapshot.docs[0].data();
                nextNumber = (lastOrder.orderNumber || 0) + 1;
            }
            
            const osNumber = `${String(nextNumber).padStart(3, '0')}/${currentYear}`;
            document.getElementById('osNumber').value = osNumber;
        } catch (error) {
            console.error('Erro ao gerar número da OS:', error);
            const currentYear = new Date().getFullYear();
            document.getElementById('osNumber').value = `001/${currentYear}`;
        }
    }

    async saveClient(e) {
        e.preventDefault();
        
        console.log('🔄 Tentando salvar cliente...');
        
        if (!this.currentUser) {
            console.error('❌ Usuário não logado');
            this.showNotification('Você precisa estar logado', 'error');
            return;
        }

        if (!db) {
            console.error('❌ Firestore não inicializado');
            this.showNotification('Erro: Banco de dados não conectado', 'error');
            return;
        }

        // Capturar e validar dados do formulário
        const name = document.getElementById('clientName').value.trim();
        const phone = document.getElementById('clientPhone').value.trim();
        const birthDate = document.getElementById('clientBirthDate').value;
        const rg = document.getElementById('clientRG').value.trim();
        const cpf = document.getElementById('clientCPF').value.trim();
        const email = document.getElementById('clientEmail').value.trim();
        const address = document.getElementById('clientAddress').value.trim();

        // Validar campos obrigatórios
        if (!name) {
            this.showNotification('Nome é obrigatório', 'error');
            return;
        }
        if (!birthDate) {
            this.showNotification('Data de nascimento é obrigatória', 'error');
            return;
        }
        if (!rg) {
            this.showNotification('RG é obrigatório', 'error');
            return;
        }
        if (!cpf) {
            this.showNotification('CPF é obrigatório', 'error');
            return;
        }
        if (!email) {
            this.showNotification('E-mail é obrigatório', 'error');
            return;
        }
        if (!address) {
            this.showNotification('Endereço é obrigatório', 'error');
            return;
        }

        // Limitar tamanho dos campos para evitar problemas
        const client = {
            name: name.substring(0, 100),
            phone: phone.replace(/\D/g, '').substring(0, 11), // Apenas números, max 11 dígitos
            birthDate: birthDate,
            rg: rg.substring(0, 20),
            cpf: cpf.replace(/\D/g, '').substring(0, 11), // Apenas números
            email: email.substring(0, 100),
            address: address.substring(0, 200),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        console.log('📄 Dados do cliente:', client);

        try {
            const clientsRef = db.collection('users').doc(this.currentUser.uid).collection('clients');
            console.log('📁 Referência da coleção criada');
            
            const docRef = await clientsRef.add(client);
            console.log('✅ Cliente salvo com ID:', docRef.id);
            
            this.hideClientForm();
            this.selectClient({ id: docRef.id, ...client });
            this.showNotification('Cliente cadastrado com sucesso!', 'success');
        } catch (error) {
            console.error('❌ Erro ao salvar cliente:', error);
            this.showNotification(`Erro ao cadastrar cliente: ${error.message}`, 'error');
        }
    }

    showClientForm() {
        document.getElementById('clientForm').classList.remove('hidden');
        document.getElementById('formCliente').reset();
    }

    hideClientForm() {
        document.getElementById('clientForm').classList.add('hidden');
        document.getElementById('formCliente').reset();
    }

    searchClients(query) {
        const filtered = this.clients.filter(client => 
            client.name.toLowerCase().includes(query.toLowerCase())
        );
        this.renderClients(filtered);
    }

    renderClients(clientsToRender = this.clients) {
        const container = document.getElementById('clientList');
        
        if (clientsToRender.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #718096; padding: 20px;">Nenhum cliente encontrado.</p>';
            return;
        }

        container.innerHTML = clientsToRender.map(client => `
            <div class="client-card ${this.selectedClient?.id === client.id ? 'selected' : ''}" 
                 data-id="${client.id}">
                <div class="client-name">${client.name}</div>
                <div class="client-info">
                    <div>Telefone: ${this.formatPhoneDisplay(client.phone)}</div>
                    <div>CPF: ${client.cpf || 'Não informado'}</div>
                    <div>Email: ${client.email || 'Não informado'}</div>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('.client-card').forEach(item => {
            item.addEventListener('click', () => {
                const clientId = item.dataset.id;
                const client = this.clients.find(c => c.id === clientId);
                this.selectClient(client);
            });
        });
    }

    selectClient(client) {
        this.selectedClient = client;
        this.renderClients();
        this.updateSelectedClientDisplay();
    }

    updateSelectedClientDisplay() {
        const container = document.getElementById('selectedClient');
        
        if (!this.selectedClient) {
            container.innerHTML = `
                <h3>Cliente Selecionado</h3>
                <p>Nenhum cliente selecionado. Cadastre ou selecione um cliente acima.</p>
            `;
            container.classList.add('empty');
            return;
        }

        container.classList.remove('empty');
        const birthDate = this.selectedClient.birthDate ? new Date(this.selectedClient.birthDate).toLocaleDateString('pt-BR') : 'Não informado';
        
        container.innerHTML = `
            <h3>Cliente Selecionado</h3>
            <div class="client-details">
                <p><strong>Nome:</strong> ${this.selectedClient.name}</p>
                <p><strong>Telefone:</strong> ${this.formatPhoneDisplay(this.selectedClient.phone)}</p>
                <p><strong>Data de Nascimento:</strong> ${birthDate}</p>
                <p><strong>RG:</strong> ${this.selectedClient.rg || 'Não informado'}</p>
                <p><strong>CPF:</strong> ${this.selectedClient.cpf || 'Não informado'}</p>
                <p><strong>E-mail:</strong> ${this.selectedClient.email || 'Não informado'}</p>
                <p><strong>Endereço:</strong> ${this.selectedClient.address || 'Não informado'}</p>
            </div>
        `;
    }

    // === ORDEM DE SERVIÇO ===

    setDefaultDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('osDate').value = today;
    }

    formatCurrency(e) {
        let value = e.target.value.replace(/\D/g, '');
        value = (parseInt(value) / 100).toFixed(2);
        e.target.value = 'R$ ' + value.replace('.', ',');
    }

    formatPhone(e) {
        let value = e.target.value.replace(/\D/g, '');
        
        // Limitar a 11 dígitos
        if (value.length > 11) {
            value = value.substring(0, 11);
        }
        
        // Aplicar formatação
        if (value.length <= 2) {
            value = value.replace(/(\d{0,2})/, '($1');
        } else if (value.length <= 7) {
            value = value.replace(/(\d{2})(\d{0,5})/, '($1) $2');
        } else {
            value = value.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
        }
        
        e.target.value = value;
    }

    formatPhoneDisplay(phone) {
        if (!phone) return 'Não informado';
        
        // Remove todos os caracteres não numéricos
        const cleaned = phone.replace(/\D/g, '');
        
        // Formatar conforme o tamanho
        if (cleaned.length === 10) {
            return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
        } else if (cleaned.length === 11) {
            return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        } else if (cleaned.length > 0) {
            return `(${cleaned.substring(0,2)}) ${cleaned.substring(2)}`;
        } else {
            return 'Não informado';
        }
    }

    getSelectedServices() {
        const checkboxes = document.querySelectorAll('input[name="service"]:checked');
        const services = Array.from(checkboxes).map(cb => cb.value);
        
        const outro = document.getElementById('outroServico').value;
        if (outro) {
            services.push(`Outro: ${outro}`);
        }
        
        return services;
    }

    getPaymentMethods() {
        const checkboxes = document.querySelectorAll('input[name="payment"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    getEstimatedTime() {
        const radio = document.querySelector('input[name="estimatedTime"]:checked');
        return radio ? radio.value : '';
    }

    async generateServiceOrder() {
        if (!this.selectedClient) {
            this.showNotification('Selecione um cliente antes de gerar a ordem de serviço', 'error');
            return;
        }

        const osNumber = document.getElementById('osNumber').value;
        if (!osNumber) {
            this.showNotification('Preencha o número da OS', 'error');
            return;
        }

        // Extrair número da OS e ano para o auto-incremento
        const [numberPart, yearPart] = osNumber.split('/');
        const orderNumber = parseInt(numberPart);
        const year = parseInt(yearPart);

        const orderData = {
            number: osNumber,
            orderNumber: orderNumber,
            year: year,
            date: this.formatDate(document.getElementById('osDate').value),
            client: this.selectedClient,
            services: this.getSelectedServices(),
            description: document.getElementById('serviceDescription').value,
            executionDate: this.formatDate(document.getElementById('execDate').value),
            executionTime: document.getElementById('execTime').value,
            estimatedTime: this.getEstimatedTime(),
            technicalResponsible: 'Tassio Pires de Oliveira',
            totalValue: document.getElementById('totalValue').value,
            paymentMethods: this.getPaymentMethods(),
            paymentDate: this.formatDate(document.getElementById('paymentDate').value),
            status: 'pending'
        };

        try {
            // Salvar OS no Firebase
            await this.saveOrderToFirebase(orderData);
            
            // Abrir página de impressão
            this.openPrintPage(orderData);
            
            // Limpar campos e gerar próximo número
            this.clearOrderForm();
            await this.generateNextOrderNumber();
            
            this.showNotification('Ordem de serviço gerada com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao gerar OS:', error);
            this.showNotification('Erro ao gerar ordem de serviço', 'error');
        }
    }

    async saveOrderToFirebase(orderData) {
        if (!this.currentUser) return;

        const ordersRef = db.collection('users').doc(this.currentUser.uid).collection('orders');
        await ordersRef.add({
            ...orderData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    clearOrderForm() {
        // Limpar apenas os campos que devem ser resetados
        document.getElementById('serviceDescription').value = '';
        document.getElementById('execDate').value = '';
        document.getElementById('execTime').value = '';
        document.getElementById('totalValue').value = '';
        document.getElementById('paymentDate').value = '';
        document.getElementById('outroServico').value = '';
        
        // Desmarcar serviços
        document.querySelectorAll('input[name="service"]:checked').forEach(cb => cb.checked = false);
        document.querySelectorAll('input[name="estimatedTime"]:checked').forEach(rb => rb.checked = false);
        document.querySelectorAll('input[name="payment"]:checked').forEach(cb => cb.checked = false);
        
        // Manter cliente selecionado e data atual
    }

    formatDate(dateString) {
        if (!dateString) return '';
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    }

    openPrintPage(data) {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(this.generatePrintHTML(data));
        printWindow.document.close();
        
        setTimeout(() => {
            printWindow.print();
        }, 500);
    }

    generatePrintHTML(data) {
        const servicesHTML = data.services.length > 0 
            ? data.services.map(s => `<li>${s}</li>`).join('') 
            : '<li>Nenhum serviço selecionado</li>';

        const paymentHTML = data.paymentMethods.length > 0
            ? data.paymentMethods.join(', ')
            : 'Não informado';

        // Data atual para assinatura
        const today = new Date();
        const signatureDate = today.toLocaleDateString('pt-BR');

        return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Ordem de Serviço #${data.number}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 40px; font-size: 12pt; line-height: 1.6; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1e3a8a; padding-bottom: 20px; }
        .header h1 { font-size: 24pt; margin-bottom: 10px; color: #1e3a8a; }
        .header .studio-info { font-size: 11pt; color: #555; margin-bottom: 5px; }
        .header .contact-info { font-size: 10pt; color: #666; }
        .os-info { display: flex; justify-content: space-between; margin-bottom: 20px; font-weight: bold; }
        .section { margin-bottom: 25px; border: 1px solid #ccc; padding: 15px; }
        .section h2 { font-size: 14pt; margin-bottom: 15px; color: #1e3a8a; border-bottom: 2px solid #3b82f6; padding-bottom: 5px; }
        .client-info p { margin: 8px 0; }
        .services-list { columns: 2; column-gap: 20px; }
        .services-list li { margin-bottom: 8px; break-inside: avoid; }
        .description { background: #f8fafc; padding: 10px; margin: 10px 0; min-height: 60px; border-left: 4px solid #3b82f6; }
        .info-row { display: flex; justify-content: space-between; margin: 10px 0; }
        .info-item { flex: 1; margin-right: 15px; }
        .observations { background: #fef3c7; padding: 15px; margin: 20px 0; border-left: 4px solid #f59e0b; }
        .observations h3 { margin-bottom: 10px; color: #92400e; }
        .observations ul { margin-left: 20px; }
        .observations li { margin: 8px 0; }
        .signatures { display: flex; justify-content: space-between; margin-top: 50px; padding-top: 20px; }
        .signature-box { text-align: center; flex: 1; margin: 0 20px; }
        .signature-line { border-top: 2px solid #000; margin-bottom: 8px; padding-top: 5px; }
        .signature-date { margin-top: 20px; text-align: center; font-size: 11pt; color: #666; }
        .print-button { position: fixed; top: 20px; right: 20px; padding: 15px 30px; background: #1e3a8a; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14pt; font-weight: bold; }
        @media print { .print-button { display: none; } body { padding: 20px; } }
    </style>
</head>
<body>
    <button class="print-button" onclick="window.print()">Imprimir</button>
    <div class="header">
        <h1>ORDEM DE SERVIÇO</h1>
        <div class="studio-info">
            <strong>Studio SMD || Studio Sonata Música e Dança</strong>
        </div>
        <div class="contact-info">
            Praça da Liberdade, 104 - União - Ouro Preto do Oeste - RO - 76.920-000<br>
            linktr.ee/sonata_md - E-mail: conservatorio86@gmail.com<br>
            Fone: (69) 99224-6426
        </div>
    </div>
    <div class="os-info">
        <div>Nº: <span>${data.number}</span></div>
        <div>Data: <span>${data.date}</span></div>
    </div>
    <div class="section">
        <h2>Dados do Cliente</h2>
        <div class="client-info">
            <p><strong>Nome Completo:</strong> ${data.client.name}</p>
            <p><strong>Telefone:</strong> ${this.formatPhoneDisplay(data.client.phone)}</p>
            <p><strong>CPF:</strong> ${data.client.cpf || 'Não informado'}</p>
            <p><strong>RG:</strong> ${data.client.rg || 'Não informado'}</p>
            <p><strong>E-mail:</strong> ${data.client.email || 'Não informado'}</p>
            <p><strong>Endereço:</strong> ${data.client.address || 'Não informado'}</p>
        </div>
    </div>
    <div class="section">
        <h2>Detalhamento do Serviço</h2>
        <ul class="services-list">${servicesHTML}</ul>
    </div>
    <div class="section">
        <h2>Descrição Detalhada</h2>
        <div class="description">${data.description || 'Nenhuma descrição fornecida.'}</div>
    </div>
    <div class="section">
        <h2>Agenda e Profissional Responsável</h2>
        <div class="info-row">
            <div class="info-item"><strong>Data:</strong> ${data.executionDate || 'Não informada'}</div>
            <div class="info-item"><strong>Horário:</strong> ${data.executionTime || 'Não informado'}</div>
        </div>
        <p><strong>Tempo Estimado:</strong> ${data.estimatedTime || 'Não informado'}</p>
    </div>
    <div class="section">
        <h2>Condições e Valores</h2>
        <p><strong>Valor Total:</strong> ${data.totalValue || 'R$ 0,00'}</p>
        <p><strong>Forma de Pagamento:</strong> ${paymentHTML}</p>
        <p><strong>Pagamento Efetuado em:</strong> ${data.paymentDate || 'Não informado'}</p>
    </div>
    <div class="observations">
        <h3>OBSERVAÇÕES IMPORTANTES</h3>
        <ul>
            <li>A ausência do cliente sem aviso prévio de 24h implica em perda do valor pago.</li>
            <li>Atrasos superiores a 10 minutos não gerarão compensação de tempo.</li>
            <li>Alterações adicionais, regravações ou edições fora do previsto serão cobradas à parte.</li>
            <li>É vedada a manipulação de equipamentos sem autorização técnica.</li>
        </ul>
    </div>
    <div class="signatures">
        <div class="signature-box">
            <div class="signature-line">Contratante</div>
            <p>${data.client.name}</p>
        </div>
        <div class="signature-box">
            <div class="signature-line">Responsável Técnico</div>
            <p>Tassio Pires de Oliveira</p>
        </div>
    </div>
    <div class="signature-date">
        <p>Ouro Preto do Oeste - RO, ${signatureDate}</p>
    </div>
</body>
</html>`;
    }

    renderOrders() {
        const container = document.getElementById('osList');
        
        if (this.orders.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #718096; padding: 20px;">Nenhuma ordem de serviço encontrada.</p>';
            return;
        }

        container.innerHTML = this.orders.map(order => {
            const statusClass = order.status === 'completed' ? 'status-completed' : 
                               order.status === 'progress' ? 'status-progress' : 'status-pending';
            
            const statusText = order.status === 'completed' ? 'Concluída' : 
                              order.status === 'progress' ? 'Em Andamento' : 'Pendente';

            const servicesList = order.services && order.services.length > 0 
                ? order.services.slice(0, 3).map(service => 
                    `<span class="service-tag">${service}</span>`
                  ).join('')
                : '<span class="service-tag">Nenhum serviço</span>';

            const moreServices = order.services && order.services.length > 3 
                ? `<span class="service-tag">+${order.services.length - 3} mais</span>` 
                : '';

            return `
                <div class="service-order-card">
                    <div class="order-header">
                        <div class="order-number">OS #${order.number}</div>
                        <div class="order-status ${statusClass}">${statusText}</div>
                    </div>
                    <div class="order-info">
                        <strong>Cliente:</strong> ${order.client?.name || 'N/A'}<br>
                        <strong>Data:</strong> ${order.date || 'N/A'}<br>
                        <strong>Execução:</strong> ${order.executionDate || 'Não agendada'}<br>
                        <strong>Responsável:</strong> ${order.technicalResponsible || 'Tassio Pires de Oliveira'}<br>
                        <strong>Valor:</strong> ${order.totalValue || 'R$ 0,00'}
                    </div>
                    <div class="order-services">
                        <h5>Serviços:</h5>
                        <div class="order-services-list">
                            ${servicesList}${moreServices}
                        </div>
                    </div>
                    <div class="order-actions">
                        <button class="btn btn-primary" onclick="manager.viewOrderDetails('${order.id}')">Ver Detalhes</button>
                        <button class="btn btn-secondary" onclick="manager.reprintOrder('${order.id}')">Reimprimir</button>
                        <button class="btn btn-success" onclick="manager.markOrderCompleted('${order.id}')">Marcar Concluída</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    async viewOrderDetails(orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) return;

        // Aqui você pode implementar um modal ou página de detalhes
        alert(`Detalhes da OS #${order.number}\n\nCliente: ${order.client?.name}\nData: ${order.date}\nStatus: ${order.status}`);
    }

    async reprintOrder(orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) return;

        this.openPrintPage(order);
    }

    async markOrderCompleted(orderId) {
        if (!this.currentUser) return;

        try {
            const orderRef = db.collection('users').doc(this.currentUser.uid).collection('orders').doc(orderId);
            await orderRef.update({
                status: 'completed',
                completedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            this.showNotification('Ordem de serviço marcada como concluída!', 'success');
        } catch (error) {
            console.error('Erro ao atualizar status:', error);
            this.showNotification('Erro ao atualizar status da ordem', 'error');
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; padding: 20px 30px;
            background: ${type === 'success' ? '#48bb78' : '#f56565'};
            color: white; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            z-index: 9999; font-weight: bold; animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Inicializar o app quando o DOM estiver pronto
let manager;
document.addEventListener('DOMContentLoaded', () => {
    manager = new ServiceOrderManager();
});