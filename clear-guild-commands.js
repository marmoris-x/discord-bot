const { REST, Routes } = require('discord.js');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'config.json');
const config = require(configPath);
const token = process.env.DISCORD_TOKEN;
const guildId = '973967293073743982'; // Der spezifische Server

if (!token) {
    console.error('Fehler: DISCORD_TOKEN wurde nicht in der .env-Datei gefunden.');
    process.exit(1);
}

// Extrahieren der Client-ID aus dem Token, falls nicht in config.json vorhanden
if (!config.clientId) {
    try {
        const clientId = Buffer.from(token.split('.')[0], 'base64').toString();
        console.log(`clientId wurde aus dem Token extrahiert: ${clientId}`);
        config.clientId = clientId;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log('clientId wurde in config.json gespeichert.');
    } catch (e) {
        console.error('Fehler: Der bereitgestellte Token ist ungültig. Konnte clientId nicht extrahieren.');
        process.exit(1);
    }
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log(`Starte das Löschen aller Guild-Befehle (/) für Server ${guildId} mit clientId: ${config.clientId}`);

        await rest.put(
            Routes.applicationGuildCommands(config.clientId, guildId),
            { body: [] },
        );

        console.log('Alle Guild-Befehle wurden erfolgreich gelöscht.');
    } catch (error) {
        console.error('Fehler beim Löschen der Guild-Befehle:', error);
    }
})();