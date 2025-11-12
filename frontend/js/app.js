// ====================================================================
// PAMIĘTAJ: Wklej swoje adresy URL z API Gateway!
// ====================================================================

// DashboardDataResolver (GET - Ładowanie statystyk)
const DASHBOARD_API_ENDPOINT = 'https://kggk7qj2bk.execute-api.eu-north-1.amazonaws.com/FINAL_SUCCESS/DashboardDataResolver'; 
// ChapterManager (POST - Dodawanie rozdziału, wywoływanie analizy)
const CHAPTER_MANAGER_ENDPOINT = 'https://hdhzbujrg3tgyc64wdnseswqxi0lhgci.lambda-url.eu-north-1.on.aws/'; 

document.addEventListener('DOMContentLoaded', fetchData);

// --- FUNKCJE NAWIGACYJNE MODALA ---

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return; 

    modal.style.display = 'block';
    // Resetuj widok na formularz wprowadzania danych
    document.getElementById('input-form').style.display = 'block';
    document.getElementById('analysis-summary').style.display = 'none';
    
    const statusDiv = document.getElementById('analysis-status');
    if (statusDiv) statusDiv.textContent = 'Oczekujące...';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
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
        const container = document.getElementById('dashboard-container');
        if (container) container.innerHTML = `<p style="color: red; padding: 20px;">Nie udało się załadować danych. Sprawdź konsolę: ${error.message}</p>`;
    }
}

// --- FUNKCJE AKTUALIZUJĄCE SEKCJE ---

function updateChapterSection(chaptersData) {
    const count = document.getElementById('chapter-count');
    const chars = document.getElementById('chapter-chars');
    const list = document.getElementById('chapter-list');
    
    if (count) count.textContent = chaptersData.count;
    if (chars) chars.textContent = (chaptersData.totalCharacters / 1000).toFixed(1) + 'k'; 

    if (!list) return;

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
    if (count) count.textContent = charactersData.count;
    
    const list = document.getElementById('char-list');
    if (!list) return;

    if (charactersData.count > 0) {
         // Lista statyczna, ale z rzeczywistą liczbą (do czasu wdrożenia API)
         list.innerHTML = `
            <li><span><strong>Piotr</strong> (Ziemia)</span><button class="cta-btn">Podgląd</button></li>
            <li><span><strong>Taras</strong> (Gaja)</span><button class="cta-btn">Podgląd</button></li>
            <li><span>Marta (Marek)</span><span>Węzeł: Lorem</span><button class="cta-btn">Podgląd</button></li>
            <li><span>Deryl (Kula)</span><button class="cta-btn">Podgląd</button></li>
         `;
    }
}


// --- FUNKCJE ANALIZY W MODALU ---

// Funkcja pomocnicza do tworzenia elementu listy analizy
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


// Funkcja pomocnicza do bezpiecznego renderowania listy i aktualizacji licznika
const updateAnalysisSection = (listId, countId, dataArray, newTag, editTag) => {
    const list = document.getElementById(listId);
    const countElement = document.getElementById(countId); 
    
    if (list) { 
        list.innerHTML = '';
        if (dataArray && dataArray.length > 0) {
             dataArray.forEach(item => list.appendChild(createAnalysisItem(item)));
        } else {
             list.innerHTML = '<p style="color:#696969; font-size:0.9em;">Brak zmian lub brak nowych danych.</p>';
        }
    }

    if (countElement) { 
        const newCount = dataArray.filter(c => c.status === newTag).length;
        const editCount = dataArray.filter(c => c.status === editTag).length;
        const noneCount = dataArray.filter(c => c.status !== newTag && c.status !== editTag).length;
        
        let countText = '';
        if (newCount > 0) countText += `${newCount} Nowy`;
        if (editCount > 0) countText += (countText ? ' / ' : '') + `${editCount} Edycja`;
        if (noneCount > 0) countText += (countText ? ' / ' : '') + `${noneCount} Bez Zmian`;

        countElement.textContent = countText || `0 Zmian`;
        countElement.className = `status-tag ${newCount > 0 || editCount > 0 ? 'status-edit' : 'status-none'}`;
    }
};


