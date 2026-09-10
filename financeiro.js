// --- CONFIGURAÇÃO DO SUPABASE ---
var SUPABASE_URL = 'https://toewirjnljlnopmsgsjn.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvZXdpcmpubGpsbm9wbXNnc2puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MTgzMTgsImV4cCI6MjEwNDI5NDMxOH0.upa1J5Pr-eN4j55UZOBkVh4OkigSHB5xdraRJFbfWUo';
var supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- ESTADO ---
var state = {
    transactions: [],
    caixinhas: [],
    metas: [],
    categories: ['Alimentação', 'Moradia', 'Transporte', 'Lazer', 'Saúde', 'Caixinhas'],
    history: [],
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear()
};
var months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
var chartInstance = null;
var currentUserRole = null;

// --- INICIALIZAÇÃO ---
window.addEventListener('DOMContentLoaded', async () => {
    var role = sessionStorage.getItem('userRole');
    if (!role) { window.location.href = 'index.html'; return; }
    currentUserRole = role;
    applyPermissions();
    await initFinanceApp();
});

function applyPermissions() {
    document.getElementById('userBadge').textContent = currentUserRole === 'admin' ? '(Administrador)' : '(Adriane - Visualização)';
    document.querySelectorAll('.admin-only').forEach(el => {
        if (currentUserRole === 'adriane') el.classList.add('hidden');
        else el.classList.remove('hidden');
    });
}

function switchTab(tabId, element) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.app-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    element.classList.add('active');
    if (tabId === 'tab-performance') { renderMonthTabsPerformance(); renderChart(getTransactionsForMonth(state.currentYear, state.currentMonth)); }
    else if (tabId === 'tab-history') renderHistory();
    else if (tabId === 'tab-metas') renderMetas();
}

async function initFinanceApp() {
    await loadFromSupabase();
    renderMonthTabs();
    renderTimeline();
    updateCategorySelect();
    document.getElementById('transDate').valueAsDate = new Date();
    document.getElementById('contribData').valueAsDate = new Date();
}

async function loadFromSupabase() {
    try {
        var [transRes, caixRes, catRes, histRes, metasRes] = await Promise.all([
            supabaseClient.from('transacoes').select('*'),
            supabaseClient.from('caixinhas').select('*'),
            supabaseClient.from('categorias').select('nome'),
            supabaseClient.from('historico').select('*').order('criado_em', { ascending: false }),
            supabaseClient.from('metas').select('*').order('criado_em', { ascending: false })
        ]);

        state.transactions = transRes.data ? transRes.data.map(t => ({ id: t.id, type: t.tipo, date: t.data, title: t.titulo, category: t.categoria, amount: parseFloat(t.valor), recurrence: t.recorrencia })) : [];
        state.caixinhas = caixRes.data ? caixRes.data.map(c => ({ id: c.id, title: c.titulo, priority: c.prioridade, ranking: c.ranking, saldo: parseFloat(c.saldo) })) : [];
        state.categories = catRes.data && catRes.data.length > 0 ? catRes.data.map(c => c.nome) : ['Alimentação', 'Moradia', 'Transporte', 'Lazer', 'Saúde', 'Caixinhas'];
        state.history = histRes.data ? histRes.data.map(h => ({ timestamp: new Date(h.criado_em).toLocaleString('pt-BR'), action: h.acao, details: h.detalhes })) : [];
        state.metas = metasRes.data || [];
    } catch (error) { console.error('Erro ao carregar:', error); }
}

// --- HISTÓRICO ---
async function addToHistory(action, details) {
    if (currentUserRole !== 'admin') return;
    state.history.unshift({ timestamp: new Date().toLocaleString('pt-BR'), action, details });
    await supabaseClient.from('historico').insert([{ acao: action, detalhes: details }]);
}

function renderHistory() {
    var list = document.getElementById('historyList');
    if (state.history.length === 0) { list.innerHTML = '<p style="text-align:center; padding:2rem; color:var(--text-muted);">Nenhum histórico.</p>'; return; }
    list.innerHTML = state.history.map(h => `<div class="history-item"><div class="timestamp">${h.timestamp}</div><div class="action">${h.action}</div><div style="font-size:0.9rem; color:var(--text-muted);">${h.details}</div></div>`).join('');
}

