import { fetchDashboardData, DASHBOARD_API_ENDPOINT } from './utils.js';

// === FUNKCJE API DLA DETALI ===

// Pobieranie detali rozdziału (przez skanowanie dashboardu)
async function fetchChapterDetails(chapterId) {
    const data = await fetchDashboardData();
    
    // Zabezpieczenie: Sprawdzamy, czy struktura chapters.latestChapters istnieje
    const latestChapters = data?.chapters?.latestChapters;

    if (!Array.isArray(latestChapters) || latestChapters.length === 0) { 
        throw new Error("Brak danych o rozdziałach w odpowiedzi API. Upewnij się, że DynamoDB zawiera zapisane rozdziały.");
    }

    const chapter = latestChapters.find(c => c.CHAPTER_ID === chapterId);
    
    if (!chapter) {
        throw new Error(`Rozdział ${chapterId} nie znaleziony w bazie danych.`);
    }
    
    const worldNameKey = chapter.WORLD_NAME ? chapter.WORLD_NAME.toUpperCase() : null;
    let worldDetails = null;
    if (worldNameKey) {
         try {
             worldDetails = await fetchWorldDetails(worldNameKey); 
         } catch(e) {
             console.warn(`Nie udało się pobrać pełnych detali świata ${worldNameKey}.`, e);
         }
    }

    return { chapter, worldDetails };
}

// Pobieranie detali postaci (przez dedykowany endpoint)
async function fetchCharacterDetails(charId) {
    const response = await fetch(`${DASHBOARD_API_ENDPOINT}?charId=${charId}`, { method: 'GET' });
    const data = await response.json();
    if (!response.ok) {
        // Rzucamy błąd, ale nie przerywamy procesu renderowania
        throw new Error(`BŁĄD API: ${data.error || 'Nieznany błąd.'}`);
    }
    return data;
}

// Pobieranie detali świata (przez dedykowany endpoint)
async function fetchWorldDetails(worldId) {
    const response = await fetch(`${DASHBOARD_API_ENDPOINT}?worldId=${worldId}`, { method: 'GET' });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(`BŁĄD API: ${data.error || 'Nieznany błąd.'}`);
    }
    return data;
}

// Pobieranie scen z danego rozdziału
async function fetchChapterScenes(chapterId) {
    const response = await fetch(`${DASHBOARD_API_ENDPOINT}?chapterScenesId=${chapterId}`, { method: 'GET' });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(`BŁĄD API (Scenes): ${data.error || 'Nieznany błąd.'}`);
    }
    return data.scenes || [];
}

// === FUNKCJE RENDEROWANIA ===

function renderError(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `<p style="color: red;">BŁĄD: ${message}</p>`;
    }
}

