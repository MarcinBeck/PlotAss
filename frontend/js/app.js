// DashboardDataResolver (GET - Ładowanie statystyk i detale postaci)
const DASHBOARD_API_ENDPOINT = 'https://kggk7qj2bk.execute-api.eu-north-1.amazonaws.com/FINAL_SUCCESS/DashboardDataResolver'; 
// ChapterManager (POST - Dodawanie rozdziału, wywoływanie analizy)
const CHAPTER_MANAGER_ENDPOINT = 'https://hdhzbujrg3tgyc64wdnseswqxi0lhgci.lambda-url.eu-north-1.on.aws/'; 

// === KONIEC FUNKCJI DASHBOARDU ===
// Funkcja wywoływana na dashboard.html
if (document.querySelector('.container#dashboard-container')) {
    document.addEventListener('DOMContentLoaded', fetchData);
}

// =======================================================
// === FUNKCJE WSPÓLNE (Dla chapter_add.html) ===
// =======================================================

// Funkcja pomocnicza: Aktualizuje wiadomość statusu
function updateStatusMessage(message, type = 'info') {
    const alertDiv = document.getElementById('status-alert');
    let bgColor = '#e7f7ff'; // info
    let color = '#333';

    if (type === 'success') {
        bgColor = '#d4edda'; // success
        color = '#155724';
    } else if (type === 'error') {
        bgColor = '#f8d7da'; // danger
        color = '#721c24';
    }

    alertDiv.style.backgroundColor = bgColor;
    alertDiv.style.color = color;
    alertDiv.innerHTML = message;
    alertDiv.style.display = 'block';
}

// Funkcja pomocnicza: Zapisuje stan do localStorage
function saveState(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

// Funkcja pomocnicza: Czyta stan z localStorage
function loadState(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
}

// =======================================================
// === FUNKCJE ZARZĄDZANIA STRONĄ (chapter_add.html) ===
// =======================================================

/**
 * Inicjalizuje stronę dodawania rozdziału, czytając stan z localStorage.
 */
function initChapterAddPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const step = parseInt(urlParams.get('step')) || 1;
    
    // Pokaż tylko aktualny krok i schowaj resztę
    document.getElementById('step-1-input').style.display = 'none';
    document.getElementById('step-2-json').style.display = 'none';
    document.getElementById('step-3-review').style.display = 'none';
    document.getElementById('status-alert').style.display = 'none';

    document.getElementById('page-title').textContent = `Dodawanie Rozdziału - Krok ${step}/3`;

    if (step === 1) {
        document.getElementById('step-1-input').style.display = 'block';
        // Oczyść lokalny storage, aby zacząć nowy rozdział
        localStorage.removeItem('rawChapterDetails');
        localStorage.removeItem('parsedJsonData');
        
    } else if (step === 2) {
        const rawDetails = loadState('rawChapterDetails');
        if (!rawDetails) {
            updateStatusMessage('BŁĄD: Najpierw zapisz treść RAW (Krok 1).', 'error');
            setTimeout(() => window.location.href = 'chapter_add.html?step=1', 3000);
            return;
        }
        document.getElementById('step-2-json').style.display = 'block';
        document.getElementById('json-chapter-display').textContent = rawDetails.title || 'N/A';
        document.getElementById('json-version-timestamp').textContent = rawDetails.versionTimestamp || '';
        
    } else if (step === 3) {
        const parsedData = loadState('parsedJsonData');
        if (!parsedData) {
            updateStatusMessage('BŁĄD: Najpierw prześlij JSON (Krok 2).', 'error');
            setTimeout(() => window.location.href = 'chapter_add.html?step=2', 3000);
            return;
        }
        document.getElementById('step-3-review').style.display = 'block';
        // Odczyt statusu zapisu z URL
        const saveStatus = urlParams.get('saveStatus');
        if (saveStatus) {
            updateStatusMessage(`Zapis danych zakończony: ${saveStatus}`, saveStatus === 'SUCCESS' ? 'success' : 'error');
        }
        renderReviewSections(); 
    }
}

// --- FUNKCJA KROK 1: ZAPIS SUROWEJ TREŚCI (RAW) ---

