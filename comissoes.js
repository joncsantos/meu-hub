var SUPABASE_URL = 'https://toewirjnljlnopmsgsjn.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvZXdpcmpubGpsbm9wbXNnc2puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MTgzMTgsImV4cCI6MjEwNDI5NDMxOH0.upa1J5Pr-eN4j55UZOBkVh4OkigSHB5xdraRJFbfWUo';
var supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

var state = {
    comissoes: [],
    pendentes: [],
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear()
};
var months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
var currentUserRole = null;

window.addEventListener('DOMContentLoaded', async function() {
    var role = sessionStorage.getItem('userRole');
    if (!role) { window.location.href = 'index.html'; return; }
    currentUserRole = role;
    applyPermissions();
    await initComissoes();
});

function applyPermissions() {
    document.getElementById('userBadge').textContent = currentUserRole === 'admin' ? '(Administrador)' : '(Visualização)';
    if (currentUserRole === 'admin') document.body.classList.add('admin-mode');
}

async function initComissoes() {
    await Promise.all([loadFromSupabase(), loadPendentes()]);
    renderMesScroll();
    renderCards();
    updateResumo();
    renderFiltroMes();
    renderPendencias();
    renderPendentesTab();
}

async function loadFromSupabase() {
    var result = await supabaseClient.from('comissoes').select('*').order('criado_em', { ascending: false });
    if (result.error) { console.error('Erro ao carregar:', result.error); return; }
    state.comissoes = result.data ? result.data.map(function(c) {
        return {
            id: c.id, cliente: c.cliente, nota_fiscal: c.nota_fiscal, parcela_letra: c.parcela_letra,
            valor_parcela: parseFloat(c.valor_parcela), percentual_comissao: parseFloat(c.percentual_comissao),
            valor_comissao: parseFloat(c.valor_comissao), data_pagamento: c.data_pagamento,
            pago: c.pago || false, mes_referencia: c.mes_referencia
        };
    }) : [];
}

async function loadPendentes() {
    var result = await supabaseClient.from('comissoes_pendentes').select('*').order('criado_em', { ascending: false });
    if (result.error) { console.error('Erro ao carregar pendentes:', result.error); return; }
    state.pendentes = result.data || [];
}

function switchComissaoTab(tabId, element) {
    document.querySelectorAll('.tab-content').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.comissoes-tab').forEach(function(t) { t.classList.remove('active'); });
    document.getElementById(tabId).classList.add('active');
    element.classList.add('active');
    if (tabId === 'tab-pendencias') renderPendencias();
    if (tabId === 'tab-a-incluir') renderPendentesTab();
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
    var grupos = {};
    state.comissoes.forEach(function(c) {
        var key = c.cliente + '|' + c.nota_fiscal;
        if (!grupos[key]) grupos[key] = { cliente: c.cliente, nota: c.nota_fiscal, parcelas: [] };
        grupos[key].parcelas.push(c);
    });
    if (Object.keys(grupos).length === 0) {
        grid.innerHTML = '<p style="color:var(--text-muted); text-align:center; grid-column:1/-1;">Nenhuma comissão cadastrada.</p>';
        return;
    }
    var html = '';
    Object.keys(grupos).forEach(function(key) {
        var grupo = grupos[key];
        var parcelasOrdenadas = grupo.parcelas.sort(function(a, b) { return a.parcela_letra.localeCompare(b.parcela_letra); });
        html += '<div class="comissao-card"><div class="comissao-card-header"><h4>' + grupo.cliente + '</h4><p>Nota Fiscal: ' + grupo.nota + '</p></div><div class="parcelas-list">';
        parcelasOrdenadas.forEach(function(p) {
            var isPaga = p.pago ? 'paga' : '';
            var dataDisplay = p.data_pagamento ? formatDate(p.data_pagamento) : 'Não definida';
            html += '<div class="parcela-item ' + isPaga + '"><div class="parcela-info"><span class="parcela-letra">' + p.parcela_letra + '</span><span class="parcela-valor">R$ ' + p.valor_parcela.toFixed(2).replace('.', ',') + '</span><div class="parcela-comissao">Comissão: ' + formatMoney(p.valor_comissao) + '</div><small style="color:var(--text-muted); display:block; margin-top:0.3rem;">Data: ' + dataDisplay + '</small></div><div class="parcela-actions"><input type="date" value="' + (p.data_pagamento || '') + '" onchange="updateDataPagamento(' + p.id + ', this.value)" ' + (currentUserRole !== 'admin' ? 'disabled' : '') + '><input type="checkbox" ' + (p.pago ? 'checked' : '') + ' onchange="updatePago(' + p.id + ', this.checked)" ' + (currentUserRole !== 'admin' ? 'disabled' : '') + ' title="Pago">';
            if (currentUserRole === 'admin') {
                html += '<button class="btn btn-warning btn-sm" onclick="editParcela(' + p.id + ')">✏️</button>';
                html += '<button class="btn btn-danger btn-sm" onclick="deleteParcela(' + p.id + ')">🗑️</button>';
            }
            html += '</div></div>';
        });
        html += '</div></div>';
    });
    grid.innerHTML = html;
}