// --- NAVEGAÇÃO DE MESES/ANOS ---
function renderMonthTabs() {
    var container = document.getElementById('monthTabs');
    container.innerHTML = '<div style="display:flex; gap:1rem; align-items:center; width:100%; overflow-x:auto;">' + 
        '<button class="btn btn-sm btn-secondary" onclick="mudarAno(-1)">◀ Ano</button>' + 
        '<strong style="min-width:60px; text-align:center;">' + state.currentYear + '</strong>' + 
        '<button class="btn btn-sm btn-secondary" onclick="mudarAno(1)">Ano ▶</button>' + 
        '<div style="display:flex; gap:0.5rem;">' +
        months.map((m, i) => `<div class="month-tab ${i === state.currentMonth ? 'active' : ''}" onclick="changeMonth(${i})">${m.substring(0,3)}</div>`).join('') + 
        '</div></div>';
}

function renderMonthTabsPerformance() {
    document.getElementById('monthTabsPerformance').innerHTML = months.map((m, i) => `<div class="month-tab ${i === state.currentMonth ? 'active' : ''}" onclick="changeMonth(${i})">${m}</div>`).join('');
}

function mudarAno(delta) {
    state.currentYear += delta;
    renderMonthTabs();
    renderTimeline();
}

function changeMonth(index) {
    state.currentMonth = index;
    renderMonthTabs();
    renderMonthTabsPerformance();
    renderTimeline();
}

// --- LÓGICA PRINCIPAL DA TIMELINE ---
function renderTimeline() {
    var year = state.currentYear;
    var month = state.currentMonth;
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var tbody = document.getElementById('timelineBody');
    tbody.innerHTML = '';

    var today = new Date();
    var isCurrentMonth = (today.getFullYear() === year && today.getMonth() === month);
    var diaAtual = today.getDate();

    // Calcular saldo até o início do mês
    var saldo = 0;
    state.transactions.forEach(t => {
        var tDate = new Date(t.date + 'T00:00:00');
        if (tDate.getFullYear() < year || (tDate.getFullYear() === year && tDate.getMonth() < month)) {
            if (t.type === 'entrada') saldo += t.amount;
            else saldo -= t.amount;
        }
    });

    var monthTransactions = getTransactionsForMonth(year, month);
    var totalEntradas = monthTransactions.filter(t => t.type === 'entrada').reduce((a, b) => a + b.amount, 0);
    var totalSaidasFixas = monthTransactions.filter(t => t.type === 'saida').reduce((a, b) => a + b.amount, 0);
    var totalDiarioMes = monthTransactions.filter(t => t.type === 'diario').reduce((a, b) => a + b.amount, 0);

    // Saldo Atual (até hoje)
    var saldoAteHoje = saldo;
    if (isCurrentMonth) {
        monthTransactions.forEach(t => {
            var tDay = parseInt(t.date.split('-')[2]);
            if (tDay <= diaAtual) {
                if (t.type === 'entrada') saldoAteHoje += t.amount;
                else saldoAteHoje -= t.amount;
            }
        });
    } else if (year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth())) {
        saldoAteHoje = saldo + totalEntradas - totalSaidasFixas - totalDiarioMes;
    }

    document.getElementById('sumSaldoAtual').textContent = formatMoney(saldoAteHoje);
    document.getElementById('saldoSubtitulo').textContent = isCurrentMonth ? `Calculado até dia ${diaAtual}` : (year < today.getFullYear() ? 'Mês encerrado' : 'Projeção futura');

    // Previsão Diário
    var diasRestantes = 0;
    if (isCurrentMonth) {
        diasRestantes = daysInMonth - diaAtual + 1;
    } else if (year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth())) {
        diasRestantes = daysInMonth;
    } else {
        diasRestantes = 0;
    }
    
    var previsaoDiario = 0;
    if (diasRestantes > 0 && saldoAteHoje > 0) {
        previsaoDiario = saldoAteHoje / diasRestantes;
    }

    for (var day = 1; day <= daysInMonth; day++) {
        var dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        var dayTrans = monthTransactions.filter(t => t.date === dateStr);
        
        var entrada = dayTrans.filter(t => t.type === 'entrada').reduce((a, b) => a + b.amount, 0);
        var saida = dayTrans.filter(t => t.type === 'saida').reduce((a, b) => a + b.amount, 0);
        var diario = dayTrans.filter(t => t.type === 'diario').reduce((a, b) => a + b.amount, 0);
        
        saldo = saldo + entrada - saida - diario;

        var tr = document.createElement('tr');
        if (isCurrentMonth && day === diaAtual) tr.className = 'linha-hoje';
        
        tr.innerHTML = `
            <td>${day} ${isCurrentMonth && day === diaAtual ? '(Hoje)' : ''}</td>
            ${renderTransCell('entrada', dateStr, entrada, dayTrans.filter(t => t.type === 'entrada'))}
            ${renderTransCell('saida', dateStr, saida, dayTrans.filter(t => t.type === 'saida'))}
            ${renderTransCell('diario', dateStr, diario, dayTrans.filter(t => t.type === 'diario'))}
            <td class="${saldo < 0 ? 'text-danger' : 'text-success'}">${formatMoney(saldo)}</td>
            <td class="bg-gray">${formatMoney(previsaoDiario)}</td>
        `;
        tbody.appendChild(tr);
    }

    var saidaTotal = totalSaidasFixas + totalDiarioMes;
    var performance = totalEntradas - saidaTotal;

    document.getElementById('sumEntrada').textContent = formatMoney(totalEntradas);
    document.getElementById('sumSaida').textContent = formatMoney(totalSaidasFixas);
    document.getElementById('sumDiario').textContent = formatMoney(totalDiarioMes);
    document.getElementById('sumSaidaTotal').textContent = formatMoney(saidaTotal);
    document.getElementById('sumPerformance').textContent = formatMoney(performance);

    renderCaixinhas(performance, year, month);
}

