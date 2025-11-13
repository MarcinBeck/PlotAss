// Konfiguracja API
export const DASHBOARD_API_ENDPOINT = 'https://kggk7qj2bk.execute-api.eu-north-1.amazonaws.com/FINAL_SUCCESS/DashboardDataResolver'; 
export const CHAPTER_MANAGER_ENDPOINT = 'https://hdhzbujrg3tgyc64wdnseswqxi0lhgci.lambda-url.eu-north-1.on.aws/'; 

// === FUNKCJE POMOCNICZE ===

export function updateStatusMessage(message, type = 'info') {
    const alertDiv = document.getElementById('status-alert');
    if (!alertDiv) return;
    
    let bgColor = '#e7f7ff'; 
    let color = '#333';

    if (type === 'success') {
        bgColor = '#d4edda'; 
        color = '#155724';
    } else if (type === 'error') {
        bgColor = '#f8d7da'; 
        color = '#721c24';
    }

    alertDiv.style.backgroundColor = bgColor;
    alertDiv.style.color = color;
    alertDiv.innerHTML = message;
    alertDiv.style.display = 'block';
}

export function saveState(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

export function loadState(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
}

// === FUNKCJE API ===

export async function fetchDashboardData() {
    const response = await fetch(DASHBOARD_API_ENDPOINT, { method: 'GET' });
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: 'Brak szczegółów w JSON' }));
        throw new Error(`Błąd HTTP: ${response.status}. Szczegóły: ${errorBody.error || 'Nieznany błąd backendu'}`);
    }
    return response.json();
}

export async function saveRawChapter(payload) {
    const response = await fetch(CHAPTER_MANAGER_ENDPOINT, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    
    const data = await response.json(); 
    
    if (!response.ok) {
        throw new Error(`BŁĄD BACKENDU: ${data.error || 'Nieznany błąd serwera.'}`);
    }
    
    return data;
}

export async function autoSaveAllSections(payload) {
    const response = await fetch(CHAPTER_MANAGER_ENDPOINT, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload) 
    });
    
    const data = await response.json(); 
    
    if (!response.ok) {
        throw new Error(`BŁĄD BACKENDU: ${data.error || 'Nieznany błąd serwera.'}`);
    }
    
    return data;
}

// =======================================================
// === LOGIKA DODAWANIA ROZDZIAŁU (chapter_add.html) ===
// =======================================================

function renderReviewSections(parsedJsonData, rawChapterDetails) {
    if (!parsedJsonData || !rawChapterDetails) return;

    const { streszczenie_szczegolowe, postacie, swiat, sceny, dane_statystyczne } = parsedJsonData;

    document.getElementById('review-chapter-display').textContent = rawChapterDetails.title;
    document.getElementById('review-version-timestamp').textContent = rawChapterDetails.versionTimestamp;
    
    document.getElementById('review-summary-text').textContent = (streszczenie_szczegolowe || '').substring(0, 500) + '...';
    document.getElementById('review-words-count').textContent = dane_statystyczne?.liczba_wyrazow || 'N/A';
    
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

    document.getElementById('review-world-name').textContent = swiat?.nazwa || 'N/A';
    document.getElementById('review-world-description').textContent = (swiat?.opis || '').substring(0, 150) + '...';

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

export function initChapterAddPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const step = parseInt(urlParams.get('step')) || 1;
    
    const rawChapterDetails = loadState('rawChapterDetails');
    const parsedJsonData = loadState('parsedJsonData');

    const step1 = document.getElementById('step-1-input');
    const step2 = document.getElementById('step-2-json');
    const step3 = document.getElementById('step-3-review');
    const title = document.getElementById('page-title');

    if (step1) step1.style.display = 'none';
    if (step2) step2.style.display = 'none';
    if (step3) step3.style.display = 'none';

    if (title) title.textContent = `Dodawanie Rozdziału - Krok ${step}/3`;

    if (step === 1) {
        if (step1) step1.style.display = 'block';
        localStorage.removeItem('rawChapterDetails');
        localStorage.removeItem('parsedJsonData');
        
    } else if (step === 2) {
        if (!rawChapterDetails) {
            updateStatusMessage('BŁĄD: Najpierw zapisz treść RAW (Krok 1).', 'error');
            setTimeout(() => window.location.href = 'chapter_add.html?step=1', 3000);
            return;
        }
        if (step2) step2.style.display = 'block';
        if (document.getElementById('json-chapter-display')) document.getElementById('json-chapter-display').textContent = rawChapterDetails.title || 'N/A';
        if (document.getElementById('json-version-timestamp')) document.getElementById('json-version-timestamp').textContent = rawChapterDetails.versionTimestamp || '';
        
    } else if (step === 3) {
        if (!parsedJsonData) {
            updateStatusMessage('BŁĄD: Najpierw prześlij JSON (Krok 2).', 'error');
            setTimeout(() => window.location.href = 'chapter_add.html?step=2', 3000);
            return;
        }
        if (step3) step3.style.display = 'block';
        const saveStatus = urlParams.get('saveStatus');
        if (saveStatus) {
            updateStatusMessage(`Zapis danych zakończony: ${saveStatus}`, saveStatus === 'SUCCESS' ? 'success' : 'error');
        }
        renderReviewSections(parsedJsonData, rawChapterDetails); 
    }
}