async function saveChapterRaw() {
    const chapterNumber = document.getElementById('chapter-number').value;
    const title = document.getElementById('chapter-title').value;
    const content = document.getElementById('chapter-content').value;
    const startBtn = document.getElementById('start-raw-save-btn');
    
    if (!chapterNumber || !title || !content) {
        updateStatusMessage('BŁĄD: Numer, Tytuł i Treść muszą być wypełnione!', 'error');
        return;
    }

    startBtn.disabled = true;
    startBtn.textContent = 'Trwa Zapis RAW...';
    updateStatusMessage('Wysyłanie treści RAW do Lambda...', 'info');
    
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
            const rawChapterDetails = {
                chapterNumber: chapterNumber, 
                chapterId: data.CHAPTER_ID,
                versionTimestamp: data.VERSION_TIMESTAMP,
                title: data.TITLE
            };
            // Zapis stanu do localStorage i przekierowanie
            saveState('rawChapterDetails', rawChapterDetails);
            window.location.href = 'chapter_add.html?step=2';
        } else {
             throw new Error('Nieoczekiwany status z serwera: ' + data.STATUS);
        }

    } catch (error) {
        updateStatusMessage(`BŁĄD KROKU 1: ${error.message}`, 'error');
        console.error('Błąd zapisu RAW:', error);
        
    } finally {
        startBtn.disabled = false;
        startBtn.textContent = '1. ZAPISZ TREŚĆ RAW I PRZEJDŹ DO KROKU 2';
    }
}


// --- FUNKCJA KROK 2: PRZETWARZANIE JSONA I AUTO-ZAPIS ---

function processJsonAndAutoSave() {
    const jsonContent = document.getElementById('json-content').value;
    const processBtn = document.getElementById('process-json-btn');

    if (!jsonContent) {
        updateStatusMessage('BŁĄD: Pole JSON nie może być puste!', 'error');
        return;
    }

    processBtn.disabled = true;
    processBtn.textContent = 'Trwa Parsowanie i Zapis...';
    updateStatusMessage('Przetwarzanie JSON i inicjowanie automatycznego zapisu do baz...', 'info');


    try {
        // 1. Parsowanie i walidacja JSON
        const parsedJsonData = JSON.parse(jsonContent);
        if (!parsedJsonData.streszczenie_szczegolowe || !parsedJsonData.postacie || !parsedJsonData.swiat || !parsedJsonData.sceny) {
             throw new Error('JSON musi zawierać pola: streszczenie_szczegolowe, postacie, swiat, sceny.');
        }
        
        // 2. Wstrzyknięcie danych z KROKU 1 (z localStorage)
        const rawChapterDetails = loadState('rawChapterDetails');
        if (!rawChapterDetails) {
            throw new Error('Brak stanu RAW. Wróć do KROKU 1.');
        }
        
        const payload = { 
            fullAutoSaveData: parsedJsonData 
        };
        payload.fullAutoSaveData.rawVersionTimestamp = rawChapterDetails.versionTimestamp;
        payload.fullAutoSaveData.numer_rozdzialu = rawChapterDetails.chapterNumber; 
        
        // Zapis parsedJsonData do localStorage na potrzeby KROKU 3
        saveState('parsedJsonData', parsedJsonData);

        // 3. Rozpoczęcie auto-zapisu
        autoSaveAllSections(payload);

    } catch (e) {
        updateStatusMessage(`BŁĄD PARSOWANIA JSON: ${e.message}`, 'error');
        processBtn.disabled = false;
        processBtn.textContent = '2. PRZETWÓRZ JSON I ZACZNIJ AUTOMATYCZNY ZAPIS (Krok 3)';
    }
}

async function autoSaveAllSections(payload) {
    const processBtn = document.getElementById('process-json-btn');
    
    // Przygotowanie do wyświetlenia statusów
    const statusMap = {
        'CHARACTERS': 'save-characters-status',
        'WORLD': 'save-world-status',
        'SCENES': 'save-scenes-status',
        'SUMMARY': 'save-summary-status'
    };
    
    // Ustawienie wszystkich na 'W trakcie'
     for (const key of Object.keys(statusMap)) {
        const statusElement = document.getElementById(statusMap[key]);
        if (statusElement) {
            statusElement.textContent = 'W trakcie...';
            statusElement.className = 'status-tag status-edit';
        }
    }


    try {
        const response = await fetch(CHAPTER_MANAGER_ENDPOINT, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload) 
        });
        
        const data = await response.json(); 
        
        if (!response.ok) {
            // Obsługa błędu HTTP 500/400 z backendu
            throw new Error(`BŁĄD BACKENDU: ${data.error || 'Nieznany błąd serwera.'}`);
        }
        
        // Przekierowanie do KROKU 3 z flagą sukcesu
        window.location.href = 'chapter_add.html?step=3&saveStatus=SUCCESS';

    } catch (error) {
        console.error('Błąd auto-zapisu:', error);
        
        // W przypadku błędu, spróbujemy przejść do KROKU 3, ale ze statusem błędu
        window.location.href = `chapter_add.html?step=3&saveStatus=ERROR&details=${encodeURIComponent(error.message)}`;
        
    } finally {
        // Ta sekcja jest głównie do obsługi błędów synchronicznych,
        // ale w przypadku operacji asynchronicznej zakończonej błędem, lepiej polegać na przekierowaniu.
        processBtn.disabled = false;
        processBtn.textContent = '2. PRZETWÓRZ JSON I ZACZNIJ AUTOMATYCZNY ZAPIS (Krok 3)';
    }
}