function renderTransCell(type, dateStr, total, transList) {
    var titles = transList.map(t => t.title).join(' + ');
    var isAdmin = currentUserRole === 'admin';
    var editBtn = isAdmin && transList.length > 0 ? `<button class="btn-icon" onclick="openDayTransModal('${dateStr}', '${type}')">✏️</button>` : '';
    var colorClass = total > 0 ? (type === 'entrada' ? 'text-success' : 'text-danger') : '';
    return `<td><div class="trans-cell"><span class="trans-value ${colorClass}" title="${titles}">${formatMoney(total)}</span>${editBtn}</div></td>`;
}

function openDayTransModal(dateStr, type) {
    var transList = state.transactions.filter(t => t.date === dateStr && t.type === type);
    var typeNames = { entrada: 'Entrada', saida: 'Saída', diario: 'Diário' };
    document.getElementById('dayTransTitle').textContent = `${typeNames[type]} em ${dateStr.split('-').reverse().join('/')}`;
    var listEl = document.getElementById('dayTransList');
    listEl.innerHTML = transList.length === 0 ? '<li>Nenhuma transação.</li>' : transList.map(t => `
        <li class="day-trans-item">
            <div><strong>${t.title}</strong><br><small>${t.category} - ${formatMoney(t.amount)}</small></div>
            <div style="display:flex; gap:0.5rem;">
                <button class="btn btn-warning btn-sm" onclick="editTransaction(${t.id})">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="deleteTransaction(${t.id})">️</button>
            </div>
        </li>
    `).join('');
    openModal('modalDayTrans');
}

function getTransactionsForMonth(year, month) {
    var start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    var end = `${year}-${String(month + 1).padStart(2, '0')}-31`;
    return state.transactions.filter(t => t.date >= start && t.date <= end);
}

