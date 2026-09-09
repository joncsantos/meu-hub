var SUPABASE_URL = 'https://toewirjnljlnopmsgsjn.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvZXdpcmpubGpsbm9wbXNnc2puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MTgzMTgsImV4cCI6MjEwNDI5NDMxOH0.upa1J5Pr-eN4j55UZOBkVh4OkigSHB5xdraRJFbfWUo';
var supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

var state = {
    temas: [],
    palavras: [],
    conexoes: [],
    audios: [],
    ideias: [],
    temaAtual: null,
    modoConexao: false,
    palavraOrigem: null
};
var currentUserRole = null;

window.addEventListener('DOMContentLoaded', async function() {
    var role = sessionStorage.getItem('userRole');
    if (!role) { window.location.href = 'index.html'; return; }
    currentUserRole = role;
    document.getElementById('userBadge').textContent = currentUserRole === 'admin' ? '(Administrador)' : '(Visualização)';
    if (currentUserRole === 'admin') document.body.classList.add('admin-mode');
    await carregarDados();
    renderTemas();
    renderIdeias();
});

async function carregarDados() {
    var [temasRes, palavrasRes, conexoesRes, audiosRes, ideiasRes] = await Promise.all([
        supabaseClient.from('zaf_temas').select('*').order('criado_em', { ascending: false }),
        supabaseClient.from('zaf_palavras').select('*'),
        supabaseClient.from('zaf_conexoes').select('*'),
        supabaseClient.from('zaf_audios').select('*').order('slot', { ascending: true }),
        supabaseClient.from('zaf_ideias').select('*').order('criado_em', { ascending: false })
    ]);
    state.temas = temasRes.data || [];
    state.palavras = palavrasRes.data || [];
    state.conexoes = conexoesRes.data || [];
    state.audios = audiosRes.data || [];
    state.ideias = ideiasRes.data || [];
}

function switchZafTab(tabId, element) {
    document.querySelectorAll('.zaf-tab-content').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.zaf-tab').forEach(function(t) { t.classList.remove('active'); });
    document.getElementById(tabId).classList.add('active');
    element.classList.add('active');
}

// --- TEMAS ---
function renderTemas() {
    var lista = document.getElementById('temasLista');
    if (state.temas.length === 0) {
        lista.innerHTML = '<p style="color:var(--text-muted); text-align:center; grid-column:1/-1;">Nenhum tema criado ainda.</p>';
        return;
    }
    var html = '';
    state.temas.forEach(function(t) {
        var data = new Date(t.criado_em).toLocaleDateString('pt-BR');
        var qtdPalavras = state.palavras.filter(function(p) { return p.tema_id === t.id; }).length;
        html += '<div class="tema-card" onclick="abrirTema(' + t.id + ')">';
        html += '<h4>' + t.titulo + '</h4>';
        html += '<small>📅 Criado em: ' + data + '</small><br>';
        html += '<small>📝 ' + qtdPalavras + ' palavras</small>';
        if (currentUserRole === 'admin') {
            html += '<button class="btn btn-danger btn-sm" style="margin-top:0.5rem;" onclick="event.stopPropagation(); excluirTema(' + t.id + ')">🗑️ Excluir</button>';
        }
        html += '</div>';
    });
    lista.innerHTML = html;
}

async function salvarNovoTema() {
    if (currentUserRole !== 'admin') return;
    var titulo = document.getElementById('novoTemaTitulo').value;
    if (!titulo) { alert('Digite um título!'); return; }
    var result = await supabaseClient.from('zaf_temas').insert([{ titulo: titulo }]).select().single();
    if (result.error) { alert('Erro: ' + result.error.message); return; }
    state.temas.unshift(result.data);
    closeModal('modalNovoTema');
    document.getElementById('novoTemaTitulo').value = '';
    renderTemas();
}

async function excluirTema(id) {
    if (currentUserRole !== 'admin') return;
    if (!confirm('Excluir este tema e todos os seus dados?')) return;
    await Promise.all([
        supabaseClient.from('zaf_palavras').delete().eq('tema_id', id),
        supabaseClient.from('zaf_conexoes').delete().eq('tema_id', id),
        supabaseClient.from('zaf_audios').delete().eq('tema_id', id),
        supabaseClient.from('zaf_temas').delete().eq('id', id)
    ]);
    await carregarDados();
    renderTemas();
}

function abrirTema(id) {
    state.temaAtual = id;
    document.getElementById('temasView').style.display = 'none';
    document.getElementById('temaDetalheView').style.display = 'block';
    var tema = state.temas.find(function(t) { return t.id === id; });
    document.getElementById('temaTituloDisplay').textContent = tema.titulo;
    document.getElementById('temaDataDisplay').textContent = 'Criado em: ' + new Date(tema.criado_em).toLocaleString('pt-BR');
    renderMapa();
    renderAudios();
}

