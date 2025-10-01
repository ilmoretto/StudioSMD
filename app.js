// Inicializar Firebase
let app, auth, db;

try {
    app = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    console.log('✅ Firebase inicializado com sucesso');
} catch (error) {
    console.error('❌ Erro ao inicializar Firebase:', error);
    alert('Erro ao conectar com o Firebase. Verifique o arquivo firebase-config.js');
}

// Gerenciador de Ordens de Serviço com Firebase
class ServiceOrderManager {
    constructor() {
        this.currentUser = null;
        this.selectedClient = null;
        this.clients = [];
        this.unsubscribeClients = null;
        this.init();
    }

    init() {
        this.setupAuthListener();
        this.setupEventListeners();
        this.setDefaultDate();
    }

    // === AUTENTICAÇÃO ===
    
    setupAuthListener() {
        auth.onAuthStateChanged((user) => {
            if (user) {
                this.currentUser = user;
                this.showApp();
                this.loadClientsRealtime();
            } else {
                this.currentUser = null;
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
        document.getElementById('userName').textContent = this.currentUser.displayName || this.currentUser.email;
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
        if (!this.currentUser) return;

        const clientsRef = db.collection('users').doc(this.currentUser.uid).collection('clients');
        
        this.unsubscribeClients = clientsRef.orderBy('name').onSnapshot((snapshot) => {
            this.clients = [];
            snapshot.forEach((doc) => {
                this.clients.push({ id: doc.id, ...doc.data() });
            });
            this.renderClients();
        }, (error) => {
            console.error('Erro ao carregar clientes:', error);
            this.showNotification('Erro ao carregar clientes', 'error');
        });
    }

    async saveClient(e) {
        e.preventDefault();
        
        if (!this.currentUser) {
            this.showNotification('Você precisa estar logado', 'error');
            return;
        }

        const client = {
            name: document.getElementById('clientName').value,
            phone: document.getElementById('clientPhone').value,
            address: document.getElementById('clientAddress').value,
            email: document.getElementById('clientEmail').value,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            const clientsRef = db.collection('users').doc(this.currentUser.uid).collection('clients');
            const docRef = await clientsRef.add(client);
            
            this.hideClientForm();
            this.selectClient({ id: docRef.id, ...client });
            this.showNotification('Cliente cadastrado com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao salvar cliente:', error);
            this.showNotification('Erro ao cadastrar cliente', 'error');
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
            <div class="client-item ${this.selectedClient?.id === client.id ? 'selected' : ''}" 
                 data-id="${client.id}">
                <h4>${client.name}</h4>
                <p>📞 ${client.phone}</p>
                <p>📧 ${client.email || 'Não informado'}</p>
            </div>
        `).join('');

        container.querySelectorAll('.client-item').forEach(item => {
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
        container.innerHTML = `
            <h3>Cliente Selecionado</h3>
            <p><strong>Nome:</strong> ${this.selectedClient.name}</p>
            <p><strong>Telefone:</strong> ${this.selectedClient.phone}</p>
            <p><strong>Endereço:</strong> ${this.selectedClient.address || 'Não informado'}</p>
            <p><strong>E-mail:</strong> ${this.selectedClient.email || 'Não informado'}</p>
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

    generateServiceOrder() {
        if (!this.selectedClient) {
            this.showNotification('Selecione um cliente antes de gerar a ordem de serviço', 'error');
            return;
        }

        const osNumber = document.getElementById('osNumber').value;
        if (!osNumber) {
            this.showNotification('Preencha o número da OS', 'error');
            return;
        }

        const orderData = {
            number: osNumber,
            date: this.formatDate(document.getElementById('osDate').value),
            client: this.selectedClient,
            services: this.getSelectedServices(),
            description: document.getElementById('serviceDescription').value,
            executionDate: this.formatDate(document.getElementById('execDate').value),
            executionTime: document.getElementById('execTime').value,
            estimatedTime: this.getEstimatedTime(),
            totalValue: document.getElementById('totalValue').value,
            paymentMethods: this.getPaymentMethods(),
            paymentDate: this.formatDate(document.getElementById('paymentDate').value)
        };

        // Salvar OS no Firebase (opcional)
        this.saveOrderToFirebase(orderData);
        
        this.openPrintPage(orderData);
    }

    async saveOrderToFirebase(orderData) {
        if (!this.currentUser) return;

        try {
            const ordersRef = db.collection('users').doc(this.currentUser.uid).collection('orders');
            await ordersRef.add({
                ...orderData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('✅ OS salva no Firebase');
        } catch (error) {
            console.error('Erro ao salvar OS:', error);
        }
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

        return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Ordem de Serviço #${data.number}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 40px; font-size: 12pt; line-height: 1.6; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #000; padding-bottom: 20px; }
        .header h1 { font-size: 24pt; margin-bottom: 10px; }
        .os-info { display: flex; justify-content: space-between; margin-bottom: 20px; font-weight: bold; }
        .section { margin-bottom: 25px; border: 1px solid #ccc; padding: 15px; }
        .section h2 { font-size: 14pt; margin-bottom: 15px; color: #333; border-bottom: 2px solid #666; padding-bottom: 5px; }
        .client-info p { margin: 8px 0; }
        .services-list { columns: 2; column-gap: 20px; }
        .services-list li { margin-bottom: 8px; break-inside: avoid; }
        .description { background: #f5f5f5; padding: 10px; margin: 10px 0; min-height: 60px; }
        .info-row { display: flex; justify-content: space-between; margin: 10px 0; }
        .info-item { flex: 1; margin-right: 15px; }
        .observations { background: #fffbf0; padding: 15px; margin: 20px 0; border-left: 4px solid #ff9800; }
        .observations h3 { margin-bottom: 10px; color: #ff9800; }
        .observations ul { margin-left: 20px; }
        .observations li { margin: 8px 0; }
        .signatures { display: flex; justify-content: space-between; margin-top: 50px; padding-top: 20px; }
        .signature-box { text-align: center; flex: 1; margin: 0 20px; }
        .signature-line { border-top: 2px solid #000; margin-bottom: 8px; padding-top: 5px; }
        .print-button { position: fixed; top: 20px; right: 20px; padding: 15px 30px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14pt; font-weight: bold; }
        @media print { .print-button { display: none; } body { padding: 20px; } }
    </style>
</head>
<body>
    <button class="print-button" onclick="window.print()">🖨️ Imprimir</button>
    <div class="header">
        <h1>ORDEM DE SERVIÇO</h1>
        <p>Estúdio de Áudio - Ouro Preto do Oeste</p>
    </div>
    <div class="os-info">
        <div>Nº: <span>${data.number}</span></div>
        <div>Data: <span>${data.date}</span></div>
    </div>
    <div class="section">
        <h2>Dados do Cliente</h2>
        <div class="client-info">
            <p><strong>Nome:</strong> ${data.client.name}</p>
            <p><strong>Telefone:</strong> ${data.client.phone}</p>
            <p><strong>Endereço:</strong> ${data.client.address || 'Não informado'}</p>
            <p><strong>E-mail:</strong> ${data.client.email || 'Não informado'}</p>
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
            <p>_____________________</p>
        </div>
    </div>
</body>
</html>`;
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
document.addEventListener('DOMContentLoaded', () => {
    new ServiceOrderManager();
});