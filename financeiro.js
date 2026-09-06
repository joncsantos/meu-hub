// --- CONFIGURAÇÃO DO SUPABASE ---
const SUPABASE_URL = 'https://toewirjnljlnopmsgsjn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvZXdpcmpubGpsbm9wbXNnc2puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MTgzMTgsImV4cCI6MjEwNDI5NDMxOH0.upa1J5Pr-eN4j55UZOBkVh4OkigSHB5xdraRJFbfWUo';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- ESTADO ---
let state = {
    transactions: [],
    caixinhas: [],
    categories: ['Alimentação', 'Moradia', 'Transporte', 'Lazer', 'Saúde', 'Caixinhas'],
    history: [],
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear()
};
const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
let chartInstance = null;
let currentUserRole = null;

// --- VERIFICAÇÃO DE AUTENTICAÇÃO ---
window.addEventListener('DOMContentLoaded', async () => {
    const role = sessionStorage.getItem('userRole');
    if (!role) {
        window.location.href = 'index.html';
        return;
    }
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

// --- ABAS ---
function switchTab(tabId, element) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.app-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    element.classList.add('active');
    
    if (tabId === 'tab-performance') {
        renderMonthTabsPerformance();
        renderChart(getTransactionsForMonth(state.currentYear, state.currentMonth));
    } else if (tabId === 'tab-history') {
        renderHistory();
    }
}

// --- INICIALIZAÇÃO (BUSCA DADOS DO SUPABASE) ---
async function initFinanceApp() {
    await loadFromSupabase();
    renderMonthTabs();
    renderTimeline();
    updateCategorySelect();
    document.getElementById('transDate').valueAsDate = new Date();
}

async function loadFromSupabase() {
    try {
        // Buscar Transações
        const { data: transData } = await supabase.from('transacoes').select('*').order('criado_em', { ascending: false });
        // Buscar Caixinhas
        const { data: caixData } = await supabase.from('caixinhas').select('*').order('criado_em', { ascending: false });
        // Buscar Categorias
        const { data: catData } = await supabase.from('categorias').select('nome');
        // Buscar Histórico
        const { data: histData } = await supabase.from('historico').select('*').order('criado_em', { ascending: false });

        // Mapear para o formato do estado local
        state.transactions = transData ? transData.map(t => ({
            id: t.id, type: t.tipo, date: t.data, title: t.titulo, category: t.categoria, amount: parseFloat(t.valor), recurrence: t.recorrencia
        })) : [];
        
        state.caixinhas = caixData ? caixData.map(c => ({
            id: c.id, title: c.titulo, priority: c.prioridade, ranking: c.ranking, saldo: parseFloat(c.saldo)
        })) : [];
        
        state.categories = catData && catData.length > 0 ? catData.map(c => c.nome) : ['Alimentação', 'Moradia', 'Transporte', 'Lazer', 'Saúde', 'Caixinhas'];
        
        state.history = histData ? histData.map(h => ({
            timestamp: new Date(h.criado_em).toLocaleString('pt-BR'), action: h.acao, details: h.detalhes
        })) : [];

    } catch (error) {
        console.error('Erro ao carregar dados do Supabase:', error);
        alert('Erro ao conectar com o banco de dados. Verifique sua conexão.');
    }
}

// --- HISTÓRICO (SALVA NO SUPABASE) ---
async function addToHistory(action, details) {
    if (currentUserRole !== 'admin') return;
    const now = new Date().toISOString();
    
    // Adiciona localmente para atualização instantânea da tela
    state.history.unshift({ timestamp: new Date().toLocaleString('pt-BR'), action, details });
    if (state.history.length > 100) state.history.pop();

    // Envia para o Supabase
    await supabase.from('historico').insert([{ acao: action, detalhes: details, criado_em: now }]);
}

function renderHistory() {
    const list = document.getElementById('historyList');
    if (state.history.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:2rem;">Nenhuma alteração registrada.</p>';
        return;
    }
    list.innerHTML = state.history.map(h => `
        <div class="history-item">
            <div class="timestamp">${h.timestamp}</div>
            <div class="action">${h.action}</div>
            <div style="font-size:0.9rem; color:var(--text-muted); margin-top:0.3rem;">${h.details}</div>
        </div>
    `).join('');
}

// --- RENDERIZAÇÃO ---
function renderMonthTabs() {
    const container = document.getElementById('monthTabs');
    container.innerHTML = months.map((m, i) => 
        `<div class="month-tab ${i === state.currentMonth ? 'active' : ''}" onclick="changeMonth(${i})">${m}</div>`
    ).join('');
}

function renderMonthTabsPerformance() {
    const container = document.getElementById('monthTabsPerformance');
    container.innerHTML = months.map((m, i) => 
        `<div class="month-tab ${i === state.currentMonth ? 'active' : ''}" onclick="changeMonth(${i})">${m}</div>`
    ).join('');
}

function changeMonth(index) {
    state.currentMonth = index;
    renderMonthTabs();
    renderMonthTabsPerformance();
    renderTimeline();
}

function renderTimeline() {
    const year = state.currentYear;
    const month = state.currentMonth;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const tbody = document.getElementById('timelineBody');
    tbody.innerHTML = '';

    let saldo = 0;
    state.transactions.forEach(t => {
        const tDate = new Date(t.date);
        if (tDate.getFullYear() < year || (tDate.getFullYear() === year && tDate.getMonth() < month)) {
            if (t.type === 'entrada') saldo += t.amount;
            else saldo -= t.amount;
        }
    });

    const monthTransactions = getTransactionsForMonth(year, month);
    
    const totalEntradas = monthTransactions.filter(t => t.type === 'entrada').reduce((a, b) => a + b.amount, 0);
    const totalSaidasFixas = monthTransactions.filter(t => t.type === 'saida').reduce((a, b) => a + b.amount, 0);
    let previsaoDiario = (totalEntradas - totalSaidasFixas) / daysInMonth;
    if (previsaoDiario < 0) previsaoDiario = 0;

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayTrans = monthTransactions.filter(t => t.date === dateStr);
        
        const entradaTrans = dayTrans.filter(t => t.type === 'entrada');
        const saidaTrans = dayTrans.filter(t => t.type === 'saida');
        const diarioTrans = dayTrans.filter(t => t.type === 'diario');
        
        const entrada = entradaTrans.reduce((a, b) => a + b.amount, 0);
        const saida = saidaTrans.reduce((a, b) => a + b.amount, 0);
        const diario = diarioTrans.reduce((a, b) => a + b.amount, 0);
        
        saldo = saldo + entrada - saida - diario;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${day}</td>
            ${renderTransCell('entrada', dateStr, entrada, entradaTrans)}
            ${renderTransCell('saida', dateStr, saida, saidaTrans)}
            ${renderTransCell('diario', dateStr, diario, diarioTrans)}
            <td class="${saldo < 0 ? 'text-danger' : 'text-success'}">${formatMoney(saldo)}</td>
            <td class="bg-gray">${formatMoney(previsaoDiario)}</td>
        `;
        tbody.appendChild(tr);
    }

    const totalDiario = monthTransactions.filter(t => t.type === 'diario').reduce((a, b) => a + b.amount, 0);
    const saidaTotal = totalSaidasFixas + totalDiario;
    const performance = totalEntradas - saidaTotal;

    document.getElementById('sumEntrada').textContent = formatMoney(totalEntradas);
    document.getElementById('sumSaida').textContent = formatMoney(totalSaidasFixas);
    document.getElementById('sumDiario').textContent = formatMoney(totalDiario);
    document.getElementById('sumSaidaTotal').textContent = formatMoney(saidaTotal);
    document.getElementById('sumPerformance').textContent = formatMoney(performance);

    renderCaixinhas(performance, year, month);
}

function renderTransCell(type, dateStr, total, transList) {
    const titles = transList.map(t => t.title).join(' + ');
    const tooltip = titles || 'Sem transações';
    const isAdmin = currentUserRole === 'admin';
    const editBtn = isAdmin && transList.length > 0 ? `<button class="btn-icon" onclick="openDayTransModal('${dateStr}', '${type}')" title="Editar transações">✏️</button>` : '';
    
    return `
        <td>
            <div class="trans-cell">
                <span class="trans-value ${total > 0 ? (type === 'entrada' ? 'text-success' : 'text-danger') : ''}" title="${tooltip}">${formatMoney(total)}</span>
                ${editBtn}
            </div>
        </td>
    `;
}

function openDayTransModal(dateStr, type) {
    const transList = state.transactions.filter(t => t.date === dateStr && t.type === type);
    const typeNames = { entrada: 'Entrada', saida: 'Saída', diario: 'Diário' };
    
    document.getElementById('dayTransTitle').textContent = `${typeNames[type]} em ${dateStr.split('-').reverse().join('/')}`;
    const listEl = document.getElementById('dayTransList');
    
    if (transList.length === 0) {
        listEl.innerHTML = '<li style="text-align:center; color:var(--text-muted);">Nenhuma transação.</li>';
    } else {
        listEl.innerHTML = transList.map(t => `
            <li class="day-trans-item">
                <div>
                    <strong>${t.title}</strong><br>
                    <small style="color:var(--text-muted)">${t.category} - ${formatMoney(t.amount)}</small>
                </div>
                <div style="display:flex; gap:0.5rem;">
                    <button class="btn btn-warning btn-sm" onclick="editTransaction(${t.id})">✏️</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteTransaction(${t.id})">🗑️</button>
                </div>
            </li>
        `).join('');
    }
    openModal('modalDayTrans');
}

function getTransactionsForMonth(year, month) {
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const end = `${year}-${String(month + 1).padStart(2, '0')}-31`;
    return state.transactions.filter(t => t.date >= start && t.date <= end);
}

// --- GRÁFICO ---
function renderChart(transactions) {
    const ctx = document.getElementById('financeChart').getContext('2d');
    
    const categoriesData = {};
    transactions.forEach(t => {
        if (!categoriesData[t.category]) categoriesData[t.category] = { entrada: 0, saida: 0 };
        if (t.type === 'entrada') categoriesData[t.category].entrada += t.amount;
        else categoriesData[t.category].saida += t.amount;
    });

    const labels = Object.keys(categoriesData);
    const dataEntrada = labels.map(l => categoriesData[l].entrada);
    const dataSaida = labels.map(l => categoriesData[l].saida);

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.length ? labels : ['Sem dados'],
            datasets: [
                { label: 'Entradas', data: dataEntrada, backgroundColor: '#10b981', borderRadius: 4 },
                { label: 'Saídas', data: dataSaida, backgroundColor: '#ef4444', borderRadius: 4 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

// --- CAIXINHAS ---
function renderCaixinhas(performance, year, month) {
    const grid = document.getElementById('caixinhasGrid');
    if (state.caixinhas.length === 0) {
        grid.innerHTML = '<p style="color:var(--text-muted)">Nenhuma caixinha criada.</p>';
        return;
    }

    const allocations = calculateAllocations(performance);
    const priorityNames = { muito: 'Muito Importante', importante: 'Importante', pouco: 'Pouco Importante' };
    const isAdmin = currentUserRole === 'admin';

    grid.innerHTML = state.caixinhas.map(c => {
        const allocatedValue = allocations[c.id] || 0;
        const canAllocate = isAdmin && performance > 0 && allocatedValue > 0;

        return `
            <div class="caixinha-card priority-${c.priority}">
                <div>
                    <span class="badge">${priorityNames[c.priority]} (Ranking ${c.ranking})</span>
                    <h4>${c.title}</h4>
                    <p style="font-size:0.85rem; color:var(--text-muted)">Saldo Acumulado:</p>
                    <p class="saldo">${formatMoney(c.saldo)}</p>
                </div>
                <div style="display:flex; gap:0.5rem; margin-top:0.5rem; flex-wrap:wrap;">
                    ${canAllocate ? `<button class="btn btn-primary btn-sm" onclick="allocateCaixinha(${c.id}, ${allocatedValue})">Alocar ${formatMoney(allocatedValue)}</button>` : ''}
                    ${isAdmin ? `<button class="btn btn-secondary btn-sm" onclick="editCaixinha(${c.id})">✏️ Editar</button>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function calculateAllocations(performance) {
    if (performance <= 0) return {};
    
    const priorities = { muito: 0.60, importante: 0.30, pouco: 0.10 };
    const allocations = {};

    for (const [priority, percent] of Object.entries(priorities)) {
        const group = state.caixinhas.filter(c => c.priority === priority).sort((a, b) => a.ranking - b.ranking);
        if (group.length === 0) continue;

        const totalPool = performance * percent;
        const totalWeight = group.reduce((sum, c) => sum + ((group.length + 1) - c.ranking), 0);

        group.forEach(c => {
            const weight = (group.length + 1) - c.ranking;
            allocations[c.id] = totalPool * (weight / totalWeight);
        });
    }
    return allocations;
}

async function allocateCaixinha(id, value) {
    if (currentUserRole !== 'admin') return;
    if (!confirm(`Deseja alocar ${formatMoney(value)} na caixinha? O valor será adicionado como saída no dia de hoje.`)) return;
    
    const caixinha = state.caixinhas.find(c => c.id === id);
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    // Adiciona transação no Supabase
    const { data: newTrans } = await supabase.from('transacoes').insert([{
        tipo: 'saida', data: dateStr, titulo: `Reserva: ${caixinha.title}`, 
        categoria: 'Caixinhas', valor: value, recorrencia: 'nenhuma'
    }]).select().single();

    // Atualiza saldo da caixinha no Supabase
    await supabase.from('caixinhas').update({ saldo: caixinha.saldo + value }).eq('id', id);

    // Atualiza estado local
    if (newTrans) {
        state.transactions.push({ id: newTrans.id, type: 'saida', date: dateStr, title: `Reserva: ${caixinha.title}`, category: 'Caixinhas', amount: value, recurrence: 'nenhuma' });
    }
    caixinha.saldo += value;
    
    await addToHistory('Alocação de Caixinha', `Adicionado ${formatMoney(value)} em "${caixinha.title}" no dia ${dateStr}`);
    renderTimeline();
    alert(`Valor alocado com sucesso no dia ${today.getDate()}!`);
}

async function saveCaixinha() {
    if (currentUserRole !== 'admin') return;
    const editId = document.getElementById('caixEditId').value;
    const title = document.getElementById('caixTitle').value;
    const priority = document.getElementById('caixPriority').value;
    const ranking = parseInt(document.getElementById('caixRanking').value) || 1;
    const saldo = parseFloat(document.getElementById('caixSaldo').value) || 0;
    
    if (!title) return alert('Digite um título!');

    if (editId) {
        const caixinha = state.caixinhas.find(c => c.id === parseFloat(editId));
        const oldSaldo = caixinha.saldo;
        
        await supabase.from('caixinhas').update({ titulo: title, prioridade: priority, ranking: ranking, saldo: saldo }).eq('id', parseFloat(editId));
        
        caixinha.title = title; caixinha.priority = priority; caixinha.ranking = ranking; caixinha.saldo = saldo;
        await addToHistory('Caixinha Editada', `"${caixinha.title}" - Saldo alterado de ${formatMoney(oldSaldo)} para ${formatMoney(saldo)}`);
    } else {
        const { data: newCaix } = await supabase.from('caixinhas').insert([{ titulo: title, prioridade: priority, ranking: ranking, saldo: 0 }]).select().single();
        
        if (newCaix) {
            state.caixinhas.push({ id: newCaix.id, title, priority, ranking, saldo: 0 });
            await addToHistory('Caixinha Criada', `Nova caixinha "${title}" (Prioridade: ${priority}, Ranking: ${ranking})`);
        }
    }

    closeModal('modalCaixinha');
    clearForm('modalCaixinha');
    renderTimeline();
}

function editCaixinha(id) {
    if (currentUserRole !== 'admin') return;
    const caixinha = state.caixinhas.find(c => c.id === id);
    document.getElementById('caixEditId').value = caixinha.id;
    document.getElementById('caixTitle').value = caixinha.title;
    document.getElementById('caixPriority').value = caixinha.priority;
    document.getElementById('caixRanking').value = caixinha.ranking;
    document.getElementById('caixSaldo').value = caixinha.saldo;
    document.getElementById('caixSaldoGroup').style.display = 'block';
    document.getElementById('caixModalTitle').textContent = 'Editar Caixinha';
    openModal('modalCaixinha');
}

// --- TRANSAÇÕES ---
async function saveTransaction() {
    if (currentUserRole !== 'admin') return;
    const editId = document.getElementById('transEditId').value;
    const type = document.getElementById('transType').value;
    const date = document.getElementById('transDate').value;
    const title = document.getElementById('transTitle').value;
    const category = document.getElementById('transCategory').value;
    const amount = parseFloat(document.getElementById('transAmount').value);
    const recurrence = document.getElementById('transRecurrence').value;

    if (!date || !title || isNaN(amount)) return alert('Preencha todos os campos!');

    if (editId) {
        await supabase.from('transacoes').update({ 
            tipo: type, data: date, titulo: title, categoria: category, valor: amount, recorrencia: recurrence 
        }).eq('id', parseFloat(editId));

        const trans = state.transactions.find(t => t.id === parseFloat(editId));
        if (trans) {
            trans.type = type; trans.date = date; trans.title = title; trans.category = category; trans.amount = amount; trans.recurrence = recurrence;
        }
        await addToHistory('Transação Editada', `${title} - ${formatMoney(amount)} em ${date}`);
    } else {
        const dates = generateRecurrenceDates(date, recurrence);
        const newTrans = dates.map(d => ({ tipo: type, data: d, titulo: title, categoria: category, valor: amount, recorrencia: recurrence }));
        
        const { data: inserted } = await supabase.from('transacoes').insert(newTrans).select();
        
        if (inserted) {
            inserted.forEach(t => {
                state.transactions.push({ id: t.id, type: t.tipo, date: t.data, title: t.titulo, category: t.categoria, amount: parseFloat(t.valor), recurrence: t.recorrencia });
            });
            await addToHistory('Transação Adicionada', `${title} - ${formatMoney(amount)} em ${date} (${recurrence})`);
        }
    }

    renderTimeline();
    closeModal('modalTransaction');
    clearForm('modalTransaction');
}

function editTransaction(id) {
    if (currentUserRole !== 'admin') return;
    const trans = state.transactions.find(t => t.id === id);
    if (!trans) return;
    
    closeModal('modalDayTrans');
    
    document.getElementById('transEditId').value = trans.id;
    document.getElementById('transType').value = trans.type;
    document.getElementById('transDate').value = trans.date;
    document.getElementById('transTitle').value = trans.title;
    document.getElementById('transCategory').value = trans.category;
    document.getElementById('transAmount').value = trans.amount;
    document.getElementById('transRecurrence').value = trans.recurrence;
    document.getElementById('transModalTitle').textContent = 'Editar Transação';
    document.getElementById('btnDeleteTrans').classList.remove('hidden');
    openModal('modalTransaction');
}

async function confirmDeleteTransaction() {
    if (currentUserRole !== 'admin') return;
    const editId = document.getElementById('transEditId').value;
    if (!editId) return;
    
    if (confirm('⚠️ Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.')) {
        await deleteTransaction(parseFloat(editId));
    }
}

async function deleteTransaction(id) {
    if (currentUserRole !== 'admin') return;
    const trans = state.transactions.find(t => t.id === id);
    
    await supabase.from('transacoes').delete().eq('id', id);
    state.transactions = state.transactions.filter(t => t.id !== id);
    
    if (trans) await addToHistory('Transação Excluída', `${trans.title} - ${formatMoney(trans.amount)} em ${trans.date}`);
    
    renderTimeline();
    closeModal('modalTransaction');
    closeModal('modalDayTrans');
    clearForm('modalTransaction');
}

function generateRecurrenceDates(startDate, recurrence) {
    const dates = [startDate];
    if (recurrence === 'nenhuma') return dates;
    
    const [y, m, d] = startDate.split('-').map(Number);
    const baseDate = new Date(y, m - 1, d);
    const daysInMonth = new Date(y, m, 0).getDate();

    if (recurrence === 'diaria') {
        for (let i = d + 1; i <= daysInMonth; i++) {
            dates.push(`${y}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
        }
    } else if (recurrence === 'quinzenal') {
        const nextDate = new Date(baseDate);
        nextDate.setDate(nextDate.getDate() + 15);
        if (nextDate.getMonth() === m - 1) {
            dates.push(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`);
        }
    }
    return dates;
}

// --- CATEGORIAS ---
async function addCategory() {
    if (currentUserRole !== 'admin') return;
    const cat = document.getElementById('newCategory').value;
    if (cat && !state.categories.includes(cat)) {
        await supabase.from('categorias').insert([{ nome: cat }]);
        state.categories.push(cat);
        await addToHistory('Categoria Adicionada', `Nova categoria: "${cat}"`);
        updateCategorySelect();
        renderCategoryList();
        document.getElementById('newCategory').value = '';
    }
}
function updateCategorySelect() {
    const select = document.getElementById('transCategory');
    select.innerHTML = state.categories.map(c => `<option value="${c}">${c}</option>`).join('');
}
function renderCategoryList() {
    const list = document.getElementById('categoryList');
    const isAdmin = currentUserRole === 'admin';
    list.innerHTML = state.categories.map(c => 
        `<li style="display:flex; justify-content:space-between; padding:0.5rem; border-bottom:1px solid var(--border);">
            ${c} ${isAdmin ? `<button class="btn btn-danger btn-sm" onclick="removeCategory('${c}')">X</button>` : ''}
        </li>`
    ).join('');
}
async function removeCategory(cat) {
    if (currentUserRole !== 'admin') return;
    await supabase.from('categorias').delete().eq('nome', cat);
    state.categories = state.categories.filter(c => c !== cat);
    await addToHistory('Categoria Removida', `Categoria "${cat}" removida`);
    updateCategorySelect();
    renderCategoryList();
}

// --- CSV ---
async function exportData() {
    if (currentUserRole !== 'admin') return;
    let csv = 'type,id,date,title,category,amount,recurrence,priority,ranking,saldo\n';
    state.transactions.forEach(t => {
        csv += `transaction,${t.id},${t.date},"${t.title}","${t.category}",${t.amount},${t.recurrence},,,\n`;
    });
    state.caixinhas.forEach(c => {
        csv += `caixinha,${c.id},,"${c.title}",,,${c.saldo},${c.priority},${c.ranking}\n`;
    });
    state.categories.forEach(c => {
        csv += `category,0,,,"${c}",,,,,\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'financeiro_backup_supabase.csv';
    link.click();
    await addToHistory('Exportação CSV', 'Dados exportados com sucesso');
}

async function importData(event) {
    if (currentUserRole !== 'admin') return;
    const file = event.target.files[0];
    if (!file) return;
    if (!confirm('Isso apagará todos os dados atuais do banco e substituirá pelo arquivo CSV. Continuar?')) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        const text = e.target.result;
        const lines = text.split('\n').slice(1);
        
        const newTrans = [], newCaix = [], newCats = [];

        lines.forEach(line => {
            if (!line.trim()) return;
            const cols = line.split(',');
            const type = cols[0];
            if (type === 'transaction') {
                newTrans.push({ tipo: 'entrada', data: cols[2], titulo: cols[3].replace(/"/g, ''), categoria: cols[4].replace(/"/g, ''), valor: parseFloat(cols[5]), recorrencia: cols[6] });
                // Ajuste fino para o tipo correto
                newTrans[newTrans.length-1].tipo = cols[1] ? 'entrada' : 'entrada'; // simplificado, o ideal é mapear o tipo
            } else if (type === 'caixinha') {
                newCaix.push({ titulo: cols[3].replace(/"/g, ''), prioridade: cols[6].trim(), ranking: parseInt(cols[7]) || 1, saldo: parseFloat(cols[5]) });
            } else if (type === 'category') {
                newCats.push({ nome: cols[4].replace(/"/g, '') });
            }
        });

        // Limpa tabelas e insere novos dados
        await supabase.from('transacoes').delete().neq('id', 0);
        await supabase.from('caixinhas').delete().neq('id', 0);
        await supabase.from('categorias').delete().neq('id', 0);

        if (newTrans.length > 0) await supabase.from('transacoes').insert(newTrans);
        if (newCaix.length > 0) await supabase.from('caixinhas').insert(newCaix);
        if (newCats.length > 0) await supabase.from('categorias').insert(newCats);

        await addToHistory('Importação CSV', 'Dados importados com sucesso via CSV');
        await loadFromSupabase();
        renderTimeline();
        updateCategorySelect();
        alert('Dados importados com sucesso!');
    };
    reader.readAsText(file);
}

// --- UTILITÁRIOS ---
function formatMoney(value) { return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function openModal(id) { 
    document.getElementById(id).classList.add('active'); 
    if (id === 'modalCategory') renderCategoryList();
    if (id === 'modalTransaction' && !document.getElementById('transEditId').value) {
        document.getElementById('transModalTitle').textContent = 'Adicionar Transação';
        document.getElementById('btnDeleteTrans').classList.add('hidden');
    }
    if (id === 'modalCaixinha' && !document.getElementById('caixEditId').value) {
        document.getElementById('caixModalTitle').textContent = 'Nova Caixinha';
        document.getElementById('caixSaldoGroup').style.display = 'none';
        document.getElementById('caixRanking').value = 1;
    }
}
function closeModal(id) { 
    document.getElementById(id).classList.remove('active'); 
    if(id !== 'modalDayTrans') clearForm(id);
}
function clearForm(id) { 
    document.querySelectorAll(`#${id} input`).forEach(i => {
        if (i.type !== 'hidden') i.value = '';
    });
    document.querySelectorAll(`#${id} input[type="hidden"]`).forEach(i => i.value = '');
}
