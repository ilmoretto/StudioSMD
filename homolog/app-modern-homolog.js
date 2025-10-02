// === CONFIGURAÇÕES DE SEGURANÇA ===
const SECURITY_CONFIG = {
    password: {
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true
    },
    session: {
        timeoutMinutes: 30,
        lockoutMinutes: 15,
        maxFailedAttempts: 5
    }
};

// === CLASSE DE AUDITORIA DE SEGURANÇA ===
class SecurityAudit {
    static log(eventType, data = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            eventType,
            data,
            userAgent: navigator.userAgent,
            sessionId: this.getSessionId()
        };

        // Armazenar no localStorage
        this.storeLog(logEntry);
        
        // Log no console para desenvolvimento
        console.log(`[SECURITY AUDIT] ${eventType}:`, logEntry);
    }

    static storeLog(logEntry) {
        try {
            const logs = JSON.parse(localStorage.getItem('security_audit_logs') || '[]');
            logs.push(logEntry);
            
            // Manter apenas últimos 1000 logs
            if (logs.length > 1000) {
                logs.splice(0, logs.length - 1000);
            }
            
            localStorage.setItem('security_audit_logs', JSON.stringify(logs));
        } catch (error) {
            console.error('Erro ao armazenar log de auditoria:', error);
        }
    }

    static getSessionId() {
        let sessionId = sessionStorage.getItem('session_id');
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('session_id', sessionId);
        }
        return sessionId;
    }

    static isAccountLocked() {
        const logs = JSON.parse(localStorage.getItem('security_audit_logs') || '[]');
        const failedAttempts = logs.filter(log => 
            log.eventType === 'LOGIN_FAILED' && 
            Date.now() - new Date(log.timestamp).getTime() < SECURITY_CONFIG.session.lockoutMinutes * 60 * 1000
        );
        
        return failedAttempts.length >= SECURITY_CONFIG.session.maxFailedAttempts;
    }

    static checkSuspiciousActivity() {
        const logs = JSON.parse(localStorage.getItem('security_audit_logs') || '[]');
        const recentFailures = logs.filter(log => 
            log.eventType === 'LOGIN_FAILED' && 
            Date.now() - new Date(log.timestamp).getTime() < 5 * 60 * 1000 // 5 minutos
        );
        
        return recentFailures.length >= 3;
    }

    static getLogs() {
        return JSON.parse(localStorage.getItem('security_audit_logs') || '[]');
    }
}

// === CLASSE PRINCIPAL DO APLICATIVO ===
class OSManagerApp {
    constructor() {
        this.currentUser = null;
        this.userRole = null;
        this.sessionTimeout = null;
        this.activityListeners = [];
        this.currentView = 'dashboard';
        this.clients = [];
        this.orders = [];
        this.users = [];
        this.unsubscribeClients = null;
        this.unsubscribeOrders = null;
        this.searchTimeout = null;
        
        this.init();
    }

    init() {
        this.setupAuthListener();
        this.setupEventListeners();
        this.setupSidebar();
        this.setupViewNavigation();
        
        // Criar usuário admin padrão se não existir (apenas para desenvolvimento)
        this.createDefaultAdminIfNeeded();
    }

    // === GERENCIAMENTO DE AUTENTICAÇÃO ===
    
    setupAuthListener() {
        console.log('🔄 Configurando listener de autenticação...');
        
        if (!auth) {
            console.error('❌ Firebase Auth não está disponível para o listener');
            return;
        }

        // Testar conectividade do Firebase
        this.testFirebaseConnection();

        auth.onAuthStateChanged(async (user) => {
            console.log('🔐 Estado de autenticação mudou:', user ? 'Logado' : 'Deslogado');
            
            if (user) {
                console.log('👤 Usuário logado:', user.email, user.uid);
                this.currentUser = user;
                await this.loadUserRole();
                this.startSessionTimeout();
                this.showApp();
                this.loadDashboardData();
            } else {
                console.log('🚪 Usuário deslogado');
                this.currentUser = null;
                this.userRole = null;
                this.clearSessionTimeout();
                this.showLogin();
            }
        });
    }

    testFirebaseConnection() {
        console.log('🧪 Testando conectividade Firebase...');
        
        try {
            // Testar Auth
            if (auth) {
                console.log('✅ Firebase Auth OK');
            } else {
                console.error('❌ Firebase Auth não disponível');
            }
            
            // Testar Firestore
            if (db) {
                console.log('✅ Firestore OK');
                // Teste simples de conectividade
                db.collection('test').limit(1).get()
                    .then(() => console.log('✅ Conectividade Firestore OK'))
                    .catch(error => console.error('❌ Erro de conectividade Firestore:', error));
            } else {
                console.error('❌ Firestore não disponível');
            }
            
        } catch (error) {
            console.error('❌ Erro no teste de conectividade:', error);
        }
    }

    async createDefaultAdminIfNeeded() {
        try {
            // Verificar se existe algum usuário pré-cadastrado
            const preRegRef = db.collection('pre_registered_users').limit(1);
            const snapshot = await preRegRef.get();
            
            if (snapshot.empty) {
                console.log('🔧 Criando usuário admin padrão para desenvolvimento...');
                
                // Criar usuário admin padrão
                await db.collection('pre_registered_users').doc('admin@test.com').set({
                    name: 'Administrador',
                    email: 'admin@test.com',
                    phone: '(11) 99999-0000',
                    role: 'admin',
                    passwordSet: false,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    createdBy: 'system'
                });
                
                console.log('✅ Usuário admin padrão criado: admin@test.com');
                console.log('💡 Use este email para fazer o primeiro acesso e definir senha');
            }
        } catch (error) {
            console.log('ℹ️ Não foi possível criar usuário padrão:', error.message);
        }
    }

    async loadUserRole() {
        try {
            // Buscar role do usuário no Firestore
            const userDoc = await db.collection('users').doc(this.currentUser.uid).get();
            if (userDoc.exists) {
                this.userRole = userDoc.data().role || 'user';
            } else {
                // Se não existe, verificar se é pré-cadastrado
                const preRegDoc = await db.collection('pre_registered_users').doc(this.currentUser.email).get();
                if (preRegDoc.exists) {
                    this.userRole = preRegDoc.data().role || 'user';
                    // Criar documento de usuário
                    await this.createUserDocument();
                } else {
                    this.userRole = 'user'; // padrão
                }
            }
            
            this.updateUIForRole();
            console.log('👤 Usuário:', this.currentUser.email, 'Role:', this.userRole);
        } catch (error) {
            console.error('Erro ao carregar role do usuário:', error);
            this.userRole = 'user';
            this.updateUIForRole();
        }
    }