function voltarParaTemas() {
    state.temaAtual = null;
    document.getElementById('temasView').style.display = 'block';
    document.getElementById('temaDetalheView').style.display = 'none';
    renderTemas();
}

// --- MAPA MENTAL ---
function renderMapa() {
    var container = document.getElementById('mapaContainer');
    // Remove nodes antigos (mantém o SVG)
    container.querySelectorAll('.palavra-node').forEach(function(n) { n.remove(); });
    
    var palavrasTema = state.palavras.filter(function(p) { return p.tema_id === state.temaAtual; });
    var conexoesTema = state.conexoes.filter(function(c) { return c.tema_id === state.temaAtual; });
    
    palavrasTema.forEach(function(p) {
        var node = document.createElement('div');
        node.className = 'palavra-node ' + p.tipo;
        node.style.left = p.posicao_x + 'px';
        node.style.top = p.posicao_y + 'px';
        node.dataset.id = p.id;
        node.textContent = p.texto;
        
        if (currentUserRole === 'admin') {
            var delBtn = document.createElement('button');
            delBtn.className = 'delete-btn';
            delBtn.textContent = '×';
            delBtn.onclick = function(e) { e.stopPropagation(); excluirPalavra(p.id); };
            node.appendChild(delBtn);
            
            node.onclick = function() {
                if (state.modoConexao) {
                    if (!state.palavraOrigem) {
                        state.palavraOrigem = p;
                        node.style.outline = '3px solid var(--warning)';
                    } else if (state.palavraOrigem.id !== p.id) {
                        state.palavraDestino = p;
                        state.modoConexao = false;
                        document.getElementById('btnConectar').style.display = 'inline-flex';
                        document.getElementById('btnCancelarConexao').style.display = 'none';
                        openModal('modalConexao');
                    }
                }
            };
            
            // Drag and drop
            var isDragging = false, startX, startY, origX, origY;
            node.addEventListener('mousedown', function(e) {
                if (state.modoConexao) return;
                isDragging = true;
                startX = e.clientX; startY = e.clientY;
                origX = parseInt(node.style.left); origY = parseInt(node.style.top);
                e.preventDefault();
            });
            document.addEventListener('mousemove', function(e) {
                if (!isDragging) return;
                var dx = e.clientX - startX, dy = e.clientY - startY;
                node.style.left = (origX + dx) + 'px';
                node.style.top = (origY + dy) + 'px';
                desenharConexoes();
            });
            document.addEventListener('mouseup', function() {
                if (!isDragging) return;
                isDragging = false;
                atualizarPosicaoPalavra(p.id, parseInt(node.style.left), parseInt(node.style.top));
            });
        }
        container.appendChild(node);
    });
    
    setTimeout(function() { desenharConexoes(); }, 100);
}

function desenharConexoes() {
    var svg = document.getElementById('mapaSvg');
    svg.innerHTML = '';
    var container = document.getElementById('mapaContainer');
    var conexoesTema = state.conexoes.filter(function(c) { return c.tema_id === state.temaAtual; });
    
    conexoesTema.forEach(function(c) {
        var nodeOrigem = container.querySelector('[data-id="' + c.palavra_origem_id + '"]');
        var nodeDestino = container.querySelector('[data-id="' + c.palavra_destino_id + '"]');
        if (!nodeOrigem || !nodeDestino) return;
        
        var x1 = parseInt(nodeOrigem.style.left) + nodeOrigem.offsetWidth / 2;
        var y1 = parseInt(nodeOrigem.style.top) + nodeOrigem.offsetHeight / 2;
        var x2 = parseInt(nodeDestino.style.left) + nodeDestino.offsetWidth / 2;
        var y2 = parseInt(nodeDestino.style.top) + nodeDestino.offsetHeight / 2;
        var midX = (x1 + x2) / 2;
        var midY = (y1 + y2) / 2;
        
        var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1); line.setAttribute('y1', y1);
        line.setAttribute('x2', x2); line.setAttribute('y2', y2);
        svg.appendChild(line);
        
        if (c.palavra_pt_label) {
            var textPT = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            textPT.setAttribute('x', midX); textPT.setAttribute('y', midY - 5);
            textPT.setAttribute('text-anchor', 'middle');
            textPT.setAttribute('fill', 'black');
            textPT.textContent = c.palavra_pt_label;
            svg.appendChild(textPT);
        }
        if (c.palavra_en_label) {
            var textEN = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            textEN.setAttribute('x', midX); textEN.setAttribute('y', midY + 12);
            textEN.setAttribute('text-anchor', 'middle');
            textEN.setAttribute('fill', 'black');
            textEN.setAttribute('font-weight', '700');
            // Fundo amarelo via rect
            var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', midX - 25); rect.setAttribute('y', midY + 2);
            rect.setAttribute('width', 50); rect.setAttribute('height', 14);
            rect.setAttribute('fill', '#fbbf24');
            svg.appendChild(rect);
            textEN.textContent = c.palavra_en_label;
            svg.appendChild(textEN);
        }
    });
}

