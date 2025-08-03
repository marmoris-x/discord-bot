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
        console.log(`[DEBUG] Ziel-Kategorie-ID: ${TARGET_CATEGORY_ID}`);

        // Nur auf Text- oder Ankündigungskanäle reagieren
        if (newChannel.type !== ChannelType.GuildText && newChannel.type !== ChannelType.GuildAnnouncement) {
            console.log(`[DEBUG] Kanal ignoriert - falscher Typ: ${newChannel.type}`);
            return;
        }

        // Prüfen, ob der Kanal die Zielkategorie verlassen hat
        if (oldChannel.parentId === TARGET_CATEGORY_ID && newChannel.parentId !== TARGET_CATEGORY_ID) {
            console.log(`[DEBUG] Kanal wurde aus Zielkategorie verschoben!`);
            const voiceChannelName = `voice-${newChannel.name}`;
            console.log(`[DEBUG] Suche nach Sprachkanal mit Name: ${voiceChannelName}`);
            
            const channels = await newChannel.guild.channels.fetch();
            console.log(`[DEBUG] Insgesamt ${channels.size} Kanäle auf dem Server gefunden`);
            
            const voiceChannel = channels.find(
                (ch) => ch.name === voiceChannelName && ch.type === ChannelType.GuildVoice
            );

            if (voiceChannel) {
                console.log(`[DEBUG] Sprachkanal gefunden: ${voiceChannel.name} (${voiceChannel.id})`);
                console.log(`[DEBUG] Sprachkanal Parent-ID: ${voiceChannel.parentId}`);
                console.log(`[DEBUG] Ist in Zielkategorie? ${voiceChannel.parentId === TARGET_CATEGORY_ID}`);
            } else {
                console.log(`[DEBUG] KEIN Sprachkanal mit dem Namen ${voiceChannelName} gefunden!`);
                // Liste alle Sprachkanäle auf für Debug
                const allVoiceChannels = channels.filter(ch => ch.type === ChannelType.GuildVoice);
                console.log(`[DEBUG] Alle verfügbaren Sprachkanäle:`);
                allVoiceChannels.forEach(vc => {
                    console.log(`[DEBUG]   - ${vc.name} (Parent: ${vc.parentId})`);
                });
            }

            // Nur fortfahren, wenn ein passender Sprachkanal in der Zielkategorie existiert(e)
            if (voiceChannel && voiceChannel.parentId === TARGET_CATEGORY_ID) {
                console.log(`[DEBUG] Versuche Sprachkanal zu löschen...`);
                try {
                    await voiceChannel.delete('Zugehöriger Textkanal wurde aus der Kategorie verschoben.');
                    console.log(`[Auto-Voice] Sprachkanal #${voiceChannel.name} wurde gelöscht (Kanal verschoben).`);
                } catch (error) {
                    console.error(`[Auto-Voice] Fehler beim Löschen des Sprachkanals #${voiceChannel.name}:`, error);
                }
            } else {
                console.log(`[DEBUG] Sprachkanal wird NICHT gelöscht - Bedingungen nicht erfüllt`);
            }
        } else {
            console.log(`[DEBUG] Kanal wurde NICHT aus Zielkategorie verschoben`);
            console.log(`[DEBUG] - Old parent === target: ${oldChannel.parentId === TARGET_CATEGORY_ID}`);
            console.log(`[DEBUG] - New parent !== target: ${newChannel.parentId !== TARGET_CATEGORY_ID}`);
        }
    },
};