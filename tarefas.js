// --- CONFIGURAÇÃO DO SUPABASE ---
var SUPABASE_URL = 'https://toewirjnljlnopmsgsjn.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvZXdpcmpubGpsbm9wbXNnc2puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MTgzMTgsImV4cCI6MjEwNDI5NDMxOH0.upa1J5Pr-eN4j55UZOBkVh4OkigSHB5xdraRJFbfWUo';
var supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

var state = { tarefas: [] };
var currentUserRole = null;
var hoje = new Date();
hoje.setHours(0, 0, 0, 0); // Zerar horas para comparação correta de datas

// --- INICIALIZAÇÃO ---
window.addEventListener('DOMContentLoaded', async function() {
    var role = sessionStorage.getItem('userRole');
    if (!role) { window.location.href = 'index.html'; return; }
    currentUserRole = role;
    document.getElementById('userBadge').textContent = currentUserRole === 'admin' ? '(Administrador)' : '(Visualização)';
    if (currentUserRole === 'admin') document.body.classList.add('admin-mode');
    
    await carregarTarefas();
});

async function carregarTarefas() {
    var { data, error } = await supabaseClient.from('tarefas').select('*').order('criado_em', { ascending: false });
    if (error) { console.error('Erro ao carregar:', error); return; }
    state.tarefas = data || [];
    renderizarTudo();
}

// --- LÓGICA DE RENDERIZAÇÃO ---
function renderizarTudo() {
    var pendentes = state.tarefas.filter(t => !t.concluida);
    var concluidas = state.tarefas.filter(t => t.concluida);
    var atrasadas = pendentes.filter(t => {
        if (!t.data_fim) return false;
        var fim = new Date(t.data_fim + 'T00:00:00');
        return fim < hoje;
    });

    // Atualizar contadores
    document.getElementById('countPendentes').textContent = pendentes.length;
    document.getElementById('countConcluidas').textContent = concluidas.length;
    document.getElementById('countAtrasadas').textContent = atrasadas.length;

    // Ordenar pendentes: Atrasadas primeiro, depois por data fim (mais próxima primeiro)
    pendentes.sort((a, b) => {
        var fimA = a.data_fim ? new Date(a.data_fim + 'T00:00:00') : new Date('2099-12-31');
        var fimB = b.data_fim ? new Date(b.data_fim + 'T00:00:00') : new Date('2099-12-31');
        var atrasadaA = fimA < hoje;
        var atrasadaB = fimB < hoje;
        if (atrasadaA && !atrasadaB) return -1;
        if (!atrasadaA && atrasadaB) return 1;
        return fimA - fimB;
    });

    renderizarGrupo('listaPendentes', pendentes, false);
    renderizarGrupo('listaConcluidas', concluidas, true);
}

function renderizarGrupo(containerId, listaTarefas, isConcluida) {
    var container = document.getElementById(containerId);
    
    if (listaTarefas.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:1rem;">Nenhuma tarefa nesta categoria.</p>';
        return;
    }

    // Agrupar por data de criação
    var grupos = {};
    listaTarefas.forEach(t => {
        var dataCriacao = t.data_criacao ? t.data_criacao.split('-').reverse().join('/') : 'Data desconhecida';
        if (!grupos[dataCriacao]) grupos[dataCriacao] = [];
        grupos[dataCriacao].push(t);
    });

    var html = '';
    Object.keys(grupos).forEach(data => {
        html += `<div class="grupo-data"><h4>📅 Criadas em ${data}</h4>`;
        grupos[data].forEach(t => { html += criarCardTarefa(t, isConcluida); });
        html += `</div>`;
    });
    container.innerHTML = html;
}

