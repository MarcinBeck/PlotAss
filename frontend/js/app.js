// DashboardDataResolver (GET - Ładowanie statystyk i detale postaci)
const DASHBOARD_API_ENDPOINT = 'https://kggk7qj2bk.execute-api.eu-north-1.amazonaws.com/FINAL_SUCCESS/DashboardDataResolver'; 
// ChapterManager (POST - Dodawanie rozdziału, wywoływanie analizy)
const CHAPTER_MANAGER_ENDPOINT = 'https://hdhzbujrg3tgyc64wdnseswqxi0lhgci.lambda-url.eu-north-1.on.aws/'; 

document.addEventListener('DOMContentLoaded', fetchData);

// === Zmienne Globalne dla Workflow ===
let rawChapterDetails = {}; 
let parsedJsonData = {}; 

// --- FUNKCJE NAWIGACYJNE MODALA ---

function updateStatusMessage(message, type = 'info') {
    const alertDiv = document.getElementById('modal-status-alert');
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

function openModal(modalId, step = 1) {
    const modal = document.getElementById(modalId);
    if (!modal) return; 

    // Zamknij poprzednie modale, jeśli nie jest to modal szczegółów postaci
    if (modalId !== 'characterDetailsModal') {
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    }
    
    modal.style.display = 'block';
    
    // Resetowanie widoków głównego modalu
    if (modalId === 'chapterModal') {
        document.getElementById('step-1-input').style.display = 'none';
        document.getElementById('step-2-json').style.display = 'none';
        document.getElementById('step-3-review').style.display = 'none';
        document.getElementById('modal-status-alert').style.display = 'none';
        document.getElementById('modal-title').textContent = 'Dodaj/Aktualizuj Rozdział';
        
        // Resetowanie statusów w KROKU 3
        ['summary', 'characters', 'world', 'scenes'].forEach(type => {
            const statusElement = document.getElementById(`save-${type}-status`);
            if (statusElement) {
                statusElement.textContent = 'Niezapisane';
                statusElement.className = 'status-tag status-none';
            }
        });

        if (step === 1) {
            document.getElementById('step-1-input').style.display = 'block';
            document.getElementById('modal-title').textContent = 'Nowy rozdział: 1/3 Wstaw treść';
            // Reset stanu
            rawChapterDetails = {}; 
            parsedJsonData = {}; 
            document.getElementById('modal-chapter-number').value = '1';
            document.getElementById('modal-chapter-title').value = '';
            document.getElementById('modal-chapter-content').value = '';
        } else if (step === 2) {
            document.getElementById('step-2-json').style.display = 'block';
            document.getElementById('modal-title').textContent = 'Nowy rozdział: 2/3 Dane Fabularne (JSON)';
            document.getElementById('json-chapter-display').textContent = rawChapterDetails.title || 'N/A';
            document.getElementById('json-version-timestamp').textContent = rawChapterDetails.versionTimestamp || '';
            document.getElementById('modal-json-content').value = '';
        } else if (step === 3) {
            document.getElementById('step-3-review').style.display = 'block';
            document.getElementById('modal-title').textContent = 'Nowy rozdział: 3/3 Potwierdzenie';
            renderReviewSections(); 
        }
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
    
    // Specjalna obsługa, aby nie odświeżać dashboardu przy zamykaniu detali postaci
    if (modalId !== 'characterDetailsModal') {
        fetchData(); 
    }
}

function viewAddChapter() {
    openModal('chapterModal', 1); 
}

// --- FUNKCJA KROK 1: ZAPIS SUROWEJ TREŚCI (RAW) ---

async function saveChapterRaw() {
    const chapterNumber = document.getElementById('modal-chapter-number').value;
    const title = document.getElementById('modal-chapter-title').value;
    const content = document.getElementById('modal-chapter-content').value;
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
            rawChapterDetails = {
                chapterNumber: chapterNumber, 
                chapterId: data.CHAPTER_ID,
                versionTimestamp: data.VERSION_TIMESTAMP,
                title: data.TITLE
            };
            updateStatusMessage(`Pomyślnie zapisano treść RAW: ${data.TITLE}. Przejdź do KROKU 2.`, 'success');
            openModal('chapterModal', 2); 
        } else {
             throw new Error('Nieoczekiwany status z serwera: ' + data.STATUS);
        }

    } catch (error) {
        updateStatusMessage(`BŁĄD KROKU 1: ${error.message}`, 'error');
        console.error('Błąd zapisu RAW:', error);
        
    } finally {
        startBtn.disabled = false;
        startBtn.textContent = '1. ZAPISZ TREŚĆ RAW';
    }
}