    async createUserDocument() {
        try {
            await db.collection('users').doc(this.currentUser.uid).set({
                uid: this.currentUser.uid,
                email: this.currentUser.email,
                displayName: this.currentUser.displayName,
                role: this.userRole,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Erro ao criar documento de usuário:', error);
        }
    }

    updateUIForRole() {
        const body = document.body;
        body.className = ''; // limpar classes
        
        if (this.userRole === 'admin') {
            body.classList.add('user-admin');
        } else {
            body.classList.add('user-common');
        }

        // Atualizar informações do usuário no header
        document.getElementById('userName').textContent = 
            this.currentUser.displayName || this.currentUser.email;
        document.getElementById('userRole').textContent = 
            this.userRole === 'admin' ? 'Administrador' : 'Usuário Comum';
    }

    showLogin() {
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('appScreen').classList.add('hidden');
    }

    showApp() {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('appScreen').classList.remove('hidden');
        this.showView('dashboard');
        
        // Carregar dados em tempo real
        this.loadClientsRealtime();
        this.loadOrdersRealtime();
        this.generateNextOrderNumber();
    }

    async generateNextOrderNumber() {
        if (!this.currentUser) return;

        try {
            const currentYear = new Date().getFullYear();
            const ordersRef = db.collection('users').doc(this.currentUser.uid).collection('orders');
            
            // Buscar ordens do ano atual
            const snapshot = await ordersRef
                .where('orderNumber', '>=', `001/${currentYear}`)
                .where('orderNumber', '<=', `999/${currentYear}`)
                .orderBy('orderNumber', 'desc')
                .limit(1)
                .get();

            let nextNumber = 1;
            if (!snapshot.empty) {
                const lastOrder = snapshot.docs[0].data();
                const lastNumber = parseInt(lastOrder.orderNumber.split('/')[0]);
                nextNumber = lastNumber + 1;
            }

            const orderNumber = String(nextNumber).padStart(3, '0') + '/' + currentYear;
            
            // Atualizar campo de número da OS no formulário se existir
            const osNumberField = document.getElementById('osNumber');
            if (osNumberField) {
                osNumberField.value = orderNumber;
            }

            console.log('🔢 Próximo número de OS:', orderNumber);
            return orderNumber;

        } catch (error) {
            console.error('❌ Erro ao gerar número da OS:', error);
            return `001/${new Date().getFullYear()}`;
        }
    }

    // === GERENCIAMENTO DE SESSÃO ===
    
    startSessionTimeout() {
        this.clearSessionTimeout();
        
        this.sessionTimeout = setTimeout(() => {
            SecurityAudit.log('SESSION_TIMEOUT', {
                userId: this.currentUser?.uid,
                email: this.currentUser?.email,
                timestamp: new Date().toISOString()
            });
            
            this.showNotification('Sessão expirada por inatividade. Faça login novamente.', 'warning');
            this.handleLogout();
        }, SECURITY_CONFIG.session.timeoutMinutes * 60 * 1000);
        
        this.resetSessionTimeout();
    }
    
    clearSessionTimeout() {
        if (this.sessionTimeout) {
            clearTimeout(this.sessionTimeout);
            this.sessionTimeout = null;
        }
        
        if (this.activityListeners && this.activityListeners.length > 0) {
            this.activityListeners.forEach(({ event, listener }) => {
                document.removeEventListener(event, listener);
            });
            this.activityListeners = [];
        }
    }
    
    resetSessionTimeout() {
        const resetTimeout = () => {
            this.clearSessionTimeout();
            this.startSessionTimeout();
        };
        
        const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        
        this.activityListeners = activityEvents.map(event => {
            const listener = resetTimeout;
            document.addEventListener(event, listener, { passive: true });
            return { event, listener };
        });
    }

    // === EVENT LISTENERS ===
    
    setupEventListeners() {
        // Auth events
        document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('registerFormSubmit').addEventListener('submit', (e) => this.handleRegister(e));
        document.getElementById('btnLogout').addEventListener('click', () => this.showLogoutModal());
        
        // Password validation
        document.getElementById('registerPassword').addEventListener('input', (e) => {
            this.validatePasswordRealTime(e.target.value);
        });
        document.getElementById('confirmPassword').addEventListener('input', (e) => {
            const password = document.getElementById('registerPassword').value;
            this.validatePasswordConfirm(password, e.target.value);
        });

        // Modal events
        document.getElementById('confirmLogout').addEventListener('click', () => this.handleLogout());
        document.getElementById('cancelLogout').addEventListener('click', () => this.hideLogoutModal());
        
        // Form toggles
        document.getElementById('showRegister').addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleLoginForms('register');
        });
        document.getElementById('showLogin').addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleLoginForms('login');
        });

        // Form submissions
        document.getElementById('newOrderForm').addEventListener('submit', (e) => this.handleNewOrder(e));
        document.getElementById('newClientFormView').addEventListener('submit', (e) => this.handleNewClient(e));
        
        // Client search and management
        document.getElementById('searchClientBtn').addEventListener('click', () => this.searchClients());
        document.getElementById('newClientBtn').addEventListener('click', () => this.showNewClientForm());
        
        // Busca em tempo real ao digitar
        document.getElementById('clientSearch').addEventListener('input', () => {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => this.searchClients(), 300);
        });
        
        // Busca ao pressionar Enter
        document.getElementById('clientSearch').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.searchClients();
            }
        });
        
        // Fechar resultados ao clicar fora
        document.addEventListener('click', (e) => {
            const searchContainer = e.target.closest('.client-search-container, .search-results');
            if (!searchContainer) {
                const resultsContainer = document.getElementById('clientSearchResults');
                if (resultsContainer) {
                    resultsContainer.classList.add('hidden');
                }
            }
        });
        document.getElementById('saveNewClient').addEventListener('click', () => this.saveNewClient());
        document.getElementById('cancelNewClient').addEventListener('click', () => this.hideNewClientForm());
        
        // Admin functions
        document.getElementById('btnPreRegister').addEventListener('click', () => this.handlePreRegister());
        
        // Phone formatting
        const phoneInputs = ['clientPhone', 'newClientPhone', 'preRegisterPhone'];
        phoneInputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('input', (e) => this.formatPhone(e));
            }
        });
        
        // Currency formatting
        document.getElementById('totalValue').addEventListener('input', (e) => this.formatCurrency(e));
    }

    setupSidebar() {
        const sidebarToggle = document.getElementById('sidebarToggle');
        const sidebar = document.getElementById('sidebar');
        
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });

        // Submenu toggles
        const menuItems = document.querySelectorAll('.nav-item.has-submenu');
        menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = item.dataset.target;
                const submenu = document.getElementById(targetId);
                const arrow = item.querySelector('.arrow');
                
                // Toggle submenu
                submenu.classList.toggle('expanded');
                item.classList.toggle('expanded');
                
                // Close other submenus
                menuItems.forEach(otherItem => {
                    if (otherItem !== item) {
                        const otherSubmenu = document.getElementById(otherItem.dataset.target);
                        otherSubmenu.classList.remove('expanded');
                        otherItem.classList.remove('expanded');
                    }
                });
            });
        });
    }

    setupViewNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = link.dataset.view;
                if (view) {
                    this.showView(view);
                    this.setActiveNavLink(link);
                }
            });
        });
    }

    showView(viewName) {
        // Hide all views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        
        // Show selected view
        const targetView = document.getElementById(`${viewName}-view`);
        if (targetView) {
            targetView.classList.add('active');
            this.currentView = viewName;
            
            // Load data for specific views
            this.loadViewData(viewName);
        }
    }

    setActiveNavLink(activeLink) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        activeLink.classList.add('active');
    }

    async loadViewData(viewName) {
        switch (viewName) {
            case 'dashboard':
                await this.loadDashboardData();
                break;
            case 'orders-list':
                await this.loadOrdersList();
                break;
            case 'clients-list':
                await this.loadClientsList();
                break;
            case 'users-management':
                if (this.userRole === 'admin') {
                    await this.loadUsersList();
                }
                break;
            case 'audit-logs':
                if (this.userRole === 'admin') {
                    await this.loadAuditLogs();
                }
                break;
        }
    }

    // === AUTENTICAÇÃO ===
    
    async handleLogin(e) {
        e.preventDefault();
        console.log('🔑 Iniciando processo de login...');
        
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        console.log('📧 Email:', email);
        console.log('🔒 Password length:', password.length);

        SecurityAudit.log('LOGIN_ATTEMPT', { email });

        if (SecurityAudit.isAccountLocked()) {
            SecurityAudit.log('LOGIN_BLOCKED', { 
                email, 
                reason: 'Account temporarily locked due to multiple failures' 
            });
            this.showNotification(
                `Conta temporariamente bloqueada por ${SECURITY_CONFIG.session.lockoutMinutes} minutos devido a muitas tentativas falhas.`, 
                'error'
            );
            return;
        }

        if (!email || !password) {
            console.log('❌ Campos obrigatórios não preenchidos');
            this.showNotification('Email e senha são obrigatórios', 'error');
            return;
        }

        if (!auth) {
            console.error('❌ Firebase Auth não inicializado');
            this.showNotification('Erro de configuração. Tente recarregar a página.', 'error');
            return;
        }

        try {
            console.log('🔄 Tentando autenticar com Firebase...');
            const result = await auth.signInWithEmailAndPassword(email, password);
            console.log('✅ Autenticação bem-sucedida:', result.user.uid);
            
            SecurityAudit.log('LOGIN_SUCCESS', { 
                email, 
                uid: result.user.uid,
                displayName: result.user.displayName 
            });
            
            this.clearLoginForm();
            this.showNotification('Login realizado com sucesso!', 'success');
        } catch (error) {
            console.error('❌ Erro no login:', error);
            console.error('Código do erro:', error.code);
            console.error('Mensagem:', error.message);
            
            SecurityAudit.log('LOGIN_FAILED', { 
                email, 
                reason: error.code,
                message: error.message 
            });
            
            if (SecurityAudit.checkSuspiciousActivity()) {
                this.showNotification(
                    'Muitas tentativas de login falharam. Conta será bloqueada temporariamente.',
                    'error'
                );
            } else {
                this.showNotification(this.getErrorMessage(error.code), 'error');
            }
        }
    }

    clearLoginForm() {
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
    }

    showLogoutModal() {
        document.getElementById('logoutModal').classList.remove('hidden');
    }

    hideLogoutModal() {
        document.getElementById('logoutModal').classList.add('hidden');
    }

    async handleLogout() {
        try {
            const userInfo = {
                uid: this.currentUser?.uid,
                email: this.currentUser?.email,
                displayName: this.currentUser?.displayName
            };

            SecurityAudit.log('LOGOUT_ATTEMPT', userInfo);

            this.clearSessionTimeout();
            
            // Limpar listeners em tempo real
            if (this.unsubscribeClients) {
                this.unsubscribeClients();
                this.unsubscribeClients = null;
            }
            if (this.unsubscribeOrders) {
                this.unsubscribeOrders();
                this.unsubscribeOrders = null;
            }
            
            await auth.signOut();
            this.hideLogoutModal();
            
            SecurityAudit.log('LOGOUT_SUCCESS', userInfo);
            this.showNotification('Logout realizado com sucesso!', 'success');
        } catch (error) {
            console.error('Erro no logout:', error);
            SecurityAudit.log('LOGOUT_FAILED', { 
                error: error.code,
                message: error.message 
            });
            this.showNotification('Erro ao fazer logout', 'error');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;

        SecurityAudit.log('FIRST_PASSWORD_ATTEMPT', { email });

        const preRegisteredUser = await this.checkPreRegisteredUser(email);
        if (!preRegisteredUser) {
            SecurityAudit.log('FIRST_PASSWORD_FAILED', { 
                email, 
                reason: 'User not pre-registered' 
            });
            this.showNotification('E-mail não encontrado no sistema. Entre em contato com o administrador.', 'error');
            return;
        }

        if (preRegisteredUser.passwordSet) {
            SecurityAudit.log('FIRST_PASSWORD_FAILED', { 
                email, 
                reason: 'Password already set' 
            });
            this.showNotification('Senha já foi definida para este usuário. Use o login normal.', 'error');
            return;
        }

        const passwordValidation = this.validateStrongPassword(password);
        if (!passwordValidation.isValid) {
            SecurityAudit.log('FIRST_PASSWORD_FAILED', { 
                email, 
                reason: 'Weak password',
                errors: passwordValidation.errors 
            });
            this.showNotification(`Senha não atende aos critérios: ${passwordValidation.errors.join(', ')}`, 'error');
            return;
        }

        try {
            const result = await auth.createUserWithEmailAndPassword(email, password);
            await result.user.updateProfile({ 
                displayName: preRegisteredUser.name 
            });
            
            await this.markPasswordAsSet(email);
            
            SecurityAudit.log('FIRST_PASSWORD_SUCCESS', { 
                email, 
                name: preRegisteredUser.name,
                uid: result.user.uid 
            });

            this.showNotification('Senha definida com sucesso! Bem-vindo ao sistema!', 'success');
        } catch (error) {
            console.error('Erro ao definir primeira senha:', error);
            
            SecurityAudit.log('FIRST_PASSWORD_FAILED', { 
                email, 
                reason: error.code,
                message: error.message 
            });
            
            this.showNotification(this.getErrorMessage(error.code), 'error');
        }
    }

    toggleLoginForms(type) {
        const loginForm = document.querySelector('#loginForm').parentElement;
        const registerForm = document.getElementById('registerForm');
        
        if (type === 'register') {
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
        } else {
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
        }
    }

    // === PRÉ-CADASTRO ===
    
    async checkPreRegisteredUser(email) {
        try {
            const userRef = db.collection('pre_registered_users').doc(email);
            const userDoc = await userRef.get();
            
            if (userDoc.exists) {
                return userDoc.data();
            }
            return null;
        } catch (error) {
            console.error('Erro ao verificar pré-cadastro:', error);
            return null;
        }
    }
    
    async markPasswordAsSet(email) {
        try {
            const userRef = db.collection('pre_registered_users').doc(email);
            await userRef.update({
                passwordSet: true,
                passwordSetAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Erro ao marcar senha como definida:', error);
        }
    }
    
    async preRegisterUser(name, email, phone, role = 'user') {
        try {
            const userRef = db.collection('pre_registered_users').doc(email);
            await userRef.set({
                name: name,
                email: email,
                phone: phone,
                role: role,
                passwordSet: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: this.currentUser?.uid
            });
            
            SecurityAudit.log('USER_PRE_REGISTERED', {
                adminEmail: this.currentUser?.email,
                newUserEmail: email,
                newUserName: name,
                newUserRole: role
            });
            
            this.showNotification(`Usuário ${name} pré-cadastrado com sucesso!`, 'success');
            return true;
        } catch (error) {
            console.error('Erro ao pré-cadastrar usuário:', error);
            this.showNotification('Erro ao pré-cadastrar usuário', 'error');
            return false;
        }
    }

    async handlePreRegister() {
        const name = document.getElementById('preRegisterName').value.trim();
        const email = document.getElementById('preRegisterEmail').value.trim();
        const phone = document.getElementById('preRegisterPhone').value.trim();
        const role = document.getElementById('preRegisterRole').value;
        
        if (!name || name.length < 2) {
            this.showNotification('Nome deve ter pelo menos 2 caracteres', 'error');
            return;
        }
        
        if (!email || !email.includes('@')) {
            this.showNotification('E-mail inválido', 'error');
            return;
        }
        
        if (!phone || phone.length < 10) {
            this.showNotification('Telefone inválido', 'error');
            return;
        }
        
        if (!role) {
            this.showNotification('Selecione o nível de acesso', 'error');
            return;
        }
        
        const existingUser = await this.checkPreRegisteredUser(email);
        if (existingUser) {
            this.showNotification('Este e-mail já foi pré-cadastrado', 'warning');
            return;
        }
        
        const success = await this.preRegisterUser(name, email, phone, role);
        if (success) {
            document.getElementById('preRegisterName').value = '';
            document.getElementById('preRegisterEmail').value = '';
            document.getElementById('preRegisterPhone').value = '';
            document.getElementById('preRegisterRole').value = '';
            
            // Recarregar lista de usuários se estiver na view
            if (this.currentView === 'users-management') {
                await this.loadUsersList();
            }
        }
    }

    // === VALIDAÇÃO DE SENHA ===
    
    validateStrongPassword(password) {
        const errors = [];
        const config = SECURITY_CONFIG.password;

        if (password.length < config.minLength) {
            errors.push(`Mínimo ${config.minLength} caracteres`);
        }

        if (config.requireUppercase && !/[A-Z]/.test(password)) {
            errors.push('Pelo menos 1 letra maiúscula');
        }

        if (config.requireLowercase && !/[a-z]/.test(password)) {
            errors.push('Pelo menos 1 letra minúscula');
        }

        if (config.requireNumbers && !/[0-9]/.test(password)) {
            errors.push('Pelo menos 1 número');
        }

        if (config.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            errors.push('Pelo menos 1 caractere especial');
        }

        const commonPasswords = ['123456', 'password', '123456789', 'qwerty', 'abc123'];
        if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
            errors.push('Não pode conter sequências comuns');
        }

        return {
            isValid: errors.length === 0,
            errors: errors,
            strength: this.calculatePasswordStrength(password)
        };
    }

    calculatePasswordStrength(password) {
        let strength = 0;
        if (password.length >= 8) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[a-z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) strength++;
        return strength;
    }

    validatePasswordRealTime(password) {
        const requirements = {
            length: password.length >= 12,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
        };

        document.querySelectorAll('.password-requirement').forEach(item => {
            const requirement = item.dataset.requirement;
            const icon = item.querySelector('i');
            
            if (requirements[requirement]) {
                item.classList.add('valid');
                item.classList.remove('invalid');
                icon.className = 'fas fa-check text-success';
            } else {
                item.classList.add('invalid');
                item.classList.remove('valid');
                icon.className = 'fas fa-times text-danger';
            }
        });

        const strength = this.calculatePasswordStrength(password);
        const strengthBar = document.querySelector('.password-strength-bar');
        const strengthText = document.querySelector('.password-strength-text');
        
        if (strengthBar && strengthText) {
            strengthBar.className = 'password-strength-bar';
            if (strength <= 2) {
                strengthBar.classList.add('weak');
                strengthText.textContent = 'Força da senha: Fraca';
            } else if (strength <= 3) {
                strengthBar.classList.add('medium');
                strengthText.textContent = 'Força da senha: Média';
            } else if (strength <= 4) {
                strengthBar.classList.add('strong');
                strengthText.textContent = 'Força da senha: Forte';
            } else {
                strengthBar.classList.add('very-strong');
                strengthText.textContent = 'Força da senha: Muito Forte';
            }
        }

        return Object.values(requirements).every(req => req);
    }

    validatePasswordConfirm(password, confirmPassword) {
        const confirmField = document.querySelector('#confirmPassword');
        const confirmError = document.querySelector('.confirm-password-error');
        
        if (confirmPassword && password !== confirmPassword) {
            if (confirmField) confirmField.classList.add('invalid');
            if (confirmError) {
                confirmError.textContent = 'As senhas não coincidem';
                confirmError.style.display = 'block';
            }
            return false;
        } else {
            if (confirmField) confirmField.classList.remove('invalid');
            if (confirmError) {
                confirmError.style.display = 'none';
            }
            return true;
        }
    }

    // === DASHBOARD ===
    
    async loadDashboardData() {
        try {
            // Carregar estatísticas
            const [orders, clients, users] = await Promise.all([
                this.loadOrdersData(),
                this.loadClientsData(),
                this.userRole === 'admin' ? this.loadUsersData() : Promise.resolve([])
            ]);

            // Atualizar cards
            document.getElementById('totalOrders').textContent = orders.length;
            document.getElementById('totalClients').textContent = clients.length;
            document.getElementById('totalUsers').textContent = users.length;

            // Ordens deste mês
            const thisMonth = orders.filter(order => {
                const orderDate = new Date(order.createdAt?.seconds * 1000 || order.createdAt);
                const now = new Date();
                return orderDate.getMonth() === now.getMonth() && 
                       orderDate.getFullYear() === now.getFullYear();
            });
            document.getElementById('thisMonth').textContent = thisMonth.length;

            // Atualizar atividade recente
            this.updateRecentActivity(orders.slice(0, 5));

        } catch (error) {
            console.error('Erro ao carregar dados do dashboard:', error);
        }
    }

    updateRecentActivity(recentOrders) {
        const activityList = document.getElementById('recentActivity');
        
        if (recentOrders.length === 0) {
            activityList.innerHTML = '<p class="no-data">Nenhuma atividade recente</p>';
            return;
        }

        const activityHTML = recentOrders.map(order => {
            // Determinar descrição a ser exibida
            let description = '';
            if (order.selectedServices && order.selectedServices.length > 0) {
                description = order.selectedServices.slice(0, 2).join(', ');
                if (order.selectedServices.length > 2) {
                    description += ` + ${order.selectedServices.length - 2} mais`;
                }
            } else if (order.serviceDescription) {
                description = order.serviceDescription.substring(0, 60);
                if (order.serviceDescription.length > 60) {
                    description += '...';
                }
            } else {
                description = 'Serviços não especificados';
            }

            // Formatar valor
            const value = order.totalValue ? `R$ ${order.totalValue.toFixed(2)}` : 'Valor não informado';

            return `
                <div class="activity-item">
                    <div class="activity-info">
                        <div class="activity-header">
                            <strong>OS #${order.orderNumber}</strong>
                            <span class="activity-value">${value}</span>
                        </div>
                        <div class="activity-client">${order.clientName}</div>
                        <div class="activity-services">${description}</div>
                    </div>
                    <div class="activity-time">
                        ${this.formatDate(order.createdAt)}
                    </div>
                </div>
            `;
        }).join('');

        activityList.innerHTML = activityHTML;
    }

    // === CLIENTES ===
    
    async loadClientsData() {
        try {
            if (!this.currentUser) {
                console.warn('⚠️ Tentativa de carregar clientes sem usuário logado');
                return [];
            }
            
            console.log('📂 Carregando clientes em tempo real...');
            const clientsRef = db.collection('users').doc(this.currentUser.uid).collection('clients');
            const snapshot = await clientsRef.orderBy('name').get();
            
            this.clients = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            console.log('👥 Clientes carregados:', this.clients.length);
            return this.clients;
        } catch (error) {
            console.error('❌ Erro ao carregar clientes:', error);
            return [];
        }
    }

    loadClientsRealtime() {
        if (!this.currentUser) {
            console.warn('⚠️ Tentativa de carregar clientes sem usuário logado');
            return;
        }

        console.log('📂 Configurando listener de clientes em tempo real...');
        const clientsRef = db.collection('users').doc(this.currentUser.uid).collection('clients');
        
        this.unsubscribeClients = clientsRef.orderBy('name').onSnapshot((snapshot) => {
            console.log('📊 Snapshot de clientes recebido:', snapshot.size, 'documentos');
            this.clients = [];
            snapshot.forEach((doc) => {
                this.clients.push({ id: doc.id, ...doc.data() });
            });
            console.log('👥 Clientes carregados:', this.clients.length);
            this.renderClientsTable();
        }, (error) => {
            console.error('❌ Erro ao carregar clientes:', error);
            this.showNotification('Erro ao carregar clientes', 'error');
        });
    }

    async loadClientsList() {
        await this.loadClientsData();
        this.renderClientsTable();
    }

    renderClientsTable() {
        const tbody = document.getElementById('clientsTableBody');
        
        if (!tbody) {
            console.warn('⚠️ Elemento clientsTableBody não encontrado');
            return;
        }
        
        if (this.clients.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="no-data">Nenhum cliente cadastrado</td></tr>';
            return;
        }

        const clientsHTML = this.clients.map(client => `
            <tr>
                <td><strong>${client.name}</strong></td>
                <td>${client.email}</td>
                <td>${client.phone}</td>
                <td>${this.formatDate(client.lastContact || client.createdAt)}</td>
                <td><strong>${client.totalOrders || 0}</strong></td>
                <td class="actions">
                    <button class="btn btn-sm btn-info" onclick="app.viewClient('${client.id}')" title="Visualizar">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="app.editClient('${client.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="app.deleteClient('${client.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        tbody.innerHTML = clientsHTML;
        console.log('👥 Tabela de clientes renderizada:', this.clients.length, 'itens');
    }

    async handleNewClient(e) {
        e.preventDefault();
        
        const clientData = {
            name: document.getElementById('clientName').value.trim(),
            email: document.getElementById('clientEmail').value.trim(),
            phone: document.getElementById('clientPhone').value.trim(),
            document: document.getElementById('clientDocument').value.trim(),
            address: document.getElementById('clientAddress').value.trim(),
            notes: document.getElementById('clientNotes').value.trim(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: this.currentUser.uid,
            totalOrders: 0
        };

        try {
            const clientsRef = db.collection('users').doc(this.currentUser.uid).collection('clients');
            await clientsRef.add(clientData);
            
            SecurityAudit.log('CLIENT_CREATED', {
                clientName: clientData.name,
                clientEmail: clientData.email,
                createdBy: this.currentUser.email
            });

            this.showNotification('Cliente cadastrado com sucesso!', 'success');
            document.getElementById('newClientFormView').reset();
            
            // Recarregar lista se estiver na view de clientes
            if (this.currentView === 'clients-list') {
                await this.loadClientsList();
            }
            
        } catch (error) {
            console.error('Erro ao cadastrar cliente:', error);
            this.showNotification('Erro ao cadastrar cliente', 'error');
        }
    }

    // === BUSCA DE CLIENTES ===
    
    async searchClients() {
        const searchTerm = document.getElementById('clientSearch').value.trim().toLowerCase();
        const resultsContainer = document.getElementById('clientSearchResults');
        
        if (!searchTerm) {
            resultsContainer.classList.add('hidden');
            return;
        }

        // Mostrar loading
        resultsContainer.innerHTML = '<div class="search-result-item loading"><i class="fas fa-spinner fa-spin"></i> Buscando...</div>';
        resultsContainer.classList.remove('hidden');

        // Garantir que os clientes estão carregados
        if (this.clients.length === 0) {
            await this.loadClientsData();
        }
        
        const filteredClients = this.clients.filter(client => 
            client.name.toLowerCase().includes(searchTerm) ||
            client.email.toLowerCase().includes(searchTerm) ||
            client.phone.includes(searchTerm)
        );

        if (filteredClients.length === 0) {
            resultsContainer.innerHTML = `
                <div class="search-result-item no-results">
                    <i class="fas fa-search"></i>
                    <div>
                        <strong>Nenhum cliente encontrado</strong>
                        <small>Tente buscar por nome, email ou telefone</small>
                    </div>
                </div>
            `;
        } else {
            const resultsHTML = filteredClients.slice(0, 10).map(client => `
                <div class="search-result-item" onclick="app.selectClient('${client.id}')">
                    <i class="fas fa-user"></i>
                    <div class="client-info">
                        <strong>${this.highlightSearchTerm(client.name, searchTerm)}</strong>
                        <small>${this.highlightSearchTerm(client.email, searchTerm)} • ${this.highlightSearchTerm(client.phone, searchTerm)}</small>
                        ${client.totalOrders ? `<span class="orders-count">${client.totalOrders} OS</span>` : ''}
                    </div>
                </div>
            `).join('');
            
            if (filteredClients.length > 10) {
                resultsContainer.innerHTML = resultsHTML + `
                    <div class="search-result-item more-results">
                        <i class="fas fa-info-circle"></i>
                        <small>Mostrando 10 de ${filteredClients.length} resultados. Seja mais específico para refinar a busca.</small>
                    </div>
                `;
            } else {
                resultsContainer.innerHTML = resultsHTML;
            }
        }

        resultsContainer.classList.remove('hidden');
    }

    highlightSearchTerm(text, searchTerm) {
        if (!searchTerm || !text) return text;
        const regex = new RegExp(`(${searchTerm})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    selectClient(clientId) {
        const client = this.clients.find(c => c.id === clientId);
        if (!client) return;

        const selectedContainer = document.getElementById('selectedClient');
        selectedContainer.innerHTML = `
            <div class="selected-client-info">
                <h4><i class="fas fa-user"></i> Cliente Selecionado</h4>
                <p><strong>${client.name}</strong></p>
                <p>${client.email} • ${client.phone}</p>
                <button type="button" onclick="app.clearSelectedClient()" class="btn btn-sm btn-secondary">
                    <i class="fas fa-times"></i> Alterar Cliente
                </button>
            </div>
        `;
        
        selectedContainer.classList.remove('hidden');
        selectedContainer.dataset.clientId = clientId;
        
        document.getElementById('clientSearchResults').classList.add('hidden');
        document.getElementById('clientSearch').value = '';
    }

    clearSelectedClient() {
        document.getElementById('selectedClient').classList.add('hidden');
        document.getElementById('selectedClient').dataset.clientId = '';
        document.getElementById('clientSearchResults').classList.add('hidden');
        document.getElementById('clientSearch').value = '';
        document.getElementById('clientSearch').focus();
    }

    showNewClientForm() {
        document.getElementById('newClientForm').classList.remove('hidden');
    }

    hideNewClientForm() {
        document.getElementById('newClientForm').classList.add('hidden');
        document.getElementById('newClientForm').querySelectorAll('input').forEach(input => input.value = '');
    }

    async saveNewClient() {
        const clientData = {
            name: document.getElementById('newClientName').value.trim(),
            email: document.getElementById('newClientEmail').value.trim(),
            phone: document.getElementById('newClientPhone').value.trim(),
            address: document.getElementById('newClientAddress').value.trim(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: this.currentUser.uid,
            totalOrders: 0
        };

        if (!clientData.name || !clientData.email || !clientData.phone) {
            this.showNotification('Preencha os campos obrigatórios', 'error');
            return;
        }

        try {
            const clientsRef = db.collection('users').doc(this.currentUser.uid).collection('clients');
            const docRef = await clientsRef.add(clientData);
            
            SecurityAudit.log('CLIENT_CREATED', {
                clientName: clientData.name,
                clientEmail: clientData.email,
                createdBy: this.currentUser.email
            });

            this.showNotification('Cliente cadastrado com sucesso!', 'success');
            
            // Selecionar o cliente recém-criado
            this.selectClient(docRef.id);
            this.hideNewClientForm();
            
            // Recarregar dados de clientes
            await this.loadClientsData();
            
        } catch (error) {
            console.error('Erro ao cadastrar cliente:', error);
            this.showNotification('Erro ao cadastrar cliente', 'error');
        }
    }

    // === ORDENS DE SERVIÇO ===
    
    async loadOrdersData() {
        try {
            if (!this.currentUser) {
                console.warn('⚠️ Tentativa de carregar ordens sem usuário logado');
                return [];
            }
            
            console.log('📋 Carregando ordens em tempo real...');
            const ordersRef = db.collection('users').doc(this.currentUser.uid).collection('orders');
            const snapshot = await ordersRef.orderBy('createdAt', 'desc').get();
            
            this.orders = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            console.log('📋 Ordens carregadas:', this.orders.length);
            return this.orders;
        } catch (error) {
            console.error('❌ Erro ao carregar ordens:', error);
            return [];
        }
    }

    loadOrdersRealtime() {
        if (!this.currentUser) return;

        console.log('📋 Configurando listener de ordens em tempo real...');
        const ordersRef = db.collection('users').doc(this.currentUser.uid).collection('orders');
        
        this.unsubscribeOrders = ordersRef.orderBy('createdAt', 'desc').onSnapshot((snapshot) => {
            console.log('📊 Snapshot de ordens recebido:', snapshot.size, 'documentos');
            this.orders = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            console.log('📋 Ordens carregadas:', this.orders.length);
            this.renderOrdersTable();
        }, (error) => {
            console.error('❌ Erro ao carregar ordens:', error);
            this.showNotification('Erro ao carregar ordens', 'error');
        });
    }

    async loadOrdersList() {
        await this.loadOrdersData();
        this.renderOrdersTable();
    }

    renderOrdersTable() {
        const tbody = document.getElementById('ordersTableBody');
        
        if (!tbody) {
            console.warn('⚠️ Elemento ordersTableBody não encontrado');
            return;
        }
        
        if (this.orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="no-data">Nenhuma ordem de serviço cadastrada</td></tr>';
            return;
        }

        const ordersHTML = this.orders.map(order => {
            // Determinar descrição a ser exibida
            let description = '';
            if (order.selectedServices && order.selectedServices.length > 0) {
                description = order.selectedServices.slice(0, 2).join(', ');
                if (order.selectedServices.length > 2) {
                    description += ` + ${order.selectedServices.length - 2} mais`;
                }
            } else if (order.serviceDescription) {
                description = order.serviceDescription.substring(0, 50);
                if (order.serviceDescription.length > 50) {
                    description += '...';
                }
            } else {
                description = 'Serviços não especificados';
            }

            return `
                <tr>
                    <td><strong>#${order.orderNumber}</strong></td>
                    <td>${order.clientName}</td>
                    <td class="service-description">${description}</td>
                    <td><strong>${this.formatCurrencyDisplay(order.totalValue)}</strong></td>
                    <td><span class="badge badge-${this.getStatusBadgeClass(order.status)}">${order.status || 'pendente'}</span></td>
                    <td>${this.formatDate(order.createdAt)}</td>
                    <td class="actions">
                        <button class="btn btn-sm btn-info" onclick="app.viewOrder('${order.id}')" title="Visualizar">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-warning" onclick="app.editOrder('${order.id}')" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="app.deleteOrder('${order.id}')" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.innerHTML = ordersHTML;
        console.log('📋 Tabela de ordens renderizada:', this.orders.length, 'itens');
    }

    getStatusBadgeClass(status) {
        const statusMap = {
            'pendente': 'warning',
            'em-andamento': 'info',
            'concluida': 'success',
            'cancelada': 'danger'
        };
        return statusMap[status] || 'secondary';
    }

    // === AÇÕES DAS ORDENS ===
    
    viewOrder(orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) {
            this.showNotification('Ordem não encontrada', 'error');
            return;
        }

        // Criar modal de visualização
        const modalHTML = this.createOrderViewModal(order);
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Mostrar modal
        document.getElementById('orderViewModal').classList.remove('hidden');
    }

    createOrderViewModal(order) {
        // Formatar serviços
        let servicesHTML = '';
        if (order.selectedServices && order.selectedServices.length > 0) {
            servicesHTML = order.selectedServices.map(service => `<li>${service}</li>`).join('');
        } else if (order.serviceDescription) {
            servicesHTML = `<li>${order.serviceDescription}</li>`;
        }

        // Formatar métodos de pagamento
        let paymentHTML = '';
        if (order.paymentMethods && order.paymentMethods.length > 0) {
            paymentHTML = order.paymentMethods.join(', ');
        } else {
            paymentHTML = 'Não informado';
        }

        return `
            <div id="orderViewModal" class="modal hidden">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2><i class="fas fa-file-alt"></i> Ordem de Serviço #${order.orderNumber}</h2>
                        <button class="close-modal" onclick="this.closest('.modal').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="order-details">
                            <div class="detail-section">
                                <h3><i class="fas fa-user"></i> Cliente</h3>
                                <p><strong>Nome:</strong> ${order.clientName}</p>
                                <p><strong>Email:</strong> ${order.clientEmail || 'Não informado'}</p>
                                <p><strong>Telefone:</strong> ${order.clientPhone || 'Não informado'}</p>
                            </div>

                            <div class="detail-section">
                                <h3><i class="fas fa-tasks"></i> Serviços</h3>
                                <ul class="services-list">${servicesHTML}</ul>
                                ${order.serviceDescription ? `<p><strong>Descrição:</strong> ${order.serviceDescription}</p>` : ''}
                            </div>

                            <div class="detail-section">
                                <h3><i class="fas fa-calendar"></i> Agenda</h3>
                                <p><strong>Data:</strong> ${order.execDate || 'Não informado'}</p>
                                <p><strong>Horário:</strong> ${order.execTime || 'Não informado'}</p>
                                <p><strong>Responsável:</strong> ${order.technicalResponsible || order.responsible || 'Não informado'}</p>
                                <p><strong>Tempo Estimado:</strong> ${order.estimatedTime || 'Não informado'}</p>
                            </div>

                            <div class="detail-section">
                                <h3><i class="fas fa-money-bill"></i> Financeiro</h3>
                                <p><strong>Valor Total:</strong> ${this.formatCurrencyDisplay(order.totalValue)}</p>
                                <p><strong>Forma de Pagamento:</strong> ${paymentHTML}</p>
                                <p><strong>Data de Pagamento:</strong> ${order.paymentDate || 'Não informado'}</p>
                            </div>

                            <div class="detail-section">
                                <h3><i class="fas fa-info"></i> Informações</h3>
                                <p><strong>Status:</strong> <span class="badge badge-${this.getStatusBadgeClass(order.status)}">${order.status || 'pendente'}</span></p>
                                <p><strong>Criado em:</strong> ${this.formatDate(order.createdAt)}</p>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-warning" onclick="app.editOrder('${order.id}'); this.closest('.modal').remove();">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                            <i class="fas fa-times"></i> Fechar
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    editOrder(orderId) {
        this.showNotification('Funcionalidade de edição em desenvolvimento', 'info');
        // TODO: Implementar edição de ordens
    }

    async deleteOrder(orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) {
            this.showNotification('Ordem não encontrada', 'error');
            return;
        }

        if (!confirm(`Tem certeza que deseja excluir a Ordem #${order.orderNumber}?`)) {
            return;
        }

        try {
            await db.collection('users').doc(this.currentUser.uid).collection('orders').doc(orderId).delete();
            
            SecurityAudit.log('ORDER_DELETED', {
                orderNumber: order.orderNumber,
                clientName: order.clientName,
                deletedBy: this.currentUser.email
            });

            this.showNotification(`Ordem #${order.orderNumber} excluída com sucesso!`, 'success');
        } catch (error) {
            console.error('Erro ao excluir ordem:', error);
            this.showNotification('Erro ao excluir ordem', 'error');
        }
    }

    // === AÇÕES DOS CLIENTES ===
    
    viewClient(clientId) {
        const client = this.clients.find(c => c.id === clientId);
        if (!client) {
            this.showNotification('Cliente não encontrado', 'error');
            return;
        }

        // Criar modal de visualização
        const modalHTML = this.createClientViewModal(client);
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Mostrar modal
        document.getElementById('clientViewModal').classList.remove('hidden');
    }

    createClientViewModal(client) {
        return `
            <div id="clientViewModal" class="modal hidden">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2><i class="fas fa-user"></i> Cliente: ${client.name}</h2>
                        <button class="close-modal" onclick="this.closest('.modal').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="client-details">
                            <div class="detail-section">
                                <h3><i class="fas fa-id-card"></i> Dados Pessoais</h3>
                                <p><strong>Nome:</strong> ${client.name}</p>
                                <p><strong>E-mail:</strong> ${client.email}</p>
                                <p><strong>Telefone:</strong> ${client.phone}</p>
                                <p><strong>Documento:</strong> ${client.document || 'Não informado'}</p>
                                <p><strong>Endereço:</strong> ${client.address || 'Não informado'}</p>
                            </div>

                            <div class="detail-section">
                                <h3><i class="fas fa-chart-line"></i> Estatísticas</h3>
                                <p><strong>Total de Ordens:</strong> ${client.totalOrders || 0}</p>
                                <p><strong>Cadastrado em:</strong> ${this.formatDate(client.createdAt)}</p>
                                <p><strong>Último contato:</strong> ${this.formatDate(client.lastContact || client.createdAt)}</p>
                            </div>

                            ${client.notes ? `
                                <div class="detail-section">
                                    <h3><i class="fas fa-sticky-note"></i> Observações</h3>
                                    <p>${client.notes}</p>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-warning" onclick="app.editClient('${client.id}'); this.closest('.modal').remove();">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                            <i class="fas fa-times"></i> Fechar
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    editClient(clientId) {
        const client = this.clients.find(c => c.id === clientId);
        if (!client) {
            this.showNotification('Cliente não encontrado', 'error');
            return;
        }

        // Criar modal de edição
        const modalHTML = this.createClientEditModal(client);
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Mostrar modal
        document.getElementById('clientEditModal').classList.remove('hidden');

        // Configurar eventos do formulário
        this.setupClientEditForm(client);
    }

    createClientEditModal(client) {
        return `
            <div id="clientEditModal" class="modal hidden">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2><i class="fas fa-user-edit"></i> Editar Cliente</h2>
                        <button class="close-modal" onclick="this.closest('.modal').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <form id="editClientForm">
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="editClientName">Nome Completo *</label>
                                    <input type="text" id="editClientName" value="${client.name}" required>
                                </div>
                                <div class="form-group">
                                    <label for="editClientEmail">E-mail *</label>
                                    <input type="email" id="editClientEmail" value="${client.email}" required>
                                </div>
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="editClientPhone">Telefone *</label>
                                    <input type="tel" id="editClientPhone" value="${client.phone}" required>
                                </div>
                                <div class="form-group">
                                    <label for="editClientDocument">CPF/CNPJ</label>
                                    <input type="text" id="editClientDocument" value="${client.document || ''}">
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label for="editClientAddress">Endereço</label>
                                <input type="text" id="editClientAddress" value="${client.address || ''}">
                            </div>
                            
                            <div class="form-group">
                                <label for="editClientNotes">Observações</label>
                                <textarea id="editClientNotes" rows="3">${client.notes || ''}</textarea>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-success" onclick="app.saveClientEdit('${client.id}')">
                            <i class="fas fa-save"></i> Salvar Alterações
                        </button>
                        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    setupClientEditForm(client) {
        // Máscara para telefone
        const phoneInput = document.getElementById('editClientPhone');
        if (phoneInput) {
            phoneInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                if (value.length >= 11) {
                    value = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
                } else if (value.length >= 7) {
                    value = value.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
                } else if (value.length >= 3) {
                    value = value.replace(/(\d{2})(\d{0,5})/, '($1) $2');
                }
                e.target.value = value;
            });
        }

        // Máscara para documento
        const docInput = document.getElementById('editClientDocument');
        if (docInput) {
            docInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                if (value.length <= 11) {
                    // CPF
                    value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
                } else {
                    // CNPJ
                    value = value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
                }
                e.target.value = value;
            });
        }
    }

    async saveClientEdit(clientId) {
        const form = document.getElementById('editClientForm');
        const formData = new FormData(form);

        const updatedData = {
            name: document.getElementById('editClientName').value.trim(),
            email: document.getElementById('editClientEmail').value.trim(),
            phone: document.getElementById('editClientPhone').value.trim(),
            document: document.getElementById('editClientDocument').value.trim(),
            address: document.getElementById('editClientAddress').value.trim(),
            notes: document.getElementById('editClientNotes').value.trim(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: this.currentUser.uid
        };

        // Validações
        if (!updatedData.name || !updatedData.email || !updatedData.phone) {
            this.showNotification('Preencha todos os campos obrigatórios', 'error');
            return;
        }

        try {
            await db.collection('users').doc(this.currentUser.uid).collection('clients').doc(clientId).update(updatedData);
            
            SecurityAudit.log('CLIENT_UPDATED', {
                clientId: clientId,
                clientName: updatedData.name,
                updatedBy: this.currentUser.email
            });

            this.showNotification('Cliente atualizado com sucesso!', 'success');
            document.getElementById('clientEditModal').remove();
            
        } catch (error) {
            console.error('Erro ao atualizar cliente:', error);
            this.showNotification('Erro ao atualizar cliente', 'error');
        }
    }

    async deleteClient(clientId) {
        const client = this.clients.find(c => c.id === clientId);
        if (!client) {
            this.showNotification('Cliente não encontrado', 'error');
            return;
        }

        if (!confirm(`Tem certeza que deseja excluir o cliente "${client.name}"?\n\nEsta ação não pode ser desfeita e todas as ordens associadas serão mantidas.`)) {
            return;
        }

        try {
            await db.collection('users').doc(this.currentUser.uid).collection('clients').doc(clientId).delete();
            
            SecurityAudit.log('CLIENT_DELETED', {
                clientName: client.name,
                clientEmail: client.email,
                deletedBy: this.currentUser.email
            });

            this.showNotification(`Cliente "${client.name}" excluído com sucesso!`, 'success');
        } catch (error) {
            console.error('Erro ao excluir cliente:', error);
            this.showNotification('Erro ao excluir cliente', 'error');
        }
    }

    async handleNewOrder(e) {
        e.preventDefault();
        
        const selectedClientElement = document.getElementById('selectedClient');
        const clientId = selectedClientElement.dataset.clientId;
        
        if (!clientId) {
            this.showNotification('Selecione um cliente ou cadastre um novo', 'error');
            return;
        }

        const client = this.clients.find(c => c.id === clientId);
        if (!client) {
            this.showNotification('Cliente não encontrado', 'error');
            return;
        }

        // Capturar serviços selecionados
        const serviceCheckboxes = document.querySelectorAll('input[name="service"]:checked');
        const selectedServices = Array.from(serviceCheckboxes).map(cb => cb.value);
        
        // Capturar outros serviços
        const outroServico = document.getElementById('outroServico').value.trim();
        if (outroServico) {
            selectedServices.push(`Outros: ${outroServico}`);
        }

        // Capturar tempo estimado
        const estimatedTime = document.querySelector('input[name="estimatedTime"]:checked')?.value || '';
        
        // Capturar formas de pagamento
        const paymentCheckboxes = document.querySelectorAll('input[name="payment"]:checked');
        const paymentMethods = Array.from(paymentCheckboxes).map(cb => cb.value);

        const orderData = {
            orderNumber: await this.generateOrderNumber(),
            clientId: clientId,
            clientName: client.name,
            clientEmail: client.email,
            clientPhone: client.phone,
            
            // Serviços completos
            selectedServices: selectedServices,
            serviceDescription: document.getElementById('serviceDescription').value.trim(),
            
            // Agenda e responsável
            execDate: document.getElementById('execDate').value,
            execTime: document.getElementById('execTime').value,
            technicalResponsible: document.getElementById('technicalResponsible').value.trim(),
            estimatedTime: estimatedTime,
            
            // Valores e pagamento
            totalValue: this.parseCurrency(document.getElementById('totalValue').value),
            paymentMethods: paymentMethods,
            paymentDate: document.getElementById('paymentDate').value,
            
            status: 'pendente',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: this.currentUser.uid
        };

        try {
            const ordersRef = db.collection('users').doc(this.currentUser.uid).collection('orders');
            await ordersRef.add(orderData);
            
            // Atualizar contador de ordens do cliente
            const clientRef = db.collection('users').doc(this.currentUser.uid).collection('clients').doc(clientId);
            await clientRef.update({
                totalOrders: firebase.firestore.FieldValue.increment(1),
                lastContact: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            SecurityAudit.log('ORDER_CREATED', {
                orderNumber: orderData.orderNumber,
                clientName: orderData.clientName,
                totalValue: orderData.totalValue,
                servicesCount: selectedServices.length,
                createdBy: this.currentUser.email
            });

            this.showNotification(`Ordem de Serviço #${orderData.orderNumber} criada com sucesso!`, 'success');
            document.getElementById('newOrderForm').reset();
            this.clearSelectedClient();
            
        } catch (error) {
            console.error('Erro ao criar ordem de serviço:', error);
            this.showNotification('Erro ao criar ordem de serviço', 'error');
        }
    }

    async generateOrderNumber() {
        try {
            const year = new Date().getFullYear();
            const ordersRef = db.collection('users').doc(this.currentUser.uid).collection('orders');
            const snapshot = await ordersRef
                .where('orderNumber', '>=', `${year}0001`)
                .where('orderNumber', '<=', `${year}9999`)
                .orderBy('orderNumber', 'desc')
                .limit(1)
                .get();

            let nextNumber = 1;
            if (!snapshot.empty) {
                const lastOrder = snapshot.docs[0].data();
                const lastNumber = parseInt(lastOrder.orderNumber.slice(-4));
                nextNumber = lastNumber + 1;
            }

            return `${year}${nextNumber.toString().padStart(4, '0')}`;
        } catch (error) {
            console.error('Erro ao gerar número da OS:', error);
            return `${new Date().getFullYear()}${Date.now().toString().slice(-4)}`;
        }
    }

    // === USUÁRIOS (ADMIN) ===
    
    async loadUsersData() {
        if (this.userRole !== 'admin') return [];
        
        try {
            const [usersSnapshot, preRegSnapshot] = await Promise.all([
                db.collection('users').get(),
                db.collection('pre_registered_users').get()
            ]);

            const users = usersSnapshot.docs.map(doc => ({
                id: doc.id,
                type: 'registered',
                ...doc.data()
            }));

            const preRegUsers = preRegSnapshot.docs.map(doc => ({
                id: doc.id,
                type: 'pre-registered',
                ...doc.data()
            }));

            this.users = [...users, ...preRegUsers];
            return this.users;
        } catch (error) {
            console.error('Erro ao carregar usuários:', error);
            return [];
        }
    }

    async loadUsersList() {
        if (this.userRole !== 'admin') return;
        
        await this.loadUsersData();
        this.renderUsersTable();
    }

    renderUsersTable() {
        const tbody = document.getElementById('usersTableBody');
        
        if (this.users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="no-data">Nenhum usuário encontrado</td></tr>';
            return;
        }

        const usersHTML = this.users.map(user => `
            <tr>
                <td>${user.name || user.displayName || 'N/A'}</td>
                <td>${user.email}</td>
                <td>${user.phone || 'N/A'}</td>
                <td><span class="badge badge-${user.role === 'admin' ? 'danger' : 'info'}">${user.role === 'admin' ? 'Admin' : 'Usuário'}</span></td>
                <td><span class="badge badge-${user.passwordSet ? 'success' : 'warning'}">${user.passwordSet ? 'Ativo' : 'Pendente'}</span></td>
                <td>${this.formatDate(user.createdAt)}</td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick="app.editUser('${user.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${user.type === 'pre-registered' && !user.passwordSet ? `
                        <button class="btn btn-sm btn-danger" onclick="app.deleteUser('${user.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `).join('');

        tbody.innerHTML = usersHTML;
    }

    // === LOGS DE AUDITORIA (ADMIN) ===
    
    async loadAuditLogs() {
        if (this.userRole !== 'admin') return;
        
        const logs = SecurityAudit.getLogs().reverse(); // Mais recentes primeiro
        this.renderLogsTable(logs);
    }

    renderLogsTable(logs) {
        const tbody = document.getElementById('logsTableBody');
        
        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="no-data">Nenhum log encontrado</td></tr>';
            return;
        }

        const logsHTML = logs.slice(0, 100).map(log => `
            <tr>
                <td>${this.formatDateTime(log.timestamp)}</td>
                <td><span class="badge badge-${this.getLogTypeBadge(log.eventType)}">${this.formatLogType(log.eventType)}</span></td>
                <td>${log.data.email || log.data.adminEmail || 'Sistema'}</td>
                <td>${log.eventType}</td>
                <td title="${JSON.stringify(log.data, null, 2)}">${this.summarizeLogData(log.data)}</td>
            </tr>
        `).join('');

        tbody.innerHTML = logsHTML;
    }

    getLogTypeBadge(eventType) {
        if (eventType.includes('SUCCESS')) return 'success';
        if (eventType.includes('FAILED') || eventType.includes('BLOCKED')) return 'danger';
        if (eventType.includes('ATTEMPT')) return 'warning';
        return 'info';
    }

    formatLogType(eventType) {
        return eventType.replace(/_/g, ' ').toLowerCase()
            .replace(/\b\w/g, l => l.toUpperCase());
    }

    summarizeLogData(data) {
        if (data.reason) return data.reason;
        if (data.clientName) return `Cliente: ${data.clientName}`;
        if (data.newUserName) return `Usuário: ${data.newUserName}`;
        return Object.keys(data).length > 0 ? 'Ver detalhes' : '-';
    }

    // === UTILITÁRIOS ===
    
    formatPhone(e) {
        let value = e.target.value.replace(/\D/g, '');
        value = value.replace(/(\d{2})(\d)/, '($1) $2');
        value = value.replace(/(\d{4,5})(\d{4})$/, '$1-$2');
        e.target.value = value;
    }

    formatCurrency(e) {
        let value = e.target.value.replace(/\D/g, '');
        value = (parseInt(value) / 100).toFixed(2);
        value = value.replace('.', ',');
        value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
        e.target.value = 'R$ ' + value;
    }

    parseCurrency(value) {
        return parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    }

    formatCurrencyDisplay(value) {
        if (!value || isNaN(value)) return 'R$ 0,00';
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    formatDate(timestamp) {
        if (!timestamp) return 'N/A';
        
        let date;
        if (timestamp.seconds) {
            date = new Date(timestamp.seconds * 1000);
        } else {
            date = new Date(timestamp);
        }
        
        return date.toLocaleDateString('pt-BR');
    }

    formatDateTime(timestamp) {
        if (!timestamp) return 'N/A';
        
        const date = new Date(timestamp);
        return date.toLocaleString('pt-BR');
    }

    getErrorMessage(code) {
        const messages = {
            'auth/user-not-found': 'Usuário não encontrado',
            'auth/wrong-password': 'Senha incorreta',
            'auth/email-already-in-use': 'E-mail já cadastrado',
            'auth/weak-password': 'Senha muito fraca',
            'auth/invalid-email': 'E-mail inválido',
            'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde'
        };
        return messages[code] || 'Erro ao processar solicitação';
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${this.getNotificationIcon(type)}"></i>
            ${message}
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 4000);
    }

    getNotificationIcon(type) {
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        return icons[type] || 'info-circle';
    }
}

// Adicionar animação de slideOut
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOut {
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// === INICIALIZAÇÃO ===
let app;
let auth;
let db;

// Inicializar Firebase
function initializeFirebase() {
    try {
        if (typeof firebase === 'undefined') {
            console.error('Firebase SDK não carregado');
            return false;
        }

        if (!window.firebaseConfig) {
            console.error('Configuração do Firebase não encontrada');
            return false;
        }

        // Inicializar Firebase
        firebase.initializeApp(window.firebaseConfig);
        
        // Inicializar serviços
        auth = firebase.auth();
        db = firebase.firestore();
        
        console.log('🔥 Firebase inicializado com sucesso');
        return true;
    } catch (error) {
        console.error('Erro ao inicializar Firebase:', error);
        return false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Iniciando OSManager App...');
    
    // Verificar se Firebase foi inicializado
    if (initializeFirebase()) {
        app = new OSManagerApp();
        console.log('✅ OSManager App iniciado com sucesso');
        
        // Adicionar função de debug global
        window.debugAuth = {
            testLogin: async (email = 'admin@test.com', password = 'Admin123456!') => {
                try {
                    console.log('🧪 Testando login programático...');
                    const result = await auth.signInWithEmailAndPassword(email, password);
                    console.log('✅ Login teste bem-sucedido:', result.user);
                    return result;
                } catch (error) {
                    console.error('❌ Erro no login teste:', error);
                    return error;
                }
            },
            
            getCurrentUser: () => {
                console.log('👤 Usuário atual:', auth.currentUser);
                return auth.currentUser;
            },
            
            createTestUser: async () => {
                try {
                    console.log('🧪 Criando usuário de teste...');
                    const result = await auth.createUserWithEmailAndPassword('admin@test.com', 'Admin123456!');
                    await result.user.updateProfile({ displayName: 'Admin Teste' });
                    console.log('✅ Usuário de teste criado:', result.user);
                    return result;
                } catch (error) {
                    console.error('❌ Erro ao criar usuário teste:', error);
                    return error;
                }
            }
        };
        
        console.log('🔧 Funções de debug disponíveis:');
        console.log('- window.debugAuth.testLogin() - Testa login');
        console.log('- window.debugAuth.getCurrentUser() - Mostra usuário atual');
        console.log('- window.debugAuth.createTestUser() - Cria usuário teste');
        
    } else {
        console.error('❌ Falha ao inicializar Firebase');
        // Mostrar erro na tela
        document.body.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: #f8fafc;">
                <div style="text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <h2 style="color: #ef4444; margin-bottom: 16px;">⚠️ Erro de Inicialização</h2>
                    <p style="color: #64748b; margin-bottom: 20px;">Não foi possível conectar com o Firebase.</p>
                    <button onclick="location.reload()" style="background: #2563eb; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer;">
                        Tentar Novamente
                    </button>
                </div>
            </div>
        `;
    }
});