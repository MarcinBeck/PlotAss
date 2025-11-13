// Plik: frontend/js/app.js (OSTATECZNIE POPRAWIONY ZAKRES ZMIENNYCH)

// ====================================================================
// PAMIĘTAJ: Wklej swoje adresy URL z API Gateway!
// ====================================================================

// DashboardDataResolver (GET - Ładowanie statystyk)
const DASHBOARD_API_ENDPOINT = 'https://kggk7qj2bk.execute-api.eu-north-1.amazonaws.com/FINAL_SUCCESS/DashboardDataResolver'; 
// ChapterManager (POST - Dodawanie rozdziału, wywoływanie analizy)
const CHAPTER_MANAGER_ENDPOINT = 'https://hdhzbujrg3tgyc64wdnseswqxi0lhgci.lambda-url.eu-north-1.on.aws/'; 

document.addEventListener('DOMContentLoaded', fetchData);

// === Zmienne Globalne dla Workflow ===
// Przechowuje dane z KROKU 1: { chapterNumber: X, chapterId: 'CH-X', versionTimestamp: 'YYYY-MM-DDTHH:MM:SSZ', title: 'Tytuł' }
let rawChapterDetails = {}; 

// --- FUNKCJE NAWIGACYJNE MODALA ---

function openModal(modalId, step = 1) {
    const modal = document.getElementById(modalId);
    if (!modal) return; 

    modal.style.display = 'block';
    
    // Resetowanie do KROKU 1
    if (step === 1) {
        document.getElementById('step-1-input').style.display = 'block';
        document.getElementById('step-2-json').style.display = 'none';
        
        // Czyścimy pola
        document.getElementById('modal-chapter-number').value = '1';
        document.getElementById('modal-chapter-title').value = '';
        document.getElementById('modal-chapter-content').value = '';
        rawChapterDetails = {}; // Resetuj szczegóły surowej wersji
    } else if (step === 2) {
        // Przejście do KROKU 2
        document.getElementById('step-1-input').style.display = 'none';
        document.getElementById('step-2-json').style.display = 'block';
        
        // Wyświetlanie danych z KROKU 1
        const chapDisplay = document.getElementById('json-chapter-display');
        const verDisplay = document.getElementById('json-version-timestamp');

        if (rawChapterDetails.title) {
             chapDisplay.textContent = rawChapterDetails.title;
             verDisplay.textContent = rawChapterDetails.versionTimestamp;
        } else {
            chapDisplay.textContent = 'Brak danych RAW';
            verDisplay.textContent = '';
        }

        // Czyścimy pole JSON
        document.getElementById('modal-json-content').value = '';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
    fetchData(); // Odśwież dashboard
}

function viewAddChapter() {
    openModal('chapterModal', 1); // Zawsze zaczynamy od KROKU 1
}

// --- FUNKCJA KROK 1: ZAPIS SUROWEJ TREŚCI (RAW) ---

async function saveChapterRaw() {
    const chapterNumber = document.getElementById('modal-chapter-number').value;
    const title = document.getElementById('modal-chapter-title').value;
    const content = document.getElementById('modal-chapter-content').value;
    const startBtn = document.getElementById('start-raw-save-btn');
    
    // Walidacja
    if (!chapterNumber || !title || !content) {
        alert('BŁĄD: Numer, Tytuł i Treść muszą być wypełnione!');
        return;
    }

    startBtn.disabled = true;
    startBtn.textContent = 'Trwa Zapis RAW...';
    
    try {
        const response = await fetch(CHAPTER_MANAGER_ENDPOINT, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chapterNumber, title, content })
        });
        
        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({ error: 'Brak szczegółów w JSON' }));
            throw new Error(`Błąd HTTP: ${response.status}. Szczegóły: ${errorBody.error || 'Nieznany błąd backendu'}`);
        }
        
        const data = await response.json(); 
        
        if (data.STATUS === 'RAW_SAVED_READY_FOR_ANALYSIS') {
            // KLUCZOWY ZAPIS: Przechowujemy numer rozdziału dla KROKU 2
            rawChapterDetails = {
                chapterNumber: chapterNumber, 
                chapterId: data.CHAPTER_ID,
                versionTimestamp: data.VERSION_TIMESTAMP,
                title: data.TITLE
            };
            alert(`Pomyślnie zapisano RAW: ${data.TITLE}. Przejdź do KROKU 2.`);
            openModal('chapterModal', 2); // Przejście do KROKU 2
        } else {
             throw new Error('Nieoczekiwany status z serwera: ' + data.STATUS);
        }

    } catch (error) {
        alert(`BŁĄD KROKU 1: ${error.message}`);
        console.error('Błąd zapisu RAW:', error);
        
    } finally {
        startBtn.disabled = false;
        startBtn.textContent = '1. ZAPISZ RAW I PRZEJDŹ DO ANALIZY';
    }
}


// --- FUNKCJA KROK 2: WYSYŁANIE JSONA (UPDATE) ---

async function startJsonAnalysis() {
    const jsonContent = document.getElementById('modal-json-content').value;
    const startBtn = document.getElementById('start-json-analysis-btn');
    
    if (!jsonContent) {
        alert('BŁĄD: Pole JSON nie może być puste!');
        return;
    }

    // Dodatkowe zabezpieczenie stanu:
    if (!rawChapterDetails.chapterNumber || !rawChapterDetails.versionTimestamp) {
         alert('BŁĄD STANU: Nie odnaleziono danych z KROKU 1. Spróbuj powtórzyć KROK 1.');
         startBtn.disabled = false;
         startBtn.textContent = '2. ZATWIERDŹ JSON I ZAPISZ ANALIZĘ';
         return;
    }

    startBtn.disabled = true;
    startBtn.textContent = 'Trwa Zapis Analizy...';

    let jsonParsed;
    try {
        jsonParsed = JSON.parse(jsonContent);
    } catch (e) {
        alert('BŁĄD: Niepoprawny format JSON!');
        startBtn.disabled = false;
        startBtn.textContent = '2. ZATWIERDŹ JSON I ZAPISZ ANALIZĘ';
        return;
    }

    // KLUCZOWE WSTRZYKNIĘCIE DANYCH Z KROKU 1
    const payload = { 
        fullJsonData: jsonParsed 
    };
    payload.fullJsonData.rawVersionTimestamp = rawChapterDetails.versionTimestamp;
    payload.fullJsonData.numer_rozdzialu = rawChapterDetails.chapterNumber; 
    
    try {
        const response = await fetch(CHAPTER_MANAGER_ENDPOINT, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({ error: 'Brak szczegółów w JSON' }));
            throw new Error(`Błąd HTTP: ${response.status}. Szczegóły: ${errorBody.error || 'Nieznany błąd backendu'}`);
        }
        
        const data = await response.json(); 
        
        alert(`Pomyślnie zapisano analizę dla ${rawChapterDetails.title}.`);
        closeModal('chapterModal'); // Zamykamy modal i odświeżamy dashboard

    } catch (error) {
        alert(`BŁĄD KROKU 2 (JSON): ${error.message}`);
        console.error('Błąd analizy JSON:', error);
        
    } finally {
        startBtn.disabled = false;
        startBtn.textContent = '2. ZATWIERDŹ JSON I ZAPISZ ANALIZĘ';
    }
}


// --- POZOSTAŁE FUNKCJE (Dashboard Fetch) ---

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
        const charCount = (chapter.CONTENT?.length / 1000).toFixed(1) + 'k';

        // Preferujemy pole TITLE
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
