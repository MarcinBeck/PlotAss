import { fetchDashboardData, DASHBOARD_API_ENDPOINT, CHARACTERS_CHAPTER_API_ENDPOINT } from './utils.js';

// === FUNKCJE API DLA DETALI ===

// Pobieranie detali rozdziału (przez skanowanie dashboardu)
async function fetchChapterDetails(chapterId) {
    const data = await fetchDashboardData();
    
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
        throw new Error(`BŁĄD API: ${data.error || 'Nieznany błąd.'}`);
    }
    return data;
}

// NOWA FUNKCJA: Pobieranie listy postaci dla danego rozdziału
async function fetchChapterCharacters(chapterId) {
    // KLUCZOWA POPRAWKA: Użycie właściwego dedykowanego endpointu
    const response = await fetch(`${CHARACTERS_CHAPTER_API_ENDPOINT}?chapterCharactersId=${chapterId}`, { method: 'GET' });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(`BŁĄD API (Characters): ${data.error || 'Nieznany błąd.'}`);
    }
    return data.characters || [];
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
    if (summaryText) summaryText.innerHTML = chapter.SUMMARY || 'Brak szczegółowego streszczenia.';

    // --- 1. SEKCIJA POSTACI ---
    const charListDetail = document.getElementById('character-list-detail');
    
    const charBoxTitle = document.querySelector('#sidebar-analysis .sidebar-box:nth-child(1) h4');
    
    if (charListDetail) charListDetail.innerHTML = `<p class="loading-text">Ładowanie postaci...</p>`;
    
    try {
        const characters = await fetchChapterCharacters(chapterId); 
        
        if (charBoxTitle) charBoxTitle.textContent = `Postacie (${characters.length})`; 

        if (charListDetail) charListDetail.innerHTML = '';

        if (characters.length > 0) {
            characters.forEach(char => {
                 const charName = char.IMIE || 'N/A';
                 const charId = char.ID || (charName || 'N/A').toUpperCase();

                 // PRZYWRÓCENIE POPRAWNEJ, STABILNEJ STRUKTURY HTML
                 if (charListDetail) charListDetail.innerHTML += `
                    <div class="char-detail-item">
                        <a href="character_details.html?id=${charId}" style="text-decoration: none; color: inherit;">
                            <strong>${charName}</strong>
                        </a>
                        <p>Rola: ${char.ROLA_W_ROZDZIALE || 'N/A'}</p>
                        <p>Status: ${char.STATUS || 'N/A'}</p>
                    </div>
                 `;
            });
        } else {
             if (charListDetail) charListDetail.innerHTML = '<p>Brak zidentyfikowanych postaci.</p>';
        }

    } catch (error) {
        if (charListDetail) charListDetail.innerHTML = `<p style="color: red;">BŁĄD POBIERANIA POSTACI: ${error.message}</p>`;
    }


    // --- 2. SEKCIJA SCEN ---
    const sceneListDetail = document.getElementById('scene-list-detail');
    const sceneCount = chapter.SCENES_COUNT || 0;
    
    const sceneBoxTitle = document.querySelector('#sidebar-analysis .sidebar-box:nth-child(2) h4');
    if (sceneBoxTitle) sceneBoxTitle.textContent = `Sceny (${sceneCount})`;
    
    if (sceneCount > 0) {
        if (sceneListDetail) sceneListDetail.innerHTML = `<p class="loading-text">Pobieranie ${sceneCount} scen...</p>`;
        
        try {
            const scenes = await fetchChapterScenes(chapterId);

            if (sceneListDetail) sceneListDetail.innerHTML = '';
            
            scenes.forEach(scene => {
                const formattedDate = new Date(scene.DATA_DODANIA).toLocaleString('pl-PL');

                // Ujednolicony format scen (ZACHOWANY)
                if (sceneListDetail) sceneListDetail.innerHTML += `
                    <div class="char-detail-item"> 
                        <a href="scene_details.html?id=${scene.ID_ZDARZENIA}" style="text-decoration: none; color: inherit;">
                            <strong>${scene.TYTUL_SCENY || 'Scena Bez Tytułu'}</strong>
                        </a>
                        <p class="metadata-line">ID Zdarzenia: ${scene.ID_ZDARZENIA} &bull; Data: ${formattedDate}</p>
                        <p class="scene-description">${scene.OPIS_SCENY || 'Brak opisu.'}</p>
                    </div>
                `;
            });
        } catch (error) {
             if (sceneListDetail) sceneListDetail.innerHTML = `<p style="color: red;">BŁĄD POBIERANIA SCEN: ${error.message}</p>`;
        }

    } else {
         if (sceneListDetail) sceneListDetail.innerHTML = '<p>Brak zidentyfikowanych scen.</p>';
    }


    // --- 3. SEKCIJA ŚWIAT ---
    const worldInfoDetail = document.getElementById('world-info-detail');
    const currentWorld = worldDetails?.latestDetails || {ID: chapter.WORLD_NAME || 'N/A', NAZWA: chapter.WORLD_NAME || 'N/A', OPIS: 'Brak detali w bazie.'};

    // ZMIANA: Dodajemy char-detail-item do sekcji świata, aby uzyskać analogiczny styl
    if (worldInfoDetail) worldInfoDetail.innerHTML = `
        <div class="char-detail-item" style="margin-bottom: 0;">
            <p><strong>Węzeł:</strong> ${currentWorld.NAZWA}</p>
            <p><strong>Opis:</strong> ${currentWorld.OPIS || 'Brak opisu.'}</p>
            <a href="world_details.html?id=${currentWorld.ID}">Zobacz Historię Węzła &rarr;</a>
        </div>
    `;
}

