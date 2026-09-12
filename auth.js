// --- SENHAS ---
var ADMIN_PASSWORD = 'torsaniqwert';
var ADRIANE_PASSWORD = 'hugojulia';

// --- LOGIN ---
function checkLogin() {
    var pass = document.getElementById('loginPassword').value;
    
    if (pass === ADMIN_PASSWORD) {
        sessionStorage.setItem('userRole', 'admin');
        enterHub();
    } else if (pass === ADRIANE_PASSWORD) {
        sessionStorage.setItem('userRole', 'adriane');
        enterHub();
    } else {
        alert('Senha incorreta!');
    }
}

function enterHub() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
    renderHubCards();
}

function renderHubCards() {
    var role = sessionStorage.getItem('userRole');
    var grid = document.getElementById('hubGrid');
    var html = '';
    
    // Cards visíveis para todos (Admin e Adriane)
    html += '<a href="financeiro.html" class="hub-card"><div class="icon">💰</div><h3>Gestão Financeira</h3></a>';
    html += '<a href="comissoes.html" class="hub-card"><div class="icon">💼</div><h3>Comissões</h3></a>';
    html += '<a href="tarefas.html" class="hub-card"><div class="icon">✅</div><h3>Tarefas</h3></a>';
    html += '<a href="fe.html" class="hub-card"><div class="icon">🙏</div><h3>Fé</h3></a>';
    
    // Cards visíveis apenas para o Administrador
    if (role === 'admin') {
        html += '<a href="zaf.html" class="hub-card"><div class="icon">🎯</div><h3>Técnica ZAF</h3></a>';
    }
    
    grid.innerHTML = html;
}

function logout() {
    sessionStorage.removeItem('userRole');
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('loginPassword').value = '';
}

// --- VERIFICAÇÃO DE SESSÃO AO CARREGAR ---
window.addEventListener('DOMContentLoaded', function() {
    var role = sessionStorage.getItem('userRole');
    if (role) {
        enterHub();
    }
});