// Nadpisanie globalnych funkcji dla HTML (dla chapter_add.html)
window.saveChapterRaw = async function() {
    const chapterNumber = document.getElementById('chapter-number')?.value;
    const title = document.getElementById('chapter-title')?.value;
    const content = document.getElementById('chapter-content')?.value;
    const startBtn = document.getElementById('start-raw-save-btn');
    
    if (!chapterNumber || !title || !content) {
        updateStatusMessage('BŁĄD: Numer, Tytuł i Treść muszą być wypełnione!', 'error');
        return;
    }

    startBtn.disabled = true;
    startBtn.textContent = 'Trwa Zapis RAW...';
    updateStatusMessage('Wysyłanie treści RAW do Lambda...', 'info');
    
    try {
        const data = await saveRawChapter({ chapterNumber, title, content });
        
        if (data.STATUS === 'RAW_SAVED_READY_FOR_ANALYSIS') {
            const rawChapterDetails = {
                chapterNumber: chapterNumber, 
                chapterId: data.CHAPTER_ID,
                versionTimestamp: data.VERSION_TIMESTAMP,
                title: data.TITLE
            };
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
};

window.processJsonAndAutoSave = function() {
    const jsonContent = document.getElementById('json-content')?.value;
    const processBtn = document.getElementById('process-json-btn');

    if (!jsonContent) {
        updateStatusMessage('BŁĄD: Pole JSON nie może być puste!', 'error');
        return;
    }

    processBtn.disabled = true;
    processBtn.textContent = 'Trwa Parsowanie i Zapis...';
    updateStatusMessage('Przetwarzanie JSON i inicjowanie automatycznego zapisu do baz...', 'info');


    try {
        const parsedJsonData = JSON.parse(jsonContent);
        if (!parsedJsonData.streszczenie_szczegolowe || !parsedJsonData.postacie || !parsedJsonData.swiat || !parsedJsonData.sceny) {
             throw new Error('JSON musi zawierać pola: streszczenie_szczegolowe, postacie, swiat, sceny.');
        }
        
        const rawChapterDetails = loadState('rawChapterDetails');
        if (!rawChapterDetails) {
            throw new Error('Brak stanu RAW. Wróć do KROKU 1.');
        }
        
        const payload = { 
            fullAutoSaveData: parsedJsonData 
        };
        payload.fullAutoSaveData.rawVersionTimestamp = rawChapterDetails.versionTimestamp;
        payload.fullAutoSaveData.numer_rozdzialu = rawChapterDetails.chapterNumber; 
        
        saveState('parsedJsonData', parsedJsonData);

        autoSaveAllSectionsAsync(payload);

    } catch (e) {
        updateStatusMessage(`BŁĄD PARSOWANIA JSON: ${e.message}`, 'error');
        processBtn.disabled = false;
        processBtn.textContent = '2. PRZETWÓRZ JSON I ZACZNIJ AUTOMATYCZNY ZAPIS (Krok 3)';
    }
};

async function autoSaveAllSectionsAsync(payload) {
    try {
        await autoSaveAllSections(payload);
        window.location.href = 'chapter_add.html?step=3&saveStatus=SUCCESS';
    } catch (error) {
        console.error('Błąd auto-zapisu:', error);
        window.location.href = `chapter_add.html?step=3&saveStatus=ERROR&details=${encodeURIComponent(error.message)}`;
    }
}
