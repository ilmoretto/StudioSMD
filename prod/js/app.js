// App de Produção - baseado em homolog com ajustes de estrutura e pequenas melhorias

let app, auth, db;

// Políticas de segurança
const SECURITY_CONFIG = {
  password: {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    blockedPasswords: ['password','123456','admin','studio','music','danca']
  },
  session: { timeoutMinutes: 30, maxLoginAttempts: 5, lockoutMinutes: 15 }
};

class SecurityAudit {
  static log(event, details = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, event, userAgent: navigator.userAgent, ...details };
    try {
      const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
      logs.push(logEntry);
      if (logs.length > 500) logs.splice(0, logs.length - 500);
      localStorage.setItem('security_logs', JSON.stringify(logs));
    } catch {}
    console.log(`[AUDIT] ${event}`, logEntry);
  }
  static isAccountLocked() {
    const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
    const recentFailures = logs.filter(l => l.event === 'LOGIN_FAILED' && new Date(l.timestamp) > new Date(Date.now() - SECURITY_CONFIG.session.lockoutMinutes*60*1000));
    return recentFailures.length >= SECURITY_CONFIG.session.maxLoginAttempts;
  }
}

if (typeof firebase === 'undefined') {
  console.error('Firebase SDK não encontrado');
} else if (typeof firebaseConfig === 'undefined') {
  console.error('Configuração Firebase não encontrada');
} else {
  try {
    if (firebase.apps.length === 0) app = firebase.initializeApp(firebaseConfig); else app = firebase.app();
    auth = firebase.auth();
    db = firebase.firestore();
    console.log('Firebase inicializado', firebaseConfig.projectId);
  } catch (e) {
    console.error('Erro ao inicializar Firebase:', e);
  }
}

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
  }

  // Auth
  setupAuthListener() {
    if (!auth) return;
    auth.onAuthStateChanged((user) => {
      if (user) {
        this.currentUser = user;
        this.showApp();
        this.loadClientsRealtime();
        this.loadOrdersRealtime();
        this.generateNextOrderNumber();
      } else {
        this.currentUser = null;
        this.showLogin();
      }
    });
  }
  showLogin() { document.getElementById('loginScreen').classList.remove('hidden'); document.getElementById('appScreen').classList.add('hidden'); }
  showApp() { document.getElementById('loginScreen').classList.add('hidden'); document.getElementById('appScreen').classList.remove('hidden'); document.getElementById('userName').textContent = this.currentUser?.displayName || this.currentUser?.email || 'Usuário'; }

  setupEventListeners() {
    // auth
    document.getElementById('loginForm').addEventListener('submit', (e)=>this.handleLogin(e));
    document.getElementById('registerFormSubmit').addEventListener('submit', (e)=>this.handleRegister(e));
    document.getElementById('btnLogout').addEventListener('click', ()=>this.showLogoutModal());
    document.getElementById('confirmLogout').addEventListener('click', ()=>this.handleLogout());
    document.getElementById('cancelLogout').addEventListener('click', ()=>this.hideLogoutModal());

    // alternar entre login e primeira senha
    const showRegister = document.getElementById('showRegister');
    const showLogin = document.getElementById('showLogin');
    if (showRegister) showRegister.addEventListener('click', (e)=>{
      e.preventDefault();
      document.querySelector('#loginForm').parentElement.classList.add('hidden');
      document.getElementById('registerForm').classList.remove('hidden');
    });
    if (showLogin) showLogin.addEventListener('click', (e)=>{
      e.preventDefault();
      document.getElementById('registerForm').classList.add('hidden');
      document.querySelector('#loginForm').parentElement.classList.remove('hidden');
    });

    // password ui
    const pwd = document.getElementById('registerPassword');
    const confirm = document.getElementById('confirmPassword');
    if (pwd) pwd.addEventListener('input', (e)=>this.validatePasswordUI(e.target.value));
    if (confirm) confirm.addEventListener('input', (e)=>this.validateConfirmUI(pwd.value, e.target.value));

    // clientes e OS
    document.getElementById('btnNovoCliente').addEventListener('click', ()=>this.showClientForm());
    document.getElementById('btnCancelar').addEventListener('click', ()=>this.hideClientForm());
    document.getElementById('formCliente').addEventListener('submit', (e)=>this.saveClient(e));
    document.getElementById('searchClient').addEventListener('input', (e)=>this.searchClients(e.target.value));
    document.getElementById('clientPhone').addEventListener('input', (e)=>this.formatPhone(e));
    document.getElementById('btnGerarOS').addEventListener('click', ()=>this.generateServiceOrder());
    document.getElementById('totalValue').addEventListener('input', (e)=>this.formatCurrency(e));
  }

  async handleLogin(e){
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    SecurityAudit.log('LOGIN_ATTEMPT',{email});
    if (!email || !password) { this.toast('Email e senha são obrigatórios','error'); return; }
    if (SecurityAudit.isAccountLocked()) { this.toast('Conta temporariamente bloqueada por muitas tentativas','error'); return; }
    try {
      await auth.signInWithEmailAndPassword(email, password);
      this.toast('Login realizado com sucesso','success');
    } catch (err) {
      SecurityAudit.log('LOGIN_FAILED',{email, code: err.code});
      this.toast('Falha no login: '+(err.code||''),'error');
    }
  }

  async handleRegister(e){
    e.preventDefault();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    // verificar pré-cadastro
    const pre = await this.checkPreRegisteredUser(email);
    if (!pre) { this.toast('E-mail não pré-cadastrado. Procure o administrador.','error'); return; }
    if (pre.passwordSet) { this.toast('Senha já foi definida para este usuário. Use o login.','error'); return; }
    const v = this.validateStrongPassword(password);
    if (!v.isValid) { this.toast('Senha não atende aos critérios: '+v.errors.join(', '),'error'); return; }
    try {
      const res = await auth.createUserWithEmailAndPassword(email, password);
      await res.user.updateProfile({ displayName: pre.name });
      await this.markPasswordAsSet(email);
      this.toast('Senha definida com sucesso! Faça login.','success');
      document.getElementById('showLogin').click();
    } catch (err) {
      this.toast('Erro ao definir senha: '+(err.code||err.message),'error');
    }
  }

  async handleLogout(){ try { await auth.signOut(); this.hideLogoutModal(); this.toast('Logout realizado','success'); } catch(e){ this.toast('Erro no logout','error'); } }
  showLogoutModal(){ document.getElementById('logoutModal').classList.remove('hidden'); }
  hideLogoutModal(){ document.getElementById('logoutModal').classList.add('hidden'); }

  // Pré-cadastro
  async checkPreRegisteredUser(email){ try { const doc = await db.collection('pre_registered_users').doc(email).get(); return doc.exists? doc.data(): null; } catch{ return null; } }
  async markPasswordAsSet(email){ try { await db.collection('pre_registered_users').doc(email).update({ passwordSet: true, passwordSetAt: firebase.firestore.FieldValue.serverTimestamp() }); } catch{} }

  // Clientes realtime
  loadClientsRealtime(){ if (!this.currentUser) return; const ref = db.collection('users').doc(this.currentUser.uid).collection('clients'); this.unsubscribeClients = ref.orderBy('name').onSnapshot(s=>{ this.clients = s.docs.map(d=>({id:d.id,...d.data()})); this.renderClients(); }); }
  loadOrdersRealtime(){ if (!this.currentUser) return; const ref = db.collection('users').doc(this.currentUser.uid).collection('orders'); this.unsubscribeOrders = ref.orderBy('createdAt','desc').onSnapshot(s=>{ this.orders = s.docs.map(d=>({id:d.id,...d.data()})); this.renderOrders(); }); }

  async generateNextOrderNumber(){ if (!this.currentUser) return; const y = new Date().getFullYear(); const ref = db.collection('users').doc(this.currentUser.uid).collection('orders'); const snap = await ref.where('year','==',y).orderBy('orderNumber','desc').limit(1).get(); let next=1; if (!snap.empty){ next = (snap.docs[0].data().orderNumber||0)+1; } document.getElementById('osNumber').value = `${String(next).padStart(3,'0')}/${y}`; }

  async saveClient(e){
    e.preventDefault();
    if (!this.currentUser) { this.toast('Precisa estar logado','error'); return; }
    const name = document.getElementById('clientName').value.trim();
    const phone = document.getElementById('clientPhone').value.trim();
    const birthDate = document.getElementById('clientBirthDate').value;
    const rg = document.getElementById('clientRG').value.trim();
    const cpf = document.getElementById('clientCPF').value.trim();
    const email = document.getElementById('clientEmail').value.trim();
    const address = document.getElementById('clientAddress').value.trim();
    if (!name||!birthDate||!rg||!cpf||!email||!address){ this.toast('Preencha todos os campos','error'); return; }
    const client = { name: name.substring(0,100), phone: phone.replace(/\D/g,'').substring(0,11), birthDate, rg: rg.substring(0,20), cpf: cpf.replace(/\D/g,'').substring(0,11), email: email.substring(0,100), address: address.substring(0,200), createdAt: firebase.firestore.FieldValue.serverTimestamp() };
    try { const ref = db.collection('users').doc(this.currentUser.uid).collection('clients'); const doc = await ref.add(client); this.hideClientForm(); this.selectClient({id:doc.id,...client}); this.toast('Cliente cadastrado','success'); } catch(e){ this.toast('Erro ao salvar cliente','error'); }
  }

  showClientForm(){ document.getElementById('clientForm').classList.remove('hidden'); document.getElementById('formCliente').reset(); }
  hideClientForm(){ document.getElementById('clientForm').classList.add('hidden'); document.getElementById('formCliente').reset(); }
  searchClients(q){ const filtered = this.clients.filter(c=> c.name.toLowerCase().includes(q.toLowerCase())); this.renderClients(filtered); }
  renderClients(list=this.clients){ const el = document.getElementById('clientList'); if (!list.length){ el.innerHTML = '<p style="text-align:center;color:#718096;padding:16px;">Nenhum cliente encontrado.</p>'; return; } el.innerHTML = list.map(c=>`<div class="client-card ${this.selectedClient?.id===c.id?'selected':''}" data-id="${c.id}"><div class="client-name">${c.name}</div><div class="client-info"><div>Telefone: ${this.formatPhoneDisplay(c.phone)}</div><div>CPF: ${c.cpf||'Não informado'}</div><div>Email: ${c.email||'Não informado'}</div></div></div>`).join(''); el.querySelectorAll('.client-card').forEach(card=> card.addEventListener('click',()=>{ const id = card.dataset.id; const cli = this.clients.find(x=>x.id===id); this.selectClient(cli); })); }
  selectClient(client){ this.selectedClient = client; this.renderClients(); this.updateSelectedClientDisplay(); }
  updateSelectedClientDisplay(){ const ctn = document.getElementById('selectedClient'); if (!this.selectedClient){ ctn.classList.add('empty'); ctn.innerHTML = '<h3>Cliente Selecionado</h3><p>Nenhum cliente selecionado. Cadastre ou selecione um cliente acima.</p>'; return; } ctn.classList.remove('empty'); const birth = this.selectedClient.birthDate? new Date(this.selectedClient.birthDate).toLocaleDateString('pt-BR'): 'Não informado'; ctn.innerHTML = `<h3>Cliente Selecionado</h3><div class="client-details"><p><strong>Nome:</strong> ${this.selectedClient.name}</p><p><strong>Telefone:</strong> ${this.formatPhoneDisplay(this.selectedClient.phone)}</p><p><strong>Data de Nascimento:</strong> ${birth}</p><p><strong>RG:</strong> ${this.selectedClient.rg||'Não informado'}</p><p><strong>CPF:</strong> ${this.selectedClient.cpf||'Não informado'}</p><p><strong>E-mail:</strong> ${this.selectedClient.email||'Não informado'}</p><p><strong>Endereço:</strong> ${this.selectedClient.address||'Não informado'}</p></div>`; }

  // OS
  setDefaultDate(){ const today = new Date().toISOString().split('T')[0]; const el = document.getElementById('osDate'); if (el) el.value = today; }
  formatCurrency(e){ let v = e.target.value.replace(/\D/g,''); v = (parseInt(v||'0')/100).toFixed(2); e.target.value = 'R$ ' + v.replace('.',','); }
  formatPhone(e){ let v = e.target.value.replace(/\D/g,''); if (v.length>11) v = v.substring(0,11); if (v.length<=2) v = v.replace(/(\d{0,2})/,'($1'); else if (v.length<=7) v = v.replace(/(\d{2})(\d{0,5})/,'($1) $2'); else v = v.replace(/(\d{2})(\d{5})(\d{0,4})/,'($1) $2-$3'); e.target.value = v; }
  formatPhoneDisplay(p){ if (!p) return 'Não informado'; const c = p.replace(/\D/g,''); if (c.length===10) return c.replace(/(\d{2})(\d{4})(\d{4})/,'($1) $2-$3'); if (c.length===11) return c.replace(/(\d{2})(\d{5})(\d{4})/,'($1) $2-$3'); if (c.length>0) return `(${c.substring(0,2)}) ${c.substring(2)}`; return 'Não informado'; }
  getSelectedServices(){ const cbs = document.querySelectorAll('input[name="service"]:checked'); const list = Array.from(cbs).map(cb=>cb.value); const outro = document.getElementById('outroServico').value; if (outro) list.push(`Outro: ${outro}`); return list; }
  getPaymentMethods(){ const cbs = document.querySelectorAll('input[name="payment"]:checked'); return Array.from(cbs).map(cb=>cb.value); }
  getEstimatedTime(){ const r = document.querySelector('input[name="estimatedTime"]:checked'); return r? r.value: ''; }

  async generateServiceOrder(){
    if (!this.selectedClient){ this.toast('Selecione um cliente','error'); return; }
    const osNumber = document.getElementById('osNumber').value; if (!osNumber){ this.toast('Preencha o número da OS','error'); return; }
    const [n,y] = osNumber.split('/');
    const orderData = {
      number: osNumber,
      orderNumber: parseInt(n),
      year: parseInt(y),
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
    try { await this.saveOrderToFirebase(orderData); this.openPrintPage(orderData); this.clearOrderForm(); await this.generateNextOrderNumber(); this.toast('OS gerada com sucesso','success'); } catch(e){ this.toast('Erro ao gerar OS','error'); }
  }
  async saveOrderToFirebase(data){ if (!this.currentUser) return; const ref = db.collection('users').doc(this.currentUser.uid).collection('orders'); await ref.add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); }
  clearOrderForm(){ document.getElementById('serviceDescription').value = ''; document.getElementById('execDate').value = ''; document.getElementById('execTime').value = ''; document.getElementById('totalValue').value = ''; document.getElementById('paymentDate').value = ''; document.getElementById('outroServico').value=''; document.querySelectorAll('input[name="service"]:checked').forEach(cb=>cb.checked=false); document.querySelectorAll('input[name="estimatedTime"]:checked').forEach(rb=>rb.checked=false); document.querySelectorAll('input[name="payment"]:checked').forEach(cb=>cb.checked=false); }
  formatDate(s){ if (!s) return ''; const [y,m,d] = s.split('-'); return `${d}/${m}/${y}`; }

  openPrintPage(data){ const w = window.open('', '_blank'); w.document.write(this.generatePrintHTML(data)); w.document.close(); setTimeout(()=>w.print(), 500); }
  generatePrintHTML(data){ const servicesHTML = data.services.length? data.services.map(s=>`<li>${s}</li>`).join('') : '<li>Nenhum serviço selecionado</li>'; const paymentHTML = data.paymentMethods.length? data.paymentMethods.join(', '): 'Não informado'; const today = new Date().toLocaleDateString('pt-BR'); return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Ordem de Serviço #${data.number}</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;padding:40px;font-size:12pt;line-height:1.6;} .header{text-align:center;margin-bottom:30px;border-bottom:3px solid #1e3a8a;padding-bottom:20px;} .header h1{font-size:24pt;margin-bottom:10px;color:#1e3a8a;} .os-info{display:flex;justify-content:space-between;margin:12px 0;font-weight:bold;} .section{margin:16px 0;border:1px solid #ccc;padding:12px;} .section h2{font-size:14pt;margin-bottom:10px;color:#1e3a8a;border-bottom:2px solid #3b82f6;padding-bottom:4px;} .services-list{columns:2;column-gap:20px;} .services-list li{margin-bottom:8px;} .description{background:#f8fafc;padding:10px;margin:10px 0;min-height:60px;border-left:4px solid #3b82f6;} .signatures{display:flex;justify-content:space-between;margin-top:40px;padding-top:12px;} .signature-box{text-align:center;flex:1;margin:0 16px;} .signature-line{border-top:2px solid #000;margin-bottom:8px;padding-top:5px;} .print-button{position:fixed;top:20px;right:20px;padding:10px 18px;background:#1e3a8a;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:12pt;font-weight:bold;} @media print{.print-button{display:none} body{padding:20px;}}</style></head><body><button class="print-button" onclick="window.print()">Imprimir</button><div class="header"><h1>ORDEM DE SERVIÇO</h1><div class="studio-info"><strong>Studio SMD || Studio Sonata Música e Dança</strong></div><div class="contact-info">Praça da Liberdade, 104 - União - Ouro Preto do Oeste - RO - 76.920-000<br/>linktr.ee/sonata_md - E-mail: conservatorio86@gmail.com<br/>Fone: (69) 99224-6426</div></div><div class="os-info"><div>Nº: <span>${data.number}</span></div><div>Data: <span>${data.date}</span></div></div><div class="section"><h2>Dados do Cliente</h2><div class="client-info"><p><strong>Nome:</strong> ${data.client.name}</p><p><strong>Telefone:</strong> ${this.formatPhoneDisplay(data.client.phone)}</p><p><strong>CPF:</strong> ${data.client.cpf||'Não informado'}</p><p><strong>RG:</strong> ${data.client.rg||'Não informado'}</p><p><strong>E-mail:</strong> ${data.client.email||'Não informado'}</p><p><strong>Endereço:</strong> ${data.client.address||'Não informado'}</p></div></div><div class="section"><h2>Detalhamento do Serviço</h2><ul class="services-list">${servicesHTML}</ul></div><div class="section"><h2>Descrição Detalhada</h2><div class="description">${data.description||'Nenhuma descrição fornecida.'}</div></div><div class="section"><h2>Agenda e Profissional</h2><p><strong>Data:</strong> ${data.executionDate||'Não informada'} &nbsp; <strong>Horário:</strong> ${data.executionTime||'Não informado'}</p><p><strong>Tempo Estimado:</strong> ${data.estimatedTime||'Não informado'}</p></div><div class="section"><h2>Condições e Valores</h2><p><strong>Valor Total:</strong> ${data.totalValue||'R$ 0,00'}</p><p><strong>Forma de Pagamento:</strong> ${paymentHTML}</p><p><strong>Pagamento Efetuado em:</strong> ${data.paymentDate||'Não informado'}</p></div><div class="signatures"><div class="signature-box"><div class="signature-line">Contratante</div><p>${data.client.name}</p></div><div class="signature-box"><div class="signature-line">Responsável Técnico</div><p>Tassio Pires de Oliveira</p></div></div><div style="text-align:center;margin-top:16px;color:#666;">Ouro Preto do Oeste - RO, ${today}</div></body></html>`; }

  renderOrders(){ const el = document.getElementById('osList'); if (!this.orders.length){ el.innerHTML = '<p style="text-align:center;color:#718096;padding:16px;">Nenhuma ordem de serviço encontrada.</p>'; return; } el.innerHTML = this.orders.map(order=>{ const statusClass = order.status==='completed'?'status-completed': order.status==='progress'?'status-progress':'status-pending'; const statusText = order.status==='completed'?'Concluída': order.status==='progress'?'Em Andamento':'Pendente'; const servicesList = order.services?.length? order.services.slice(0,3).map(s=>`<span class="service-tag">${s}</span>`).join('') : '<span class="service-tag">Nenhum serviço</span>'; const more = order.services?.length>3? `<span class="service-tag">+${order.services.length-3} mais</span>`: ''; return `<div class="service-order-card"><div class="order-header"><div class="order-number">OS #${order.number}</div><div class="order-status ${statusClass}">${statusText}</div></div><div class="order-info"><strong>Cliente:</strong> ${order.client?.name||'N/A'}<br/><strong>Data:</strong> ${order.date||'N/A'}<br/><strong>Execução:</strong> ${order.executionDate||'Não agendada'}<br/><strong>Responsável:</strong> ${order.technicalResponsible||'Tassio Pires de Oliveira'}<br/><strong>Valor:</strong> ${order.totalValue||'R$ 0,00'}</div><div class="order-services"><h5>Serviços:</h5><div class="order-services-list">${servicesList}${more}</div></div><div class="order-actions"><button class="btn btn-primary" onclick="manager.reprintOrder('${order.id}')">Reimprimir</button><button class="btn btn-success" onclick="manager.markOrderCompleted('${order.id}')">Marcar Concluída</button></div></div>`; }).join(''); }
  reprintOrder(id){ const o = this.orders.find(x=>x.id===id); if (o) this.openPrintPage(o); }
  async markOrderCompleted(id){ if (!this.currentUser) return; try { await db.collection('users').doc(this.currentUser.uid).collection('orders').doc(id).update({ status:'completed', completedAt: firebase.firestore.FieldValue.serverTimestamp() }); this.toast('Ordem marcada como concluída','success'); } catch{ this.toast('Erro ao atualizar status','error'); } }

  // Senha forte UI
  validateStrongPassword(pwd){ const errors=[]; const cfg = SECURITY_CONFIG.password; if (pwd.length<cfg.minLength) errors.push(`Mínimo ${cfg.minLength} caracteres`); if (cfg.requireUppercase && !/[A-Z]/.test(pwd)) errors.push('Pelo menos uma letra maiúscula'); if (cfg.requireLowercase && !/[a-z]/.test(pwd)) errors.push('Pelo menos uma letra minúscula'); if (cfg.requireNumbers && !/[0-9]/.test(pwd)) errors.push('Pelo menos um número'); if (cfg.requireSpecialChars && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>\/?]/.test(pwd)) errors.push('Pelo menos um caractere especial'); const lower = pwd.toLowerCase(); if (SECURITY_CONFIG.password.blockedPasswords.some(b=>lower.includes(b))) errors.push('Não pode conter palavras comuns'); if (/123456|abcdef|qwerty/i.test(pwd)) errors.push('Evite sequências óbvias'); return { isValid: errors.length===0, errors, strength: this.calculatePasswordStrength(pwd) }; }
  calculatePasswordStrength(p){ let s=0; if (p.length>=8) s++; if (/[A-Z]/.test(p)) s++; if (/[a-z]/.test(p)) s++; if (/[0-9]/.test(p)) s++; if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>\/?]/.test(p)) s++; return s; }
  validatePasswordUI(p){ const reqs = { length: p.length>=12, uppercase:/[A-Z]/.test(p), lowercase:/[a-z]/.test(p), number:/[0-9]/.test(p), special:/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>\/?]/.test(p)}; document.querySelectorAll('.password-requirement').forEach(li=>{ const r = li.dataset.requirement; li.classList.toggle('valid', !!reqs[r]); li.classList.toggle('invalid', !reqs[r]); }); const strengthBar = document.getElementById('strengthBar'); const t = this.calculatePasswordStrength(p); strengthBar.className = 'password-strength-bar'; if (t<=2) { /* default weak */ } else if (t<=3) { strengthBar.classList.add('medium'); } else if (t<=4) { strengthBar.classList.add('strong'); } else { strengthBar.classList.add('very-strong'); } document.getElementById('strengthText').textContent = 'Força da senha: ' + (t<=2?'Fraca': t<=3?'Média': t<=4?'Forte':'Muito forte'); return Object.values(reqs).every(Boolean); }
  validateConfirmUI(p,c){ const el = document.getElementById('confirmMessage'); if (c && p!==c){ el.textContent = 'As senhas não coincidem'; el.className='invalid'; } else { el.textContent = 'Senhas coincidem'; el.className='valid'; }
    return p===c; }

  // Utils
  toast(msg,type='info'){ const n = document.createElement('div'); n.style.cssText = `position:fixed;top:20px;right:20px;padding:14px 18px;background:${type==='success'?'#16a34a': type==='error'?'#dc2626':'#334155'};color:#fff;border-radius:10px;z-index:9999;font-weight:700;box-shadow:0 10px 30px rgba(0,0,0,.25)`; n.textContent = msg; document.body.appendChild(n); setTimeout(()=>{ n.style.opacity='0'; setTimeout(()=>n.remove(),300); }, 2600); }
}

let manager; document.addEventListener('DOMContentLoaded', ()=>{ manager = new ServiceOrderManager(); });
// Expor globalmente para handlers inline
window.manager = undefined;
document.addEventListener('DOMContentLoaded', ()=>{ window.manager = manager; });