// ZMIANA: POPRAWIONA FUNKCJA renderCharacterDetails (ASYNC)
async function renderCharacterDetails(data) {
    const { latestDetails, chaptersHistory } = data;
    
    // --- Nowe: Pobranie wszystkich rozdziałów do uzyskania streszczeń ---
    const dashboardData = await fetchDashboardData();
    const chapterSummaries = dashboardData?.chapters?.latestChapters || [];
    
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) pageTitle.textContent = `Szczegóły Postaci: ${latestDetails.IMIE}`;
    
    const mainContent = document.getElementById('character-details-content');
    const historyContainer = document.getElementById('chapter-history-container');
    
    // --- Ustawienie linku edycji ---
    const editLink = document.getElementById('edit-link');
    if (editLink) editLink.href = `character_add.html?id=${latestDetails.ID}`; 

    // --- 1. Render Głównych Danych ---
    mainContent.innerHTML = `
        <h3 style="margin: 0; font-size: 1.5em; color: #333;">Główne Dane</h3>
        <p style="margin-top: 10px;"><strong>ID Postaci:</strong> ${latestDetails.ID}</p>
        <p><strong>Ostatni Status:</strong> ${latestDetails.SZCZEGOLY?.status || 'N/A'}</p>
        <p><strong>Typ:</strong> ${latestDetails.SZCZEGOLY?.typ || 'N/A'}</p>
        <p><strong>Data Ost. Zmiany:</strong> ${new Date(latestDetails.DATA_DODANIA).toLocaleString('pl-PL')}</p>
    `;

    // --- 2. Przetwarzanie i Renderowanie Historii Rozdziałów ---

    // Sortowanie chronologiczne (najstarszy rozdział pierwszy: CH-1, CH-2...)
    chaptersHistory.sort((a, b) => {
        const numA = parseInt(a.chapterId.replace('CH-', ''));
        const numB = parseInt(b.chapterId.replace('CH-', ''));
        return numA - numB; 
    });

    if (chaptersHistory.length === 0) {
        historyContainer.innerHTML = `<p>Brak historii w rozdziałach.</p>`;
        return;
    }

    historyContainer.innerHTML = '';
    
    for (const chapter of chaptersHistory) {
        const chapterId = chapter.chapterId;
        const chapterNumber = chapterId.replace('CH-', '');
        
        // Znajdowanie streszczenia
        const chapterDetail = chapterSummaries.find(c => c.CHAPTER_ID === chapterId);
        const summary = chapterDetail?.SUMMARY || 'Brak streszczenia dla tego rozdziału.';
        
        // Bierzemy najnowszą wersję w ramach TEGO rozdziału
        const latestChapterVersion = chapter.versions.sort((a, b) => new Date(b.versionTimestamp) - new Date(a.versionTimestamp))[0];
        
        let sceneBoxesHtml = ''; 
        let scenes = []; 
        
        // FIX: Deklarujemy 'scenes' poza blokiem try/catch, aby była dostępna do licznika
        
        try {
            // Asynchroniczne ładowanie scen dla każdego rozdziału
            scenes = await fetchChapterScenes(chapter.chapterId);
            
            // Render Sceny jako osobne, zwinięte ramki (poza boxem rozdziału)
            if (scenes.length > 0) {
                scenes.forEach(scene => {
                    // Render każdej sceny jako osobną, zwiniętą ramkę
                    sceneBoxesHtml += `
                        <div class="char-detail-item scene-item-standalone">
                            <details>
                                <summary style="cursor: pointer; color: #007bff; font-weight: 500;">
                                    ${scene.TYTUL_SCENY || 'Scena Bez Tytułu'}
                                </summary>
                                <p class="scene-description" style="margin-top: 5px;">
                                    ${scene.OPIS_SCENY || 'Brak opisu.'}
                                </p>
                            </details>
                        </div>
                    `;
                });
            }
        } catch (error) {
            sceneBoxesHtml = `<p style="color: red; font-size: 0.9em;">Błąd ładowania scen: ${error.message.substring(0, 50)}...</p>`;
            scenes = []; 
        }

        // Renderowanie Pojedynczego Boksu Rozdziału (Poziomego)
        const fullChapterBlock = `
            <div class="chapter-history-block-vertical">
                <div class="chapter-box-horizontal">
                    <h5>ROZDZIAŁ ${chapterNumber} (${chapterDetail?.TITLE || 'Brak Tytułu'})</h5>
                    
                    <p class="chapter-summary-text">${summary}</p>
                    
                    <hr class="chapter-separator-line">

                    <div class="chapter-char-context">
                        <p><strong>Rola:</strong> ${latestChapterVersion.rola_w_rozdziale}</p>
                        <p><strong>Status:</strong> ${latestChapterVersion.szczegoly?.status || 'N/A'}</p>
                    </div>
                </div>
                
                <div class="chapter-scenes-list-wrapper">
                    ${sceneBoxesHtml}
                </div>
            </div>
        `;
        historyContainer.innerHTML += fullChapterBlock;
    }
}