function updateReviewStatusIndicators(results) {
    const statusMap = {
        'CHARACTERS': 'save-characters-status',
        'WORLD': 'save-world-status',
        'SCENES': 'save-scenes-status',
        'SUMMARY': 'save-summary-status'
    };

    for (const key in results) {
        const statusElement = document.getElementById(statusMap[key]);
        if (statusElement) {
            if (results[key].success) {
                statusElement.textContent = `ZAPISANO (OK)`;
                statusElement.className = 'status-tag status-new'; // Zielony
            } else {
                statusElement.textContent = `BŁĄD: ${results[key].error.substring(0, 20)}...`;
                statusElement.className = 'status-tag status-edit'; // Żółty/czerwony
            }
        }
    }
}

// --- FUNKCJA KROK 3: RENDEROWANIE DANYCH DO PRZEGLĄDU ---

function renderReviewSections() {
    const parsedJsonData = loadState('parsedJsonData');
    const rawChapterDetails = loadState('rawChapterDetails');
    
    if (!parsedJsonData || !rawChapterDetails) return;

    const { streszczenie_szczegolowe, postacie, swiat, sceny, dane_statystyczne } = parsedJsonData;

    document.getElementById('review-chapter-display').textContent = rawChapterDetails.title;
    document.getElementById('review-version-timestamp').textContent = rawChapterDetails.versionTimestamp;
    
    // 1. STRESZCZENIE i STATYSTYKI
    document.getElementById('review-summary-text').textContent = (streszczenie_szczegolowe || '').substring(0, 500) + '...';
    document.getElementById('review-words-count').textContent = dane_statystyczne?.liczba_wyrazow || 'N/A';
    
    // 2. POSTACIE
    const charList = document.getElementById('review-character-list');
    charList.innerHTML = '';
    const numChars = (postacie || []).length;
    document.getElementById('review-char-count').textContent = `${numChars} Postaci`;
    document.getElementById('review-char-count').className = `status-tag ${numChars > 0 ? 'status-edit' : 'status-none'}`;
    
    if (numChars > 0) {
        const charNames = postacie.map(p => p.imie).join(', ');
        const li = document.createElement('li');
        li.innerHTML = `<span>**Lista Imion:** ${charNames}</span>`;
        charList.appendChild(li);
    } else {
        charList.innerHTML = '<p>Brak postaci do zapisu.</p>';
    }

    // 3. ŚWIAT
    document.getElementById('review-world-name').textContent = swiat?.nazwa || 'N/A';
    document.getElementById('review-world-description').textContent = (swiat?.opis || '').substring(0, 150) + '...';

    // 4. SCENY
    const sceneList = document.getElementById('review-scene-list');
    sceneList.innerHTML = '';
    const numScenes = (sceny || []).length;
    document.getElementById('review-scene-count').textContent = `${numScenes} Scen`;
    document.getElementById('review-scene-count').className = `status-tag ${numScenes > 0 ? 'status-new' : 'status-none'}`;
    
    if (numScenes > 0) {
        sceny.forEach(s => {
            const li = document.createElement('li');
            li.innerHTML = `<span><strong>${s.numer} - ${s.tytul}</strong>: ${s.opis.substring(0, 80)}...</span>`;
            li.style.padding = '5px 0';
            li.style.borderBottom = '1px dotted #ccc';
            sceneList.appendChild(li);
        });
    } else {
         sceneList.innerHTML = '<p>Brak scen do zapisu.</p>';
    }
}


// --- FUNKCJE DASHBOARDU (Pozostają na końcu, aby nie kolidować z nową logiką) ---

