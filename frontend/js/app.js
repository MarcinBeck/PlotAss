// Plik: frontend/js/app.js (LOGIKA GRANULARNEGO ZAPISU)

// ====================================================================
// PAMIĘTAJ: Wklej swoje adresy URL z API Gateway!
// ====================================================================

// DashboardDataResolver (GET - Ładowanie statystyk)
const DASHBOARD_API_ENDPOINT = 'https://kggk7qj2bk.execute-api.eu-north-1.amazonaws.com/FINAL_SUCCESS/DashboardDataResolver'; 
// ChapterManager (POST - Dodawanie rozdziału, wywoływanie analizy)
const CHAPTER_MANAGER_ENDPOINT = 'https://hdhzbujrg3tgyc64wdnseswqxi0lhgci.lambda-url.eu-north-1.on.aws/'; 

document.addEventListener('DOMContentLoaded', fetchData);

// === Zmienne Globalne dla Workflow ===
let rawChapterDetails = {}; 
let parsedJsonData = {}; 

// --- FUNKCJE NAWIGACYJNE MODALA ---

function openModal(modalId, step = 1) {
    const modal = document.getElementById(modalId);
    if (!modal) return; 

    modal.style.display = 'block';
    
    // Resetowanie widoków
    document.getElementById('step-1-input').style.display = 'none';
    document.getElementById('step-2-json').style.display = 'none';
    document.getElementById('step-3-review').style.display = 'none';

    if (step === 1) {
        document.getElementById('step-1-input').style.display = 'block';
        // Reset stanu
        rawChapterDetails = {}; 
        parsedJsonData = {}; 
        document.getElementById('modal-chapter-number').value = '1';
        document.getElementById('modal-chapter-title').value = '';
        document.getElementById('modal-chapter-content').value = '';
    } else if (step === 2) {
        document.getElementById('step-2-json').style.display = 'block';
        // Wyświetlanie danych z KROKU 1
        document.getElementById('json-chapter-display').textContent = rawChapterDetails.title || 'N/A';
        document.getElementById('json-version-timestamp').textContent = rawChapterDetails.versionTimestamp || '';
        document.getElementById('modal-json-content').value = '';
    } else if (step === 3) {
        document.getElementById('step-3-review').style.display = 'block';
        renderReviewSections(); // Wyświetlenie danych JSON w sekcjach
    }
    
    // Resetowanie przycisków zapisu
    ['SUMMARY', 'CHARACTERS', 'WORLD', 'SCENES'].forEach(type => {
        const btn = document.getElementById(`save-${type.toLowerCase()}-btn`);
        btn.disabled = false;
        btn.textContent = 'Zapisz';
        btn.style.backgroundColor = '#28a745'; 
    });
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
    fetchData(); 
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
            rawChapterDetails = {
                chapterNumber: chapterNumber, 
                chapterId: data.CHAPTER_ID,
                versionTimestamp: data.VERSION_TIMESTAMP,
                title: data.TITLE
            };
            alert(`Pomyślnie zapisano RAW: ${data.TITLE}. Przejdź do KROKU 2 (Wklej JSON).`);
            openModal('chapterModal', 2); 
        } else {
             throw new Error('Nieoczekiwany status z serwera: ' + data.STATUS);
        }

    } catch (error) {
        alert(`BŁĄD KROKU 1: ${error.message}`);
        console.error('Błąd zapisu RAW:', error);
        
    } finally {
        startBtn.disabled = false;
        startBtn.textContent = '1. ZAPISZ RAW';
    }
}


// --- FUNKCJA KROK 2: PRZETWARZANIE JSONA I PRZEGLĄD ---

function processJsonAndShowReview() {
    const jsonContent = document.getElementById('modal-json-content').value;

    if (!jsonContent) {
        alert('BŁĄD: Pole JSON nie może być puste!');
        return;
    }

    try {
        parsedJsonData = JSON.parse(jsonContent);
        // Sprawdzamy kluczowe pola
        if (!parsedJsonData.streszczenie_szczegolowe || !parsedJsonData.postacie || !parsedJsonData.swiat || !parsedJsonData.sceny) {
             throw new Error('JSON musi zawierać pola: streszczenie_szczegolowe, postacie, swiat, sceny.');
        }
        
        // Wymuszenie dodania numeru rozdziału z KROKU 1 do JSONa, jeśli go tam nie ma
        parsedJsonData.numer_rozdzialu = rawChapterDetails.chapterNumber; 

        openModal('chapterModal', 3); 
        
    } catch (e) {
        alert(`BŁĄD PARSOWANIA JSON: ${e.message}`);
    }
}


// --- FUNKCJA KROK 3: RENDEROWANIE I ZAPIS SEKCJI ---

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

async function saveSection(sectionType) {
    const startBtn = document.getElementById(`save-${sectionType.toLowerCase()}-btn`);
    startBtn.disabled = true;
    startBtn.textContent = 'Zapisuję...';

    // Przygotowanie payloadu na podstawie sectionType
    let payloadData = {
        rawVersionTimestamp: rawChapterDetails.versionTimestamp,
        numer_rozdzialu: rawChapterDetails.chapterNumber,
        sectionType: sectionType
    };
    
    if (sectionType === 'SUMMARY') {
        payloadData.summary = parsedJsonData.streszczenie_szczegolowe;
        payloadData.stats = parsedJsonData.dane_statystyczne;
        payloadData.title = parsedJsonData.tytul_rozdzialu;
    } else if (sectionType === 'CHARACTERS') {
         payloadData.postacie = parsedJsonData.postacie;
    } else if (sectionType === 'WORLD') {
         payloadData.swiat = parsedJsonData.swiat;
    } else if (sectionType === 'SCENES') {
         payloadData.sceny = parsedJsonData.sceny;
    } 

    try {
        const response = await fetch(CHAPTER_MANAGER_ENDPOINT, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sectionUpdateData: payloadData }) 
        });
        
        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({ error: 'Brak szczegółów w JSON' }));
            throw new Error(`Błąd HTTP: ${response.status}. Szczegóły: ${errorBody.error || 'Nieznany błąd backendu'}`);
        }
        
        const data = await response.json(); 
        
        alert(`Sukces: ${data.message}`);
        startBtn.style.backgroundColor = '#218838'; 
        startBtn.textContent = 'ZAPISANO!';
        
    } catch (error) {
        alert(`BŁĄD ZAPISU ${sectionType}: ${error.message}`);
        console.error(`Błąd zapisu sekcji ${sectionType}:`, error);
        startBtn.style.backgroundColor = '#dc3545'; 
        startBtn.textContent = 'BŁĄD ZAPISU';
        
    }
}


// --- POZOSTAŁE FUNKCJE ---

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
        const charWorld = char.A_DANE_OGOLNE?.WEZEL_ID || 'Nieznany'; 
        
        li.innerHTML = `
            <span><strong>${charName.substring(0, 15)}</strong></span>
            <span>Węzeł: ${charWorld.substring(0, 10)}</span>
            <button class="cta-btn" onclick="viewCharacterDetails('${char.ID}')">Podgląd</button>
        `;
        list.appendChild(li);
    });
}