// --- GRÁFICO ---
function renderChart(transactions) {
    var ctx = document.getElementById('financeChart').getContext('2d');
    var categoriesData = {};
    transactions.forEach(t => {
        if (!categoriesData[t.category]) categoriesData[t.category] = { entrada: 0, saida: 0 };
        if (t.type === 'entrada') categoriesData[t.category].entrada += t.amount;
        else categoriesData[t.category].saida += t.amount;
    });
    var labels = Object.keys(categoriesData);
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: labels.length ? labels : ['Sem dados'], datasets: [{ label: 'Entradas', data: labels.map(l => categoriesData[l].entrada), backgroundColor: '#10b981' }, { label: 'Saídas', data: labels.map(l => categoriesData[l].saida), backgroundColor: '#ef4444' }] },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// --- CAIXINHAS ---
function renderCaixinhas(performance, year, month) {
    var grid = document.getElementById('caixinhasGrid');
    if (state.caixinhas.length === 0) { grid.innerHTML = '<p style="color:var(--text-muted)">Nenhuma caixinha.</p>'; return; }
    var allocations = calculateAllocations(performance);
    var priorityNames = { muito: 'Muito Importante (60%)', importante: 'Importante (30%)', pouco: 'Pouco Importante (10%)' };
    var isAdmin = currentUserRole === 'admin';
    grid.innerHTML = state.caixinhas.map(c => {
        var allocatedValue = allocations[c.id] || 0;
        var canAllocate = isAdmin && performance > 0 && allocatedValue > 0;
        return `<div class="caixinha-card priority-${c.priority}"><span class="badge">${priorityNames[c.priority]}</span><h4>${c.title}</h4><p class="saldo">${formatMoney(c.saldo)}</p><div style="display:flex; gap:0.5rem; flex-wrap:wrap;">${canAllocate ? `<button class="btn btn-primary btn-sm" onclick="allocateCaixinha(${c.id}, ${allocatedValue})">Alocar ${formatMoney(allocatedValue)}</button>` : ''}${isAdmin ? `<button class="btn btn-secondary btn-sm" onclick="editCaixinha(${c.id})">️</button>` : ''}</div></div>`;
    }).join('');
}

function calculateAllocations(performance) {
    if (performance <= 0) return {};
    var priorities = { muito: 0.60, importante: 0.30, pouco: 0.10 };
    var allocations = {};
    for (var [priority, percent] of Object.entries(priorities)) {
        var group = state.caixinhas.filter(c => c.priority === priority).sort((a, b) => a.ranking - b.ranking);
        if (group.length === 0) continue;
        var totalPool = performance * percent;
        var totalWeight = group.reduce((sum, c) => sum + ((group.length + 1) - c.ranking), 0);
        group.forEach(c => { allocations[c.id] = totalPool * (((group.length + 1) - c.ranking) / totalWeight); });
    }
    return allocations;
}

async function allocateCaixinha(id, value) {
    if (currentUserRole !== 'admin') return;
    if (!confirm(`Alocar ${formatMoney(value)}?`)) return;
    var caixinha = state.caixinhas.find(c => c.id === id);
    var today = new Date();
    var dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    await supabaseClient.from('transacoes').insert([{ tipo: 'saida', data: dateStr, titulo: `Reserva: ${caixinha.title}`, categoria: 'Caixinhas', valor: value, recorrencia: 'nenhuma' }]);
    await supabaseClient.from('caixinhas').update({ saldo: caixinha.saldo + value }).eq('id', id);
    caixinha.saldo += value;
    await addToHistory('Alocação', `Alocado ${formatMoney(value)} em ${caixinha.title}`);
    await loadFromSupabase(); renderTimeline();
}

async function saveCaixinha() {
    if (currentUserRole !== 'admin') return;
    var editId = document.getElementById('caixEditId').value;
    var title = document.getElementById('caixTitle').value;
    var priority = document.getElementById('caixPriority').value;
    var ranking = parseInt(document.getElementById('caixRanking').value) || 1;
    var saldo = parseFloat(document.getElementById('caixSaldo').value) || 0;
    if (!title) return alert('Título obrigatório!');
    if (editId) {
        await supabaseClient.from('caixinhas').update({ titulo: title, prioridade: priority, ranking: ranking, saldo: saldo }).eq('id', parseFloat(editId));
    } else {
        await supabaseClient.from('caixinhas').insert([{ titulo: title, prioridade: priority, ranking: ranking, saldo: 0 }]);
    }
    closeModal('modalCaixinha'); clearForm('modalCaixinha');
    await loadFromSupabase(); renderTimeline();
}

