// Plik: index.mjs (DashboardDataResolver - Zabezpieczenie przed błędami null)

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(client);

// Tabele do pobrania danych
const CHAPTERS_TABLE = 'LLM_Chapters_V2';
const CHARACTERS_TABLE = 'LLM_Characters';

export const handler = async (event) => {
    
    const headers = { 
        "Content-Type": "application/json",
        'Access-Control-Allow-Origin': '*', 
        'Access-Control-Allow-Methods': 'OPTIONS,GET',
        'Access-Control-Allow-Headers': 'Content-Type'
    };
    if (event.httpMethod === 'OPTIONS') { return { statusCode: 200, headers }; }

    try {
        // 1. POBIERANIE DANYCH ROZDZIAŁÓW
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

        
        // 2. POBIERANIE DANYCH POSTACI (Uproszczona Projekcja)
        const characterScan = await db.send(new ScanCommand({
            TableName: CHARACTERS_TABLE,
            ProjectionExpression: "ID, IMIE, A_DANE_OGOLNE" 
        }));
        const allCharacters = characterScan.Items;
        const totalCharactersCount = allCharacters.length;

        
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
                    // KLUCZOWA POPRAWKA: Sortujemy bezpiecznie, traktując null/undefined jako puste stringi
                    list: allCharacters.sort((a, b) => {
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
