// --- SENHAS ---
const ADMIN_PASSWORD = 'torsanijuliaqwert123';
const ADRIANE_PASSWORD = 'hugojulia';

// --- LOGIN ---
function checkLogin() {
    const pass = document.getElementById('loginPassword').value;
    
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
    const role = sessionStorage.getItem('userRole');
    const grid = document.getElementById('hubGrid');
    
    let html = `
        <a href="financeiro.html" class="hub-card">
            <div class="icon">💰</div>
            <h3>Gestão Financeira</h3>
        </a>
    `;
    
    // Adriane só vê Gestão Financeira
    if (role === 'admin') {
        html += `
            <a href="comissoes.html" class="hub-card">
                <div class="icon">💼</div>
                <h3>Comissões</h3>
            </a>
        `;
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
window.addEventListener('DOMContentLoaded', () => {
    const role = sessionStorage.getItem('userRole');
    if (role) {
        enterHub();
    }
});