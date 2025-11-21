// Função auxiliar para formatar HH:MM:SS
function formatTime(seconds) {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

// --- GERENCIADOR DE TELAS ---
const viewManager = {
    show(viewId) {
        ['menu', 'game', 'results', 'settings', 'history', 'editor'].forEach(id => {
            const el = document.getElementById(`view-${id}`);
            if (el) el.classList.add('hidden');
        });
        const target = document.getElementById(`view-${viewId}`);
        if (target) target.classList.remove('hidden');
        
        // LINHA NOVA: Renderiza tabela se for histórico
        if(viewId === 'history') historyManager.renderTable();
    }
};

// --- GERENCIADOR DE MODAIS (Popups) ---
const modalManager = {
    overlay: document.getElementById('modal-overlay'),
    titleEl: document.getElementById('modal-title'),
    msgEl: document.getElementById('modal-message'),
    btnConfirm: document.getElementById('modal-btn-confirm'),
    btnCancel: document.getElementById('modal-btn-cancel'),

    // MODO 1: Confirmação (Sim/Não)
    confirm(title, message, onConfirmAction, confirmText = "Confirmar") {
        this.titleEl.innerText = title;
        this.msgEl.innerText = message;
        this.btnConfirm.innerText = confirmText;
        this.btnCancel.classList.remove('hidden'); // Mostra cancelar

        this._setupListeners(onConfirmAction);
        this.overlay.classList.remove('hidden');
    },

    // MODO 2: Alerta Simples (Apenas OK)
    alert(title, message) {
        this.titleEl.innerText = title;
        this.msgEl.innerText = message;
        this.btnConfirm.innerText = "OK";
        this.btnCancel.classList.add('hidden'); // Esconde cancelar

        this._setupListeners(() => {}); // Ação vazia
        this.overlay.classList.remove('hidden');
    },

    _setupListeners(onConfirm) {
        // Limpa eventos antigos clonando os botões
        const newConfirm = this.btnConfirm.cloneNode(true);
        const newCancel = this.btnCancel.cloneNode(true);
        
        this.btnConfirm.parentNode.replaceChild(newConfirm, this.btnConfirm);
        this.btnCancel.parentNode.replaceChild(newCancel, this.btnCancel);

        this.btnConfirm = newConfirm;
        this.btnCancel = newCancel;

        this.btnConfirm.addEventListener('click', () => {
            if(onConfirm) onConfirm();
            this.close();
        });
        this.btnCancel.addEventListener('click', () => this.close());
    },

    close() {
        this.overlay.classList.add('hidden');
    }
};

// --- GERENCIADOR DE HISTÓRICO ---
const historyManager = {
    STORAGE_KEY: 'flashcards_history_v1',
    get() {
        const data = localStorage.getItem(this.STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    },
    add(entry) {
        const history = this.get();
        history.unshift(entry);
        if(history.length > 50) history.pop();
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
    },
    clear() { localStorage.removeItem(this.STORAGE_KEY); },
    renderTable() {
        const tbody = document.getElementById('history-list');
        tbody.innerHTML = '';
        const history = this.get();

        if (history.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500">Nenhum histórico encontrado.</td></tr>';
            return;
        }
        history.forEach(item => {
            const tr = document.createElement('tr');
            tr.className = "border-b border-gray-700 hover:bg-gray-700/50";
            tr.innerHTML = `
                <td class="p-3 text-gray-300 text-xs">${item.date}</td>
                <td class="p-3 text-blue-300 text-xs font-bold">${item.deck}</td>
                <td class="p-3 text-green-400 font-bold">${item.correct}</td>
                <td class="p-3 text-red-400 font-bold">${item.wrong}</td>
                <td class="p-3 text-gray-400 text-xs">${item.time}</td>
            `;
            tbody.appendChild(tr);
        });
    }
};

// --- EDITOR DE DECK ---
const editor = {
    workingDeck: [],
    currentName: "Meu Novo Deck",
    selectedIndex: -1,

    init(mode) {
        if (mode === 'create') {
            this.workingDeck = [];
            this.currentName = "";
            this.addCard(); 
        } else if (mode === 'edit') {
            this.workingDeck = JSON.parse(JSON.stringify(game.deck));
            this.currentName = game.currentDeckName.replace('.json', '');
        }
        
        document.getElementById('editor-deck-name').value = this.currentName;
        this.renderList();
        this.selectCard(0);
        viewManager.show('editor');
    },

    renderList() {
        const listEl = document.getElementById('editor-list');
        listEl.innerHTML = '';
        document.getElementById('editor-total').innerText = this.workingDeck.length;

        this.workingDeck.forEach((card, index) => {
            const item = document.createElement('div');
            item.className = `p-3 rounded cursor-pointer text-xs truncate border ${index === this.selectedIndex ? 'bg-blue-900/50 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`;
            item.innerText = `${index + 1}. ${card.front || '(Vazio)'}`;
            item.onclick = () => this.selectCard(index);
            listEl.appendChild(item);
        });
    },

    selectCard(index) {
        if (this.workingDeck.length === 0) return;
        this.selectedIndex = index;
        
        document.getElementById('editor-current-index').innerText = index + 1;
        document.getElementById('editor-input-front').value = this.workingDeck[index].front;
        document.getElementById('editor-input-back').value = this.workingDeck[index].back;
        
        this.renderList();
    },

    updateCurrent(field, value) {
        if (this.selectedIndex === -1) return;
        this.workingDeck[this.selectedIndex][field] = value;
        if (field === 'front') this.renderList();
    },

    addCard() {
        this.workingDeck.push({ front: "", back: "" });
        this.selectCard(this.workingDeck.length - 1);
        document.getElementById('editor-input-front').focus();
    },

    deleteCurrent() {
        if (this.workingDeck.length <= 1) return modalManager.alert("Ação Negada", "O deck deve ter pelo menos 1 card.");
        if (confirm("Deletar este card?")) {
            this.workingDeck.splice(this.selectedIndex, 1);
            const newIndex = Math.max(0, this.selectedIndex - 1);
            this.selectCard(newIndex);
        }
    },

    saveToBrowser() {
        const nameInput = document.getElementById('editor-deck-name').value;
        const name = nameInput ? nameInput : "Meu Deck Salvo";
        const cleanDeck = this.workingDeck.filter(c => c.front.trim() !== "" && c.back.trim() !== "");
        
        if (cleanDeck.length === 0) return modalManager.alert("Incompleto", "Adicione pelo menos uma pergunta e resposta válida.");

        // Salva no LocalStorage
        const saveData = {
            name: name,
            deck: cleanDeck,
            date: new Date().toISOString()
        };
        localStorage.setItem('flashcards_saved_deck', JSON.stringify(saveData));

        // Carrega no jogo
        game.deck = cleanDeck;
        game.currentDeckName = name;
        
        document.getElementById('deck-info').innerText = `Deck Salvo no App: ${name}`;
        document.getElementById('deck-info').className = "mt-2 text-xs text-green-400 italic";
        
        viewManager.show('menu');
        // Pequeno feedback visual (opcional)
        modalManager.alert("Sucesso!", "Deck salvo na memória do aplicativo.");
    },

    downloadJSON() {
        const name = document.getElementById('editor-deck-name').value || "backup-deck";
        const cleanDeck = this.workingDeck.filter(c => c.front.trim() !== "" && c.back.trim() !== "");
        
        if (cleanDeck.length === 0) return modalManager.alert("Vazio", "Não há nada para baixar.");

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cleanDeck, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", name + ".json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }
};

// --- ENGINE DO JOGO ---
const game = {
    deck: [],
    activeDeck: [],
    currentDeckName: "",
    currentCardIndex: 0,
    mode: 'free',
    timer: null,
    timeElapsed: 0,
    timeLeft: 60,
    config: { speedTime: 60 },
    stats: { correct: 0, wrong: 0, skipped: 0 },
    isCardFlipped: false,

    init() {
        // Carrega configuração salva
        const savedConfig = localStorage.getItem('flashcards_config');
        if (savedConfig) {
            this.config = JSON.parse(savedConfig);
        }
        
        // Atualiza o input do HTML com o valor carregado
        document.getElementById('setting-time-input').value = this.config.speedTime;
        
        // Tenta carregar deck salvo no navegador
        const savedData = localStorage.getItem('flashcards_saved_deck');
        
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                this.deck = parsed.deck;
                this.currentDeckName = parsed.name;
                
                const info = document.getElementById('deck-info');
                info.innerText = `Restaurado: ${parsed.name}`;
                info.className = "mt-2 text-xs text-blue-400 italic";
            } catch (e) {
                this.deck = []; // Erro ao ler
            }
        } else {
            this.deck = [];
            const info = document.getElementById('deck-info');
            info.innerText = "Nenhum deck salvo. Crie ou carregue um.";
            info.className = "mt-2 text-xs text-gray-500";
        }

        loadLibraryIndex();

        this.setupEventListeners();
    },

    setupEventListeners() {
        // Inputs
        document.getElementById('file-input').addEventListener('change', (e) => this.handleFileUpload(e));
        
        // Botões de Menu
        document.getElementById('btn-mode-free').addEventListener('click', () => this.setMode('free'));
        document.getElementById('btn-mode-speed').addEventListener('click', () => this.setMode('speed'));
        document.getElementById('btn-start').addEventListener('click', () => this.start());
        document.getElementById('btn-settings').addEventListener('click', () => viewManager.show('settings'));
        
        // Botões de Jogo
        document.getElementById('card-container').addEventListener('click', () => this.flip()); // Flip ao clicar no card
        document.getElementById('btn-flip').addEventListener('click', () => this.flip());
        document.getElementById('btn-review-question').addEventListener('click', () => this.toggleFlip());
        document.getElementById('btn-skip').addEventListener('click', () => this.skipCard());
        document.getElementById('btn-wrong').addEventListener('click', () => this.submitAnswer(false));
        document.getElementById('btn-correct').addEventListener('click', () => this.submitAnswer(true));
        document.getElementById('btn-quit').addEventListener('click', () => this.quit());
        
        // --- LÓGICA DA SANFONA (ACORDEÃO) ---
        const btnToggle = document.getElementById('btn-toggle-library');
        if (btnToggle) {
            btnToggle.addEventListener('click', () => {
                const grid = document.getElementById('library-grid');
                const arrow = document.getElementById('library-arrow');
                
                // Alterna visibilidade
                if (grid.classList.contains('hidden')) {
                    grid.classList.remove('hidden');
                    arrow.style.transform = 'rotate(0deg)'; // Seta pra baixo
                } else {
                    grid.classList.add('hidden');
                    arrow.style.transform = 'rotate(-90deg)'; // Seta pro lado
                }
            });
        }

        // Botões de Navegação
        document.getElementById('btn-back-menu').addEventListener('click', () => {
            viewManager.show('menu');
            loadLibraryIndex(); // Garante que o deck atual continue verde na lista
        });
        document.getElementById('btn-settings-back').addEventListener('click', () => {
            // Reseta o input para o valor que estava salvo antes de editar
            document.getElementById('setting-time-input').value = this.config.speedTime;
            viewManager.show('menu');
        });

        // LISTENERS DE HISTÓRICO
        document.getElementById('btn-history').addEventListener('click', () => viewManager.show('history'));
        document.getElementById('btn-history-back').addEventListener('click', () => viewManager.show('menu'));
        document.getElementById('btn-history-reset').addEventListener('click', () => {
            if(confirm("Apagar todo o histórico?")) {
                historyManager.clear();
                historyManager.renderTable();
            }
        });

        // LISTENERS DO EDITOR ---
        
        // Botões do Menu
        document.getElementById('btn-create-deck').addEventListener('click', () => editor.init('create'));
        document.getElementById('btn-edit-deck').addEventListener('click', () => {
            if (game.deck.length === 0) return modalManager.alert("Atenção", "Nenhum deck carregado para editar.");
            editor.init('edit');
        });

        // Inputs do Editor (Tempo Real)
        document.getElementById('editor-input-front').addEventListener('input', (e) => editor.updateCurrent('front', e.target.value));
        document.getElementById('editor-input-back').addEventListener('input', (e) => editor.updateCurrent('back', e.target.value));

        // Botões de Ação do Editor
        document.getElementById('btn-editor-add-new').addEventListener('click', () => editor.addCard());
        document.getElementById('btn-editor-delete-card').addEventListener('click', () => editor.deleteCurrent());
        
        // Novo botão de Salvar Interno
        document.getElementById('btn-editor-save-local').addEventListener('click', () => editor.saveToBrowser());
        
        // Botão de Download (Backup) - Note que mudamos o ID no HTML para btn-editor-download
        const btnDownload = document.getElementById('btn-editor-download'); // Verifica se existe caso não tenha atualizado o HTML ainda
        if(btnDownload) btnDownload.addEventListener('click', () => editor.downloadJSON());
        
        document.getElementById('btn-editor-cancel').addEventListener('click', () => {
            modalManager.confirm(
                "Descartar alterações?", 
                "Se sair agora, o novo deck não será salvo.", 
                () => viewManager.show('menu'), 
                "Sair sem Salvar"
            );
        });

        // LISTENER Salvar Configurações
        document.getElementById('btn-settings-save').addEventListener('click', () => {
            const val = parseInt(document.getElementById('setting-time-input').value);
            if (val && val > 0) {
                this.config.speedTime = val;
                localStorage.setItem('flashcards_config', JSON.stringify(this.config));
                
                // Atualiza o texto do botão do menu para refletir a mudança
                const btnText = document.getElementById('btn-mode-speed');
                if(btnText) btnText.innerHTML = `Modo Velocidade (${val}s)`;

                modalManager.alert("Sucesso", "Configurações salvas!");
                viewManager.show('menu');
            } else {
                modalManager.alert("Erro", "Insira um tempo válido (maior que 0).");
            }
        });
    },

    handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target.result);
                if (Array.isArray(json) && json.length > 0 && json[0].front && json[0].back) {
                    this.deck = json;
                    const info = document.getElementById('deck-info');
                    info.innerText = `Deck: ${file.name} (${json.length} cards)`;
                    info.className = "mt-2 text-xs text-green-400 italic";
                } else {
                    modalManager.alert("Erro no Arquivo", "JSON inválido. Use o formato array com objetos 'front' e 'back'.");
                }
            } catch (err) {
                modalManager.alert("Erro", "Falha ao ler o arquivo.");
            }
        };
        reader.readAsText(file);
    },

    setMode(mode) {
        this.mode = mode;
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.remove('border-blue-500', 'opacity-100');
            btn.classList.add('border-transparent', 'opacity-60');
        });
        const activeBtn = document.getElementById(`btn-mode-${mode}`);
        activeBtn.classList.add('border-blue-500', 'opacity-100');
        activeBtn.classList.remove('border-transparent', 'opacity-60');
    },

    start() {
        if (this.deck.length === 0) {
            modalManager.alert("Ops!", "Nenhum deck carregado para jogar.");
            return;
        }
        
        // Reset de variáveis
        this.stats = { correct: 0, wrong: 0, skipped: 0 };
        this.activeDeck = this.shuffleArray([...this.deck]);
        this.currentCardIndex = 0;
        this.isCardFlipped = false;
        this.timeElapsed = 0; // Reinicia contador real

        this.updateStatsDisplay();
        viewManager.show('game');
        
        this.loadCardUI();

        // Lógica de Timer
        if (this.mode === 'speed') {
            this.timeLeft = this.config.speedTime;
            this.startTimerSpeed();
        } else {
            this.startTimerFree();
        }
    },

    // Timer para Modo Velocidade (Decrementa limite, Incrementa decorrido)
    startTimerSpeed() {
        const timerDisplay = document.getElementById('timer-display');
        // Define o inicial formatado
        timerDisplay.innerText = formatTime(this.timeLeft);
        
        if (this.timer) clearInterval(this.timer);
        
        this.timer = setInterval(() => {
            this.timeLeft--;
            this.timeElapsed++;
            
            // Atualiza formatado
            timerDisplay.innerText = formatTime(this.timeLeft);
            
            // Alerta visual quando faltar pouco (opcional, mas bom UX)
            if (this.timeLeft <= 10) timerDisplay.classList.add('text-red-500');
            else timerDisplay.classList.remove('text-red-500');

            if (this.timeLeft <= 0) {
                this.endGame();
            }
        }, 1000);
    },

    // Timer para Modo Livre (Apenas incrementa decorrido visualmente ou em background)
    startTimerFree() {
        const timerDisplay = document.getElementById('timer-display');
        timerDisplay.innerText = "00:00:00";
        timerDisplay.classList.remove('text-red-500');
        
        if (this.timer) clearInterval(this.timer);

        this.timer = setInterval(() => {
            this.timeElapsed++;
            // Atualiza formatado
            timerDisplay.innerText = formatTime(this.timeElapsed);
        }, 1000);
    },

    loadCardUI() {
        if (this.currentCardIndex >= this.activeDeck.length) {
            this.endGame();
            return;
        }

        const cardData = this.activeDeck[this.currentCardIndex];
        const cardContainer = document.getElementById('card-container');

        document.getElementById('card-counter').innerText = `${this.currentCardIndex + 1}/${this.activeDeck.length}`;
        
        cardContainer.classList.remove('card-flip');
        this.isCardFlipped = false;

        document.getElementById('btn-review-question').innerText = "Rever Frente";

        // Delay pequeno para evitar glitch visual durante a animação de reset
        setTimeout(() => {
            document.getElementById('card-front-text').innerText = cardData.front;
            document.getElementById('card-back-text').innerText = cardData.back;
        }, 200);

        document.getElementById('controls-reveal').classList.remove('hidden');
        document.getElementById('controls-judge').classList.add('hidden');
    },

    flip() {
        if (this.isCardFlipped) return;
        document.getElementById('card-container').classList.add('card-flip');
        this.isCardFlipped = true;
        document.getElementById('controls-reveal').classList.add('hidden');
        document.getElementById('controls-judge').classList.remove('hidden');
    },

    // Nova função para o botão de revisão
    toggleFlip() {
        const cardContainer = document.getElementById('card-container');
        const btnReview = document.getElementById('btn-review-question');
        
        if (cardContainer.classList.contains('card-flip')) {
            // Está mostrando a resposta, vira para a pergunta
            cardContainer.classList.remove('card-flip');
            btnReview.innerText = "Ver a Resposta";
        } else {
            // Está na pergunta, vira para a resposta
            cardContainer.classList.add('card-flip');
            btnReview.innerText = "Rever Frente";
        }
    },  

    skipCard() {
        this.stats.skipped++;
        this.nextCard();
    },

    submitAnswer(isCorrect) {
        if (isCorrect) {
            this.stats.correct++;
        } else {
            this.stats.wrong++;
            // LÓGICA DO SHAKE
            const view = document.getElementById('view-game');
            view.classList.remove('animate-shake');
            void view.offsetWidth; // Hack para reiniciar animação CSS
            view.classList.add('animate-shake');
        }
        this.updateStatsDisplay();
        this.nextCard();
    },

    nextCard() {
        this.currentCardIndex++;
        this.loadCardUI();
    },

    updateStatsDisplay() {
        document.getElementById('score-correct').innerText = this.stats.correct;
        document.getElementById('score-wrong').innerText = this.stats.wrong;
    },

    quit() {
        modalManager.confirm(
            "Desistir do Jogo?", 
            "Todo o seu progresso atual será perdido e você voltará ao menu.",
            () => {
                // Ação que acontece se o usuário clicar em "Confirmar"
                this.endGame(); 
            },
            "Sim, Sair" // Texto opcional do botão
        );
    },

    endGame() {
        if (this.timer) clearInterval(this.timer);
        const now = new Date();
        historyManager.add({
            date: now.toLocaleDateString() + ' ' + now.toLocaleTimeString().slice(0,5),
            deck: this.currentDeckName || "Deck Padrão",
            correct: this.stats.correct,
            wrong: this.stats.wrong,
            time: this.timeElapsed + 's'
        });
        
        document.getElementById('res-correct').innerText = this.stats.correct;
        document.getElementById('res-wrong').innerText = this.stats.wrong;
        document.getElementById('res-skipped').innerText = this.stats.skipped;
        document.getElementById('res-total').innerText = this.stats.correct + this.stats.wrong + this.stats.skipped;
        
        viewManager.show('results');
    },

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
};