function ativarModoConexao() {
    state.modoConexao = true;
    state.palavraOrigem = null;
    document.getElementById('btnConectar').style.display = 'none';
    document.getElementById('btnCancelarConexao').style.display = 'inline-flex';
    alert('Clique na primeira palavra e depois na segunda para conectá-las.');
}

function cancelarModoConexao() {
    state.modoConexao = false;
    state.palavraOrigem = null;
    document.getElementById('btnConectar').style.display = 'inline-flex';
    document.getElementById('btnCancelarConexao').style.display = 'none';
    renderMapa();
}

function adicionarPalavra(tipo) {
    if (currentUserRole !== 'admin') return;
    document.getElementById('palavraTipo').value = tipo;
    document.getElementById('palavraPT').value = '';
    document.getElementById('palavraEN').value = '';
    document.getElementById('palavraModalTitulo').textContent = tipo === 'pt' ? 'Nova Palavra (PT)' : 'Nova Palavra (EN)';
    openModal('modalNovaPalavra');
}

async function salvarPalavra() {
    if (currentUserRole !== 'admin') return;
    var tipo = document.getElementById('palavraTipo').value;
    var pt = document.getElementById('palavraPT').value;
    var en = document.getElementById('palavraEN').value;
    var texto = tipo === 'pt' ? pt : en;
    if (!texto) { alert('Preencha a palavra!'); return; }
    
    var container = document.getElementById('mapaContainer');
    var x = 50 + Math.random() * 100;
    var y = 50 + Math.random() * 100;
    
    var result = await supabaseClient.from('zaf_palavras').insert([{
        tema_id: state.temaAtual, tipo: tipo, texto: texto, posicao_x: x, posicao_y: y
    }]).select().single();
    
    if (result.error) { alert('Erro: ' + result.error.message); return; }
    state.palavras.push(result.data);
    closeModal('modalNovaPalavra');
    renderMapa();
}

async function atualizarPosicaoPalavra(id, x, y) {
    await supabaseClient.from('zaf_palavras').update({ posicao_x: x, posicao_y: y }).eq('id', id);
    var p = state.palavras.find(function(p) { return p.id === id; });
    if (p) { p.posicao_x = x; p.posicao_y = y; }
}

async function excluirPalavra(id) {
    if (currentUserRole !== 'admin') return;
    if (!confirm('Excluir esta palavra?')) return;
    await supabaseClient.from('zaf_palavras').delete().eq('id', id);
    await supabaseClient.from('zaf_conexoes').delete().or('palavra_origem_id.eq.' + id + ',palavra_destino_id.eq.' + id);
    state.palavras = state.palavras.filter(function(p) { return p.id !== id; });
    state.conexoes = state.conexoes.filter(function(c) { return c.palavra_origem_id !== id && c.palavra_destino_id !== id; });
    renderMapa();
}

async function salvarConexao() {
    if (currentUserRole !== 'admin') return;
    var pt = document.getElementById('conexaoPT').value;
    var en = document.getElementById('conexaoEN').value;
    if (!pt || !en) { alert('Preencha as duas palavras!'); return; }
    
    var result = await supabaseClient.from('zaf_conexoes').insert([{
        tema_id: state.temaAtual,
        palavra_origem_id: state.palavraOrigem.id,
        palavra_destino_id: state.palavraDestino.id,
        palavra_pt_label: pt,
        palavra_en_label: en
    }]).select().single();
    
    if (result.error) { alert('Erro: ' + result.error.message); return; }
    state.conexoes.push(result.data);
    closeModal('modalConexao');
    state.palavraOrigem = null;
    state.palavraDestino = null;
    renderMapa();
}

// --- ÁUDIOS ---
function renderAudios() {
    var grid = document.getElementById('audiosGrid');
    var audiosTema = state.audios.filter(function(a) { return a.tema_id === state.temaAtual; });
    var html = '';
    for (var i = 1; i <= 10; i++) {
        var audio = audiosTema.find(function(a) { return a.slot === i; });
        html += '<div class="audio-slot">';
        html += '<h5>🎙️ Gravação ' + i + '</h5>';
        if (audio && audio.audio_url) {
            html += '<audio controls src="' + audio.audio_url + '"></audio>';
            if (currentUserRole === 'admin') {
                html += '<button class="btn btn-danger btn-sm" onclick="excluirAudio(' + audio.id + ')">🗑️ Excluir</button>';
            }
        } else {
            html += '<p style="color:var(--text-muted); font-size:0.85rem;">Sem gravação</p>';
            if (currentUserRole === 'admin') {
                html += '<button class="btn btn-primary btn-sm" onclick="gravarAudio(' + i + ')" id="btnGravar' + i + '">⏺️ Gravar</button>';
                html += '<button class="btn btn-danger btn-sm" onclick="pararGravacao(' + i + ')" id="btnParar' + i + '" style="display:none;">⏹️ Parar</button>';
            }
        }
        html += '</div>';
    }
    grid.innerHTML = html;
}

