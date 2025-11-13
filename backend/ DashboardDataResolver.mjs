// Plik: index.mjs (DashboardDataResolver - Zmodyfikowany pod szczegóły postaci)

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(client);

// Tabele do pobrania danych
const CHAPTERS_TABLE = 'LLM_Chapters_V2';
const CHARACTERS_TABLE = 'LLM_Characters';

const headers = { 
    "Content-Type": "application/json",
    'Access-Control-Allow-Origin': '*', 
    'Access-Control-Allow-Methods': 'OPTIONS,GET',
    'Access-Control-Allow-Headers': 'Content-Type'
};

const getCharacterDetails = async (charId) => {
    // 1. POBIERANIE WSZYSTKICH HISTORYCZNYCH WERSJI POSTACI
    const params = {
        TableName: CHARACTERS_TABLE,
        KeyConditionExpression: "ID = :id",
        ExpressionAttributeValues: { ":id": charId },
        ScanIndexForward: false // Od najnowszej do najstarszej
    };

    const queryResult = await db.send(new QueryCommand(params));
    const allVersions = queryResult.Items || [];

    if (allVersions.length === 0) {
        return null;
    }

    // 2. PRZETWARZANIE DANYCH DO FORMATU GRUPOWANIA
    const latestDetails = allVersions[0]; // Najnowsza wersja to ogólny status

    const chaptersMap = {};

    allVersions.forEach(version => {
        const chapterId = version.SOURCE_CHAPTER_ID;
        const versionTimestamp = version.DATA_DODANIA;
        const role = version.ROLA_W_ROZDZIALE || 'N/A';
        const details = version.SZCZEGOLY || {};
        
        if (!chaptersMap[chapterId]) {
            chaptersMap[chapterId] = {
                chapterId: chapterId,
                versions: []
            };
        }

        chaptersMap[chapterId].versions.push({
            versionTimestamp: versionTimestamp,
            rola_w_rozdziale: role,
            szczegoly: details
        });
    });

    // Konwersja na listę rozdziałów
    const chaptersList = Object.values(chaptersMap);

    return {
        latestDetails: latestDetails,
        chaptersHistory: chaptersList
    };
};

export const handler = async (event) => {
    
    if (event.httpMethod === 'OPTIONS') { return { statusCode: 200, headers }; }

    try {
        const charId = event.queryStringParameters?.charId;
        
        // Jeśli podano charId, zwracamy szczegóły historyczne
        if (charId) {
            const details = await getCharacterDetails(charId);
            if (!details) {
                 return { statusCode: 404, headers, body: JSON.stringify({ error: "Postać nie znaleziona." }) };
            }
            return { statusCode: 200, headers, body: JSON.stringify(details) };
        }

        // --- Standardowy Dashboard Scan (dla głównego widoku) ---
        
        // 1. POBIERANIE DANYCH ROZDZIAŁÓW (Logika bez zmian)
        const chapterScan = await db.send(new ScanCommand({
            TableName: CHAPTERS_TABLE,
            ProjectionExpression: "CHAPTER_ID, #T, VERSION_TIMESTAMP, #S, CONTENT",
            ExpressionAttributeNames: { "#T": "TITLE", "#S": "STATUS" } 
        }));
        
        const allVersions = chapterScan.Items;
        
        const processChapterData = (items) => {
            const latestVersions = {};
            let totalCharacters = 0;

            items.forEach(item => {
                totalCharacters += item.CONTENT ? item.CONTENT.length : 0;
                const id = item.CHAPTER_ID;
                const timestamp = new Date(item.VERSION_TIMESTAMP).getTime();

                if (!latestVersions[id] || timestamp > new Date(latestVersions[id].VERSION_TIMESTAMP).getTime()) {
                    latestVersions[id] = item;
                }
            });

            const latestChapters = Object.values(latestVersions)
                .sort((a, b) => new Date(b.VERSION_TIMESTAMP) - new Date(a.VERSION_TIMESTAMP));

            return { latestChapters, totalCharacters };
        };

        const { latestChapters, totalCharacters } = processChapterData(allVersions);

        
        // 2. POBIERANIE DANYCH POSTACI (Uproszczona Projekcja) - Wymaga skanowania, aby zebrać unikalne ID
        // Ten scan może być wolny, ale jest potrzebny, by zebrać najnowsze unikalne rekordy
        const characterScan = await db.send(new ScanCommand({
            TableName: CHARACTERS_TABLE
        }));
        const allCharactersVersions = characterScan.Items;
        
        // Logika grupowania na potrzeby dashboardu
        const latestCharacters = {};
        allCharactersVersions.forEach(char => {
             const id = char.ID;
             const timestamp = new Date(char.DATA_DODANIA).getTime();
             
             if (!latestCharacters[id] || timestamp > new Date(latestCharacters[id].DATA_DODANIA).getTime()) {
                 latestCharacters[id] = char;
             }
        });

        const latestCharactersList = Object.values(latestCharacters);
        const totalCharactersCount = latestCharactersList.length;

        
        // 3. ZWRACANIE ZBIORCZEGO WIDOKU
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                chapters: {
                    count: latestChapters.length,
                    totalCharacters: totalCharacters,
                    lastUpdates: latestChapters.slice(0, 4)
                },
                characters: {
                    count: totalCharactersCount,
                    // Sortujemy bezpiecznie, traktując null/undefined jako puste stringi
                    list: latestCharactersList.sort((a, b) => {
                         const nameA = a.IMIE || '';
                         const nameB = b.IMIE || '';
                         return nameA.localeCompare(nameB);
                    }) 
                }
            })
        };

    } catch (error) {
        console.error("BŁĄD DASHBOARD RESOLVER:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: `BŁĄD BACKENDU: ${error.message}` }) };
    }
};