// Função que renderiza a Biblioteca (Local + Nuvem)
async function loadLibraryIndex() {
    const container = document.getElementById('library-grid');
    if (!container) return;

    container.innerHTML = ''; // Limpa loading

    // 1. DECK LOCAL (Salvo no App)
    const localData = localStorage.getItem('flashcards_saved_deck');
    if (localData) {
        try {
            const parsed = JSON.parse(localData);
            createLibraryCard(container, {
                type: 'local',
                title: `💾 ${parsed.name}`,
                description: `Salvo no dispositivo • ${parsed.deck.length} cards`,
                data: parsed.deck,
                name: parsed.name
            });
        } catch (e) { console.error("Erro ao ler save local"); }
    }

    // 2. DECKS DA NUVEM (Fetch do lista.json)
    try {
        const response = await fetch('decks/lista.json');
        if (response.ok) {
            const cloudDecks = await response.json();
            cloudDecks.forEach(deckInfo => {
                createLibraryCard(container, {
                    type: 'cloud',
                    title: deckInfo.title,
                    description: deckInfo.description,
                    file: deckInfo.file
                });
            });
        } else {
            // Se der erro no fetch (ex: rodando local sem server), mostra aviso discreto
            const errDiv = document.createElement('div');
            errDiv.className = "text-[10px] text-center text-gray-600 italic p-2";
            errDiv.innerText = "Conecte à internet para ver mais decks.";
            container.appendChild(errDiv);
        }
    } catch (error) {
        console.log("Modo offline ou sem servidor local.");
    }
}

