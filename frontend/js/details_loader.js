import { fetchDashboardData, DASHBOARD_API_ENDPOINT } from './utils.js';

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

// Pobieranie detali świata (przez dedykowany endpoint)
async function fetchWorldDetails(worldId) {
    const response = await fetch(`${DASHBOARD_API_ENDPOINT}?worldId=${worldId}`, { method: 'GET' });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(`BŁĄD API: ${data.error || 'Nieznany błąd.'}`);
    }
    return data;
}


// === FUNKCJE RENDEROWANIA ===

function renderError(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `<p style="color: red;">BŁĄD: ${message}</p>`;
    }
}

// Renderowanie detali rozdziału (Nowy Layout i dane analityczne)
function renderChapterDetails(data) {
    const { chapter, worldDetails } = data;
    
    const chapterNumber = chapter.CHAPTER_ID.replace('CH-', '');
    document.getElementById('page-title').textContent = `${chapterNumber}: ${chapter.TITLE}`;
    document.getElementById('edit-link').href = `chapter_add.html?step=1&id=${chapter.CHAPTER_ID}`;
    
    // Data dodania (pod nagłówkiem)
    document.getElementById('version-date').textContent = `Data dodania: ${new Date(chapter.VERSION_TIMESTAMP).toLocaleString('pl-PL')}`;
    
    // Streszczenie
    document.getElementById('summary-text').textContent = chapter.SUMMARY || 'Brak szczegółowego streszczenia.';

    // Boczna sekcja: Postacie
    const charListDetail = document.getElementById('character-list-detail');
    const characters = chapter.CHARACTERS_LIST || []; // Używamy CHARACTERS_LIST z backendu
    
    document.getElementById('char-count-display').textContent = characters.length;
    
    if (characters.length > 0) {
        charListDetail.innerHTML = '';

        characters.forEach(char => {
             const charName = char.imie || char;
             const charId = (charName || 'N/A').toUpperCase();

             charListDetail.innerHTML += `
                <a href="character_details.html?id=${charId}" class="char-box">
                    <strong>${charName}</strong>
                    Rola: ${char.rola_w_rozdziale || 'N/A'} <br>
                    Status: ${char.status || 'N/A'}
                </a>
             `;
        });
    } else {
         charListDetail.innerHTML = '<p>Brak zidentyfikowanych postaci.</p>';
    }

    // Boczna sekcja: Sceny
    const sceneListDetail = document.getElementById('scene-list-detail');
    const sceneCount = chapter.SCENES_COUNT || 0;
    document.getElementById('scene-count-display').textContent = sceneCount;
    
    if (sceneCount > 0) {
        // Generowanie placeholderów dla scen
        let sceneHtml = `<p><strong>${sceneCount}</strong> zidentyfikowanych scen:</p>`;

        // Pokaż max 5 placeholderów
        for(let i = 1; i <= Math.min(sceneCount, 5); i++) {
             sceneHtml += `<div class="detail-item">
                <a href="scene_details.html?id=SCENE-PLCHDR-${i}">Scena ${i}: (Tytuł/Opis Placeholder)</a>
             </div>`;
        }
        if (sceneCount > 5) {
            sceneHtml += `<p style="margin-top: 10px;">...i ${sceneCount - 5} więcej. <a href="scenes.html">Zobacz wszystkie &rarr;</a></p>`;
        }
        
        sceneListDetail.innerHTML = sceneHtml;
        
    } else {
         sceneListDetail.innerHTML = '<p>Brak zidentyfikowanych scen.</p>';
    }


    // Boczna sekcja: Świat
    const worldInfoDetail = document.getElementById('world-info-detail');
    const currentWorld = worldDetails?.latestDetails || {ID: chapter.WORLD_NAME || 'N/A', NAZWA: chapter.WORLD_NAME || 'N/A', OPIS: 'Brak detali w bazie.'};

    // Zmiana: Pełny opis, bez limitu znaków
    worldInfoDetail.innerHTML = `
        <p><strong>Węzeł:</strong> ${currentWorld.NAZWA}</p>
        <p><strong>Opis:</strong> ${currentWorld.OPIS || 'Brak opisu.'}</p>
        <a href="world_details.html?id=${currentWorld.ID}">Zobacz Historię Węzła &rarr;</a>
    `;
}

// Renderowanie detali postaci (Ewolucja)
function renderCharacterDetails(data) {
    const { latestDetails, chaptersHistory } = data;
    document.getElementById('page-title').textContent = `Szczegóły Postaci: ${latestDetails.IMIE}`;
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

    content.innerHTML = html;
}

function renderWorldDetails(data) {
    const { latestDetails, chaptersHistory } = data;
    document.getElementById('page-title').textContent = `Szczegóły Węzła: ${latestDetails.NAZWA}`;
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

    content.innerHTML = html;
}

// === FUNKCJA GŁÓWNA LOADERA ===
export async function loadDetailsPage(id, type) {
    document.getElementById('page-title').textContent = `Ładowanie szczegółów ${type}...`;
    const contentContainerId = `${type}-details-content`;

    try {
        if (type === 'chapter') {
            const details = await fetchChapterDetails(id);
            renderChapterDetails(details);
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
             document.getElementById('chapter-details-grid').innerHTML = `<p style="color: red; padding: 20px;">BŁĄD: ${error.message}</p>`;
        } else {
             renderError(contentContainerId, error.message);
        }
    }
}
