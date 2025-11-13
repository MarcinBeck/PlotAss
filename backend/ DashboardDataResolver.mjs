import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(client);

// Tabele do pobrania danych
const CHAPTERS_TABLE = 'LLM_Chapters_V2';
const CHARACTERS_TABLE = 'LLM_Characters';
const WORLDS_TABLE = 'LLM_Worlds';
const PLOT_EVENTS_TABLE = 'LLM_PlotEvents'; // Tabela zdarzeń fabularnych

const headers = { 
    "Content-Type": "application/json",
    'Access-Control-Allow-Origin': '*', 
    'Access-Control-Allow-Methods': 'OPTIONS,GET',
    'Access-Control-Allow-Headers': 'Content-Type'
};

// === FUNKCJE POMOCNICZE (Detale) ===

const getCharacterDetails = async (charId) => {
    const params = {
        TableName: CHARACTERS_TABLE,
        Key: { "ID": charId } 
    };

    const queryResult = await db.send(new GetCommand(params));
    const mainRecord = queryResult.Item; 

    if (!mainRecord) {
        return null;
    }

    const chaptersMap = mainRecord.HISTORIA_ROZDZIALOW || {};
    const chaptersList = [];

    for (const chapterNumber in chaptersMap) {
        if (chaptersMap.hasOwnProperty(chapterNumber)) {
            chaptersList.push({
                chapterId: `CH-${chapterNumber}`, 
                versions: chaptersMap[chapterNumber].map(version => ({
                    versionTimestamp: version.DATA_WPROWADZENIA,
                    rola_w_rozdziale: version.ROLA_W_ROZDZIALE || 'N/A',
                    szczegoly: {
                        status: version.STATUS || 'N/A', 
                        typ: version.TYP || 'N/A'
                    }
                }))
            });
        }
    }

    return {
        latestDetails: mainRecord, 
        chaptersHistory: chaptersList
    };
};

const getWorldDetails = async (worldId) => {
    const params = {
        TableName: WORLDS_TABLE,
        Key: { "ID": worldId } 
    };

    const queryResult = await db.send(new GetCommand(params));
    const mainRecord = queryResult.Item; 

    if (!mainRecord) {
        return null;
    }

    const historyList = mainRecord.HISTORIA_ROZDZIALOW || [];
    const chaptersMap = {};

    historyList.forEach(version => {
        const chapterId = version.SOURCE_CHAPTER_ID;
        
        if (!chaptersMap[chapterId]) {
            chaptersMap[chapterId] = {
                chapterId: chapterId,
                versions: []
            };
        }

        chaptersMap[chapterId].versions.push({
            versionTimestamp: version.DATA_WPROWADZENIA,
            opis: version.OPIS, 
            rozdział_numer: version.ROZDZIAL_NUMER
        });
    });

    const chaptersList = Object.values(chaptersMap);

    return {
        latestDetails: mainRecord, 
        chaptersHistory: chaptersList
    };
};


// NOWA FUNKCJA: Pobieranie scen po ID rozdziału
const getSceneDetails = async (chapterId) => {
    // UWAGA: Używamy ScanCommand z filtrem, co jest wolne i drogie, 
    // ale działa na istniejącym schemacie LLM_PlotEvents bez GSI.
    const params = {
        TableName: PLOT_EVENTS_TABLE,
        FilterExpression: "SOURCE_CHAPTER_ID = :chapterId",
        ExpressionAttributeValues: {
            ":chapterId": chapterId
        }
    };
    
    const scanResult = await db.send(new ScanCommand(params));
    
    // Sortujemy sceny chronologicznie według numeru rozdziału (lub daty)
    // Zakładamy, że ROZDZIAL_NUMER zapewnia chronologię w danym rozdziale.
    const sortedScenes = (scanResult.Items || []).sort((a, b) => (a.ROZDZIAL_NUMER || 0) - (b.ROZDZIAL_NUMER || 0));

    return sortedScenes;
};


// === GŁÓWNY HANDLER LAMBDY ===

