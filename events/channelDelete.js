const { Events, ChannelType } = require('discord.js');

// Die spezifische Kategorie-ID, die überwacht werden soll
const TARGET_CATEGORY_ID = '974687871984361522';

module.exports = {
    name: Events.ChannelDelete,
    async execute(channel) {
        console.log(`[DEBUG] channelDelete Event ausgelöst für Kanal: ${channel.name} (${channel.id})`);
        console.log(`[DEBUG] Kanaltyp: ${channel.type}`);
        console.log(`[DEBUG] Parent-ID des gelöschten Kanals: ${channel.parentId}`);
        console.log(`[DEBUG] Ziel-Kategorie-ID: ${TARGET_CATEGORY_ID}`);

        // Nur auf Text- oder Ankündigungskanäle reagieren
        if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
            console.log(`[DEBUG] Kanal ignoriert - falscher Typ: ${channel.type}`);
            return;
        }

        const voiceChannelName = `voice-${channel.name}`;
        console.log(`[DEBUG] Suche nach Sprachkanal mit Name: ${voiceChannelName}`);
        
        const channels = await channel.guild.channels.fetch();
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

        // Nur fortfahren, wenn ein passender Sprachkanal in der Zielkategorie existiert
        if (voiceChannel && voiceChannel.parentId === TARGET_CATEGORY_ID) {
            console.log(`[DEBUG] Versuche Sprachkanal zu löschen...`);
            try {
                await voiceChannel.delete('Zugehöriger Textkanal wurde gelöscht.');
                console.log(`[Auto-Voice] Sprachkanal #${voiceChannel.name} wurde gelöscht.`);
            } catch (error) {
                console.error(`[Auto-Voice] Fehler beim Löschen des Sprachkanals #${voiceChannel.name}:`, error);
            }
        } else {
            console.log(`[DEBUG] Sprachkanal wird NICHT gelöscht - Bedingungen nicht erfüllt`);
        }
    },
};