// --- FUNKCJA KROK 2: PRZETWARZANIE JSONA I AUTO-ZAPIS ---

function processJsonAndAutoSave() {
    const jsonContent = document.getElementById('modal-json-content').value;
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
        parsedJsonData = JSON.parse(jsonContent);
        if (!parsedJsonData.streszczenie_szczegolowe || !parsedJsonData.postacie || !parsedJsonData.swiat || !parsedJsonData.sceny) {
             throw new Error('JSON musi zawierać pola: streszczenie_szczegolowe, postacie, swiat, sceny.');
        }
        
        // 2. Wstrzyknięcie danych z KROKU 1
        const payload = { 
            fullAutoSaveData: parsedJsonData 
        };
        payload.fullAutoSaveData.rawVersionTimestamp = rawChapterDetails.versionTimestamp;
        payload.fullAutoSaveData.numer_rozdzialu = rawChapterDetails.chapterNumber; 
        
        // 3. Rozpoczęcie auto-zapisu
        autoSaveAllSections(payload);

    } catch (e) {
        updateStatusMessage(`BŁĄD PARSOWANIA JSON: ${e.message}`, 'error');
        processBtn.disabled = false;
        processBtn.textContent = '2. PRZETWÓRZ JSON I ZACZNIJ AUTOMATYCZNY ZAPIS';
    }
}

