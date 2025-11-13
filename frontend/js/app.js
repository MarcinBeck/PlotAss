// Plik: frontend/js/app.js (OSTATECZNIE POPRAWIONY ZAKRES ZMIENNYCH)

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
    document.getElementById('input-form').style.display = 'block';
    document.getElementById('analysis-summary').style.display = 'none';
    
    // Czyścimy poprzednie dane modala
    document.getElementById('modal-chapter-id').value = 'CH-01';
    document.getElementById('modal-chapter-title').value = '';
    document.getElementById('modal-chapter-content').value = '';
    document.getElementById('gemini-summary-text').textContent = 'Oczekiwanie na streszczenie...';
    document.getElementById('analysis-chapter-title').textContent = '';
    document.getElementById('version-timestamp').textContent = '';
    document.getElementById('char-count-display').textContent = '0 Postaci';
    // Wyczyść listę i ustaw placeholder
    const charList = document.getElementById('character-analysis-list');
    if (charList) {
        charList.innerHTML = '<p style="margin: 0; font-style: italic; color: #696969;">Lista bohaterów.</p>';
        charList.style.border = 'none'; // Ustawienie z dashboard.html
    }


    const statusDiv = document.getElementById('analysis-status');
    if (statusDiv) statusDiv.textContent = 'Oczekujące...';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
    fetchData();
}

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

// --- FUNKCJE AKTUALIZUJĄCE SEKCJE (Przykładowe) ---

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
    const list = document.getElementById('char-list');

    if (count) count.textContent = charactersData.count;
    if (!list) return;

    list.innerHTML = ''; // Czyścimy listę

    if (charactersData.count === 0) {
        list.innerHTML = '<p class="loading-text">Brak utworzonych bohaterów.</p>';
        return;
    }

    // Używamy dynamicznej listy zwróconej przez DashboardDataResolver
    const displayList = charactersData.list.slice(0, 4);

    displayList.forEach(char => {
        const li = document.createElement('li');
        // Upewniamy się, że nazwa i węzeł są bezpieczne (na wypadek null)
        const charName = char.IMIE || 'N/A';
        const charWorld = char.A_DANE_OGOLNE?.WEZEL_ID || 'Nieznany'; 
        
        li.innerHTML = `
            <span><strong>${charName.substring(0, 15)}</strong></span>
            <span>Węzeł: ${charWorld.substring(0, 10)}</span>
            <button class="cta-btn" onclick="viewCharacterDetails('${char.ID}')">Podgląd</button>
        `;
        list.appendChild(li);
    });
}


// --- FUNKCJE CTA ---

// Funkcja do nawigacji do podglądu rozdziału
function viewChapter(id) {
    alert(`Otwieram podgląd rozdziału: ${id}. Logika nawigacji zostanie zaimplementowana później.`);
}

// USUNIĘTO funkcje createAnalysisItem i updateAnalysisSection

// --- FUNKCJA GŁÓWNA: ANALIZA W MODALU ---

async function startChapterAnalysis() {
    const chapterId = document.getElementById('modal-chapter-id').value;
    const title = document.getElementById('modal-chapter-title').value;
    const content = document.getElementById('modal-chapter-content').value;
    const statusDiv = document.getElementById('analysis-status');
    const startBtn = document.getElementById('start-analysis-btn');
    const summaryElement = document.getElementById('gemini-summary-text'); 

    // Poprawiona walidacja
    if (!chapterId || !title || !content) {
        statusDiv.textContent = 'BŁĄD: Wszystkie pola muszą być wypełnione!';
        statusDiv.style.color = 'red';
        return;
    }

    startBtn.disabled = true;
    startBtn.textContent = 'Trwa Analiza... (Proszę czekać)';
    statusDiv.textContent = 'Wysyłanie i Analiza W toku...';
    statusDiv.style.color = '#007bff';

    let data = null; // Zabezpieczenie: deklaracja let na początku funkcji
    
    try {
        const response = await fetch(CHAPTER_MANAGER_ENDPOINT, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chapterId, title, content })
        });
        
        if (!response.ok) {
            throw new Error(`Błąd HTTP: ${response.status}. Sprawdź logi CloudWatch.`);
        }
        
        data = await response.json(); // Przypisanie do zmiennej "data"
        
        if (data.error) {
            throw new Error(`BŁĄD LAMBDA: ${data.error}`);
        }

        // --- SUKCES ANALIZY ---
        
        const identifiedCharacters = data.IDENTIFIED_CHARACTERS || [];
        const analysisSummary = data.ANALYSIS_SUMMARY || "Analiza Gemini nie dostarczyła podsumowania.";
        
        // 1. Zmiana widoku w Modalu
        document.getElementById('input-form').style.display = 'none';
        document.getElementById('analysis-summary').style.display = 'block';

        // 2. Wyświetlanie podstawowych informacji: STATUS, DATE, TITLE
        statusDiv.textContent = data.STATUS || 'ANALYZED';
        statusDiv.style.color = '#28a745';
        // Formatowanie daty dla lepszej czytelności
        document.getElementById('version-timestamp').textContent = new Date(data.VERSION_TIMESTAMP).toLocaleString('pl-PL'); 
        document.getElementById('analysis-chapter-title').textContent = title; 
        
        // 3. Wyświetlanie RZECZYWISTEGO Streszczenia
        if (summaryElement) {
            summaryElement.textContent = analysisSummary; 
        }

        // 4. Wyświetlanie Bohaterów
        const charList = document.getElementById('character-analysis-list');
        const charCountDisplay = document.getElementById('char-count-display');
        
        if (charList) {
             charList.innerHTML = ''; // Czyścimy placeholder
             charCountDisplay.textContent = `${identifiedCharacters.length} Postaci`;
             charCountDisplay.className = `status-tag ${identifiedCharacters.length > 0 ? 'status-edit' : 'status-none'}`;
             
             if (identifiedCharacters.length > 0) {
                 identifiedCharacters.forEach((name, index) => {
                     const li = document.createElement('li');
                     // Używamy prostej struktury z listą
                     li.innerHTML = `<span>${name}</span>`;
                     // Dodajemy linię rozdzielającą z wyjątkiem ostatniego elementu
                     li.style.padding = '5px 0';
                     if (index < identifiedCharacters.length - 1) {
                         li.style.borderBottom = '1px dotted #ccc';
                     }
                     charList.appendChild(li);
                 });
             } else {
                  charList.innerHTML = '<p style="color:#696969; font-size:0.9em;">Brak zidentyfikowanych postaci.</p>';
             }
        }
        
        // 5. Aktywacja przycisku zatwierdzenia
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
