// --- CONFIGURAÇÃO DO SUPABASE ---
var SUPABASE_URL = 'https://toewirjnljlnopmsgsjn.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvZXdpcmpubGpsbm9wbXNnc2puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MTgzMTgsImV4cCI6MjEwNDI5NDMxOH0.upa1J5Pr-eN4j55UZOBkVh4OkigSHB5xdraRJFbfWUo';
var supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- ESTADO ---
var state = {
    comissoes: [],
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear()
};
var months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
var currentUserRole = null;

// --- INICIALIZAÇÃO ---
window.addEventListener('DOMContentLoaded', async function() {
    var role = sessionStorage.getItem('userRole');
    if (!role) {
        window.location.href = 'index.html';
        return;
    }
    currentUserRole = role;
    applyPermissions();
    await initComissoes();
});

function applyPermissions() {
    document.getElementById('userBadge').textContent = currentUserRole === 'admin' ? '(Administrador)' : '(Visualização)';
    if (currentUserRole === 'admin') {
        document.body.classList.add('admin-mode');
    }
}

async function initComissoes() {
    await loadFromSupabase();
    renderMesScroll();
    renderCards();
    updateResumo();
}

async function loadFromSupabase() {
    try {
        var result = await supabaseClient.from('comissoes').select('*').order('criado_em', { ascending: false });
        if (result.error) {
            console.error('Erro ao carregar:', result.error);
            return;
        }
        state.comissoes = result.data ? result.data.map(function(c) {
            return {
                id: c.id,
                cliente: c.cliente,
                nota_fiscal: c.nota_fiscal,
                parcela_letra: c.parcela_letra,
                valor_parcela: parseFloat(c.valor_parcela),
                percentual_comissao: parseFloat(c.percentual_comissao),
                valor_comissao: parseFloat(c.valor_comissao),
                data_pagamento: c.data_pagamento,
                pago: c.pago || false,
                mes_referencia: c.mes_referencia,
                criado_em: c.criado_em
            };
        }) : [];
    } catch (error) {
        console.error('Erro ao carregar comissões:', error);
    }
}

function renderMesScroll() {
    var container = document.getElementById('mesScroll');
    var html = '';
    months.forEach(function(m, i) {
        html += '<button class="mes-btn ' + (i === state.currentMonth ? 'active' : '') + '" onclick="changeMonth(' + i + ')">' + m + '</button>';
    });
    container.innerHTML = html;
}

function changeMonth(index) {
    state.currentMonth = index;
    renderMesScroll();
    renderCards();
    updateResumo();
}

function renderCards() {
    var grid = document.getElementById('cardsGrid');
    var year = state.currentYear;
    var month = state.currentMonth;
    
    // Agrupar comissões por cliente e nota fiscal
    var grupos = {};
    state.comissoes.forEach(function(c) {
        var key = c.cliente + '|' + c.nota_fiscal;
        if (!grupos[key]) {
            grupos[key] = { cliente: c.cliente, nota: c.nota_fiscal, parcelas: [] };
        }
        grupos[key].parcelas.push(c);
    });
    
    if (Object.keys(grupos).length === 0) {
        grid.innerHTML = '<p style="color:var(--text-muted); text-align:center; grid-column:1/-1;">Nenhuma comissão cadastrada. Clique em "+ Adicionar Comissão" para começar.</p>';
        return;
    }
    
    var html = '';
    Object.keys(grupos).forEach(function(key) {
        var grupo = grupos[key];
        var parcelasOrdenadas = grupo.parcelas.sort(function(a, b) {
            return a.parcela_letra.localeCompare(b.parcela_letra);
        });
        
        html += '<div class="comissao-card">';
        html += '<div class="comissao-card-header">';
        html += '<h4>' + grupo.cliente + '</h4>';
        html += '<p>Nota Fiscal: ' + grupo.nota + '</p>';
        html += '</div>';
        html += '<div class="parcelas-list">';
        
        parcelasOrdenadas.forEach(function(p) {
            var isPaga = p.pago ? 'paga' : '';
            var dataDisplay = p.data_pagamento ? formatDate(p.data_pagamento) : 'Não definida';
            var comissaoDisplay = formatMoney(p.valor_comissao);
            
            html += '<div class="parcela-item ' + isPaga + '">';
            html += '<div class="parcela-info">';
            html += '<span class="parcela-letra">' + p.parcela_letra + '</span>';
            html += '<span class="parcela-valor">R$ ' + p.valor_parcela.toFixed(2).replace('.', ',') + '</span>';
            html += '<div class="parcela-comissao">Comissão: ' + comissaoDisplay + '</div>';
            html += '<small style="color:var(--text-muted); display:block; margin-top:0.3rem;">Data: ' + dataDisplay + '</small>';
            html += '</div>';
            html += '<div class="parcela-actions">';
            html += '<input type="date" value="' + (p.data_pagamento || '') + '" onchange="updateDataPagamento(' + p.id + ', this.value)" ' + (currentUserRole !== 'admin' ? 'disabled' : '') + '>';
            html += '<input type="checkbox" ' + (p.pago ? 'checked' : '') + ' onchange="updatePago(' + p.id + ', this.checked)" ' + (currentUserRole !== 'admin' ? 'disabled' : '') + ' title="Pago">';
            if (currentUserRole === 'admin') {
                html += '<button class="btn btn-warning btn-sm" onclick="editParcela(' + p.id + ')">✏️</button>';
                html += '<button class="btn btn-danger btn-sm" onclick="deleteParcela(' + p.id + ')">🗑️</button>';
            }
            html += '</div>';
            html += '</div>';
        });
        
        html += '</div></div>';
    });
    
    grid.innerHTML = html;
}