function editCaixinha(id) {
    var c = state.caixinhas.find(x => x.id === id);
    document.getElementById('caixEditId').value = c.id;
    document.getElementById('caixTitle').value = c.title;
    document.getElementById('caixPriority').value = c.priority;
    document.getElementById('caixRanking').value = c.ranking;
    document.getElementById('caixSaldo').value = c.saldo;
    document.getElementById('caixSaldoGroup').style.display = 'block';
    openModal('modalCaixinha');
}

// --- TRANSAÇÕES ---
function toggleEndDate() {
    var rec = document.getElementById('transRecurrence').value;
    if (rec !== 'nenhuma') document.getElementById('groupEndDate').classList.remove('hidden');
    else document.getElementById('groupEndDate').classList.add('hidden');
}

function generateRecurrenceDates(startDate, recurrence, endDate) {
    var dates = [];
    var startParts = startDate.split('-');
    var current = new Date(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2]));

    var end;
    if (endDate && endDate !== "") {
        var endParts = endDate.split('-');
        end = new Date(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2]));
    } else {
        end = new Date(parseInt(startParts[0]) + 1, parseInt(startParts[1]) - 1, parseInt(startParts[2]));
    }

    var maxIterations = 500;
    var iterations = 0;

    while (current <= end && iterations < maxIterations) {
        var y = current.getFullYear();
        var m = String(current.getMonth() + 1).padStart(2, '0');
        var d = String(current.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${d}`);

        if (recurrence === 'diaria') {
            current.setDate(current.getDate() + 1);
        } else if (recurrence === 'quinzenal') {
            current.setDate(current.getDate() + 15);
        } else if (recurrence === 'mensal') {
            current.setMonth(current.getMonth() + 1);
        } else {
            break;
        }
        iterations++;
    }
    return dates;
}

async function saveTransaction() {
    if (currentUserRole !== 'admin') return;
    var editId = document.getElementById('transEditId').value;
    var type = document.getElementById('transType').value;
    var startDate = document.getElementById('transDate').value;
    var title = document.getElementById('transTitle').value;
    var category = document.getElementById('transCategory').value;
    var amount = parseFloat(document.getElementById('transAmount').value);
    var recurrence = document.getElementById('transRecurrence').value;
    var endDate = document.getElementById('transEndDate').value;

    if (!startDate || !title || isNaN(amount)) return alert('Preencha os campos!');

    if (editId) {
        var { error } = await supabaseClient.from('transacoes').update({
            tipo: type, data: startDate, titulo: title, categoria: category, valor: amount, recorrencia: recurrence
        }).eq('id', parseFloat(editId));

        if (error) { alert('Erro ao editar: ' + error.message); return; }
        await addToHistory('Editado', `${title} - ${formatMoney(amount)}`);
    } else {
        var dates = generateRecurrenceDates(startDate, recurrence, endDate);
        console.log("Datas geradas para recorrência:", dates);

        var newTrans = dates.map(d => ({
            tipo: type,
            data: d,
            titulo: title,
            categoria: category,
            valor: amount,
            recorrencia: recurrence
        }));

        var { data, error } = await supabaseClient.from('transacoes').insert(newTrans);

        if (error) {
            console.error("Erro ao inserir recorrência:", error);
            alert("Erro ao salvar recorrência: " + error.message);
            return;
        }

        await addToHistory('Adicionado', `${title} (${dates.length} parcelas geradas)`);
    }

    closeModal('modalTransaction');
    clearForm('modalTransaction');
    document.getElementById('groupEndDate').classList.add('hidden');
    await loadFromSupabase();
    renderTimeline();
}

function editTransaction(id) {
    var t = state.transactions.find(x => x.id === id);
    if (!t) return;
    closeModal('modalDayTrans');
    document.getElementById('transEditId').value = t.id;
    document.getElementById('transType').value = t.type;
    document.getElementById('transDate').value = t.date;
    document.getElementById('transTitle').value = t.title;
    document.getElementById('transCategory').value = t.category;
    document.getElementById('transAmount').value = t.amount;
    document.getElementById('transRecurrence').value = t.recurrence || 'nenhuma';
    toggleEndDate();
    document.getElementById('transModalTitle').textContent = 'Editar Transação';
    document.getElementById('btnDeleteTrans').classList.remove('hidden');
    openModal('modalTransaction');
}

async function confirmDeleteTransaction() {
    var id = document.getElementById('transEditId').value;
    if (id && confirm('Excluir?')) await deleteTransaction(parseFloat(id));
}

async function deleteTransaction(id) {
    await supabaseClient.from('transacoes').delete().eq('id', id);
    await loadFromSupabase(); renderTimeline();
    closeModal('modalTransaction'); closeModal('modalDayTrans'); clearForm('modalTransaction');
}

// --- METAS (GAMIFICAÇÃO) ---
function renderMetas() {
    var ativas = state.metas.filter(m => !m.concluida);
    var concluidas = state.metas.filter(m => m.concluida);
    
    document.getElementById('metasAtivasGrid').innerHTML = ativas.length ? ativas.map(m => renderMetaCard(m)).join('') : '<p style="color:var(--text-muted)">Nenhuma meta ativa.</p>';
    document.getElementById('metasConcluidasGrid').innerHTML = concluidas.length ? concluidas.map(m => renderMetaCard(m)).join('') : '<p style="color:var(--text-muted)">Nenhuma meta concluída ainda.</p>';
}

function renderMetaCard(m) {
    var percent = Math.min(100, (m.valor_atual / m.valor_alvo) * 100);
    var color = percent < 25 ? '#ef4444' : percent < 50 ? '#f59e0b' : percent < 75 ? '#84cc16' : percent < 100 ? '#10b981' : '#fbbf24';
    var isConcluida = m.concluida ? 'concluida' : '';
    var isAdmin = currentUserRole === 'admin';
    
    return `
    <div class="meta-card ${isConcluida}">
        <div class="meta-header">
            <div class="meta-icon">🏆</div>
            <div style="text-align:right;">
                ${isAdmin ? `<button class="btn btn-sm btn-secondary" onclick="editMeta(${m.id})">✏️</button> <button class="btn btn-sm btn-danger" onclick="deleteMeta(${m.id})">️</button>` : ''}
            </div>
        </div>
        <div class="meta-title">${m.titulo}</div>
        <div class="meta-reward">🎁 Recompensa: ${m.recompensa || 'Não definida'}</div>
        <div class="progress-container">
            <div class="progress-bar" style="width: ${percent}%; background-color: ${color};"></div>
            <div class="progress-text">${percent.toFixed(1)}%</div>
        </div>
        <div class="meta-values">
            <span>${formatMoney(m.valor_atual)}</span>
            <span style="color:var(--text-muted)">/ ${formatMoney(m.valor_alvo)}</span>
        </div>
        ${!m.concluida && isAdmin ? `<button class="btn btn-primary btn-sm" style="width:100%" onclick="openContribModal(${m.id})">+ Adicionar Valor</button>` : ''}
        ${m.concluida ? '<div style="text-align:center; color:#fbbf24; font-weight:bold; margin-top:0.5rem;">✨ META CONCLUÍDA! ✨</div>' : ''}
        ${m.historico ? `<div class="historico-mini">${m.historico}</div>` : ''}
    </div>`;
}

async function saveMeta() {
    if (currentUserRole !== 'admin') return;
    var id = document.getElementById('metaEditId').value;
    var titulo = document.getElementById('metaTitulo').value;
    var alvo = parseFloat(document.getElementById('metaAlvo').value);
    var recompensa = document.getElementById('metaRecompensa').value;
    if (!titulo || !alvo) return alert('Preencha título e valor!');
    
    if (id) {
        await supabaseClient.from('metas').update({ titulo, valor_alvo: alvo, recompensa }).eq('id', parseFloat(id));
    } else {
        await supabaseClient.from('metas').insert([{ titulo, valor_alvo: alvo, valor_atual: 0, recompensa, concluida: false, historico: '' }]);
    }
    closeModal('modalMeta'); clearForm('modalMeta');
    await loadFromSupabase(); renderMetas();
}

function editMeta(id) {
    var m = state.metas.find(x => x.id === id);
    document.getElementById('metaEditId').value = m.id;
    document.getElementById('metaTitulo').value = m.titulo;
    document.getElementById('metaAlvo').value = m.valor_alvo;
    document.getElementById('metaRecompensa').value = m.recompensa || '';
    document.getElementById('metaModalTitle').textContent = 'Editar Meta';
    openModal('modalMeta');
}

function openContribModal(id) {
    document.getElementById('contribMetaId').value = id;
    document.getElementById('contribValor').value = '';
    openModal('modalContribuicao');
}

async function salvarContribuicao() {
    var id = parseFloat(document.getElementById('contribMetaId').value);
    var valor = parseFloat(document.getElementById('contribValor').value);
    var data = document.getElementById('contribData').value;
    if (!valor) return alert('Valor inválido');
    
    var meta = state.metas.find(m => m.id === id);
    var novoValor = meta.valor_atual + valor;
    var concluida = novoValor >= meta.valor_alvo;
    var historicoEntry = `+ ${formatMoney(valor)} em ${data.split('-').reverse().join('/')}\n`;
    var novoHistorico = historicoEntry + (meta.historico || '');
    
    await supabaseClient.from('metas').update({ valor_atual: novoValor, concluida: concluida, historico: novoHistorico }).eq('id', id);
    closeModal('modalContribuicao');
    await loadFromSupabase(); renderMetas();
    if (concluida) alert('🎉 Parabéns! Meta Concluída! Resgate sua recompensa: ' + meta.recompensa);
}

async function deleteMeta(id) {
    if (!confirm('Excluir meta?')) return;
    await supabaseClient.from('metas').delete().eq('id', id);
    await loadFromSupabase(); renderMetas();
}

// --- CATEGORIAS & CSV ---
async function addCategory() {
    var cat = document.getElementById('newCategory').value;
    if (cat && !state.categories.includes(cat)) {
        await supabaseClient.from('categorias').insert([{ nome: cat }]);
        await loadFromSupabase(); updateCategorySelect(); renderCategoryList();
        document.getElementById('newCategory').value = '';
    }
}
function updateCategorySelect() { document.getElementById('transCategory').innerHTML = state.categories.map(c => `<option value="${c}">${c}</option>`).join(''); }
function renderCategoryList() {
    var isAdmin = currentUserRole === 'admin';
    document.getElementById('categoryList').innerHTML = state.categories.map(c => `<li style="display:flex; justify-content:space-between; padding:0.5rem; border-bottom:1px solid var(--border);">${c} ${isAdmin ? `<button class="btn btn-danger btn-sm" onclick="removeCategory('${c}')">X</button>` : ''}</li>`).join('');
}
async function removeCategory(cat) {
    await supabaseClient.from('categorias').delete().eq('nome', cat);
    await loadFromSupabase(); updateCategorySelect(); renderCategoryList();
}

async function exportData() {
    var csv = 'type,id,date,title,category,amount,recurrence\n';
    state.transactions.forEach(t => { csv += `transaction,${t.id},${t.date},"${t.title}","${t.category}",${t.amount},${t.recurrence}\n`; });
    var blob = new Blob([csv], { type: 'text/csv' });
    var link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'backup.csv'; link.click();
}

async function importData(event) {
    var file = event.target.files[0]; if (!file) return;
    var reader = new FileReader();
    reader.onload = async function(e) {
        var lines = e.target.result.split('\n').slice(1);
        var newTrans = [];
        lines.forEach(line => {
            if (!line.trim()) return;
            var cols = line.split(',');
            if (cols[0] === 'transaction') newTrans.push({ tipo: cols[1], data: cols[2], titulo: cols[3].replace(/"/g, ''), categoria: cols[4].replace(/"/g, ''), valor: parseFloat(cols[5]), recorrencia: cols[6] });
        });
        if (newTrans.length > 0) await supabaseClient.from('transacoes').insert(newTrans);
        await loadFromSupabase(); renderTimeline(); alert('Importado!');
    };
    reader.readAsText(file);
}

// --- UTILITÁRIOS ---
function formatMoney(v) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function openModal(id) { document.getElementById(id).classList.add('active'); if(id==='modalMeta' && !document.getElementById('metaEditId').value) document.getElementById('metaModalTitle').textContent='Nova Meta'; }
function closeModal(id) { document.getElementById(id).classList.remove('active'); clearForm(id); }
function clearForm(id) { document.querySelectorAll(`#${id} input`).forEach(i => { if(i.type!=='hidden') i.value=''; }); document.querySelectorAll(`#${id} input[type="hidden"]`).forEach(i => i.value=''); }