async function startChapterAnalysis() {
    const chapterId = document.getElementById('modal-chapter-id').value;
    const title = document.getElementById('modal-chapter-title').value;
    const content = document.getElementById('modal-chapter-content').value;
    const statusDiv = document.getElementById('analysis-status');
    const startBtn = document.getElementById('start-analysis-btn');
    const summaryElement = document.getElementById('gemini-summary-text');

    if (summaryElement && data.ANALYSIS_SUMMARY) {
        summaryElement.textContent = data.ANALYSIS_SUMMARY; // Używamy danych z JSON
    } else if (summaryElement) {
        summaryElement.textContent = "Analiza Gemini nie dostarczyła podsumowania. Sprawdź logi CloudWatch i klucz API.";
    }
    
    if (!chapterId || !title || !content) {
        statusDiv.textContent = 'BŁĄD: Wszystkie pola muszą być wypełnione!';
        statusDiv.style.color = 'red';
        return;
    }

    startBtn.disabled = true;
    startBtn.textContent = 'Trwa Analiza... (Proszę czekać)';
    statusDiv.textContent = 'Wysyłanie i Analiza W toku...';
    statusDiv.style.color = '#007bff';

    let data = null; // Zabezpieczenie przed ReferenceError
    
    try {
        const response = await fetch(CHAPTER_MANAGER_ENDPOINT, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chapterId, title, content })
        });
        
        if (!response.ok) {
            throw new Error(`Błąd HTTP: ${response.status}. Sprawdź logi CloudWatch.`);
        }
        
        data = await response.json(); // Przypisanie do zmiennej "data" w zasięgu funkcji
        
        if (data.error) {
            throw new Error(`BŁĄD LAMBDA: ${data.error}`);
        }

        // --- SUKCES ANALIZY ---
        
        // --- Usunięcie fejkowych danych z Modala ---
        // Ponieważ backend zwraca tylko status, na razie wyświetlamy, że nie ma zmian
        const charChanges = []; 
        const eventChanges = []; 
        const worldChanges = []; 
        
        document.getElementById('input-form').style.display = 'none';
        document.getElementById('analysis-summary').style.display = 'block';

        statusDiv.textContent = data.STATUS || 'ANALYZED';
        statusDiv.style.color = '#28a745';
        document.getElementById('version-timestamp').textContent = data.VERSION_TIMESTAMP;
        
        // RENDEROWANIE CZYSTYCH DANYCH
        updateAnalysisSection('character-analysis-list', 'char-changes-count', charChanges, 'Nowy', 'Edycja');
        updateAnalysisSection('event-analysis-list', 'event-changes-count', eventChanges, 'Nowy', 'Edycja');
        updateAnalysisSection('world-analysis-list', 'world-changes-count', worldChanges, 'Nowy', 'Edycja');


        // Aktywacja przycisku zatwierdzenia
        document.getElementById('final-confirm-btn').onclick = () => {
            alert(`Zmiany zatwierdzone. Nowe dane: ${data.CHAPTER_ID} zostały zapisane do baz.`);
            closeModal('chapterModal');
        };
        
    } catch (error) {
        statusDiv.textContent = `BŁĄD: ${error.message}`;
        statusDiv.style.color = 'red';
        console.error('Błąd analizy rozdziału:', error);
        
    } finally {
        startBtn.disabled = false;
        startBtn.textContent = 'DODAJ I ZACZNIJ ANALIZĘ';
    }
}


// --- FUNKCJE CTA ---

// Funkcja do nawigacji do podglądu rozdziału
function viewChapter(id) {
    alert(`Otwieram podgląd rozdziału: ${id}. Logika nawigacji zostanie zaimplementowana później.`);
}
