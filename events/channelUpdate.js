const { Events, ChannelType } = require('discord.js');

// Die spezifische Kategorie-ID, die überwacht werden soll
const TARGET_CATEGORY_ID = '974687871984361522';

module.exports = {
    name: Events.ChannelUpdate,
    async execute(oldChannel, newChannel) {
        console.log(`[DEBUG] channelUpdate Event ausgelöst für Kanal: ${newChannel.name} (${newChannel.id})`);
        console.log(`[DEBUG] Kanaltyp: ${newChannel.type}`);
        console.log(`[DEBUG] Alte Parent-ID: ${oldChannel.parentId}`);
        console.log(`[DEBUG] Neue Parent-ID: ${newChannel.parentId}`);

        // Nur auf Text- oder Ankündigungskanäle reagieren
        if (newChannel.type !== ChannelType.GuildText && newChannel.type !== ChannelType.GuildAnnouncement) {
            console.log(`[DEBUG] Kanal ignoriert - falscher Typ: ${newChannel.type}`);
            return;
        }

        // Prüfen, ob der Kanal die Zielkategorie verlassen hat ODER aus der Zielkategorie verschoben wurde
        if (oldChannel.parentId === TARGET_CATEGORY_ID && newChannel.parentId !== TARGET_CATEGORY_ID) {
            console.log(`[DEBUG] Kanal wurde AUS Zielkategorie ${TARGET_CATEGORY_ID} verschoben!`);
        } else if (oldChannel.parentId !== TARGET_CATEGORY_ID && newChannel.parentId !== TARGET_CATEGORY_ID) {
            console.log(`[DEBUG] Kanal wurde verschoben, aber war nie in Zielkategorie - suche trotzdem nach zugehörigem Sprachkanal`);
        } else {
            console.log(`[DEBUG] Kanal wurde NICHT aus Zielkategorie verschoben oder ist weiterhin in Zielkategorie`);
            return;
        }

        // Entferne nur "open" oder "closed", behalte aber die Nummer (z.B. "sonstiges-closed-0446" → "sonstiges-0446")
        const channelPattern = newChannel.name.replace(/-(?:open|closed)-/, '-');
        const voiceChannelName = `voice-${channelPattern}`;
        console.log(`[DEBUG] Suche nach Sprachkanal mit Name: ${voiceChannelName} in Zielkategorie ${TARGET_CATEGORY_ID}`);
        
        const channels = await newChannel.guild.channels.fetch();
        console.log(`[DEBUG] Insgesamt ${channels.size} Kanäle auf dem Server gefunden`);
        
        // Suche nach dem exakten Sprachkanal-Namen
        const voiceChannel = channels.find(
            (ch) => ch.name === voiceChannelName &&
                   ch.type === ChannelType.GuildVoice &&
                   ch.parentId === TARGET_CATEGORY_ID
        );

        if (voiceChannel) {
            console.log(`[DEBUG] Passender Sprachkanal in Zielkategorie gefunden: ${voiceChannel.name} (${voiceChannel.id})`);
            console.log(`[DEBUG] Versuche Sprachkanal zu löschen...`);
            try {
                await voiceChannel.delete('Zugehöriger Textkanal wurde aus der Kategorie verschoben.');
                console.log(`[Auto-Voice] Sprachkanal #${voiceChannel.name} wurde gelöscht (Kanal verschoben).`);
            } catch (error) {
                console.error(`[Auto-Voice] Fehler beim Löschen des Sprachkanals #${voiceChannel.name}:`, error);
            }
        } else {
            console.log(`[DEBUG] KEIN passender Sprachkanal ${voiceChannelName} in Zielkategorie ${TARGET_CATEGORY_ID} gefunden!`);
            // Liste alle Sprachkanäle in der Zielkategorie auf für Debug
            const targetVoiceChannels = channels.filter(ch =>
                ch.type === ChannelType.GuildVoice && ch.parentId === TARGET_CATEGORY_ID
            );
            console.log(`[DEBUG] Alle Sprachkanäle in Zielkategorie ${TARGET_CATEGORY_ID}:`);
            targetVoiceChannels.forEach(vc => {
                console.log(`[DEBUG]   - ${vc.name}`);
            });
        }
    },
};