// Renderowanie detali rozdziału
async function renderChapterDetails(data) {
    const { chapter, worldDetails } = data;
    
    const chapterNumber = chapter.CHAPTER_ID.replace('CH-', '');
    const chapterId = chapter.CHAPTER_ID;

    // --- Ustawienia nagłówka i metadanych ---
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) pageTitle.textContent = `${chapterNumber}: ${chapter.TITLE}`;
    
    const editLink = document.getElementById('edit-link');
    if (editLink) editLink.href = `chapter_add.html?step=1&id=${chapter.CHAPTER_ID}`;
    
    const versionDate = document.getElementById('version-date');
    if (versionDate) versionDate.textContent = `Data dodania: ${new Date(chapter.VERSION_TIMESTAMP).toLocaleString('pl-PL')}`;
    
    const summaryText = document.getElementById('summary-text');
    if (summaryText) summaryText.textContent = chapter.SUMMARY || 'Brak szczegółowego streszczenia.';

    // --- 1. SEKCIJA POSTACI (NOWA LOGIKA POBIERANIA Z LLM_Characters) ---
    const charListDetail = document.getElementById('character-list-detail');
    
    // Priorytetowo używamy listy z pełnymi detalami z rozdziału (CHARACTERS_LIST).
    // Jeśli pusta, używamy starego pola CHARACTERS (lista stringów).
    let chapterCharacters = chapter.CHARACTERS_LIST || chapter.CHARACTERS || []; 
    
    // Konwersja na jednolity format obiektów, jeśli to lista stringów
    if (chapterCharacters.length > 0 && typeof chapterCharacters[0] === 'string') {
        chapterCharacters = chapterCharacters.map(name => ({ imie: name }));
    }

    const charBoxTitle = document.querySelector('#analysis-sections-grid .analysis-box:nth-child(1) h4');
    if (charBoxTitle) charBoxTitle.textContent = `Postacie (${chapterCharacters.length})`;
    
    let detailedCharacters = [];

    if (chapterCharacters.length > 0) {
        if (charListDetail) charListDetail.innerHTML = `<p class="loading-text">Ładowanie ${chapterCharacters.length} postaci z LLM_Characters...</p>`;

        // ITERACJA I POBIERANIE DETALI Z LLM_Characters
        for (const char of chapterCharacters) {
            const charName = char.imie || 'N/A';
            const charId = (charName || 'N/A').toUpperCase();

            let displayChar = { 
                imie: charName,
                rola_w_rozdziale: char.rola_w_rozdziale || 'N/A',
                status: char.status || 'N/A'
            };
            
            // Jeśli postać została zidentyfikowana (imie jest dostępne), pobieramy jej najnowszy status z LLM_Characters
            if (charId !== 'N/A') {
                try {
                    const latestDetails = await fetchCharacterDetails(charId);
                    if (latestDetails && latestDetails.latestDetails) {
                        // Aktualizujemy status z najnowszego rekordu
                        displayChar.status = latestDetails.latestDetails.SZCZEGOLY?.status || displayChar.status;
                        
                        // Oznaczamy rolę jako pobraną z rozdziału, jeśli była dostępna
                        if (displayChar.rola_w_rozdziale === 'N/A') {
                             displayChar.rola_w_rozdziale = 'N/A (Aktualne dane)';
                        }
                    }
                } catch(e) {
                    console.error(`Nie udało się pobrać detali dla ${charName}:`, e);
                }
            }
            detailedCharacters.push(displayChar);
        }

        // Czyścimy i renderujemy
        if (charListDetail) charListDetail.innerHTML = '';
        
        detailedCharacters.forEach(char => {
             const charId = (char.imie || 'N/A').toUpperCase();

             if (charListDetail) charListDetail.innerHTML += `
                <div class="char-detail-item">
                    <a href="character_details.html?id=${charId}" class="char-box">
                        <strong>${char.imie}</strong>
                        Rola: ${char.rola_w_rozdziale} <br>
                        Status: ${char.status}
                    </a>
                </div>
             `;
        });
    } else {
         if (charListDetail) charListDetail.innerHTML = '<p>Brak zidentyfikowanych postaci.</p>';
    }

    // --- 2. SEKCIJA SCEN (Bez zmian) ---
    const sceneListDetail = document.getElementById('scene-list-detail');
    const sceneCount = chapter.SCENES_COUNT || 0;
    
    const sceneBoxTitle = document.querySelector('#analysis-sections-grid .analysis-box:nth-child(2) h4');
    if (sceneBoxTitle) sceneBoxTitle.textContent = `Sceny (${sceneCount})`;
    
    if (sceneCount > 0) {
        if (sceneListDetail) sceneListDetail.innerHTML = `<p class="loading-text">Pobieranie ${sceneCount} scen...</p>`;
        
        try {
            const scenes = await fetchChapterScenes(chapterId);

            if (sceneListDetail) sceneListDetail.innerHTML = '';
            
            scenes.forEach(scene => {
                const formattedDate = new Date(scene.DATA_DODANIA).toLocaleDateString('pl-PL');

                if (sceneListDetail) sceneListDetail.innerHTML += `
                    <div class="scene-item">
                        <a href="scene_details.html?id=${scene.ID_ZDARZENIA}"><strong>${scene.TYTUL_SCENY || 'Scena Bez Tytułu'}</strong></a>
                        <p class="metadata-line">ID Zdarzenia: ${scene.ID_ZDARZENIA} &bull; Data: ${formattedDate}</p>
                        <p class="scene-description">${scene.OPIS_SCENY || 'Brak opisu.'}</p>
                        <hr class="scene-separator">
                    </div>
                `;
            });
        } catch (error) {
             if (sceneListDetail) sceneListDetail.innerHTML = `<p style="color: red;">BŁĄD POBIERANIA SCEN: ${error.message}</p>`;
        }

    } else {
         if (sceneListDetail) sceneListDetail.innerHTML = '<p>Brak zidentyfikowanych scen.</p>';
    }


    // --- 3. SEKCIJA ŚWIAT (Bez zmian) ---
    const worldInfoDetail = document.getElementById('world-info-detail');
    const currentWorld = worldDetails?.latestDetails || {ID: chapter.WORLD_NAME || 'N/A', NAZWA: chapter.WORLD_NAME || 'N/A', OPIS: 'Brak detali w bazie.'};

    if (worldInfoDetail) worldInfoDetail.innerHTML = `
        <p><strong>Węzeł:</strong> ${currentWorld.NAZWA}</p>
        <p><strong>Opis:</strong> ${currentWorld.OPIS || 'Brak opisu.'}</p>
        <a href="world_details.html?id=${currentWorld.ID}">Zobacz Historię Węzła &rarr;</a>
    `;
}