function getCicloDatas() {
    var year = state.currentYear;
    var month = state.currentMonth;
    var startMonth = month - 2, startYear = year;
    if (startMonth < 0) { startMonth += 12; startYear -= 1; }
    var endMonth = month - 1, endYear = year;
    if (endMonth < 0) { endMonth += 12; endYear -= 1; }
    var startDate = new Date(startYear, startMonth, 23);
    var endDate = new Date(endYear, endMonth, 22);
    endDate.setHours(23, 59, 59, 999);
    return { startDate: startDate, endDate: endDate };
}

function updateResumo() {
    var ciclo = getCicloDatas();
    var previsao = state.comissoes.filter(function(c) {
        if (!c.data_pagamento) return false;
        var d = new Date(c.data_pagamento + 'T00:00:00');
        return d >= ciclo.startDate && d <= ciclo.endDate;
    }).reduce(function(sum, c) { return sum + c.valor_comissao; }, 0);
    var aReceber = state.comissoes.filter(function(c) {
        if (!c.pago || !c.data_pagamento) return false;
        var d = new Date(c.data_pagamento + 'T00:00:00');
        return d >= ciclo.startDate && d <= ciclo.endDate;
    }).reduce(function(sum, c) { return sum + c.valor_comissao; }, 0);
    document.getElementById('resumoPrevisao').textContent = formatMoney(previsao);
    document.getElementById('resumoReceber').textContent = formatMoney(aReceber);
}

function abrirDetalhamentoReceber() {
    var ciclo = getCicloDatas();
    var parcelasReceber = state.comissoes.filter(function(c) {
        if (!c.pago || !c.data_pagamento) return false;
        var d = new Date(c.data_pagamento + 'T00:00:00');
        return d >= ciclo.startDate && d <= ciclo.endDate;
    });
    if (parcelasReceber.length === 0) { alert('Nenhuma comissão a receber no período.'); return; }
    var periodoTexto = 'Período: ' + formatDate(ciclo.startDate.toISOString().split('T')[0]) + ' a ' + formatDate(ciclo.endDate.toISOString().split('T')[0]) + ' (Mês de referência: ' + months[state.currentMonth] + ' ' + state.currentYear + ')';
    document.getElementById('detalhamentoPeriodo').textContent = periodoTexto;
    var lista = document.getElementById('detalhamentoLista');
    var html = '<div class="detalhamento-item" style="background:var(--bg); font-weight:600; font-size:0.85rem; color:var(--text-muted); text-transform:uppercase;"><div>Parcela</div><div>Cliente / NF</div><div>Data Pagamento</div><div>Comissão</div></div>';
    var total = 0;
    parcelasReceber.forEach(function(p) {
        html += '<div class="detalhamento-item"><div><strong>' + p.parcela_letra + '</strong></div><div>' + p.cliente + '<br><small style="color:var(--text-muted)">' + p.nota_fiscal + '</small></div><div>' + formatDate(p.data_pagamento) + '</div><div style="color:var(--success); font-weight:600;">' + formatMoney(p.valor_comissao) + '</div></div>';
        total += p.valor_comissao;
    });
    html += '<div class="detalhamento-total"><div></div><div>TOTAL</div><div></div><div style="color:var(--success);">' + formatMoney(total) + '</div></div>';
    lista.innerHTML = html;
    openModal('modalDetalhamento');
}

