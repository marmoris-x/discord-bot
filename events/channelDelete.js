const { Events, ChannelType } = require('discord.js');

// Die spezifische Kategorie-ID, die überwacht werden soll
const TARGET_CATEGORY_ID = '974687871984361522';

module.exports = {
    name: Events.ChannelDelete,
    async execute(channel) {
        console.log(`[DEBUG] channelDelete Event ausgelöst für Kanal: ${channel.name} (${channel.id})`);
        console.log(`[DEBUG] Kanaltyp: ${channel.type}`);

        // Nur auf Text- oder Ankündigungskanäle reagieren
        if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
            console.log(`[DEBUG] Kanal ignoriert - falscher Typ: ${channel.type}`);
            return;
        }

        // Extrahiere das Basis-Pattern (z.B. "sonstiges" aus "sonstiges-closed-0446")
        const channelPattern = channel.name.replace(/-(?:open|closed)-\d{4}$/, '');
        const voiceChannelPattern = `voice-${channelPattern}`;
        console.log(`[DEBUG] Suche nach Sprachkanal mit Pattern: ${voiceChannelPattern}-* in Zielkategorie ${TARGET_CATEGORY_ID}`);
        
        const channels = await channel.guild.channels.fetch();
        console.log(`[DEBUG] Insgesamt ${channels.size} Kanäle auf dem Server gefunden`);
        
        // Suche nach einem Sprachkanal, der dem Pattern entspricht
        const voiceChannel = channels.find(
            (ch) => ch.name.startsWith(voiceChannelPattern) &&
                   ch.type === ChannelType.GuildVoice &&
                   ch.parentId === TARGET_CATEGORY_ID
        );

        if (voiceChannel) {
            console.log(`[DEBUG] Passender Sprachkanal in Zielkategorie gefunden: ${voiceChannel.name} (${voiceChannel.id})`);
            console.log(`[DEBUG] Versuche Sprachkanal zu löschen...`);
            try {
                await voiceChannel.delete('Zugehöriger Textkanal wurde gelöscht.');
                console.log(`[Auto-Voice] Sprachkanal #${voiceChannel.name} wurde gelöscht.`);
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