// Renderowanie detali postaci (Ewolucja) - bez zmian
function renderCharacterDetails(data) {
    const { latestDetails, chaptersHistory } = data;
    
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) pageTitle.textContent = `Szczegóły Postaci: ${latestDetails.IMIE}`;
    
    const content = document.getElementById('character-details-content');
    
    let html = `
        <h3>Główne Dane Postaci</h3>
        <p><strong>Imię:</strong> ${latestDetails.IMIE}</p>
        <p><strong>Ostatni Status:</strong> ${latestDetails.SZCZEGOLY?.status || 'N/A'}</p>
        <p><strong>Typ:</strong> ${latestDetails.SZCZEGOLY?.typ || 'N/A'}</p>
        <p><strong>Data Ost. Zmiany:</strong> ${new Date(latestDetails.DATA_DODANIA).toLocaleString('pl-PL')}</p>
        
        <h3>Ewolucja i Historia w Rozdziałach</h3>
    `;
    
    chaptersHistory.sort((a, b) => {
        const numA = parseInt(a.chapterId.replace('CH-', ''));
        const numB = parseInt(b.chapterId.replace('CH-', ''));
        return numB - numA; 
    });

    chaptersHistory.forEach(chapter => {
        const chapterNumber = chapter.chapterId.replace('CH-', '');
        
        html += `<details class="analysis-section" open>
            <summary style="font-weight: bold; cursor: pointer; padding: 5px 0; font-size: 1.1em; color: #007bff;">
                ROZDZIAŁ ${chapterNumber} (${chapter.versions.length} Wersji)
            </summary>
            <ul class="version-list" style="list-style: none; padding-left: 0;">`;
        
        chapter.versions.sort((a, b) => new Date(b.versionTimestamp) - new Date(a.versionTimestamp)).forEach(version => {
            const formattedDate = new Date(version.versionTimestamp).toLocaleString('pl-PL');
            
            html += `
                <li>
                    <details style="margin-top: 10px; border-left: 3px solid #28a745; padding-left: 10px;">
                        <summary style="cursor: pointer;">
                            Wpis z: <strong>${formattedDate}</strong>
                        </summary>
                        <p style="margin-top: 5px; font-size: 0.9em;">
                            **Rola w Rozdziale:** ${version.rola_w_rozdziale} <br>
                            **Typ:** ${version.szczegoly?.typ || 'N/A'} <br>
                            **Status:** ${version.szczegoly?.status || 'N/A'}
                        </p>
                    </details>
                </li>
            `;
        });
        
        html += `</ul></details>`;
    });

    if (content) content.innerHTML = html;
}