function updateResumo() {
    var year = state.currentYear;
    var month = state.currentMonth;
    
    // Previsão: todas as parcelas com data até dia 22 do mês atual
    var previsao = state.comissoes.filter(function(c) {
        if (!c.data_pagamento) return false;
        var d = new Date(c.data_pagamento);
        return d.getFullYear() === year && d.getMonth() === month && d.getDate() <= 22;
    }).reduce(function(sum, c) { return sum + c.valor_comissao; }, 0);
    
    // A Receber: parcelas pagas com data até dia 22 do mês ANTERIOR
    var prevMonth = month === 0 ? 11 : month - 1;
    var prevYear = month === 0 ? year - 1 : year;
    
    var aReceber = state.comissoes.filter(function(c) {
        if (!c.pago || !c.data_pagamento) return false;
        var d = new Date(c.data_pagamento);
        return d.getFullYear() === prevYear && d.getMonth() === prevMonth && d.getDate() <= 22;
    }).reduce(function(sum, c) { return sum + c.valor_comissao; }, 0);
    
    document.getElementById('resumoPrevisao').textContent = formatMoney(previsao);
    document.getElementById('resumoReceber').textContent = formatMoney(aReceber);
}

async function saveComissao() {
    if (currentUserRole !== 'admin') return;
    
    var cliente = document.getElementById('comissaoCliente').value;
    var nota = document.getElementById('comissaoNota').value;
    var parcelas = parseInt(document.getElementById('comissaoParcelas').value);
    var valor = parseFloat(document.getElementById('comissaoValor').value);
    var percentual = parseFloat(document.getElementById('comissaoPercentual').value);
    
    if (!cliente || !nota || !parcelas || !valor) {
        alert('Preencha todos os campos!');
        return;
    }
    
    var letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    var newComissoes = [];
    var mesRef = state.currentYear + '-' + String(state.currentMonth + 1).padStart(2, '0');
    
    for (var i = 0; i < parcelas; i++) {
        var letra = letras[i] || ('P' + (i + 1));
        var valorComissao = (valor * 0.77) * (percentual / 100);
        
        newComissoes.push({
            cliente: cliente,
            nota_fiscal: nota,
            parcela_letra: letra,
            valor_parcela: valor,
            percentual_comissao: percentual,
            valor_comissao: valorComissao,
            data_pagamento: null,
            pago: false,
            mes_referencia: mesRef
            // REMOVEMOS criado_em - o Supabase vai preencher automaticamente
        });
    }
    
    console.log('Enviando dados:', newComissoes);
    
    var result = await supabaseClient.from('comissoes').insert(newComissoes);
    
    if (result.error) {
        console.error('Erro detalhado:', result.error);
        alert('Erro ao salvar comissão: ' + result.error.message);
        return;
    }
    
    console.log('Sucesso!', result);
    closeModal('modalComissao');
    clearForm('modalComissao');
    await loadFromSupabase();
    renderCards();
    updateResumo();
    alert('Comissão adicionada com sucesso!');
}

async function updateDataPagamento(id, data) {
    if (currentUserRole !== 'admin') return;
    
    var result = await supabaseClient.from('comissoes').update({ data_pagamento: data }).eq('id', id);
    if (result.error) {
        console.error('Erro ao atualizar data:', result.error);
        return;
    }
    
    var parcela = state.comissoes.find(function(c) { return c.id === id; });
    if (parcela) {
        parcela.data_pagamento = data;
    }
    updateResumo();
}

async function updatePago(id, pago) {
    if (currentUserRole !== 'admin') return;
    
    var result = await supabaseClient.from('comissoes').update({ pago: pago }).eq('id', id);
    if (result.error) {
        console.error('Erro ao atualizar pago:', result.error);
        return;
    }
    
    var parcela = state.comissoes.find(function(c) { return c.id === id; });
    if (parcela) {
        parcela.pago = pago;
    }
    renderCards();
    updateResumo();
}

function editParcela(id) {
    if (currentUserRole !== 'admin') return;
    alert('Funcionalidade de edição em desenvolvimento');
}

async function deleteParcela(id) {
    if (currentUserRole !== 'admin') return;
    if (!confirm('Tem certeza que deseja excluir esta parcela?')) return;
    
    var result = await supabaseClient.from('comissoes').delete().eq('id', id);
    if (result.error) {
        console.error('Erro ao excluir:', result.error);
        return;
    }
    
    await loadFromSupabase();
    renderCards();
    updateResumo();
}

function formatDate(dateStr) {
    if (!dateStr) return 'Não definida';
    var parts = dateStr.split('-');
    return parts[2] + '/' + parts[1] + '/' + parts[0];
}

function formatMoney(value) {
    return 'R$ ' + value.toFixed(2).replace('.', ',');
}

function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function clearForm(id) {
    document.querySelectorAll('#' + id + ' input').forEach(function(input) {
        if (input.type !== 'hidden') input.value = '';
    });
}