async function fetchData() {
    // ... (Logika fetchData i aktualizacji sekcji dashboardu) ...
    try {
        const response = await fetch(DASHBOARD_API_ENDPOINT, { method: 'GET' });
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}. Sprawdź logi DashboardDataResolver.`);
        }
        const data = await response.json();
        
        updateChapterSection(data.chapters);
        updateCharacterSection(data.characters); 
        // W nowej wersji DashboardDataResolver.mjs potrzebne są dane o scenach
        updateSceneSection(data.chapters); 
        updateWorldSection(data.worlds); 

    } catch (error) {
        console.error('Błąd ładowania Dashboardu:', error);
        const container = document.getElementById('dashboard-container');
        if (container) container.innerHTML = `<p style="color: red; padding: 20px;">Nie udało się załadować danych. Sprawdź konsolę: ${error.message}</p>`;
    }
}

function updateChapterSection(chaptersData) {
    const count = document.getElementById('chapter-count');
    const chars = document.getElementById('chapter-chars');
    const time = document.querySelector('.chapter-card .summary-box .summary-item:last-child strong');
    const list = document.getElementById('chapter-list');
    
    if (count) count.textContent = chaptersData.count;
    if (chars) chars.textContent = (chaptersData.totalCharacters / 1000).toFixed(1) + 'k'; 
    if (time) time.textContent = 'N/A'; // Placeholder

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
        const title = chapter.TITLE || chapter.CHAPTER_ID; 

        li.innerHTML = `
            <span><strong>${title.substring(0, 20)}</strong></span>
            <span>${date} / ${charCount}</span>
            <a href="chapter_details.html?id=${chapter.CHAPTER_ID}" class="cta-btn">Podgląd</a>
        `;
        list.appendChild(li);
    });
}

function updateCharacterSection(charactersData) {
    const count = document.getElementById('char-count');
    const list = document.getElementById('char-list');

    if (count) count.textContent = charactersData.count;
    if (!list) return;

    list.innerHTML = ''; 

    if (charactersData.count === 0) {
        list.innerHTML = '<p class="loading-text">Brak utworzonych bohaterów.</p>';
        return;
    }

    const displayList = charactersData.list.slice(0, 4);

    displayList.forEach(char => {
        const li = document.createElement('li');
        const charName = char.IMIE || 'N/A';
        const charId = char.ID; 
        
        li.innerHTML = `
            <span><strong>${charName.substring(0, 15)}</strong></span>
            <span>Status: ${char.SZCZEGOLY?.status || 'N/A'}</span>
            <a href="character_details.html?id=${charId}" class="cta-btn">Podgląd</a>
        `;
        list.appendChild(li);
    });
}

function updateSceneSection(chaptersData) {
    const count = document.getElementById('scene-count');
    const list = document.getElementById('event-list');
    
    const totalScenes = chaptersData.lastUpdates.reduce((sum, chapter) => sum + (chapter.SCENES_COUNT || 0), 0);

    if (count) count.textContent = totalScenes; 
    if (!list) return;
    
    list.innerHTML = `
        <li><span>Zdrada na Hubie</span><span>2025-11-09</span><a href="scene_details.html" class="cta-btn">Podgląd</a></li>
        <li><span>Odkrycie schronu</span><span>2025-11-08</span><a href="scene_details.html" class="cta-btn">Podgląd</a></li>
        <li><span>Kłótnia w kwaterze</span><span>2025-11-07</span><a href="scene_details.html" class="cta-btn">Podgląd</a></li>
        <li><span>Pierwsza śmierć</span><span>2025-11-05</span><a href="scene_details.html" class="cta-btn">Podgląd</a></li>
    `;
}

function updateWorldSection(worldsData) {
    const count = document.getElementById('world-count');
    const list = document.getElementById('worlds-list');
    
    if (count) count.textContent = worldsData.count; 
    if (!list) return;

    list.innerHTML = ''; 

    if (worldsData.count === 0) {
        list.innerHTML = '<p class="loading-text">Brak utworzonych węzłów.</p>';
        return;
    }

    worldsData.list.forEach(world => {
        const li = document.createElement('li');
        const worldName = world.NAZWA || world.ID || 'N/A';
        const date = new Date(world.DATA_DODANIA).toLocaleDateString('pl-PL');
        const worldId = world.ID; 
        
        li.innerHTML = `
            <span><strong>${worldName.substring(0, 15)}</strong></span>
            <span>Ostatni: ${date}</span>
            <a href="world_details.html?id=${worldId}" class="cta-btn">Podgląd</a>
        `;
        list.appendChild(li);
    });
}
