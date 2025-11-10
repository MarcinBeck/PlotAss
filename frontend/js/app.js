// ====================================================================
// PAMIĘTAJ: Wklej swoje adresy URL z API Gateway!
// ====================================================================

// DashboardDataResolver (GET - Ładowanie statystyk)
const DASHBOARD_API_ENDPOINT = 'TWÓJ_URL_DLA_DASHBOARD_RESOLVER'; 
// ChapterManager (POST - Dodawanie rozdziału, wywoływanie analizy)
const CHAPTER_MANAGER_ENDPOINT = 'TWÓJ_URL_DLA_CHAPTER_MANAGER'; 

document.addEventListener('DOMContentLoaded', fetchData);

// --- FUNKCJE NAWIGACYJNE MODALA ---

function openModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
    // Resetuj widok na formularz wprowadzania danych
    document.getElementById('input-form').style.display = 'block';
    document.getElementById('analysis-summary').style.display = 'none';
    document.getElementById('analysis-status').textContent = 'Oczekujące...';
    document.getElementById('character-analysis-list').innerHTML = '';
    document.getElementById('event-analysis-list').innerHTML = '';
    document.getElementById('world-analysis-list').innerHTML = '';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    // Po zamknięciu odświeżamy Dashboard
    fetchData();
}

// Funkcja wywoływana z Dashboardu
function viewAddChapter() {
    openModal('chapterModal');
}

// --- FUNKCJA GŁÓWNA: ŁADOWANIE DASHBOARDU ---