// Renderowanie detali świata (Ewolucja) - bez zmian
function renderWorldDetails(data) {
    const { latestDetails, chaptersHistory } = data;
    
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) pageTitle.textContent = `Szczegóły Węzła: ${latestDetails.NAZWA}`;
    
    const content = document.getElementById('world-details-content');
    
    let html = `
        <h3>Główne Dane Węzła</h3>
        <p><strong>Nazwa:</strong> ${latestDetails.NAZWA}</p>
        <p><strong>Aktualny Opis:</strong> ${latestDetails.OPIS || 'Brak opisu.'}</p>
        <p><strong>Data Ost. Aktualizacji:</strong> ${new Date(latestDetails.DATA_DODANIA).toLocaleString('pl-PL')}</p>
        
        <h3>Historia Opisów Węzła w Rozdziałach</h3>
    `;
    
    chaptersHistory.sort((a, b) => {
        const numA = parseInt(a.chapterId.replace('CH-', ''));
        const numB = parseInt(b.chapterId.replace('CH-', ''));
        return numB - numA; 
    });

    chaptersHistory.forEach(chapter => {
        const chapterNumber = chapter.chapterId.replace('CH-', '');
        
        html += `<details class="analysis-section" open>
            <summary style="font-weight: bold; cursor: pointer; padding: 5px 0; font-size: 1.1em; color: #007bff;">
                ROZDZIAŁ ${chapterNumber} (${chapter.versions.length} Wersji)
            </summary>
            <ul class="version-list" style="list-style: none; padding-left: 0;">`;
        
        chapter.versions.sort((a, b) => new Date(b.versionTimestamp) - new Date(a.versionTimestamp)).forEach(version => {
            const formattedDate = new Date(version.versionTimestamp).toLocaleString('pl-PL');
            
            html += `
                <li>
                    <details style="margin-top: 10px; border-left: 3px solid #28a745; padding-left: 10px;">
                        <summary style="cursor: pointer;">
                            Wpis z: <strong>${formattedDate}</strong>
                        </summary>
                        <p style="margin-top: 5px; font-size: 0.9em;">
                            **Opis:** ${version.opis}
                        </p>
                    </details>
                </li>
            `;
        });
        
        html += `</ul></details>`;
    });

    if (content) content.innerHTML = html;
}

// === FUNKCJA GŁÓWNA LOADERA ===
export async function loadDetailsPage(id, type) {
    // Zabezpieczony odczyt nagłówka
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) pageTitle.textContent = `Ładowanie szczegółów ${type}...`;
    
    const contentContainerId = `${type}-details-content`;

    try {
        if (type === 'chapter') {
            const details = await fetchChapterDetails(id);
            // Czekamy na zakończenie renderowania (w tym asynchronicznego pobierania postaci)
            await renderChapterDetails(details); 
            
        } else if (type === 'character') {
            const details = await fetchCharacterDetails(id);
            renderCharacterDetails(details);
        } else if (type === 'world') {
            const details = await fetchWorldDetails(id);
            renderWorldDetails(details);
        } else {
             renderError(contentContainerId, 'Nieznany typ detali.');
        }
    } catch (error) {
        console.error(`Błąd ładowania detali ${type}:`, error);
        if (type === 'chapter') {
             const grid = document.getElementById('chapter-details-grid');
             if (grid) grid.innerHTML = `<p style="color: red; padding: 20px;">BŁĄD: ${error.message}</p>`;
        } else {
             renderError(contentContainerId, error.message);
        }
    }
}
