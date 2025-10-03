// App moderno de produção: baseado em homolog/app-modern-homolog.js, adaptado para Firebase compat v10
let app, auth, db;

// Inicialização Firebase (compat v10)
function initializeFirebase() {
  try {
    if (typeof firebase === 'undefined') { console.error('Firebase SDK não carregado'); return false; }
    if (!window.firebaseConfig) { console.error('Configuração Firebase não encontrada'); return false; }
    if (firebase.apps.length === 0) firebase.initializeApp(window.firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
  // Mitiga erros de transporte (WebChannel 400/terminate) em algumas redes/proxies
  // Força long polling e desabilita autodetecção explicitamente para evitar conflito
  try { db.settings({ experimentalForceLongPolling: true, experimentalAutoDetectLongPolling: false, useFetchStreams: false, merge: true }); } catch(e) { console.warn('Não foi possível aplicar settings do Firestore', e); }
    console.log('🔥 Firebase inicializado (moderno prod)');
    return true;
  } catch (e) { console.error('Erro ao inicializar Firebase:', e); return false; }
}

const SECURITY_CONFIG = { password: { minLength: 12, requireUppercase: true, requireLowercase: true, requireNumbers: true, requireSpecialChars: true } };
// Admin principal (usado apenas para atribuir role automaticamente no primeiro perfil)
const DEFAULT_ADMIN_EMAIL = 'conservatorio86@gmail.com';

class SecurityAudit { static log(t,d={}){ const x={timestamp:new Date().toISOString(),t,d}; try{const k=JSON.parse(localStorage.getItem('audit_logs')||'[]'); k.push(x); if(k.length>1000)k.splice(0,k.length-1000); localStorage.setItem('audit_logs',JSON.stringify(k));}catch{} console.log('[AUDIT]',t,d);} }

class OSManagerApp {
  constructor(){
    this.currentUser=null; this.userRole=null; this.clients=[]; this.orders=[]; this.users=[];
    this.unsubscribeClients=null; this.unsubscribeOrders=null;
    this._appButtonsBound=false; this._sidebarDelegated=false;
    // Inatividade: 20 minutos (1200000 ms)
    this.idleTimeoutMs = 20 * 60 * 1000;
    this.idleTimer = null;
    this._idleBound = false;
    this._idleResetHandler = null;
    this.init();
  }
  getStatusLabel(code){
    const map={ pending:'Pendente', progress:'Em Andamento', completed:'Concluída' };
    return map[code]||code||'';
  }
  init(){ this.setupAuth(); this.setupUI(); this.setupSidebar(); }
  setupAuth(){
    if (!auth) return;
    auth.onAuthStateChanged(async (user)=>{
      if (user){
        this.currentUser=user;
        // Garante perfil e papel antes de exibir a UI e iniciar listeners
        await this.ensureUserProfile();
        this.showApp();
        this.loadDashboard();
        this.loadRealtime();
      } else {
        this.currentUser=null;
        // encerra listeners anteriores, se houver
        try{ this.unsubscribeClients?.(); }catch{}
        try{ this.unsubscribeOrders?.(); }catch{}
        this.showLogin();
      }
    });
  }
  showLogin(){ document.getElementById('loginScreen').classList.remove('hidden'); document.getElementById('appScreen').classList.add('hidden'); this.bindLoginForms(); }
  showApp(){
    const loginScr=document.getElementById('loginScreen');
    const appScr=document.getElementById('appScreen');
    if(loginScr) loginScr.classList.add('hidden');
    if(appScr) appScr.classList.remove('hidden');
    const nameLabel=document.getElementById('userName');
    if(nameLabel) nameLabel.textContent = this.currentUser?.displayName || this.currentUser?.email || 'Usuário';
    const roleLabel=document.getElementById('userRole');
    if(roleLabel){
      // Limpa qualquer texto de cargo (exibição suprimida por requisito)
      roleLabel.textContent='';
      roleLabel.title = this.userRole || '';
    }
    // Força todos admin-only ocultos (menu removido)
    document.querySelectorAll('.admin-only').forEach(el=>{ el.style.display='none'; });
    // garante modo expandido por padrão ao entrar
    document.body.classList.remove('sidebar-collapsed');
    this.bindAppButtons();
    // garante que o dashboard esteja visível após login
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    document.getElementById('dashboard-view')?.classList.add('active');
    // Abre o dropdown de Ordens apenas na primeira carga da sessão (evita sensação de desaparecido)
    try{ if(!sessionStorage.getItem('submenuInitialOpen')){ this.openSubmenu('orders-submenu'); const item=document.querySelector('.nav-item.has-submenu[data-target="orders-submenu"]'); item?.scrollIntoView({block:'nearest'}); sessionStorage.setItem('submenuInitialOpen','1'); } } catch{}
    // Inicia rastreamento de inatividade após exibir app
    this.setupIdleTracking();
  }

  openSubmenu(id){ const submenu=document.getElementById(id); if(!submenu) return; submenu.classList.add('open'); submenu.style.display='block'; const item=submenu.previousElementSibling; if(item && item.classList.contains('nav-item')) item.classList.add('open'); }

  async ensureUserProfile(){
    try{
      const uid=this.currentUser.uid; const ref=db.collection('users').doc(uid);
      const snap=await ref.get();
      if(!snap.exists){
        const role = (this.currentUser.email===DEFAULT_ADMIN_EMAIL) ? 'admin' : 'user';
        await ref.set({ email:this.currentUser.email, name:this.currentUser.displayName||'', role, createdAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
        this.userRole=role;
        if(role==='admin') this.toast('Perfil criado como administrador (primeiro acesso)','success');
      } else {
        const data=snap.data(); this.userRole=data.role||'user';
        // força admin para o e-mail padrão, mesmo que já exista com outro papel
        if(this.currentUser.email===DEFAULT_ADMIN_EMAIL && this.userRole!=='admin'){
          await ref.update({ role:'admin', updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
          this.userRole='admin';
          this.toast('Papel elevado para Administrador (usuário padrão)','success');
        }
      }
    } catch(e){ console.warn('Falha ao garantir perfil do usuário', e); this.userRole='user'; }
    this.updateRoleUI(); // aplica estado final quando perfil confirmado
  }

  updateRoleUI(){
    // Mantém this.userRole para lógica interna, mas oculta a visualização textual do cargo
    const label=document.getElementById('userRole');
    if(label){
      // Esvazia o texto do cargo para mostrar só o nome do usuário na topbar
      label.textContent='';
      // Opcional: poderia adicionar um title se quiser ver ao passar mouse
      label.title = this.userRole ? (this.userRole==='admin' ? 'Administrador' : 'Usuário') : '';
      // Também pode usar data-attribute para debug
      label.setAttribute('data-role', this.userRole||'');
    }
    // Elementos admin-only permanecem ocultos (requisito anterior de remover menu de gestão)
    document.querySelectorAll('.admin-only').forEach(el=> el.style.display='none');
  }

  setupUI(){ this.bindLoginForms(); }
  // Mantido por compatibilidade: lógica da sidebar está em bindAppButtons
  setupSidebar(){ /* noop - sidebar handled in bindAppButtons */ }
  bindLoginForms(){ const showReg=document.getElementById('showRegister'); const showLogin=document.getElementById('showLogin'); if (showReg) showReg.addEventListener('click',(e)=>{e.preventDefault(); document.getElementById('registerForm').classList.remove('hidden'); document.querySelector('#loginForm').parentElement.classList.add('hidden');}); if (showLogin) showLogin.addEventListener('click',(e)=>{e.preventDefault(); document.getElementById('registerForm').classList.add('hidden'); document.querySelector('#loginForm').parentElement.classList.remove('hidden');}); const pwd=document.getElementById('registerPassword'); const confirm=document.getElementById('confirmPassword'); if(pwd) pwd.addEventListener('input',(e)=>this.updatePasswordUI(e.target.value)); if(confirm) confirm.addEventListener('input',(e)=>this.updateConfirmUI(pwd.value,e.target.value)); const lf=document.getElementById('loginForm'); if(lf) lf.addEventListener('submit',(e)=>this.handleLogin(e)); const rf=document.getElementById('registerFormSubmit'); if(rf) rf.addEventListener('submit',(e)=>this.handleFirstPassword(e)); }

  bindAppButtons(){
    if (this._appButtonsBound) return; // evita bind duplicado
    const logout=document.getElementById('btnLogout'); if(logout) logout.addEventListener('click',()=>document.getElementById('logoutModal').classList.remove('hidden'));
    document.getElementById('confirmLogout')?.addEventListener('click',()=>this.logout());
    document.getElementById('cancelLogout')?.addEventListener('click',()=>document.getElementById('logoutModal').classList.add('hidden'));

    const toggle=document.getElementById('sidebarToggle'); const sidebar=document.getElementById('sidebar');
    if(toggle && sidebar){ toggle.addEventListener('click',()=>{
        if (window.matchMedia('(max-width: 768px)').matches){ sidebar.classList.toggle('open'); }
        else { document.body.classList.toggle('sidebar-collapsed'); }
      });
    }
    const title=document.querySelector('.app-title'); if(title){ title.addEventListener('click',(e)=>{ e.preventDefault(); document.querySelectorAll('.view').forEach(v=>v.classList.remove('active')); document.getElementById('dashboard-view')?.classList.add('active'); document.querySelectorAll('.submenu .nav-link').forEach(a=>a.classList.remove('active')); }); }

    // Delegação de eventos no sidebar para submenus e navegação
    if (sidebar && !this._sidebarDelegated){
      sidebar.addEventListener('click',(e)=>{
        const item = e.target.closest('.nav-item.has-submenu');
        if (item && sidebar.contains(item)){
          e.preventDefault();
          const targetId=item.getAttribute('data-target');
          const submenu=document.getElementById(targetId);
          if (submenu){
            const isOpen = !submenu.classList.contains('open');
            submenu.classList.toggle('open', isOpen);
            submenu.style.display = isOpen? 'block':'none';
            item.classList.toggle('open', isOpen);
          }
          return;
        }
        const link = e.target.closest('.nav-link[data-view]');
        if (link && sidebar.contains(link)){
          e.preventDefault();
          const viewId = link.getAttribute('data-view')+'-view';
          document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
          this.ensureView(viewId);
          document.querySelectorAll('.submenu .nav-link').forEach(a=>a.classList.remove('active'));
          link.classList.add('active');
          const submenu = link.closest('.submenu');
          if (submenu){
            submenu.classList.add('open');
            submenu.style.display='block';
            const parentItem = submenu.previousElementSibling;
            if (parentItem && parentItem.classList.contains('nav-item')) parentItem.classList.add('open');
          }
        }
      });
      this._sidebarDelegated = true;
    }
    this._appButtonsBound = true;
  }

  // Auth handlers (restored)
  async handleLogin(e){ e.preventDefault(); const email=document.getElementById('loginEmail').value.trim(); const password=document.getElementById('loginPassword').value; if(!email||!password){ this.toast('Informe email e senha','error'); return; } try{ await auth.signInWithEmailAndPassword(email,password); this.toast('Login realizado','success'); } catch(err){ this.toast('Falha no login: '+(err.code||''),'error'); } }

  async handleFirstPassword(e){ e.preventDefault(); const email=document.getElementById('registerEmail').value.trim(); const password=document.getElementById('registerPassword').value;
    // Caminho especial: admin default não exige pré-cadastro em Firestore
    if(email===DEFAULT_ADMIN_EMAIL){
      const v=this.validateStrong(password); if(!v.isValid){ this.toast('Senha fraca: '+v.errors.join(', '),'error'); return; }
      try{ const res=await auth.createUserWithEmailAndPassword(email,password); await res.user.updateProfile({displayName:'Administrador'}); this.toast('Senha definida. Faça login.','success'); document.getElementById('showLogin').click(); } catch(err){ this.toast('Erro ao definir senha: '+(err.code||''),'error'); }
      return;
    }
    // Demais usuários: requerem pré-cadastro
    let pre=await this.getPreRegistered(email);
    if(!pre){ this.toast('E-mail não pré-cadastrado','error'); return; }
    if(pre.passwordSet){ this.toast('Senha já definida para este usuário','error'); return; }
    const v=this.validateStrong(password); if(!v.isValid){ this.toast('Senha fraca: '+v.errors.join(', '),'error'); return; }
    try{ const res=await auth.createUserWithEmailAndPassword(email,password); await res.user.updateProfile({displayName: pre.name||'Usuário'}); await this.markPasswordAsSet(email); this.toast('Senha definida. Faça login.','success'); document.getElementById('showLogin').click(); } catch(err){ this.toast('Erro ao definir senha: '+(err.code||''),'error'); }
  }

  async logout(){
    try{
      // encerra listeners antes de sair
      try{ this.unsubscribeClients?.(); }catch{}
      try{ this.unsubscribeOrders?.(); }catch{}
      // Limpa timer de inatividade
      if(this.idleTimer){ clearTimeout(this.idleTimer); this.idleTimer=null; }
      // Remove listeners de inatividade (serão re-adicionados no próximo login)
      if(this._idleBound && this._idleResetHandler){
        ['mousemove','keydown','click','scroll','touchstart'].forEach(ev=> window.removeEventListener(ev,this._idleResetHandler));
        document.removeEventListener('visibilitychange', this._idleVisibilityHandler);
        this._idleBound=false;
      }
      await auth.signOut();
      document.getElementById('logoutModal').classList.add('hidden');
      this.toast('Logout realizado','success');
    } catch{ this.toast('Erro no logout','error'); }
  }

  async getPreRegistered(email){ try{ const doc=await db.collection('pre_registered_users').doc(email).get(); return doc.exists? doc.data(): null; } catch{return null} }
  async markPasswordAsSet(email){ try{ await db.collection('pre_registered_users').doc(email).update({ passwordSet:true, passwordSetAt: firebase.firestore.FieldValue.serverTimestamp() }); } catch{} }

  // Criação e ligação de views
  ensureView(viewId){
    let view=document.getElementById(viewId);
    if(!view){
      view = document.createElement('div'); view.id=viewId; view.className='view';
      if(viewId==='new-order-view') view.innerHTML=this.tplNewOrder();
      else if(viewId==='orders-list-view') view.innerHTML=this.tplOrdersList();
      else if(viewId==='new-client-view') view.innerHTML=this.tplNewClient();
      else if(viewId==='clients-list-view') view.innerHTML=this.tplClientsList();
  // Removidos: users-management-view e audit-logs-view (ocultados por requisito)
      else view.innerHTML=this.tplPlaceholder('Página');
      document.getElementById('mainContent').appendChild(view);
      this.wireView(viewId);
    }
    view.classList.add('active');
  }

  tplPlaceholder(title){ return `<div class="page-header"><h1>${title}</h1></div><div class="no-data">Conteúdo em preparação...</div>`; }

  // Templates
  tplNewOrder(){ return `
    <div class="page-header"><h1><i class="fas fa-plus"></i> Nova Ordem de Serviço</h1><p>Fluxo simplificado (como na homologação)</p></div>
    <div class="table-container">
      <form id="newOrderForm">
        <!-- Seção de Clientes -->
        <h3>Clientes</h3>
        <div class="filter-group" style="justify-content:space-between;flex-wrap:wrap">
          <div class="input-search">
            <i class="fas fa-search"></i>
            <input type="text" id="clientSearch" class="search-input" placeholder="Buscar cliente por nome, e-mail ou telefone..." />
            <button type="button" id="clearClientSearch" class="clear-btn" title="Limpar"><i class="fas fa-times"></i></button>
          </div>
          <button type="button" id="toggleQuickClientForm" class="btn btn-secondary"><i class="fas fa-user-plus"></i> Novo Cliente</button>
        </div>
        <div id="clientSearchResults" class="table-wrapper client-results" style="display:none;margin-top:8px"><table class="data-table"><thead><tr><th>Nome</th><th>Email</th><th>Telefone</th><th style="width:110px">Ação</th></tr></thead><tbody id="clientSearchBody"></tbody></table></div>
        <div id="selectedClientBox" class="selected-client" style="margin-top:8px">
          <h4>Cliente Selecionado</h4>
          <div class="selected-empty">Nenhum cliente selecionado.</div>
        </div>

        <div id="quickClientForm" class="client-quick-form hidden" style="margin-top:12px">
          <h4>Cadastro de Cliente</h4>
          <div class="form-row">
            <div class="form-group"><label>Nome Completo</label><input type="text" id="qClientName"/></div>
            <div class="form-group"><label>Telefone</label><input type="tel" id="qClientPhone" placeholder="(69) 99999-9999" maxlength="15"/></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Data de Nascimento</label><input type="date" id="qClientBirthDate"/></div>
            <div class="form-group"><label>RG</label><input type="text" id="qClientRG" placeholder="12.345.678-9"/></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>CPF</label><input type="text" id="qClientCPF" placeholder="123.456.789-00"/></div>
            <div class="form-group"><label>E-mail</label><input type="email" id="qClientEmail"/></div>
          </div>
          <div class="form-group"><label>Endereço Completo</label><textarea id="qClientAddress" rows="2" placeholder="Rua, número, bairro, cidade, CEP..."></textarea></div>
          <div class="filter-group"><button type="button" id="btnQuickSaveClient" class="btn btn-success">Salvar Cliente</button><button type="button" id="btnQuickCancel" class="btn btn-secondary">Cancelar</button></div>
        </div>

        <!-- Cabeçalho da OS -->
        <h3 style="margin-top:16px">Ordem de Serviço</h3>
        <div class="os-header">
          <div class="form-group"><label for="osNumber">Nº da OS</label><input type="text" id="osNumber" placeholder="Gerado automaticamente" disabled/><small class="field-hint">Gerado automaticamente</small></div>
          <div class="form-group"><label for="osDate">Data</label><input type="date" id="osDate" class="input-compact"/></div>
        </div>

        <!-- Serviços -->
        <div class="service-details">
          <h3>Detalhamento do Serviço</h3>
          <div class="service-categories-grid">
            <div class="service-category"><h4>Pré-produção</h4><div class="service-items">
              <label><input type="checkbox" name="service" value="Pré-produção: Planejamento"> Planejamento</label>
              <label><input type="checkbox" name="service" value="Pré-produção: Testes"> Testes</label>
              <label><input type="checkbox" name="service" value="Pré-produção: Ensaio"> Ensaio</label>
              <label><input type="checkbox" name="service" value="Pré-produção: Partitura"> Partitura</label>
              <label><input type="checkbox" name="service" value="Pré-produção: Arranjo"> Arranjo</label>
            </div></div>
            <div class="service-category"><h4>Produção</h4><div class="service-items">
              <label><input type="checkbox" name="service" value="Produção: Gravação"> Gravação</label>
              <label><input type="checkbox" name="service" value="Produção: Masterização"> Masterização</label>
              <label><input type="checkbox" name="service" value="Produção: Edição"> Edição</label>
              <label><input type="checkbox" name="service" value="Produção: Mixagem"> Mixagem</label>
              <label><input type="checkbox" name="service" value="Produção: Captação ao vivo"> Captação ao vivo</label>
              <label><input type="checkbox" name="service" value="Produção: VS/Playback/Trilha de apoio"> VS / Playback / Trilha de apoio</label>
              <label><input type="checkbox" name="service" value="Produção: Podcast/Audiobook"> Podcast / Audiobook</label>
              <label><input type="checkbox" name="service" value="Produção: Reamping"> Reamping</label>
              <label><input type="checkbox" name="service" value="Produção: Sound Design/Efeitos Sonoros"> Sound Design / Efeitos Sonoros</label>
              <label><input type="checkbox" name="service" value="Produção: Trilha Sonora/Música Original"> Trilha Sonora / Música Original</label>
            </div></div>
            <div class="service-category"><h4>Pós-produção</h4><div class="service-items">
              <label><input type="checkbox" name="service" value="Pós-produção: Filmagem de estúdio/making of"> Filmagem de estúdio / making of</label>
              <label><input type="checkbox" name="service" value="Pós-produção: Fotografia de estúdio"> Fotografia de estúdio</label>
              <label><input type="checkbox" name="service" value="Pós-produção: Vídeos conceituais"> Vídeos conceituais (animações ou takes abstratos)</label>
              <label><input type="checkbox" name="service" value="Pós-produção: Distribuição em Plataformas Streaming"> Distribuição em Plataformas Streaming</label>
              <label><input type="checkbox" name="service" value="Pós-produção: Personalização de perfil"> Personalização de perfil</label>
            </div></div>
          </div>
          <div class="form-group"><label for="outroServico">Outros serviços</label><input type="text" id="outroServico" placeholder="Especifique outros serviços..."/></div>
        </div>

        <div class="form-group"><label>Descrição detalhada do serviço</label><textarea id="serviceDescription" rows="3"></textarea></div>

        <!-- Agenda -->
        <div class="schedule-section"><h3>Agenda e Profissional</h3>
          <div class="form-row">
            <div class="form-group"><label>Data da execução</label><input type="date" id="execDate" class="input-compact"/></div>
            <div class="form-group"><label>Horário</label><input type="time" id="execTime" class="input-compact input-time"/></div>
          </div>
          <div class="form-group"><label>Tempo Estimado</label>
            <div class="filter-group">
              <label><input type="radio" name="estimatedTime" value="30 minutos"/> 30 minutos</label>
              <label><input type="radio" name="estimatedTime" value="50 minutos"/> 50 minutos</label>
              <label><input type="radio" name="estimatedTime" value="1 hora"/> 1 hora</label>
              <label><input type="radio" name="estimatedTime" value="1h30min"/> 1h30min</label>
              <label><input type="radio" name="estimatedTime" value="2 horas"/> 2 horas</label>
              <label><input type="radio" name="estimatedTime" value="2h30min"/> 2h30min</label>
            </div>
          </div>
        </div>

        <!-- Pagamento -->
        <div class="payment-section"><h3>Condições e Valores</h3>
          <div class="form-group"><label>Valor total</label><input type="text" id="totalValue" placeholder="R$ 0,00"/></div>
          <div class="form-group"><label>Forma de pagamento</label>
            <div class="filter-group">
              <label><input type="checkbox" name="payment" value="Pix"/> Pix</label>
              <label><input type="checkbox" name="payment" value="Cartão"/> Cartão</label>
              <label><input type="checkbox" name="payment" value="Dinheiro"/> Dinheiro</label>
              <label><input type="checkbox" name="payment" value="Boleto"/> Boleto</label>
            </div>
          </div>
          <div class="form-group"><label>Pagamento efetuado em</label><input type="date" id="paymentDate" class="input-compact"/></div>
        </div>

        <div class="filter-group"><button class="btn btn-primary" id="btnCreateOrder" type="submit"><i class="fas fa-print"></i> Gerar Ordem de Serviço para Impressão</button></div>
      </form>
    </div>`; }

  tplOrdersList(){ return `
    <div class="page-header"><h1><i class="fas fa-list"></i> Ordens de Serviço</h1></div>
    <div class="table-container">
      <div class="table-filters"><div class="filter-group">
        <input type="text" id="orderSearchFilter" placeholder="Buscar por cliente, descrição..."/>
        <select id="statusFilter"><option value="">Todos</option><option value="pending">Pendente</option><option value="progress">Em Andamento</option><option value="completed">Concluída</option></select>
        <button id="clearOrdersFilters" class="btn btn-secondary">Limpar</button>
      </div></div>
      <div class="table-wrapper"><table class="data-table"><thead><tr><th>OS #</th><th>Cliente</th><th>Descrição</th><th>Valor</th><th>Status</th><th>Data</th><th style="min-width:340px">Ações</th></tr></thead><tbody id="ordersTableBody"><tr><td colspan="7" class="no-data">Carregando...</td></tr></tbody></table></div>
    </div>`; }

  tplNewClient(){ return `
    <div class="page-header"><h1><i class="fas fa-user-plus"></i> Novo Cliente</h1></div>
    <div class="table-container"><form id="newClientForm">
      <div class="form-group"><label>Nome Completo</label><input type="text" id="clientName" required/></div>
      <div class="form-group"><label>E-mail</label><input type="email" id="clientEmail" required/></div>
      <div class="form-group"><label>Telefone</label><input type="tel" id="clientPhone"/></div>
      <div class="form-group"><label>CPF</label><input type="text" id="clientCPF"/></div>
      <div class="form-group"><label>Endereço</label><textarea id="clientAddress" rows="2"></textarea></div>
      <button class="btn btn-primary" type="submit">Salvar Cliente</button>
    </form></div>`; }

  tplClientsList(){ return `
    <div class="page-header"><h1><i class="fas fa-users"></i> Clientes</h1></div>
    <div class="table-container">
      <div class="table-filters"><div class="filter-group"><input type="text" id="clientSearchFilter" placeholder="Buscar por nome, email..."/><button id="clearClientFilters" class="btn btn-secondary">Limpar</button></div></div>
      <div class="table-wrapper"><table class="data-table"><thead><tr><th>Nome</th><th>E-mail</th><th>Telefone</th><th>Total OS</th><th style="min-width:220px">Ações</th></tr></thead><tbody id="clientsTableBody"><tr><td colspan="5" class="no-data">Carregando...</td></tr></tbody></table></div>
    </div>`; }

  tplUsersManagement(){ return `
    <div class="page-header"><h1><i class="fas fa-users-cog"></i> Gestão de Usuários</h1></div>
    <div class="table-container">
      <form id="preRegisterForm" class="filter-group" style="gap:12px;flex-wrap:wrap">
        <input type="text" id="preRegisterName" placeholder="Nome completo" required/>
        <input type="email" id="preRegisterEmail" placeholder="email@exemplo.com" required/>
        <input type="tel" id="preRegisterPhone" placeholder="(11) 99999-9999" required/>
        <select id="preRegisterRole" required><option value="">Nível</option><option value="user">Usuário</option><option value="admin">Administrador</option></select>
        <button type="submit" class="btn btn-primary"><i class="fas fa-user-plus"></i> Pré-cadastrar</button>
      </form>
      <div class="table-wrapper" style="margin-top:12px"><table class="data-table"><thead><tr><th>Nome</th><th>E-mail</th><th>Telefone</th><th>Nível</th><th>Status</th><th>Cadastrado em</th><th>Ações</th></tr></thead><tbody id="usersTableBody"><tr><td colspan="7" class="no-data">Carregando...</td></tr></tbody></table></div>
    </div>`; }

  tplAuditLogs(){ return `
    <div class="page-header"><h1><i class="fas fa-history"></i> Logs de Auditoria</h1></div>
    <div class="table-container"><div class="table-wrapper"><table class="data-table"><thead><tr><th>Data/Hora</th><th>Tipo</th><th>Detalhes</th></tr></thead><tbody id="logsTableBody"></tbody></table></div></div>`; }

  wireView(viewId){
    if(viewId==='new-order-view') this.wireNewOrder();
    if(viewId==='orders-list-view') this.renderOrdersTable();
    if(viewId==='new-client-view') this.wireNewClient();
    if(viewId==='clients-list-view') this.renderClientsTable();
    if(viewId==='users-management-view') this.wireUsersManagement();
    if(viewId==='audit-logs-view') this.renderAuditLogs();
  }

  // NEW ORDER
  wireNewOrder(){
    const search = document.getElementById('clientSearch');
    const clearBtn = document.getElementById('clearClientSearch');
    const resultsBox = document.getElementById('clientSearchResults');
    const resultsBody = document.getElementById('clientSearchBody');
    const selBox = document.getElementById('selectedClientBox');
    // Define data da OS como hoje por padrão
    const today = new Date();
    const isoToday = today.toISOString().slice(0,10);
    const osDate = document.getElementById('osDate');
    if (osDate && !osDate.value) osDate.value = isoToday;
    if (search){
      search.addEventListener('input',()=>{
        const q=search.value.toLowerCase();
        const list = this.clients.filter(c=> (c.name||'').toLowerCase().includes(q) || (c.email||'').toLowerCase().includes(q));
  resultsBody.innerHTML = list.map(c=>`<tr data-id="${c.id}"><td>${c.name}</td><td>${c.email||''}</td><td>${this.formatPhoneDisplay(c.phone||'')}</td><td><button type="button" class="btn btn-primary btn-sm" data-action="select">Selecionar</button></td></tr>`).join('');
        resultsBox.style.display = list.length? 'block':'none';
        resultsBody.querySelectorAll('tr[data-id]').forEach(row=>{
          const id=row.getAttribute('data-id');
          row.querySelector('[data-action="select"]').addEventListener('click',(ev)=>{ ev.preventDefault(); ev.stopPropagation();
            const cli=this.clients.find(x=>x.id===id); this.selectedClient=cli; selBox.innerHTML = `<h4>Cliente Selecionado</h4><div class="selected-data"><div>${cli.name} (${cli.email||''}) — ${this.formatPhoneDisplay(cli.phone||'')}</div><button type="button" class="btn btn-secondary btn-sm" id="btnChangeClient">Trocar</button></div>`; resultsBox.style.display='none';
            document.getElementById('btnChangeClient')?.addEventListener('click',()=>{ this.selectedClient=null; selBox.innerHTML = `<h4>Cliente Selecionado</h4><div class=\"selected-empty\">Nenhum cliente selecionado.</div>`; search.focus(); });
          });
        });
      });
    }
    // Evita que Enter no campo de busca submeta o formulário acidentalmente
    if (search){
      search.addEventListener('keydown',(e)=>{ if(e.key==='Enter'){ e.preventDefault(); e.stopPropagation(); }});
    }
    // Quick client form toggle
    document.getElementById('toggleQuickClientForm')?.addEventListener('click',()=>{
      document.getElementById('quickClientForm')?.classList.toggle('hidden');
    });
    document.getElementById('btnQuickCancel')?.addEventListener('click',()=>{
      document.getElementById('quickClientForm')?.classList.add('hidden');
    });
    // Quick save client
    document.getElementById('btnQuickSaveClient')?.addEventListener('click', async ()=>{
      const payload={
        name:document.getElementById('qClientName').value.trim(),
        phone:(document.getElementById('qClientPhone').value||'').replace(/\D/g,''),
        birthDate:document.getElementById('qClientBirthDate').value||'',
        rg:document.getElementById('qClientRG').value.trim(),
        cpf:(document.getElementById('qClientCPF').value||'').replace(/\D/g,''),
        email:document.getElementById('qClientEmail').value.trim(),
        address:document.getElementById('qClientAddress').value.trim()
      };
      if(!payload.name||!payload.email){ this.toast('Nome e e-mail são obrigatórios','error'); return; }
    // Botão limpar pesquisa
    if (clearBtn){
      clearBtn.addEventListener('click',()=>{
        if(search){ search.value=''; search.focus(); }
        if(resultsBody) resultsBody.innerHTML='';
        if(resultsBox) resultsBox.style.display='none';
      });
    }
      try{
        const col=db.collection('users').doc(this.currentUser.uid).collection('clients');
        const ref=await col.add({ ...payload, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        this.toast('Cliente salvo','success');
  this.selectedClient = { id: ref.id, ...payload };
  selBox.innerHTML = `<h4>Cliente Selecionado</h4><div class="selected-data"><div>${payload.name} (${payload.email}) — ${this.formatPhoneDisplay(payload.phone)}</div><button type=\"button\" class=\"btn btn-secondary btn-sm\" id=\"btnChangeClient\">Trocar</button></div>`;
  document.getElementById('btnChangeClient')?.addEventListener('click',()=>{ this.selectedClient=null; selBox.innerHTML = `<h4>Cliente Selecionado</h4><div class=\"selected-empty\">Nenhum cliente selecionado.</div>`; search.focus(); });
        document.getElementById('quickClientForm')?.classList.add('hidden');
      } catch{ this.toast('Erro ao salvar cliente','error'); }
    });
    document.getElementById('newOrderForm')?.addEventListener('submit',(e)=>{
      e.preventDefault(); this.createOrder();
    });
    document.getElementById('totalValue')?.addEventListener('input',(e)=>this.formatCurrency(e));
  }

  async createOrder(){
    if(!this.selectedClient){ this.toast('Selecione um cliente','error'); return; }
    const y=new Date().getFullYear();
    const next = await this.nextOrderNumber(y);
    const osNumber = `${String(next).padStart(3,'0')}/${y}`;
    // Exibe o número gerado na UI (campo bloqueado)
    const osNumberInput = document.getElementById('osNumber');
    if (osNumberInput) osNumberInput.value = osNumber;
    // Coleta serviços marcados
    const services = Array.from(document.querySelectorAll('input[name="service"]:checked')).map(cb=>cb.value);
    const outro = (document.getElementById('outroServico')||{}).value?.trim();
    if(outro) services.push(outro);
    const data = {
      number: osNumber,
      orderNumber: next,
      year: y,
      date: (document.getElementById('osDate')?.value? this.formatDate(document.getElementById('osDate').value) : new Date().toLocaleDateString('pt-BR')),
      client: this.selectedClient,
      services,
      description: document.getElementById('serviceDescription').value,
      executionDate: this.formatDate(document.getElementById('execDate').value),
      executionTime: document.getElementById('execTime').value,
      estimatedTime: (document.querySelector('input[name="estimatedTime"]:checked')||{}).value || '',
  technicalResponsible: 'Tassio Cristiano da Silva Pires',
      totalValue: document.getElementById('totalValue').value,
      paymentMethods: Array.from(document.querySelectorAll('input[name="payment"]:checked')).map(cb=>cb.value),
      paymentDate: this.formatDate(document.getElementById('paymentDate').value),
      status:'pending'
    };
    try{ await this.saveOrder(data); this.toast('OS gerada','success'); this.openPrint(data); } catch{ this.toast('Erro ao salvar OS','error'); }
  }

  async nextOrderNumber(year){
    const ref=db.collection('users').doc(this.currentUser.uid).collection('orders');
    try{
      const snap=await ref.where('year','==',year).orderBy('orderNumber','desc').limit(1).get();
      if(snap.empty) return 1; return (snap.docs[0].data().orderNumber||0)+1;
    } catch(err){
      // Fallback quando não há índice composto (year + orderNumber)
      if(err?.code==='failed-precondition' || String(err||'').toLowerCase().includes('index')){
        const snap=await ref.where('year','==',year).get();
        let max=0; snap.forEach(d=>{ const n=d.data()?.orderNumber||0; if(n>max) max=n; });
        return max+1;
      }
      throw err;
    }
  }
  async saveOrder(data){ const ref=db.collection('users').doc(this.currentUser.uid).collection('orders'); const docRef = await ref.add({...data, createdAt: firebase.firestore.FieldValue.serverTimestamp(), lastEvent:'opened'}); return docRef; }

  // ORDERS LIST
  renderOrdersTable(){ const tbody=document.getElementById('ordersTableBody'); if(!tbody) return; const filter=document.getElementById('orderSearchFilter'); const status=document.getElementById('statusFilter'); const render=()=>{
      const q=(filter?.value||'').toLowerCase(); const st=status?.value||'';
      const list=this.orders.filter(o=> {
        const hit = (o.client?.name||'').toLowerCase().includes(q) || (o.description||'').toLowerCase().includes(q) || (o.number||'').toLowerCase().includes(q);
        const stOk = st? (o.status===st) : true; return hit && stOk;
      });
      tbody.innerHTML = list.length? list.map(o=>{
        const viewBtn = `<button class=\"btn btn-secondary btn-sm\" data-action=\"view\" data-id=\"${o.id}\"><i class=\"fas fa-eye\"></i> Visualizar</button>`;
        const printBtn = `<button class=\"btn btn-secondary btn-sm\" data-action=\"print\" data-id=\"${o.id}\"><i class=\"fas fa-print\"></i> Imprimir</button>`;
        const reopenBtn = o.status==='completed'? `<button class=\"btn btn-warning btn-sm\" data-action=\"reopen\" data-id=\"${o.id}\"><i class=\"fas fa-rotate-left\"></i> Reabrir</button>` : '';
        const completeBtn = o.status!=='completed'? `<button class=\"btn btn-success btn-sm\" data-action=\"complete\" data-id=\"${o.id}\"><i class=\"fas fa-check\"></i> Concluir</button>` : '';
  return `<tr data-row-id="${o.id}"><td>${o.number}</td><td>${o.client?.name||''}</td><td>${(o.description||'').slice(0,80)}</td><td>${o.totalValue||'R$ 0,00'}</td><td class="status-cell" data-status="${o.status||''}">${this.getStatusLabel(o.status)}</td><td>${o.date||''}</td><td><div class="actions">${viewBtn} ${printBtn} ${completeBtn} ${reopenBtn}</div></td></tr>`;
      }).join('') : `<tr><td colspan=\"7\" class=\"no-data\">Nenhum registro</td></tr>`;
      // bind ações
      tbody.querySelectorAll('button[data-action]').forEach(btn=>{
        const id=btn.getAttribute('data-id'); const act=btn.getAttribute('data-action');
        btn.addEventListener('click', async ()=>{
          const row = btn.closest('tr');
          const order=this.orders.find(x=>x.id===id); if(!order) return;
          if(act==='view'){ this.openOrderView(order); return; }
          if(act==='print'){ this.openPrint(order); return; }
          if(act==='complete'){
            // otimista: atualiza UI antes da confirmação do servidor
            this.optimisticOrderUpdate(row, 'completed');
            try{ await this.completeOrder(id); } catch{ this.optimisticOrderUpdate(row, order.status||'pending'); this.toast('Falha ao concluir','error'); }
            return;
          }
          if(act==='reopen'){
            this.optimisticOrderUpdate(row, 'pending');
            try{ await this.reopenOrder(id); } catch{ this.optimisticOrderUpdate(row, order.status||'completed'); this.toast('Falha ao reabrir','error'); }
            return;
          }
        });
      });
    };
  filter?.addEventListener('input',render); status?.addEventListener('change',render); document.getElementById('clearOrdersFilters')?.addEventListener('click',()=>{ if(filter) filter.value=''; if(status) status.value=''; render(); }); render(); }

  // Atualização otimista dos botões e status na linha da tabela
  optimisticOrderUpdate(row, newStatus){ if(!row) return; const statusCell=row.querySelector('.status-cell'); if(statusCell){ statusCell.textContent=this.getStatusLabel(newStatus); statusCell.setAttribute('data-status', newStatus);} const actions=row.querySelector('.actions'); if(!actions) return; const id=row.getAttribute('data-row-id'); const viewBtn=`<button class="btn btn-secondary btn-sm" data-action="view" data-id="${id}"><i class="fas fa-eye"></i> Visualizar</button>`; const printBtn=`<button class="btn btn-secondary btn-sm" data-action="print" data-id="${id}"><i class="fas fa-print"></i> Imprimir</button>`; const completeBtn = newStatus!=='completed'? `<button class="btn btn-success btn-sm" data-action="complete" data-id="${id}"><i class="fas fa-check"></i> Concluir</button>`: '' ; const reopenBtn = newStatus==='completed'? `<button class="btn btn-warning btn-sm" data-action="reopen" data-id="${id}"><i class="fas fa-rotate-left"></i> Reabrir</button>`: '' ; actions.innerHTML = `${viewBtn} ${printBtn} ${completeBtn} ${reopenBtn}`; // rebind recém-criados rapidamente
    actions.querySelectorAll('button[data-action]').forEach(btn=>{
      const act=btn.getAttribute('data-action'); const bid=btn.getAttribute('data-id'); btn.addEventListener('click', async ()=>{
        const order=this.orders.find(x=>x.id===bid); if(!order) return;
        if(act==='view'){ this.openOrderView(order); return; }
        if(act==='print'){ this.openPrint(order); return; }
        if(act==='complete'){ this.optimisticOrderUpdate(row,'completed'); try{ await this.completeOrder(bid); } catch{ this.optimisticOrderUpdate(row, order.status||'pending'); this.toast('Falha ao concluir','error'); } return; }
        if(act==='reopen'){ this.optimisticOrderUpdate(row,'pending'); try{ await this.reopenOrder(bid); } catch{ this.optimisticOrderUpdate(row, order.status||'completed'); this.toast('Falha ao reabrir','error'); } return; }
      });
    });
  }

  openOrderView(order){ const modal=document.getElementById('orderViewModal'); const body=document.getElementById('orderViewBody'); const btnClose=document.getElementById('orderViewClose'); const btnPrint=document.getElementById('orderViewPrint'); if(!modal||!body) return; const g=this.parseServicesByCategory(order.services||[]); const block=(t,items)=>`<div><h4 style="margin:8px 0 6px">${t}</h4>${items.length? `<ul style=\"margin-left:16px\">${items.map(i=>`<li>${i}</li>`).join('')}</ul>`:'<div style="color:#64748b">—</div>'}</div>`; body.innerHTML = `
      <div><strong>OS:</strong> ${order.number}</div>
      <div><strong>Cliente:</strong> ${order.client?.name||''} (${order.client?.email||''})</div>
      <div><strong>Telefone:</strong> ${this.formatPhoneDisplay(order.client?.phone||'')}</div>
      <div><strong>Data:</strong> ${order.date||''}</div>
      <div><strong>Status:</strong> ${order.status||''}</div>
      <div><strong>Valor:</strong> ${order.totalValue||'R$ 0,00'}</div>
      <div style="margin-top:10px"><strong>Serviços</strong>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:6px">
          ${block('Pré-produção', g.pre)}
          ${block('Produção', g.prod)}
          ${block('Pós-produção', g.pos)}
        </div>
        ${g.outros.length? `<div style=\"margin-top:8px\">${block('Outros', g.outros)}</div>`:''}
      </div>
      <div style="margin-top:10px"><strong>Descrição:</strong><br/>${order.description||''}</div>
    `; modal.classList.remove('hidden');
    const close=()=> modal.classList.add('hidden'); btnClose?.addEventListener('click', close, { once:true }); modal.addEventListener('click',(e)=>{ if(e.target===modal) close(); }, { once:true }); btnPrint?.addEventListener('click',()=> this.openPrint(order), { once:true }); }

  async completeOrder(id){ await db.collection('users').doc(this.currentUser.uid).collection('orders').doc(id).update({ status:'completed', completedAt: firebase.firestore.FieldValue.serverTimestamp(), lastEvent:'completed' }); this.toast('OS concluída','success'); }
  async reopenOrder(id){ await db.collection('users').doc(this.currentUser.uid).collection('orders').doc(id).update({ status:'pending', reopenedAt: firebase.firestore.FieldValue.serverTimestamp(), lastEvent:'reopened' }); this.toast('OS reaberta','success'); }
  openPrint(o){ const w=window.open('','_blank'); w.document.write(this.generatePrintHTML(o)); w.document.close(); setTimeout(()=>w.print(),400); }

  generatePrintHTML(order){
    // Garantias básicas
    const services = (order.services||[]);
    const groups = this.parseServicesByCategory(services);
    const listBlock = (title, arr)=> arr && arr.length? `<div class="svc-col"><h4>${title}</h4><ul>${arr.map(i=>`<li>${i}</li>`).join('')}</ul></div>`: '';
    const today = new Date();
    const fmtDate = d=> d? d: '';
    const client = order.client||{};
    const payments = (order.paymentMethods||[]).join(', ')||'—';
    const logoPath = './img/logo.png'; // relativo à janela de impressão (mesmo host)
    // Info da empresa (pode ser sobrescrito antes da impressão via window.COMPANY_INFO)
    const company = (typeof window !== 'undefined' && window.COMPANY_INFO) ? window.COMPANY_INFO : {
      name: '',
      cnpj: '',
      phone: '',
      email: '',
      site: '',
      address: ''
    };
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/>
      <title>OS ${order.number||''}</title>
      <meta name="viewport" content="width=device-width,initial-scale=1"/>
      <style>
  :root{--ink:#0f172a;--ink-soft:#475569;--brand:#1e3a8a;--border:#7f8c99;--border-strong:#566374;--border-header:#d2dde9;--bg:#ffffff;--bg-alt:#f5f8fc;--radius:10px;--accent:#2563eb;}
        *{box-sizing:border-box;margin:0;padding:0;font-family:Inter,Arial,sans-serif;}
  body{background:#f1f5fa;color:var(--ink);padding:32px;position:relative;overflow:visible;}
  .watermark{position:fixed;inset:0;pointer-events:none;display:flex;align-items:center;justify-content:center;z-index:0;font-size:68px;font-weight:700;letter-spacing:4px;font-family:Inter,Arial,sans-serif;color:rgba(30,58,138,.06);transform:rotate(-24deg);user-select:none;text-transform:uppercase}
  header.print-header{display:flex;align-items:flex-start;gap:18px;margin-bottom:24px;padding:16px 22px;border:1.15px solid var(--border-strong);border-radius:16px;background:linear-gradient(135deg,#ffffff 0%,#f3f7fb 85%);box-shadow:0 4px 12px -4px rgba(0,0,0,.12)}
        .logo-box{width:72px;height:72px;border-radius:16px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#fff;border:1px solid #e2e8f0}
        .logo-box img{max-width:100%;max-height:100%;object-fit:contain}
  .doc-meta h1{font-size:22px;letter-spacing:.5px;color:var(--brand);margin:0 0 6px;font-weight:700;display:flex;align-items:center;gap:8px}
  .doc-meta small{display:block;color:var(--ink-soft);font-size:12px;font-weight:500;letter-spacing:.5px}
  .company-block{margin-top:2px;display:flex;flex-direction:column;gap:2px;font-size:11px;line-height:1.25;color:var(--ink-soft);font-weight:500;max-width:640px}
  .company-block .address{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ink-soft)}
  .company-block .contact{white-space:nowrap;}
  .company-block .phone{white-space:nowrap;}
  .company-block .generated{margin-top:2px;}
  .company-block .generated strong{color:var(--ink);font-weight:700;font-size:11px}
  .company-inline{display:block;margin-top:4px;color:var(--ink-soft);font-size:11px;line-height:1.3;font-weight:500;max-width:520px}
  .company-inline strong{color:var(--ink);font-weight:600}
        .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin-top:4px}
  .panel{background:var(--bg);border:1.15px solid var(--border-strong);padding:14px 16px;border-radius:var(--radius);position:relative}
        .panel h3{font-size:14px;text-transform:uppercase;letter-spacing:.8px;font-weight:600;color:var(--ink-soft);margin:0 0 10px}
        .kv{display:grid;grid-template-columns:130px 1fr;row-gap:6px;font-size:13px}
        .kv strong{font-weight:600;color:var(--ink-soft)}
        .services-wrapper{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-top:10px}
        .svc-col h4{font-size:13px;margin:0 0 6px;color:var(--brand);text-transform:uppercase;letter-spacing:.7px}
        .svc-col ul{list-style:disc;margin-left:18px;display:flex;flex-direction:column;gap:3px;font-size:12px}
  .desc-box{margin-top:14px;background:var(--bg-alt);border:1.15px solid var(--border-strong);padding:14px 16px;border-radius:var(--radius);font-size:13px;line-height:1.5}
  .footer{margin-top:32px;display:flex;justify-content:space-between;align-items:flex-start;gap:32px}
  .sign-group{flex:1;display:flex;flex-direction:column;gap:22px}
  .sign-box{position:relative;flex:1;min-height:120px;border:1.2px solid var(--border-strong);border-radius:12px;padding:18px 18px 14px;display:flex;flex-direction:column;justify-content:flex-end;background:linear-gradient(135deg,#ffffff 0%,#f7f9fc 100%)}
  .sign-label{position:absolute;top:10px;left:16px;font-size:11px;font-weight:600;letter-spacing:.7px;text-transform:uppercase;color:var(--ink-soft)}
  .sign-line{height:2px;background:#000;width:100%;margin-top:auto;margin-bottom:6px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .sign-name{font-size:12px;font-weight:600;color:var(--ink);text-align:center;margin:0;padding-top:2px}
  .sign-hint{font-size:10px;color:var(--ink-soft);margin-top:2px;text-align:center;display:none}
  .print-badge{font-size:11px;color:var(--ink-soft);text-align:right;display:flex;flex-direction:column;gap:6px;align-items:flex-end;justify-content:flex-end}
  .dev-credit{font-size:10px;color:var(--ink-soft);letter-spacing:1px;text-transform:uppercase;opacity:.7}
  .status-wrapper{display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#f0f4f9,#e4ecf4);padding:3px 6px;border:1px solid var(--border-strong);border-radius:28px;box-shadow:0 1px 2px rgba(0,0,0,.12),0 0 0 1px rgba(255,255,255,.6) inset}
  .status-pill{display:inline-block;padding:4px 12px;border-radius:18px;font-size:11px;font-weight:600;letter-spacing:.4px;line-height:1;position:relative;min-width:82px;text-align:center;background:#e2e8f0;color:#334155;box-shadow:0 1px 2px rgba(0,0,0,.08) inset}
  .status-pill[data-status="completed"]{background:#d1fae5;color:#065f46}
  .status-pill[data-status="pending"]{background:#fde68a;color:#92400e}
  .status-pill[data-status="progress"]{background:#dbeafe;color:#1e40af}
        .value{font-weight:600;color:var(--brand)}
        @media print{body{padding:16px;background:#fff} header.print-header{box-shadow:none;margin-bottom:18px} .panel, .desc-box{box-shadow:none} .print-hide{display:none !important} .watermark{font-size:48px} }
      </style>
    </head><body>
      <div class="watermark">Developed by ILMORETTO</div>
      <header class="print-header">
        <div class="logo-box"><img src="${logoPath}" alt="Logo" onerror="this.style.display='none'"></div>
        <div class="doc-meta" style="flex:1;">
          <h1>Ordem de Serviço <span>#${order.number||''}</span></h1>
          <div class="company-block">
            ${company.address?`<div class="address">${company.address}</div>`:''}
            ${(company.site||company.email)?`<div class="contact">${company.site||''}${(company.site&&company.email)?' - ':''}${company.email?('E-mail '+company.email):''}</div>`:''}
            ${company.phone?`<div class="phone">${company.phone}</div>`:''}
            <div class="generated"><strong>Gerada em ${today.toLocaleDateString('pt-BR')} às ${today.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</strong></div>
          </div>
          <div style="margin-top:8px" class="status-wrapper"><span class="status-pill" data-status="${order.status||'pending'}">${this.getStatusLabel(order.status||'pending')}</span></div>
        </div>
      </header>
      <section class="grid">
        <div class="panel">
          <h3>Identificação</h3>
          <div class="kv">
            <strong>Cliente:</strong><span>${client.name||''}</span>
            <strong>E-mail:</strong><span>${client.email||''}</span>
            <strong>Telefone:</strong><span>${this.formatPhoneDisplay(client.phone||'')}</span>
            <strong>Data OS:</strong><span>${order.date||''}</span>
            <strong>Execução:</strong><span>${fmtDate(order.executionDate)} ${order.executionTime||''}</span>
            <strong>Tempo Est.:</strong><span>${order.estimatedTime||'—'}</span>
            <strong>Responsável:</strong><span>${order.technicalResponsible||'—'}</span>
          </div>
        </div>
        <div class="panel">
          <h3>Financeiro</h3>
          <div class="kv">
            <strong>Valor:</strong><span class="value">${order.totalValue||'R$ 0,00'}</span>
            <strong>Pagamentos:</strong><span>${payments}</span>
            <strong>Data Pagto:</strong><span>${order.paymentDate||'—'}</span>
          </div>
        </div>
        <div class="panel">
          <h3>Serviços</h3>
          <div class="services-wrapper">
            ${listBlock('Pré-produção', groups.pre)}
            ${listBlock('Produção', groups.prod)}
            ${listBlock('Pós-produção', groups.pos)}
            ${listBlock('Outros', groups.outros)}
          </div>
        </div>
      </section>
      <div class="desc-box">
        <h3 style="margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.8px;color:var(--ink-soft)">Descrição Detalhada</h3>
        ${ (order.description||'').replace(/\n/g,'<br/>') || '<em style="color:var(--ink-soft)">Sem descrição fornecida.</em>' }
      </div>
      <div class="footer">
        <div class="sign-group">
          <div class="sign-box">
            <span class="sign-label">Cliente</span>
            <div class="sign-line"></div>
            <div class="sign-name">${client.name||''}</div>
          </div>
        </div>
        <div class="sign-group">
          <div class="sign-box">
            <span class="sign-label">Responsável Técnico</span>
            <div class="sign-line"></div>
            <div class="sign-name">${order.technicalResponsible||'—'}</div>
          </div>
        </div>
        <div class="print-badge">
          <div>Impresso em ${today.toLocaleDateString('pt-BR')}</div>
          <div>Sistema OSManager</div>
          <div class="dev-credit">Developed by ilmoretto</div>
        </div>
      </div>
    </body></html>`;
  }

  // NEW CLIENT
  wireNewClient(){ const f=document.getElementById('newClientForm'); if(!f) return; f.addEventListener('submit', async (e)=>{ e.preventDefault(); const payload={ name:document.getElementById('clientName').value.trim(), email:document.getElementById('clientEmail').value.trim(), phone:(document.getElementById('clientPhone').value||'').replace(/\D/g,''), cpf:(document.getElementById('clientCPF').value||'').replace(/\D/g,''), address:document.getElementById('clientAddress').value.trim() }; if(!payload.name||!payload.email){ this.toast('Nome e e-mail são obrigatórios','error'); return; } try{ const col=db.collection('users').doc(this.currentUser.uid).collection('clients'); const editId=f.dataset.editId; if(editId){ await col.doc(editId).update({ ...payload, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }); this.toast('Cliente atualizado','success'); delete f.dataset.editId; const submit=f.querySelector('button[type="submit"]'); if(submit) submit.textContent='Salvar Cliente'; } else { await col.add({ ...payload, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); this.toast('Cliente salvo','success'); } f.reset(); } catch{ this.toast('Erro ao salvar cliente','error'); } }); }

  // CLIENTS LIST
  renderClientsTable(){ const tbody=document.getElementById('clientsTableBody'); if(!tbody) return; const filter=document.getElementById('clientSearchFilter'); const render=()=>{ const q=(filter?.value||'').toLowerCase(); const list=this.clients.filter(c=> (c.name||'').toLowerCase().includes(q) || (c.email||'').toLowerCase().includes(q)); tbody.innerHTML = list.length? list.map(c=>`<tr data-id="${c.id}"><td>${c.name}</td><td>${c.email||''}</td><td>${this.formatPhoneDisplay(c.phone||'')}</td><td>${this.countOrdersFor(c.id)}</td><td><div class="actions"><button class=\"btn btn-secondary\" data-action=\"select\">Selecionar</button><button class=\"btn btn-success\" data-action=\"edit\">Editar</button><button class=\"btn btn-danger\" data-action=\"delete\">Excluir</button></div></td></tr>`).join('') : `<tr><td colspan=\"5\" class=\"no-data\">Nenhum registro</td></tr>`;
      tbody.querySelectorAll('tr[data-id]').forEach(row=>{
        const id=row.getAttribute('data-id');
        row.querySelector('[data-action="select"]').addEventListener('click',()=>{ const cli=this.clients.find(x=>x.id===id); this.selectedClient=cli; this.toast(`Selecionado: ${cli?.name||''}`,'success'); });
        row.querySelector('[data-action="edit"]').addEventListener('click',()=> this.openEditClient(id));
        row.querySelector('[data-action="delete"]').addEventListener('click',()=> this.deleteClient(id));
      });
    }; filter?.addEventListener('input',render); document.getElementById('clearClientFilters')?.addEventListener('click',()=>{ if(filter) filter.value=''; render(); }); render(); }

  async openEditClient(id){ const cli=this.clients.find(x=>x.id===id); if(!cli){ this.toast('Cliente não encontrado','error'); return; }
    // Reutiliza o formulário de novo cliente no modo edição
    this.ensureView('new-client-view');
    const f=document.getElementById('newClientForm'); if(!f) return; f.dataset.editId=id;
    document.getElementById('clientName').value=cli.name||'';
    document.getElementById('clientEmail').value=cli.email||'';
    document.getElementById('clientPhone').value=this.formatPhoneDisplay(cli.phone||'');
    document.getElementById('clientCPF').value=cli.cpf||'';
    document.getElementById('clientAddress').value=cli.address||'';
    const submit=f.querySelector('button[type="submit"]'); if(submit) submit.textContent='Atualizar Cliente';
    this.toast('Editando cliente. Faça as alterações e salve.','info');
  }

  async deleteClient(id){ if(!confirm('Confirmar exclusão do cliente? Esta ação não pode ser desfeita.')) return; try{ await db.collection('users').doc(this.currentUser.uid).collection('clients').doc(id).delete(); this.toast('Cliente excluído','success'); } catch{ this.toast('Erro ao excluir','error'); } }
  countOrdersFor(clientId){ return this.orders.filter(o=> o.client?.id===clientId).length; }

  // USERS MANAGEMENT
  wireUsersManagement(){ const f=document.getElementById('preRegisterForm'); const body=document.getElementById('usersTableBody'); const render = async ()=>{ try{ const prs=await db.collection('pre_registered_users').orderBy('createdAt','desc').limit(50).get(); const act=await db.collection('users').orderBy('createdAt','desc').limit(50).get(); const rows=[]; if(!prs.empty){ prs.docs.forEach(d=>{ const u=d.data(); rows.push(`<tr data-type="pre" data-id="${d.id}"><td>${u.name||''}</td><td>${u.email||d.id||''}</td><td>${u.phone||''}</td><td>${u.role||'user'}</td><td>${u.passwordSet?'com senha':'pendente'}</td><td>${(u.createdAt?.toDate?.()||'').toLocaleString?.('pt-BR')||''}</td><td><div class="actions"><button class=\"btn btn-danger\" data-action=\"del-pre\">Excluir</button></div></td></tr>`); }); }
        if(!act.empty){ act.docs.forEach(d=>{ const u=d.data(); rows.push(`<tr data-type="active" data-id="${d.id}"><td>${u.name||''}</td><td>${u.email||''}</td><td>${u.phone||''}</td><td><select data-action=\"role\"><option value=\"user\" ${u.role==='user'?'selected':''}>Usuário</option><option value=\"admin\" ${u.role==='admin'?'selected':''}>Administrador</option></select></td><td>ativo</td><td>${(u.createdAt?.toDate?.()||'').toLocaleString?.('pt-BR')||''}</td><td><div class="actions"><button class=\"btn btn-secondary\" data-action=\"impersonate\">Ver Perfil</button></div></td></tr>`); }); }
        body.innerHTML = rows.length? rows.join('') : `<tr><td colspan="7" class="no-data">Nenhum usuário encontrado</td></tr>`;
        // bind actions
        body.querySelectorAll('tr[data-type="pre"]').forEach(tr=>{
          const id=tr.getAttribute('data-id'); tr.querySelector('[data-action="del-pre"]').addEventListener('click', async ()=>{ if(!confirm('Excluir pré-cadastro?')) return; try{ await db.collection('pre_registered_users').doc(id).delete(); this.toast('Pré-cadastro excluído','success'); render(); } catch{ this.toast('Erro ao excluir','error'); } });
        });
        body.querySelectorAll('tr[data-type="active"]').forEach(tr=>{
          const id=tr.getAttribute('data-id'); const sel=tr.querySelector('select[data-action="role"]'); sel.addEventListener('change', async ()=>{ try{ await db.collection('users').doc(id).update({ role: sel.value, updatedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedBy:this.currentUser?.uid }); this.toast('Papel atualizado','success'); if(this.currentUser?.uid===id){ this.userRole=sel.value; this.updateRoleUI(); } } catch{ this.toast('Falha ao atualizar papel','error'); } });
          tr.querySelector('[data-action="impersonate"]').addEventListener('click',()=>{ alert(`Perfil de ${id}: ${tr.children[0].textContent}`); });
        });
      } catch{ body.innerHTML = `<tr><td colspan="7" class="no-data">Erro ao carregar</td></tr>`; }}; render();
  f?.addEventListener('submit', async (e)=>{ e.preventDefault(); const name=document.getElementById('preRegisterName').value.trim(); const email=document.getElementById('preRegisterEmail').value.trim(); const phone=document.getElementById('preRegisterPhone').value.trim(); const role=document.getElementById('preRegisterRole').value; if(!name||!email||!phone||!role){ this.toast('Preencha todos os campos','error'); return; } try{ await db.collection('pre_registered_users').doc(email).set({ name,email,phone,role,passwordSet:false,createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy:this.currentUser?.uid}); this.toast('Usuário pré-cadastrado','success'); (e.target).reset(); render(); } catch(err){ this.toast('Erro ao pré-cadastrar: '+(err?.code||err?.message||'verifique permissões'), 'error'); } }); }

  // LOGS
  renderAuditLogs(){ const body=document.getElementById('logsTableBody'); const logs=JSON.parse(localStorage.getItem('audit_logs')||'[]').slice(-200).reverse(); body.innerHTML = logs.map(l=>`<tr><td>${new Date(l.timestamp).toLocaleString('pt-BR')}</td><td>${l.t}</td><td><pre style="white-space:pre-wrap">${JSON.stringify(l.d,null,2)}</pre></td></tr>`).join(''); }

  loadRealtime(){
    if(!this.currentUser) return;
    const uid=this.currentUser.uid;
    const userDocRef = db.collection('users').doc(uid);
    // Pré-checagem leve para evitar race: garante que o perfil existe antes dos listeners
    const startListeners = ()=>{
      const cRef=db.collection('users').doc(uid).collection('clients');
      this.unsubscribeClients=cRef.orderBy('name').onSnapshot(
        s=>{
          this.clients=s.docs.map(d=>({id:d.id,...d.data()}));
          this.loadDashboard(); this.renderRecentActivity();
          if(document.getElementById('clients-list-view')?.classList.contains('active')) this.renderClientsTable();
        },
        err=>{ console.warn('Snapshot clients permissão/erro:', err?.code||err, err); this.toast('Sem permissão para clientes ou erro de rede','error'); }
      );
      const oRef=db.collection('users').doc(uid).collection('orders');
      this.unsubscribeOrders=oRef.orderBy('createdAt','desc').onSnapshot(
        s=>{
          this.orders=s.docs.map(d=>({id:d.id,...d.data()}));
          this.loadDashboard(); this.renderRecentActivity();
          if(document.getElementById('orders-list-view')?.classList.contains('active')) this.renderOrdersTable();
        },
        err=>{ console.warn('Snapshot orders permissão/erro:', err?.code||err, err); this.toast('Sem permissão para ordens ou erro de rede','error'); }
      );
    };
    userDocRef.get().then(s=>{
      if(s.exists) { startListeners(); }
      else {
        // aguarda um pouco a criação do perfil no first login
        let attempts=0; const max=5; const tick=()=>{
          attempts++;
          userDocRef.get().then(s2=>{ if(s2.exists){ startListeners(); } else if(attempts<max){ setTimeout(tick, 300); } else { startListeners(); }}).catch(()=>{ if(attempts<max){ setTimeout(tick, 300); } else { startListeners(); }});
        }; tick();
      }
    }).catch(()=> startListeners());
  }

  // Atividade recente: ordens abertas/concluídas/reabertas
  renderRecentActivity(){
    const box=document.getElementById('recentActivity'); if(!box) return;
    // Gera cache completo de eventos
    const events=[];
    (this.orders||[]).forEach(o=>{
      const baseTxt = `OS ${o.number} - ${o.client?.name||''}`;
      if(o.createdAt?.toDate){ events.push({type:'Aberta', time:o.createdAt.toDate(), text: baseTxt, order:o}); }
      if(o.completedAt?.toDate){ events.push({type:'Concluída', time:o.completedAt.toDate(), text: baseTxt, order:o}); }
      if(o.reopenedAt?.toDate){ events.push({type:'Reaberta', time:o.reopenedAt.toDate(), text: baseTxt, order:o}); }
    });
    events.sort((a,b)=> b.time - a.time);

    // Recupera filtros
    const typeSel = document.getElementById('activityTypeFilter');
    const searchInput = document.getElementById('activitySearch');
    const q = (searchInput?.value||'').toLowerCase();
    const typeFilter = typeSel?.value||'';

    const filtered = events.filter(ev=>{
      const typeOk = typeFilter? ev.type===typeFilter : true;
      if(!typeOk) return false;
      if(!q) return true;
      const hay = `${ev.text} ${ev.order?.number||''} ${ev.order?.client?.name||''}`.toLowerCase();
      return hay.includes(q);
    });

    const slice = filtered.slice(0,30); // mostra mais resultados se filtrado
    if(!slice.length){ box.innerHTML='<p class="no-data">Sem atividades para os filtros</p>'; }
    else {
      box.innerHTML = slice.map(e=>`<div class="activity-item"><strong>${e.type}</strong> • ${e.time.toLocaleString('pt-BR')} — ${e.text}</div>`).join('');
    }

    // Liga eventos de filtro apenas uma vez
    if(!this._activityFiltersBound){
      if(typeSel) typeSel.addEventListener('change',()=> this.renderRecentActivity());
      if(searchInput) searchInput.addEventListener('input',()=> this.renderRecentActivity());
      const clearBtn=document.getElementById('activityClear');
      if(clearBtn) clearBtn.addEventListener('click',()=>{ if(searchInput){ searchInput.value=''; searchInput.focus(); } this.renderRecentActivity(); });
      this._activityFiltersBound = true;
    }
  }
  loadDashboard(){
    // Atualiza cartões do dashboard
    const totalOrders = this.orders.length;
    const now = new Date(); const ym = now.getFullYear()+ '-' + String(now.getMonth()+1).padStart(2,'0');
    const monthCount = this.orders.filter(o=>{
      // tenta usar createdAt ou date no formato dd/mm/yyyy
      if (o.createdAt?.toDate){ const d=o.createdAt.toDate(); return (d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth()); }
      if (o.date){ const [d,m,y]=(o.date||'').split('/'); return `${y}-${m}`===ym; }
      return false;
    }).length;
    const activeCount = this.orders.filter(o=> o.status!=='completed').length;
    const clientsCount = this.clients.length;
    const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent = String(v); };
    set('totalOrders', totalOrders);
    set('thisMonth', monthCount);
    set('activeOrders', activeCount);
    set('totalClients', clientsCount);
  }

  validateStrong(p){ const errors=[]; if(p.length<SECURITY_CONFIG.password.minLength) errors.push(`Mínimo ${SECURITY_CONFIG.password.minLength} caracteres`); if(!/[A-Z]/.test(p)) errors.push('Maiúscula'); if(!/[a-z]/.test(p)) errors.push('Minúscula'); if(!/[0-9]/.test(p)) errors.push('Número'); if(!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>\/?]/.test(p)) errors.push('Especial'); return { isValid: errors.length===0, errors, strength: this.score(p) }; }
  score(p){ let s=0; if(p.length>=8) s++; if(/[A-Z]/.test(p)) s++; if(/[a-z]/.test(p)) s++; if(/[0-9]/.test(p)) s++; if(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>\/?]/.test(p)) s++; return s; }
  updatePasswordUI(p){ const req={length:p.length>=12,uppercase:/[A-Z]/.test(p),lowercase:/[a-z]/.test(p),number:/[0-9]/.test(p),special:/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>\/?]/.test(p)}; document.querySelectorAll('.password-requirement').forEach(li=>{const k=li.dataset.requirement; li.classList.toggle('valid',!!req[k]); li.classList.toggle('invalid',!req[k]);}); const bar=document.querySelector('.password-strength-bar'); const t=this.score(p); bar.className='password-strength-bar'; if(t<=2){} else if(t<=3){bar.classList.add('medium')} else if(t<=4){bar.classList.add('strong')} else {bar.classList.add('very-strong')} const txt=document.querySelector('.password-strength-text'); if(txt) txt.textContent='Força da senha: '+(t<=2?'Fraca':t<=3?'Média':t<=4?'Forte':'Muito forte'); }
  updateConfirmUI(p,c){ const el=document.querySelector('.confirm-password-error'); if(!el) return; if(c && p!==c){ el.textContent='As senhas não coincidem'; el.style.display='block'; } else { el.textContent=''; el.style.display='none'; } }

  // Helpers de formatação
  parseServicesByCategory(services){
    const groups={ pre:[], prod:[], pos:[], outros:[] };
    (services||[]).forEach(s=>{
      const text=String(s);
      const [prefixRaw, ...rest] = text.split(':');
      const prefix=(prefixRaw||'').trim().toLowerCase();
      const item=(rest.join(':')||'').trim() || (prefixRaw||'').trim();
      if(prefix.startsWith('pré-produção')) groups.pre.push(item);
      else if(prefix.startsWith('produção')) groups.prod.push(item);
      else if(prefix.startsWith('pós-produção')) groups.pos.push(item);
      else groups.outros.push(text);
    });
    return groups;
  }
  formatCurrency(e){ let v=e.target.value.replace(/\D/g,''); if(!v) { e.target.value=''; return; } v=(parseInt(v,10)/100).toFixed(2).replace('.',','); v=v.replace(/(\d)(?=(\d{3})+(?!\d))/g,'$1.'); e.target.value='R$ '+v; }
  formatDate(s){ if(!s) return ''; const [y,m,d]=s.split('-'); return `${d}/${m}/${y}`; }
  formatPhoneDisplay(p){ const d=(p||'').replace(/\D/g,''); if(d.length===11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`; if(d.length===10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`; return p; }

  toast(msg,type='info'){ const n=document.createElement('div'); n.style.cssText=`position:fixed;top:20px;right:20px;padding:14px 18px;background:${type==='success'?'#16a34a': type==='error'?'#dc2626':'#334155'};color:#fff;border-radius:10px;z-index:9999;font-weight:700;box-shadow:0 10px 30px rgba(0,0,0,.25)`; n.textContent=msg; document.body.appendChild(n); setTimeout(()=>{n.style.opacity='0'; setTimeout(()=>n.remove(),300)},2400); }

  // ===== Inatividade (auto logout) =====
  setupIdleTracking(){
    if(this._idleBound) { this.resetIdleTimer(); return; }
    this._idleResetHandler = ()=> this.resetIdleTimer();
    this._idleVisibilityHandler = ()=>{ if(document.visibilityState==='visible') this.resetIdleTimer(); };
    ['mousemove','keydown','click','scroll','touchstart'].forEach(ev=> window.addEventListener(ev,this._idleResetHandler,{passive:true}));
    document.addEventListener('visibilitychange', this._idleVisibilityHandler);
    this._idleBound = true;
    this.resetIdleTimer();
  }
  resetIdleTimer(){
    if(this.idleTimer) clearTimeout(this.idleTimer);
    // Se usuário não está logado, não agenda
    if(!this.currentUser) return;
    this.idleTimer = setTimeout(()=>{
      // Evita corrida caso tenha feito logout manual antes de disparar
      if(!this.currentUser) return;
      this.toast('Sessão encerrada por inatividade','info');
      this.logout();
    }, this.idleTimeoutMs);
  }
}

// Inicialização da aplicação após DOM pronto, evitando flash da tela de login
document.addEventListener('DOMContentLoaded',()=>{
  const loginScr=document.getElementById('loginScreen');
  if(loginScr) loginScr.classList.add('hidden');
  if(initializeFirebase()){
    window.osmApp=new OSManagerApp();
  } else {
    document.body.innerHTML='<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8fafc;color:#334155"><div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.06);padding:32px;max-width:520px;text-align:center"><h2 style="color:#ef4444;margin:0 0 10px 0">Erro ao iniciar</h2><p>Não foi possível conectar ao Firebase.</p><button onclick="location.reload()" style="margin-top:10px" class="btn btn-primary">Tentar novamente</button></div></div>';
  }
});
