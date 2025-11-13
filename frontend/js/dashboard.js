import { fetchDashboardData } from './utils.js';

// === FUNKCJE DASHBOARDU ===

export async function initDashboard() {
    try {
        const data = await fetchDashboardData();
        
        updateChapterSection(data.chapters);
        updateCharacterSection(data.characters); 
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
    if (time) time.textContent = 'N/A'; 

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