async function fetchData() {
    try {
        const response = await fetch(DASHBOARD_API_ENDPOINT, { method: 'GET' });
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}. Sprawdź logi DashboardDataResolver.`);
        }
        const data = await response.json();
        
        updateChapterSection(data.chapters);
        updateCharacterSection(data.characters); 

    } catch (error) {
        console.error('Błąd ładowania Dashboardu:', error);
        // Informowanie użytkownika o błędzie
        const container = document.getElementById('dashboard-container');
        container.innerHTML = `<p style="color: red; padding: 20px;">Nie udało się załadować danych. Sprawdź konsolę i konfigurację CORS/IAM: ${error.message}</p>`;
    }
}

// --- FUNKCJE AKTUALIZUJĄCE SEKCJE ---

function updateChapterSection(chaptersData) {
    const count = document.getElementById('chapter-count');
    const chars = document.getElementById('chapter-chars');
    const list = document.getElementById('chapter-list');

    count.textContent = chaptersData.count;
    chars.textContent = (chaptersData.totalCharacters / 1000).toFixed(1) + 'k'; 

    list.innerHTML = ''; 

    if (chaptersData.lastUpdates.length === 0) {
        list.innerHTML = '<p class="loading-text">Brak zapisanych rozdziałów.</p>';
        return;
    }
    
    chaptersData.lastUpdates.forEach(chapter => {
        const li = document.createElement('li');
        const date = new Date(chapter.VERSION_TIMESTAMP).toLocaleDateString('pl-PL');
        const charCount = (chapter.CONTENT.length / 1000).toFixed(1) + 'k';
        const title = chapter.TITLE || chapter.CHAPTER_ID;

        li.innerHTML = `
            <span><strong>${title.substring(0, 20)}</strong></span>
            <span>${date} / ${charCount}</span>
            <button class="cta-btn" onclick="viewChapter('${chapter.CHAPTER_ID}')">Podgląd</button>
        `;
        list.appendChild(li);
    });
}

function updateCharacterSection(charactersData) {
    const count = document.getElementById('char-count');
    count.textContent = charactersData.count;
    
    // Lista postaci zostaje statyczna do czasu implementacji pobierania listy
    const list = document.getElementById('char-list');
    if (charactersData.count > 0) {
         list.innerHTML = `
            <li><span>**Piotr** (Ziemia)</span><button class="cta-btn">Podgląd</button></li>
            <li><span>**Taras** (Gaja)</span><button class="cta-btn">Podgląd</button></li>
            <li><span>Marta (Marek)</span><span>Węzeł: Lorem</span><button class="cta-btn">Podgląd</button></li>
            <li><span>Deryl (Kula)</span><button class="cta-btn">Podgląd</button></li>
         `;
    }
}


// --- FUNKCJE ANALIZY W MODALU ---

async function startChapterAnalysis() {
    const chapterId = document.getElementById('modal-chapter-id').value;
    const title = document.getElementById('modal-chapter-title').value;
    const content = document.getElementById('modal-chapter-content').value;
    const statusDiv = document.getElementById('analysis-status');
    const startBtn = document.getElementById('start-analysis-btn');
    
    if (!chapterId || !title || !content) {
        statusDiv.textContent = 'BŁĄD: Wszystkie pola muszą być wypełnione!';
        statusDiv.style.color = 'red';
        return;
    }

    startBtn.disabled = true;
    startBtn.textContent = 'Trwa Analiza... (Proszę czekać)';
    statusDiv.textContent = 'Wysyłanie i Analiza W toku...';
    statusDiv.style.color = '#007bff';

    try {
        const response = await fetch(CHAPTER_MANAGER_ENDPOINT, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chapterId, title, content })
        });
        
        if (!response.ok) {
            throw new Error(`Błąd HTTP: ${response.status}. Sprawdź logi ChapterManager.`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(`BŁĄD LAMBDA: ${data.error}`);
        }

        // --- SUKCES ANALIZY ---
        displayAnalysisResults(data);
        
    } catch (error) {
        statusDiv.textContent = `BŁĄD: ${error.message}`;
        statusDiv.style.color = 'red';
        console.error('Błąd analizy rozdziału:', error);
        
    } finally {
        startBtn.disabled = false;
        startBtn.textContent = 'DODAJ I ZACZNIJ ANALIZĘ';
    }
}


function displayAnalysisResults(data) {
    // Logika wyświetlania wyników (Symulacja danych)
    
    document.getElementById('input-form').style.display = 'none';
    document.getElementById('analysis-summary').style.display = 'block';

    document.getElementById('analysis-status').textContent = 'ANALYZED';
    document.getElementById('analysis-status').style.color = '#28a745';
    document.getElementById('version-timestamp').textContent = data.VERSION_TIMESTAMP;

    // --- Symulowane dane z analizy (w przyszłości zastąpione przez LLM) ---
    const charChanges = [
        { id: "PIOTR_1", name: "Piotr", status: "Edycja", details: "Wzrost odpowiedzialności po zdarzeniu." },
        { id: "TARAS_1", name: "Taras", status: "Edycja", details: "Wzmocnienie cynizmu wobec władzy." },
        { id: "MART_1", name: "Marta (Marek)", status: "Nowy", details: "Nowa postać wprowadzona w scenie." }
    ];
    const eventChanges = [
        { id: "E-CH01...", name: "Odkrycie schronu", status: "Nowy", details: "Nowe kluczowe wydarzenie fabularne." }
    ];
    const worldChanges = [
        { id: "GAJA", name: "Gaja", status: "Bez Zmian", details: "Brak zmian w metadanych świata." }
    ];
    // --- Koniec Symulacji ---

    // RENDEROWANIE
    const renderList = (listId, dataArray, newTag, editTag, noneTag) => {
        const list = document.getElementById(listId);
        list.innerHTML = '';
        dataArray.forEach(item => list.appendChild(createAnalysisItem(item)));
        
        // Aktualizacja liczników (prosta symulacja, wymaga dopracowania)
        document.getElementById(listId.replace('-list', '-count')).textContent = 
            `${dataArray.filter(c => c.status === newTag).length} Nowy / ${dataArray.filter(c => c.status === editTag).length} Edycja`;
    };


    renderList('character-analysis-list', charChanges, 'Nowy', 'Edycja', 'Bez Zmian');
    document.getElementById('char-changes-count').textContent = 
        `${charChanges.filter(c => c.status === 'Nowy').length} Nowy / ${charChanges.filter(c => c.status === 'Edycja').length} Edycja`;
    
    renderList('event-analysis-list', eventChanges, 'Nowy', 'Edycja', 'Bez Zmian');
    document.getElementById('event-changes-count').textContent = `${eventChanges.length} Nowy`;

    renderList('world-analysis-list', worldChanges, 'Nowy', 'Edycja', 'Bez Zmian');
    document.getElementById('world-changes-count').textContent = `${worldChanges.length} Bez Zmian`;


    document.getElementById('final-confirm-btn').onclick = () => {
        alert("Zmiany zatwierdzone. Dane zostały wdrożone do głównej fabuły.");
        closeModal('chapterModal');
    };
}

function createAnalysisItem(item) {
    const li = document.createElement('li');
    const statusClass = item.status === 'Nowy' ? 'status-new' : (item.status === 'Edycja' ? 'status-edit' : 'status-none');
    
    li.className = 'result-item';
    li.innerHTML = `
        <div>
            <strong>${item.name}</strong> 
            <span class="status-tag ${statusClass}">${item.status}</span>
            <p style="margin: 5px 0 0; font-size: 0.9em;">${item.details}</p>
        </div>
        <button class="cta-btn" onclick="alert('Podgląd szczegółów ${item.name}')">Podgląd</button>
    `;
    return li;
}

function viewChapter(id) {
    alert(`Otwieram podgląd rozdziału: ${id}. Logika nawigacji zostanie zaimplementowana później.`);
}
// Funkcja do przełączenia na widok dodawania rozdziału (założenie: index.html to formularz)
function viewAddChapter() {
    openModal('chapterModal');
}