// ZMIANA: PRZEPISANA FUNKCJA renderWorldDetails (ASYNC)
async function renderWorldDetails(data) {
    const { latestDetails, chaptersHistory } = data;

    // --- Nowe: Pobranie wszystkich rozdziałów do uzyskania streszczeń ---
    const dashboardData = await fetchDashboardData();
    const chapterSummaries = dashboardData?.chapters?.latestChapters || [];
    
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) pageTitle.textContent = `Szczegóły Węzła: ${latestDetails.NAZWA}`;
    
    const mainContent = document.getElementById('world-details-content');
    const historyContainer = document.getElementById('chapter-history-container');
    
    // --- Ustawienie linku edycji ---
    const editLink = document.getElementById('edit-link');
    // Zakładamy, że link edycji będzie prowadził do strony opartej na ID świata
    if (editLink) editLink.href = `world_add.html?id=${latestDetails.ID}`; 

    // --- 1. Render Głównych Danych ---
    // Główna zawartość jest renderowana do #world-details-content (obok zdjęcia)
    mainContent.innerHTML = `
        <h3 style="margin: 0; font-size: 1.5em; color: #333;">Główne Dane Węzła</h3>
        <p style="margin-top: 10px;"><strong>ID Węzła:</strong> ${latestDetails.ID}</p>
        <p><strong>Aktualny Opis:</strong> ${latestDetails.OPIS || 'Brak opisu.'}</p>
        <p><strong>Data Ost. Aktualizacji:</strong> ${new Date(latestDetails.DATA_DODANIA).toLocaleString('pl-PL')}</p>
    `;

    // --- 2. Przetwarzanie i Renderowanie Historii Rozdziałów ---

    // Sortowanie chronologiczne (najstarszy rozdział pierwszy: CH-1, CH-2...)
    chaptersHistory.sort((a, b) => {
        const numA = parseInt(a.chapterId.replace('CH-', ''));
        const numB = parseInt(b.chapterId.replace('CH-', ''));
        return numA - numB; 
    });

    if (chaptersHistory.length === 0) {
        historyContainer.innerHTML = `<p>Brak historii w rozdziałach.</p>`;
        return;
    }

    historyContainer.innerHTML = '';
    
    for (const chapter of chaptersHistory) {
        const chapterId = chapter.chapterId;
        const chapterNumber = chapterId.replace('CH-', '');
        
        // Znajdowanie streszczenia
        const chapterDetail = chapterSummaries.find(c => c.CHAPTER_ID === chapterId);
        const summary = chapterDetail?.SUMMARY || 'Brak streszczenia dla tego rozdziału.';
        
        // Bierzemy najnowszą wersję opisu świata w ramach TEGO rozdziału
        // W historyList (w backend/ DashboardDataResolver.mjs) pole to nazywa się DATA_WPROWADZENIA
        const latestWorldVersion = chapter.versions.sort((a, b) => new Date(b.versionTimestamp) - new Date(a.versionTimestamp))[0];
        
        let sceneBoxesHtml = ''; 
        let scenes = []; 
        
        try {
            // Asynchroniczne ładowanie scen dla każdego rozdziału
            scenes = await fetchChapterScenes(chapter.chapterId);
            
            // Render Sceny jako osobne, zwinięte ramki (poza boxem rozdziału)
            if (scenes.length > 0) {
                scenes.forEach(scene => {
                    // Render każdej sceny jako osobną, zwiniętą ramkę
                    sceneBoxesHtml += `
                        <div class="char-detail-item scene-item-standalone">
                            <details>
                                <summary style="cursor: pointer; color: #007bff; font-weight: 500;">
                                    ${scene.TYTUL_SCENY || 'Scena Bez Tytułu'}
                                </summary>
                                <p class="scene-description" style="margin-top: 5px;">
                                    ${scene.OPIS_SCENY || 'Brak opisu.'}
                                </p>
                            </details>
                        </div>
                    `;
                });
            }
        } catch (error) {
            sceneBoxesHtml = `<p style="color: red; font-size: 0.9em;">Błąd ładowania scen: ${error.message.substring(0, 50)}...</p>`;
            scenes = []; 
        }

        // Renderowanie Pojedynczego Boksu Rozdziału (Poziomego)
        const fullChapterBlock = `
            <div class="chapter-history-block-vertical">
                <div class="chapter-box-horizontal">
                    <h5>ROZDZIAŁ ${chapterNumber} (${chapterDetail?.TITLE || 'Brak Tytułu'})</h5>
                    
                    <p class="chapter-summary-text">${summary}</p>
                    
                    <hr class="chapter-separator-line">

                    <div class="chapter-char-context">
                        <p><strong>Opis Węzła:</strong> ${latestWorldVersion.opis || 'Brak opisu w kontekście tego rozdziału.'}</p>
                        <p class="metadata-line">Wprowadzono: ${new Date(latestWorldVersion.versionTimestamp).toLocaleDateString('pl-PL')}</p>
                    </div>
                </div>
                
                <div class="chapter-scenes-list-wrapper">
                    ${sceneBoxesHtml}
                </div>
            </div>
        `;
        historyContainer.innerHTML += fullChapterBlock;
    }
}

// Renderowanie detali postaci (Ewolucja) - Przekierowanie do nowej funkcji
// ...
// (Pozostała część pliku details_loader.js bez zmian)
// ...