// --- LÓGICA DA ABA "PRECISA INCLUIR" ---
function renderPendentesTab() {
    var grid = document.getElementById('pendentesGrid');
    if (state.pendentes.length === 0) {
        grid.innerHTML = '<p style="color:var(--text-muted); text-align:center; grid-column:1/-1;">Nenhum lembrete pendente. Clique em "+ Adicionar Lembrete" para começar.</p>';
        return;
    }
    // Ordenar: não inclusas primeiro, depois inclusas
    var ordenados = state.pendentes.slice().sort(function(a, b) {
        if (a.ja_inclusa === b.ja_inclusa) return 0;
        return a.ja_inclusa ? 1 : -1;
    });

    var html = '';
    ordenados.forEach(function(p) {
        var classeInclusa = p.ja_inclusa ? 'inclusa' : '';
        var badgeTexto = p.ja_inclusa ? '✅ Incluída' : '⏳ Pendente';
        html += '<div class="pendente-card ' + classeInclusa + '">';
        html += '<div class="pendente-card-header"><h4>' + p.cliente + '</h4><span class="badge">' + badgeTexto + '</span></div>';
        html += '<div class="pendente-info">';
        html += '<div><strong>Nota Fiscal</strong>' + p.nota_fiscal + '</div>';
        html += '<div><strong>Valor Total</strong>R$ ' + parseFloat(p.valor_total).toFixed(2).replace('.', ',') + '</div>';
        html += '<div style="grid-column: 1/-1;"><strong>Comissionamento</strong>' + p.comissionamento + '</div>';
        html += '</div>';
        html += '<div class="pendente-actions">';
        html += '<label class="checkbox-label"><input type="checkbox" ' + (p.ja_inclusa ? 'checked' : '') + ' onchange="toggleInclusa(' + p.id + ', this.checked)"> Já inclusa</label>';
        if (currentUserRole === 'admin') {
            html += '<button class="btn btn-danger btn-sm" onclick="excluirPendente(' + p.id + ')">🗑️</button>';
        }
        html += '</div></div>';
    });
    grid.innerHTML = html;
}

async function savePendente() {
    if (currentUserRole !== 'admin') return;
    var cliente = document.getElementById('pendenteCliente').value;
    var nota = document.getElementById('pendenteNota').value;
    var valor = parseFloat(document.getElementById('pendenteValor').value);
    var comissao = document.getElementById('pendenteComissao').value;
    if (!cliente || !nota || !valor) { alert('Preencha os campos obrigatórios!'); return; }
    var result = await supabaseClient.from('comissoes_pendentes').insert([{ cliente: cliente, nota_fiscal: nota, valor_total: valor, comissionamento: comissao, ja_inclusa: false }]);
    if (result.error) { alert('Erro: ' + result.error.message); return; }
    closeModal('modalPendente');
    clearForm('modalPendente');
    await loadPendentes();
    renderPendentesTab();
}

async function toggleInclusa(id, status) {
    if (currentUserRole !== 'admin') return;
    await supabaseClient.from('comissoes_pendentes').update({ ja_inclusa: status }).eq('id', id);
    var p = state.pendentes.find(function(x) { return x.id === id; });
    if (p) p.ja_inclusa = status;
    renderPendentesTab();
}

async function excluirPendente(id) {
    if (currentUserRole !== 'admin') return;
    if (!confirm('Excluir este lembrete?')) return;
    await supabaseClient.from('comissoes_pendentes').delete().eq('id', id);
    await loadPendentes();
    renderPendentesTab();
}

// --- RESTANTE DAS FUNÇÕES ---
function renderFiltroMes() {
    var select = document.getElementById('filtroMes');
    var html = '<option value="">Todos</option>';
    var mesesUnicos = {};
    state.comissoes.forEach(function(c) { if (c.mes_referencia) mesesUnicos[c.mes_referencia] = true; });
    Object.keys(mesesUnicos).sort().forEach(function(m) {
        var partes = m.split('-');
        var nomeMes = months[parseInt(partes[1]) - 1] || m;
        html += '<option value="' + m + '">' + nomeMes + ' ' + partes[0] + '</option>';
    });
    select.innerHTML = html;
}

