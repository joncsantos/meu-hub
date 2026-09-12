var SUPABASE_URL = 'https://toewirjnljlnopmsgsjn.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvZXdpcmpubGpsbm9wbXNnc2puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MTgzMTgsImV4cCI6MjEwNDI5NDMxOH0.upa1J5Pr-eN4j55UZOBkVh4OkigSHB5xdraRJFbfWUo';
var supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

var state = {
    oracoes: [],
    temas: [],
    textos: [],
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
    temaAtualId: null
};
var months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
var currentUserRole = null;

// Variáveis do Timer
var timerInterval = null;
var timerStartTime = null;

window.addEventListener('DOMContentLoaded', async function() {
    var role = sessionStorage.getItem('userRole');
    if (!role) { window.location.href = 'index.html'; return; }
    currentUserRole = role;
    document.getElementById('userBadge').textContent = currentUserRole === 'admin' ? '(Administrador)' : '(Visualização)';
    if (currentUserRole === 'admin') document.body.classList.add('admin-mode');
    
    await carregarDados();
    verificarTimerAtivo();
    renderizarCalendario();
    renderizarTemas();
});

async function carregarDados() {
    var [oracoesRes, temasRes, textosRes] = await Promise.all([
        supabaseClient.from('oracoes').select('*').order('data_inicio', { ascending: false }),
        supabaseClient.from('estudos_temas').select('*'),
        supabaseClient.from('estudos_textos').select('*')
    ]);
    state.oracoes = oracoesRes.data || [];
    state.temas = temasRes.data || [];
    state.textos = textosRes.data || [];
}