function criarCardTarefa(t, isConcluida) {
    var isAtrasada = false;
    var statusBadge = '';
    var diasRestantes = 0;

    if (!isConcluida && t.data_fim) {
        var fim = new Date(t.data_fim + 'T00:00:00');
        var diffTime = fim - hoje;
        diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diasRestantes < 0) {
            isAtrasada = true;
            statusBadge = `<span class="badge-status badge-atrasada">⚠️ Atrasada há ${Math.abs(diasRestantes)} dias</span>`;
        } else if (diasRestantes === 0) {
            statusBadge = `<span class="badge-status badge-urgente">⏳ Vence hoje</span>`;
        } else {
            statusBadge = `<span class="badge-status badge-normal">⏳ ${diasRestantes} dias restantes</span>`;
        }
    } else if (isConcluida) {
        statusBadge = `<span class="badge-status badge-concluida">✅ Concluída</span>`;
    }

    var datasInfo = '';
    if (t.data_inicio) datasInfo += `<span>Início: ${t.data_inicio.split('-').reverse().join('/')}</span>`;
    if (t.data_fim) datasInfo += `<span>Prazo: ${t.data_fim.split('-').reverse().join('/')}</span>`;

    var classes = `tarefa-card prioridade-${t.prioridade}`;
    if (isAtrasada) classes += ' atrasada';
    if (isConcluida) classes += ' concluida-card';

    var isAdmin = currentUserRole === 'admin';
    var acoesHtml = '';
    if (isAdmin) {
        if (isConcluida) {
            acoesHtml += `<button class="btn btn-secondary btn-sm" onclick="reabrirTarefa(${t.id})">🔄 Reabrir</button>`;
        } else {
            acoesHtml += `<button class="btn btn-success btn-sm" style="background:var(--success); color:white;" onclick="concluirTarefa(${t.id})">✅</button>`;
        }
        acoesHtml += `<button class="btn btn-warning btn-sm" onclick="editarTarefa(${t.id})">✏️</button>`;
        acoesHtml += `<button class="btn btn-danger btn-sm" onclick="excluirTarefa(${t.id})">️</button>`;
    }

    return `
    <div class="${classes}">
        <div class="tarefa-check">
            ${isAdmin && !isConcluida ? `<input type="checkbox" onchange="concluirTarefa(${t.id})" title="Marcar como concluída">` : ''}
        </div>
        <div class="tarefa-info">
            <div class="tarefa-titulo">${t.titulo}</div>
            ${t.observacao ? `<div class="tarefa-obs">${t.observacao}</div>` : ''}
            <div class="tarefa-datas">
                ${datasInfo}
                ${statusBadge}
            </div>
        </div>
        <div class="tarefa-actions">${acoesHtml}</div>
    </div>`;
}

// --- AÇÕES DE TAREFA ---
async function concluirTarefa(id) {
    if (currentUserRole !== 'admin') return;
    var hojeStr = hoje.toISOString().split('T')[0];
    await supabaseClient.from('tarefas').update({ concluida: true, data_conclusao: hojeStr }).eq('id', id);
    await carregarTarefas();
}

async function reabrirTarefa(id) {
    if (currentUserRole !== 'admin') return;
    await supabaseClient.from('tarefas').update({ concluida: false, data_conclusao: null }).eq('id', id);
    await carregarTarefas();
}

async function excluirTarefa(id) {
    if (currentUserRole !== 'admin') return;
    if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;
    await supabaseClient.from('tarefas').delete().eq('id', id);
    await carregarTarefas();
}

// --- MODAL ---
function abrirModalNovaTarefa() {
    if (currentUserRole !== 'admin') return;
    document.getElementById('modalTarefaTitulo').textContent = 'Nova Tarefa';
    document.getElementById('tarefaId').value = '';
    document.getElementById('tarefaTitulo').value = '';
    document.getElementById('tarefaObs').value = '';
    document.getElementById('tarefaInicio').value = hoje.toISOString().split('T')[0];
    document.getElementById('tarefaFim').value = '';
    document.getElementById('tarefaPrioridade').value = 'media';
    document.getElementById('btnDeleteTarefa').classList.add('hidden');
    document.getElementById('modalTarefa').classList.add('active');
}

function editarTarefa(id) {
    if (currentUserRole !== 'admin') return;
    var t = state.tarefas.find(x => x.id === id);
    if (!t) return;
    document.getElementById('modalTarefaTitulo').textContent = 'Editar Tarefa';
    document.getElementById('tarefaId').value = t.id;
    document.getElementById('tarefaTitulo').value = t.titulo;
    document.getElementById('tarefaObs').value = t.observacao || '';
    document.getElementById('tarefaInicio').value = t.data_inicio || '';
    document.getElementById('tarefaFim').value = t.data_fim || '';
    document.getElementById('tarefaPrioridade').value = t.prioridade || 'media';
    document.getElementById('btnDeleteTarefa').classList.remove('hidden');
    document.getElementById('modalTarefa').classList.add('active');
}

function fecharModalTarefa() {
    document.getElementById('modalTarefa').classList.remove('active');
}

async function salvarTarefa() {
    if (currentUserRole !== 'admin') return;
    var id = document.getElementById('tarefaId').value;
    var titulo = document.getElementById('tarefaTitulo').value;
    var obs = document.getElementById('tarefaObs').value;
    var inicio = document.getElementById('tarefaInicio').value;
    var fim = document.getElementById('tarefaFim').value;
    var prioridade = document.getElementById('tarefaPrioridade').value;

    if (!titulo) return alert('O título é obrigatório!');

    var dados = { titulo, observacao: obs, data_inicio: inicio, data_fim: fim, prioridade };

    if (id) {
        await supabaseClient.from('tarefas').update(dados).eq('id', parseInt(id));
    } else {
        dados.data_criacao = hoje.toISOString().split('T')[0];
        await supabaseClient.from('tarefas').insert([dados]);
    }
    fecharModalTarefa();
    await carregarTarefas();
}

function confirmarExclusao() {
    var id = document.getElementById('tarefaId').value;
    if (id) excluirTarefa(parseInt(id));
    fecharModalTarefa();
}