// Função auxiliar para criar o visual do card
function createLibraryCard(container, item) {
    const card = document.createElement('div');
    
    // LÓGICA DE DESTAQUE
    const isSelected = (game.currentDeckName === item.title) || (game.currentDeckName === item.name);
    
    let borderColor, bgColor, statusBadge, opacity;

    if (isSelected) {
        // Estilo ATIVO (Verde Neon)
        borderColor = 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)] scale-[1.02]';
        bgColor = 'bg-gradient-to-br from-green-900/40 to-gray-800';
        statusBadge = '<span class="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full shadow-glow"></span>';
        opacity = 'opacity-100';
    } else {
        // Estilo INATIVO (Discreto)
        borderColor = 'border-gray-700 hover:border-blue-500 hover:scale-[1.02]';
        bgColor = 'bg-gray-800';
        statusBadge = '';
        opacity = 'opacity-70 hover:opacity-100';
    }
    
    // Configuração do Card Quadrado (h-32 define a altura fixa)
    card.className = `${bgColor} ${opacity} h-32 p-3 rounded-xl border-2 ${borderColor} cursor-pointer transition-all duration-200 flex flex-col items-center justify-center text-center relative group`;
    
    // Ícone baseado no tipo
    const icon = item.type === 'local' ? '💾' : '📜';
    const actionText = item.type === 'local' ? 'Editar' : 'Baixar';

    card.innerHTML = `
        ${statusBadge}
        <div class="text-2xl mb-2 filter drop-shadow-md">${icon}</div>
        <h4 class="font-bold text-xs text-gray-100 leading-tight line-clamp-2 mb-1">${item.title}</h4>
        <span class="text-[10px] text-blue-400 font-mono mt-auto">${item.data ? item.data.length : '?'} cards</span>
    `;

    card.addEventListener('click', () => loadDeckFromLibrary(item));
    container.appendChild(card);
}