function renderPendencias() {
    var body = document.getElementById('pendenciasBody');
    var filtroNF = document.getElementById('filtroNF').value.toLowerCase();
    var filtroCliente = document.getElementById('filtroCliente').value.toLowerCase();
    var filtroMes = document.getElementById('filtroMes').value;
    var filtroValorMin = parseFloat(document.getElementById('filtroValorMin').value) || 0;
    var filtroValorMax = parseFloat(document.getElementById('filtroValorMax').value) || 999999999;
    var filtroDataInicio = document.getElementById('filtroDataInicio').value;
    var filtroDataFim = document.getElementById('filtroDataFim').value;
    var filtroPercentual = document.getElementById('filtroPercentual').value;
    var pendentes = state.comissoes.filter(function(c) {
        if (c.pago) return false;
        if (filtroNF && !c.nota_fiscal.toLowerCase().includes(filtroNF)) return false;
        if (filtroCliente && !c.cliente.toLowerCase().includes(filtroCliente)) return false;
        if (filtroMes && c.mes_referencia !== filtroMes) return false;
        if (c.valor_parcela < filtroValorMin || c.valor_parcela > filtroValorMax) return false;
        if (filtroDataInicio && (!c.data_pagamento || c.data_pagamento < filtroDataInicio)) return false;
        if (filtroDataFim && (!c.data_pagamento || c.data_pagamento > filtroDataFim)) return false;
        if (filtroPercentual && parseFloat(c.percentual_comissao) !== parseFloat(filtroPercentual)) return false;
        return true;
    });
    if (pendentes.length === 0) { body.innerHTML = '<p style="padding:2rem; text-align:center; color:var(--text-muted);">Nenhuma pendência encontrada.</p>'; return; }
    var html = '';
    pendentes.forEach(function(p) {
        html += '<div class="pendencia-item"><div><strong>' + p.parcela_letra + '</strong></div><div>' + p.cliente + '<br><small style="color:var(--text-muted)">' + p.nota_fiscal + '</small></div><div>' + (p.data_pagamento ? formatDate(p.data_pagamento) : '<em style="color:var(--text-muted)">Sem data</em>') + '</div><div>' + formatMoney(p.valor_parcela) + '</div><div style="color:var(--success); font-weight:600;">' + formatMoney(p.valor_comissao) + '</div><div>' + p.percentual_comissao + '%</div><div><input type="checkbox" onchange="updatePago(' + p.id + ', this.checked)" ' + (currentUserRole !== 'admin' ? 'disabled' : '') + ' title="Marcar como pago"></div></div>';
    });
    body.innerHTML = html;
}

async function saveComissao() {
    if (currentUserRole !== 'admin') return;
    var cliente = document.getElementById('comissaoCliente').value;
    var nota = document.getElementById('comissaoNota').value;
    var parcelas = parseInt(document.getElementById('comissaoParcelas').value);
    var valor = parseFloat(document.getElementById('comissaoValor').value);
    var percentual = parseFloat(document.getElementById('comissaoPercentual').value);
    if (!cliente || !nota || !parcelas || !valor) { alert('Preencha todos os campos!'); return; }
    var letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    var newComissoes = [];
    var mesRef = state.currentYear + '-' + String(state.currentMonth + 1).padStart(2, '0');
    for (var i = 0; i < parcelas; i++) {
        var letra = letras[i] || ('P' + (i + 1));
        var valorComissao = (valor * 0.77) * (percentual / 100);
        newComissoes.push({ cliente: cliente, nota_fiscal: nota, parcela_letra: letra, valor_parcela: valor, percentual_comissao: percentual, valor_comissao: valorComissao, data_pagamento: null, pago: false, mes_referencia: mesRef });
    }
    var result = await supabaseClient.from('comissoes').insert(newComissoes);
    if (result.error) { alert('Erro ao salvar: ' + result.error.message); return; }
    closeModal('modalComissao');
    clearForm('modalComissao');
    await loadFromSupabase();
    renderCards();
    updateResumo();
    renderFiltroMes();
    renderPendencias();
    alert('Comissão adicionada!');
}

async function updateDataPagamento(id, data) {
    if (currentUserRole !== 'admin') return;
    await supabaseClient.from('comissoes').update({ data_pagamento: data }).eq('id', id);
    var parcela = state.comissoes.find(function(c) { return c.id === id; });
    if (parcela) parcela.data_pagamento = data;
    updateResumo();
    renderPendencias();
}