var gravadores = {};

async function gravarAudio(slot) {
    if (currentUserRole !== 'admin') return;
    try {
        var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        var mediaRecorder = new MediaRecorder(stream);
        var chunks = [];
        mediaRecorder.ondataavailable = function(e) { chunks.push(e.data); };
        mediaRecorder.onstop = async function() {
            var blob = new Blob(chunks, { type: 'audio/webm' });
            var fileName = 'tema_' + state.temaAtual + '_slot_' + slot + '_' + Date.now() + '.webm';
            var { data, error } = await supabaseClient.storage.from('zaf-audios').upload(fileName, blob, { contentType: 'audio/webm' });
            if (error) { alert('Erro ao upload: ' + error.message); return; }
            var { data: urlData } = supabaseClient.storage.from('zaf-audios').getPublicUrl(fileName);
            var audioUrl = urlData.publicUrl;
            var result = await supabaseClient.from('zaf_audios').insert([{ tema_id: state.temaAtual, slot: slot, audio_url: audioUrl }]).select().single();
            if (result.error) { alert('Erro ao salvar: ' + result.error.message); return; }
            state.audios.push(result.data);
            stream.getTracks().forEach(function(t) { t.stop(); });
            renderAudios();
        };
        mediaRecorder.start();
        gravadores[slot] = mediaRecorder;
        document.getElementById('btnGravar' + slot).style.display = 'none';
        document.getElementById('btnParar' + slot).style.display = 'inline-flex';
    } catch (err) {
        alert('Erro ao acessar microfone: ' + err.message);
    }
}

function pararGravacao(slot) {
    if (gravadores[slot]) {
        gravadores[slot].stop();
        delete gravadores[slot];
    }
}

async function excluirAudio(id) {
    if (currentUserRole !== 'admin') return;
    if (!confirm('Excluir esta gravação?')) return;
    var audio = state.audios.find(function(a) { return a.id === id; });
    if (audio && audio.audio_url) {
        var fileName = audio.audio_url.split('/').pop();
        await supabaseClient.storage.from('zaf-audios').remove([fileName]);
    }
    await supabaseClient.from('zaf_audios').delete().eq('id', id);
    state.audios = state.audios.filter(function(a) { return a.id !== id; });
    renderAudios();
}

// --- ANÁLISE EXPLORATÓRIA ---
function renderIdeias() {
    var lista = document.getElementById('ideiasLista');
    if (state.ideias.length === 0) {
        lista.innerHTML = '<p style="color:var(--text-muted); text-align:center;">Nenhuma ideia registrada.</p>';
        return;
    }
    var html = '';
    state.ideias.forEach(function(i) {
        html += '<div class="ideia-item">';
        if (i.categoria) html += '<span class="categoria-tag">' + i.categoria + '</span>';
        html += '<div class="texto">' + i.texto + '</div>';
        html += '<small>' + new Date(i.criado_em).toLocaleString('pt-BR') + '</small>';
        if (currentUserRole === 'admin') {
            html += '<button class="btn btn-danger btn-sm" style="float:right; margin-top:0.5rem;" onclick="excluirIdeia(' + i.id + ')">🗑️</button>';
        }
        html += '</div>';
    });
    lista.innerHTML = html;
}

async function salvarIdeia() {
    if (currentUserRole !== 'admin') return;
    var categoria = document.getElementById('ideiaCategoria').value;
    var texto = document.getElementById('ideiaTexto').value;
    if (!texto) { alert('Digite a ideia!'); return; }
    var result = await supabaseClient.from('zaf_ideias').insert([{ categoria: categoria, texto: texto }]).select().single();
    if (result.error) { alert('Erro: ' + result.error.message); return; }
    state.ideias.unshift(result.data);
    document.getElementById('ideiaCategoria').value = '';
    document.getElementById('ideiaTexto').value = '';
    renderIdeias();
}

async function excluirIdeia(id) {
    if (currentUserRole !== 'admin') return;
    if (!confirm('Excluir esta ideia?')) return;
    await supabaseClient.from('zaf_ideias').delete().eq('id', id);
    state.ideias = state.ideias.filter(function(i) { return i.id !== id; });
    renderIdeias();
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