// Função que trata o clique
async function loadDeckFromLibrary(item) {
    // CASO 1: Deck Local
    if (item.type === 'local') {
        game.deck = item.data;
        game.currentDeckName = item.name;
        updateGameInfo(item.name, item.data.length);
        
        // 1. ATUALIZA O VISUAL (Isso deixa verde)
        loadLibraryIndex(); 
        
        // 2. ENCERRA AQUI (Para não tentar baixar da nuvem)
        return; 
    }

    // CASO 2: Deck da Nuvem
    //modalManager.alert("Baixando...", "Conectando ao servidor...");
    try {
        const response = await fetch(`decks/${item.file}`);
        if (!response.ok) throw new Error("Erro no download");
        
        const json = await response.json();
        if (!Array.isArray(json)) throw new Error("Formato inválido");

        game.deck = json;
        game.currentDeckName = item.title;
        updateGameInfo(item.title, json.length);
        
        //modalManager.alert("Sucesso", `Deck baixado com sucesso!`);
        
        // ATUALIZA O VISUAL TAMBÉM NO SUCESSO DA NUVEM
        loadLibraryIndex();

    } catch (error) {
        console.error(error);
        modalManager.alert("Erro", "Não foi possível baixar o deck.");
    }
}

// Atualiza o texto informativo no menu
function updateGameInfo(name, count) {
    const info = document.getElementById('deck-info');
    info.innerText = `Ativo: ${name} (${count} cards)`;
    info.className = "mt-2 text-xs text-blue-400 font-bold";
}

// Inicializa quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => game.init());