function switchFeTab(tabId, element) {
    document.querySelectorAll('.fe-tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.fe-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    element.classList.add('active');
    if (tabId === 'tab-calendario') renderizarCalendario();
    if (tabId === 'tab-estudos') { voltarParaTemas(); renderizarTemas(); }
}

// --- TIMER ---
function verificarTimerAtivo() {
    var salvo = localStorage.getItem('fe_timer_start');
    if (salvo) {
        timerStartTime = parseInt(salvo);
        document.getElementById('timerStatusText').textContent = 'Orando agora...';
        document.getElementById('btnTimerAction').textContent = 'Finalizar Oração';
        document.getElementById('btnTimerAction').className = 'btn btn-timer btn-finalizar';
        iniciarContagemVisual();
    }
}

function toggleTimer() {
    if (timerStartTime) {
        finalizarOração();
    } else {
        iniciarOração();
    }
}

function iniciarOração() {
    timerStartTime = Date.now();
    localStorage.setItem('fe_timer_start', timerStartTime.toString());
    document.getElementById('timerStatusText').textContent = 'Orando agora...';
    document.getElementById('btnTimerAction').textContent = 'Finalizar Oração';
    document.getElementById('btnTimerAction').className = 'btn btn-timer btn-finalizar';
    iniciarContagemVisual();
}

function iniciarContagemVisual() {
    atualizarDisplayTimer();
    timerInterval = setInterval(atualizarDisplayTimer, 1000);
}

function atualizarDisplayTimer() {
    var elapsed = Math.floor((Date.now() - timerStartTime) / 1000);
    var h = Math.floor(elapsed / 3600).toString().padStart(2, '0');
    var m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
    var s = (elapsed % 60).toString().padStart(2, '0');
    document.getElementById('timerDisplay').textContent = `${h}:${m}:${s}`;
}

async function finalizarOração() {
    var endTime = Date.now();
    var duracao = Math.floor((endTime - timerStartTime) / 1000);
    
    var startDate = new Date(timerStartTime).toISOString();
    var endDate = new Date(endTime).toISOString();

    var { error } = await supabaseClient.from('oracoes').insert([{
        data_inicio: startDate,
        data_fim: endDate,
        duracao_segundos: duracao
    }]);

    if (error) { alert('Erro ao salvar oração: ' + error.message); return; }

    localStorage.removeItem('fe_timer_start');
    clearInterval(timerInterval);
    timerStartTime = null;
    timerInterval = null;

    document.getElementById('timerDisplay').textContent = '00:00:00';
    document.getElementById('timerStatusText').textContent = 'Oração registrada com sucesso!';
    document.getElementById('btnTimerAction').textContent = 'Iniciar Oração';
    document.getElementById('btnTimerAction').className = 'btn btn-timer btn-iniciar';

    await carregarDados();
    setTimeout(() => { document.getElementById('timerStatusText').textContent = 'Pronto para orar'; }, 3000);
}

// --- CALENDÁRIO ---
function mudarMes(delta) {
    state.currentMonth += delta;
    if (state.currentMonth > 11) { state.currentMonth = 0; state.currentYear++; }
    if (state.currentMonth < 0) { state.currentMonth = 11; state.currentYear--; }
    renderizarCalendario();
}

function formatarTempo(segundos) {
    if (!segundos || segundos <= 0) return '';
    var h = Math.floor(segundos / 3600);
    var m = Math.floor((segundos % 3600) / 60);
    if (h > 0) return h + 'h ' + m + 'min';
    return m + 'min';
}

function renderizarCalendario() {
    document.getElementById('calendarioMesAno').textContent = `${months[state.currentMonth]} ${state.currentYear}`;
    var grid = document.getElementById('calendarioGrid');
    grid.innerHTML = '';

    var diasSemana = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
    diasSemana.forEach(d => { grid.innerHTML += `<div class="calendario-dia-semana">${d}</div>`; });

    var firstDay = new Date(state.currentYear, state.currentMonth, 1).getDay();
    var daysInMonth = new Date(state.currentYear, state.currentMonth + 1, 0).getDate();
    var today = new Date();
    today.setHours(0,0,0,0);

    for (var i = 0; i < firstDay; i++) { grid.innerHTML += '<div></div>'; }

    var tempoPorDia = {}; 
    state.oracoes.forEach(o => {
        var d = new Date(o.data_inicio);
        if (d.getFullYear() === state.currentYear && d.getMonth() === state.currentMonth) {
            var dia = d.getDate();
            if (!tempoPorDia[dia]) tempoPorDia[dia] = 0;
            tempoPorDia[dia] += o.duracao_segundos;
        }
    });

    for (var day = 1; day <= daysInMonth; day++) {
        var dateObj = new Date(state.currentYear, state.currentMonth, day);
        var classe = 'calendario-dia';
        var conteudoDia = day;
        var onclickAttr = '';
        
        if (dateObj > today) {
            classe += ' futuro';
        } else if (tempoPorDia[day]) {
            classe += ' orou';
            conteudoDia += `<br><small style="font-size:0.65rem; font-weight:600; margin-top:2px;">${formatarTempo(tempoPorDia[day])}</small>`;
            onclickAttr = `onclick="abrirListaOracoes(${day}, ${state.currentMonth}, ${state.currentYear})"`;
        } else {
            classe += ' nao-orou';
        }
        
        grid.innerHTML += `<div class="${classe}" ${onclickAttr}>${conteudoDia}</div>`;
    }
}

// --- LISTA E EXCLUSÃO DE ORAÇÕES ---
function abrirListaOracoes(dia, mes, ano) {
    var oracoesDoDia = state.oracoes.filter(o => {
        var d = new Date(o.data_inicio);
        return d.getDate() === dia && d.getMonth() === mes && d.getFullYear() === ano;
    });

    document.getElementById('tituloModalOracoes').textContent = `Orações de ${dia}/${mes + 1}/${ano}`;
    var container = document.getElementById('listaOracoesDoDia');
    
    if (oracoesDoDia.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted);">Nenhuma oração registrada.</p>';
    } else {
        var html = '';
        oracoesDoDia.forEach(o => {
            var inicio = new Date(o.data_inicio).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
            var fim = new Date(o.data_fim).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
            html += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid var(--border);">
                <div>
                    <strong style="font-size:1.1rem;">${inicio} - ${fim}</strong><br>
                    <small style="color:var(--text-muted);">Duração: ${formatarTempo(o.duracao_segundos)}</small>
                </div>
                <button class="btn btn-danger btn-sm" onclick="excluirOracao(${o.id})">🗑️ Excluir</button>
            </div>`;
        });
        container.innerHTML = html;
    }
    openModal('modalListaOracoes');
}

async function excluirOracao(id) {
    if (!confirm('Tem certeza que deseja excluir este registro de oração?')) return;
    
    var { error } = await supabaseClient.from('oracoes').delete().eq('id', id);
    if (error) { alert('Erro ao excluir: ' + error.message); return; }
    
    await carregarDados();
    closeModal('modalListaOracoes');
    renderizarCalendario();
}

// --- ESTUDOS ---
function renderizarTemas() {
    var container = document.getElementById('listaTemas');
    if (state.temas.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); text-align:center; grid-column:1/-1;">Nenhum tema criado.</p>';
        return;
    }
    container.innerHTML = state.temas.map(t => `
        <div class="tema-card" onclick="abrirTema(${t.id})">
            <h4>${t.titulo}</h4>
            <small style="color:var(--text-muted)">${state.textos.filter(x => x.tema_id === t.id).length} estudos</small>
            ${currentUserRole === 'admin' ? `<button class="btn btn-danger btn-sm" style="float:right; margin-top:-2rem;" onclick="event.stopPropagation(); excluirTema(${t.id})">🗑️</button>` : ''}
        </div>
    `).join('');
}

function abrirTema(id) {
    state.temaAtualId = id;
    var tema = state.temas.find(t => t.id === id);
    document.getElementById('tituloTemaAtual').textContent = tema.titulo;
    document.getElementById('estudosViewTemas').style.display = 'none';
    document.getElementById('estudosViewTextos').style.display = 'block';
    renderizarTextos();
}

function renderizarTextos() {
    var textosTema = state.textos.filter(t => t.tema_id === state.temaAtualId);
    var container = document.getElementById('listaTextos');
    if (textosTema.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); text-align:center;">Nenhum estudo neste tema.</p>';
        return;
    }
    container.innerHTML = textosTema.map(t => `
        <div class="texto-card" onclick="lerTexto(${t.id})">
            <h4>${t.titulo}</h4>
            ${currentUserRole === 'admin' ? `<button class="btn btn-danger btn-sm" style="float:right; margin-top:-2rem;" onclick="event.stopPropagation(); excluirTexto(${t.id})">🗑️</button>` : ''}
        </div>
    `).join('');
}

function lerTexto(id) {
    var texto = state.textos.find(t => t.id === id);
    document.getElementById('tituloLeitura').textContent = texto.titulo;
    document.getElementById('conteudoLeitura').innerHTML = texto.conteudo;
    document.getElementById('estudosViewTextos').style.display = 'none';
    document.getElementById('estudosViewLeitura').style.display = 'block';
}

function voltarParaTemas() {
    state.temaAtualId = null;
    document.getElementById('estudosViewTemas').style.display = 'block';
    document.getElementById('estudosViewTextos').style.display = 'none';
    document.getElementById('estudosViewLeitura').style.display = 'none';
}

function voltarParaTextos() {
    document.getElementById('estudosViewTextos').style.display = 'block';
    document.getElementById('estudosViewLeitura').style.display = 'none';
}

function abrirModalTema() { document.getElementById('temaTitulo').value = ''; openModal('modalTema'); }
async function salvarTema() {
    var titulo = document.getElementById('temaTitulo').value;
    if (!titulo) return alert('Digite o título!');
    await supabaseClient.from('estudos_temas').insert([{ titulo }]);
    closeModal('modalTema');
    await carregarDados();
    renderizarTemas();
}
async function excluirTema(id) {
    if (!confirm('Excluir tema e todos os seus estudos?')) return;
    await supabaseClient.from('estudos_textos').delete().eq('tema_id', id);
    await supabaseClient.from('estudos_temas').delete().eq('id', id);
    await carregarDados();
    renderizarTemas();
}

function abrirModalTexto() { document.getElementById('textoTitulo').value = ''; document.getElementById('textoConteudo').innerHTML = ''; openModal('modalTexto'); }
async function salvarTexto() {
    var titulo = document.getElementById('textoTitulo').value;
    var conteudo = document.getElementById('textoConteudo').innerHTML;
    if (!titulo) return alert('Digite o título!');
    await supabaseClient.from('estudos_textos').insert([{ tema_id: state.temaAtualId, titulo, conteudo }]);
    closeModal('modalTexto');
    await carregarDados();
    renderizarTextos();
}
async function excluirTexto(id) {
    if (!confirm('Excluir este estudo?')) return;
    await supabaseClient.from('estudos_textos').delete().eq('id', id);
    await carregarDados();
    renderizarTextos();
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