async function updatePago(id, pago) {
    if (currentUserRole !== 'admin') return;
    await supabaseClient.from('comissoes').update({ pago: pago }).eq('id', id);
    var parcela = state.comissoes.find(function(c) { return c.id === id; });
    if (parcela) parcela.pago = pago;
    renderCards();
    updateResumo();
    renderPendencias();
}

function editParcela(id) {
    if (currentUserRole !== 'admin') return;
    var parcela = state.comissoes.find(function(c) { return c.id === id; });
    if (!parcela) return;
    document.getElementById('editCliente').value = parcela.cliente;
    document.getElementById('editNota').value = parcela.nota_fiscal;
    document.getElementById('editValor').value = parcela.valor_parcela;
    document.getElementById('editPercentual').value = parcela.percentual_comissao;
    document.getElementById('editParcelaId').value = parcela.id;
    openModal('modalEditarParcela');
}

async function saveEditParcela() {
    if (currentUserRole !== 'admin') return;
    var id = parseInt(document.getElementById('editParcelaId').value);
    var cliente = document.getElementById('editCliente').value;
    var nota = document.getElementById('editNota').value;
    var valor = parseFloat(document.getElementById('editValor').value);
    var percentual = parseFloat(document.getElementById('editPercentual').value);
    if (!cliente || !nota || !valor) { alert('Preencha todos os campos!'); return; }
    var valorComissao = (valor * 0.77) * (percentual / 100);
    var result = await supabaseClient.from('comissoes').update({ cliente: cliente, nota_fiscal: nota, valor_parcela: valor, percentual_comissao: percentual, valor_comissao: valorComissao }).eq('id', id);
    if (result.error) { alert('Erro: ' + result.error.message); return; }
    closeModal('modalEditarParcela');
    await loadFromSupabase();
    renderCards();
    updateResumo();
    renderFiltroMes();
    renderPendencias();
}

async function deleteParcela(id) {
    if (currentUserRole !== 'admin') return;
    if (!confirm('Tem certeza que deseja excluir esta parcela?')) return;
    await supabaseClient.from('comissoes').delete().eq('id', id);
    await loadFromSupabase();
    renderCards();
    updateResumo();
    renderFiltroMes();
    renderPendencias();
}

function exportarRelatorio() {
    var ciclo = getCicloDatas();
    var pendentes = state.comissoes.filter(function(c) {
        if (c.pago) return false;
        if (!c.data_pagamento) return false;
        var d = new Date(c.data_pagamento + 'T00:00:00');
        return d >= ciclo.startDate && d <= ciclo.endDate;
    });
    if (pendentes.length === 0) { alert('Nenhuma parcela pendente para ' + months[state.currentMonth] + '/' + state.currentYear + '.'); return; }
    var csv = 'Nota Fiscal;Cliente;Parcela;Data Pagamento;Valor Parcela (R$);Valor Comissão (R$);Status\n';
    pendentes.forEach(function(p) {
        csv += '"' + p.nota_fiscal + '";"' + p.cliente + '";"' + p.parcela_letra + '";"' + formatDate(p.data_pagamento) + '";"' + p.valor_parcela.toFixed(2).replace('.', ',') + '";"' + p.valor_comissao.toFixed(2).replace('.', ',') + '";Pendente\n';
    });
    var totalParcelas = pendentes.reduce(function(sum, p) { return sum + p.valor_parcela; }, 0);
    var totalComissoes = pendentes.reduce(function(sum, p) { return sum + p.valor_comissao; }, 0);
    csv += '\n;;TOTAL;;' + totalParcelas.toFixed(2).replace('.', ',') + ';' + totalComissoes.toFixed(2).replace('.', ',') + ';\n';
    var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'Relatorio_Comissoes_Pendentes_' + months[state.currentMonth] + '_' + state.currentYear + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function formatDate(dateStr) {
    if (!dateStr) return 'Não definida';
    var parts = dateStr.split('-');
    return parts[2] + '/' + parts[1] + '/' + parts[0];
}

function formatMoney(value) {
    return 'R$ ' + value.toFixed(2).replace('.', ',');
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function clearForm(id) {
    document.querySelectorAll('#' + id + ' input').forEach(function(input) {
        if (input.type !== 'hidden') input.value = '';
    });
}