export const handler = async (event) => {
    
    if (event.httpMethod === 'OPTIONS') { return { statusCode: 200, headers }; }

    try {
        const charId = event.queryStringParameters?.charId;
        const worldId = event.queryStringParameters?.worldId;
        const chapterScenesId = event.queryStringParameters?.chapterScenesId; // NOWY PARAMETR
        
        // --- Obsługa Detali Postaci/Świata/Scen ---
        if (charId) {
            const details = await getCharacterDetails(charId);
            if (!details) { return { statusCode: 404, headers, body: JSON.stringify({ error: "Postać nie znaleziona." }) }; }
            return { statusCode: 200, headers, body: JSON.stringify(details) };
        }
        
        if (worldId) {
            const details = await getWorldDetails(worldId.toUpperCase()); 
            if (!details) { return { statusCode: 404, headers, body: JSON.stringify({ error: "Świat nie znaleziony." }) }; }
            return { statusCode: 200, headers, body: JSON.stringify(details) };
        }
        
        // NOWA OBSŁUGA SCEN
        if (chapterScenesId) {
            const scenes = await getSceneDetails(chapterScenesId);
            return { statusCode: 200, headers, body: JSON.stringify({ scenes }) };
        }


        // --- Standardowy Dashboard Scan ---
        
        // 1. POBIERANIE DANYCH ROZDZIAŁÓW
        const chapterScan = await db.send(new ScanCommand({
            TableName: CHAPTERS_TABLE,
            ProjectionExpression: "CHAPTER_ID, #T, VERSION_TIMESTAMP, #S, CONTENT, SUMMARY, CHARACTERS_LIST, WORLD_NAME, SCENES_COUNT", 
            ExpressionAttributeNames: { "#T": "TITLE", "#S": "STATUS" } 
        }));
        
        const allVersions = chapterScan.Items || [];
        
        const processChapterData = (items) => {
            const latestVersions = {};
            let totalCharacters = 0;

            items.forEach(item => {
                totalCharacters += item.CONTENT ? item.CONTENT.length : 0; // Używamy Content do statystyki
                const id = item.CHAPTER_ID;
                const timestamp = new Date(item.VERSION_TIMESTAMP).getTime();

                if (!latestVersions[id] || timestamp > new Date(latestVersions[id].VERSION_TIMESTAMP).getTime()) {
                    latestVersions[id] = {
                        ...item,
                        // Eksportujemy pola analityczne
                        CHARACTERS_LIST: item.CHARACTERS_LIST || [],
                        SCENES_COUNT: item.SCENES_COUNT || 0,
                        WORLD_NAME: item.WORLD_NAME
                    };
                }
            });

            const latestChapters = Object.values(latestVersions)
                .sort((a, b) => new Date(b.VERSION_TIMESTAMP) - new Date(a.VERSION_TIMESTAMP));

            return { latestChapters, totalCharacters };
        };

        const { latestChapters, totalCharacters } = processChapterData(allVersions);

        
        // 2. POBIERANIE DANYCH POSTACI
        const characterScan = await db.send(new ScanCommand({ TableName: CHARACTERS_TABLE }));
        const latestCharactersList = characterScan.Items || []; 
        const totalCharactersCount = latestCharactersList.length;
        
        // 3. POBIERANIE DANYCH ŚWIATÓW
        const worldScan = await db.send(new ScanCommand({
            TableName: WORLDS_TABLE,
            ProjectionExpression: "ID, NAZWA, DATA_DODANIA" 
        }));
        const latestWorldsList = worldScan.Items || [];
        const totalWorldsCount = latestWorldsList.length;


        // 4. ZWRACANIE ZBIORCZEGO WIDOKU
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                chapters: {
                    count: latestChapters.length,
                    totalCharacters: totalCharacters,
                    lastUpdates: latestChapters.slice(0, 4),
                    latestChapters: latestChapters // KLUCZOWY EKSPORT DLA details_loader
                },
                characters: {
                    count: totalCharactersCount,
                    list: latestCharactersList.sort((a, b) => (a.IMIE || '').localeCompare(b.IMIE || ''))
                },
                worlds: {
                    count: totalWorldsCount,
                    list: latestWorldsList.sort((a, b) => new Date(b.DATA_DODANIA) - new Date(a.DATA_DODANIA)).slice(0, 4)
                }
            })
        };

    } catch (error) {
        console.error("BŁĄD DASHBOARD RESOLVER:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: `BŁĄD BACKENDU: ${error.message}` }) };
    }
};