async function autoSaveAllSections(payload) {
    const processBtn = document.getElementById('process-json-btn');
    
    const statusMap = {
        'CHARACTERS': 'save-characters-status',
        'WORLD': 'save-world-status',
        'SCENES': 'save-scenes-status',
        'SUMMARY': 'save-summary-status'
    };
    
    // Ustawienie wszystkich na 'W trakcie' przed wysłaniem
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
        
        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({ error: 'Brak szczegółów w JSON' }));
            throw new Error(`Błąd HTTP: ${response.status}. Szczegóły: ${errorBody.error || 'Nieznany błąd backendu'}`);
        }
        
        const data = await response.json(); 
        
        updateStatusMessage('Wszystkie sekcje zostały przetworzone i zapisane! Przejdź do Potwierdzenia (KROK 3).', 'success');
        
        // Uaktualnienie statusu sekcji w KROKU 3
        updateReviewStatusIndicators(data.results);
        
        processBtn.textContent = 'ZAPISANO Pomyślnie!';
        openModal('chapterModal', 3); 

    } catch (error) {
        console.error('Błąd auto-zapisu:', error);

        const globalErrorResults = {};
        for (const key of Object.keys(statusMap)) {
            globalErrorResults[key] = { success: false, error: 'Krytyczny błąd połączenia/API.' };
        }
        updateReviewStatusIndicators(globalErrorResults);
        
        updateStatusMessage(`KRYTYCZNY BŁĄD ZAPISU: ${error.message}. Sprawdź konsolę.`, 'error');
        openModal('chapterModal', 3); 
        
    } finally {
        processBtn.disabled = false;
        processBtn.style.backgroundColor = (processBtn.textContent === 'ZAPISANO Pomyślnie!') ? '#218838' : '#dc3545';
        if (processBtn.textContent !== 'ZAPISANO Pomyślnie!') {
            processBtn.textContent = 'BŁĄD - Spróbuj Ponownie';
        }
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


// --- FUNKCJE SZCZEGÓŁÓW POSTACI ---

async function viewCharacterDetails(charId) {
    // 1. Otwarcie modalu i inicjalizacja elementów
    openModal('characterDetailsModal');
    
    const nameElement = document.getElementById('char-detail-name');
    const statusElement = document.getElementById('char-latest-status');
    const roleElement = document.getElementById('char-latest-role');
    const typeElement = document.getElementById('char-latest-type');
    const historyContainer = document.getElementById('char-chapters-history');
    
    nameElement.textContent = 'Ładowanie...';
    historyContainer.innerHTML = '<p class="loading-text">Pobieranie historii postaci...</p>';

    try {
        // 2. Pobranie danych historycznych
        const response = await fetch(`${DASHBOARD_API_ENDPOINT}?charId=${charId}`, { method: 'GET' });
        if (!response.ok) {
            throw new Error(`Błąd HTTP: ${response.status}`);
        }
        const data = await response.json();
        
        const latest = data.latestDetails;
        
        // 3. Uzupełnienie najnowszych detali
        nameElement.textContent = latest.IMIE || 'Nieznana Postać';
        statusElement.textContent = latest.SZCZEGOLY?.status || 'Brak statusu';
        roleElement.textContent = latest.ROLA_W_ROZDZIALE || 'Brak roli';
        typeElement.textContent = latest.SZCZEGOLY?.typ || 'N/A';
        
        // 4. Renderowanie historii ewolucji
        renderCharacterHistory(data.chaptersHistory);

    } catch (error) {
        nameElement.textContent = 'BŁĄD ŁADOWANIA';
        historyContainer.innerHTML = `<p style="color:red;">Nie udało się załadować danych. ${error.message}</p>`;
        console.error('Błąd ładowania detali postaci:', error);
    }
}

function renderCharacterHistory(chaptersHistory) {
    const historyContainer = document.getElementById('char-chapters-history');
    historyContainer.innerHTML = ''; // Czyścimy

    if (chaptersHistory.length === 0) {
        historyContainer.innerHTML = '<p>Brak historii w rozdziałach.</p>';
        return;
    }
    
    chaptersHistory.forEach(chapter => {
        // Tytuł Rozdziału (Sekcja rozwijana - <details>)
        const chapterDiv = document.createElement('div');
        chapterDiv.className = 'chapter-history-group';
        chapterDiv.innerHTML = `
            <details class="analysis-section" open>
                <summary style="font-weight: bold; cursor: pointer; padding: 5px 0;">
                    ROZDZIAŁ ${chapter.chapterId.replace('CH-', '')} (${chapter.versions.length} Wersji)
                </summary>
                <ul class="version-list" style="list-style: none; padding-left: 0;"></ul>
            </details>
        `;
        
        const versionList = chapterDiv.querySelector('.version-list');
        
        // Wersje w ramach Rozdziału (Data i Detale)
        chapter.versions.sort((a, b) => new Date(b.versionTimestamp) - new Date(a.versionTimestamp)).forEach(version => {
            const versionLi = document.createElement('li');
            const formattedDate = new Date(version.versionTimestamp).toLocaleString('pl-PL');
            
            // Tworzymy rozwijaną sekcję dla każdej wersji
            versionLi.innerHTML = `
                <details style="margin-top: 10px; border-left: 3px solid #007bff; padding-left: 10px;">
                    <summary style="cursor: pointer;">
                        Wersja z: <strong>${formattedDate}</strong>
                    </summary>
                    <p style="margin-top: 5px; font-size: 0.9em;">
                        **Rola w Rozdziale:** ${version.rola_w_rozdziale} <br>
                        **Status:** ${version.szczegoly?.status || 'N/A'} <br>
                        **Typ:** ${version.szczegoly?.typ || 'N/A'}
                    </p>
                </details>
            `;
            versionList.appendChild(versionLi);
        });
        
        historyContainer.appendChild(chapterDiv);
    });
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
            <button class="cta-btn" onclick="viewCharacterDetails('${charId}')">Podgląd</button>
        `;
        list.appendChild(li);
    });
}
