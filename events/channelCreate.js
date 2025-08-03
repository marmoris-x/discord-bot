const { Events, ChannelType } = require('discord.js');

// Die spezifische Kategorie-ID, die überwacht werden soll
const TARGET_CATEGORY_ID = '974687871984361522';

module.exports = {
    name: Events.ChannelCreate,
    async execute(channel) {
        // Ignorieren, wenn der Kanal kein Text- oder Ankündigungskanal ist oder nicht in der Zielkategorie liegt.
        if (
            channel.parentId !== TARGET_CATEGORY_ID ||
            (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)
        ) {
            return;
        }

        try {
            // Erstellt den zugehörigen Sprachkanal
            await channel.guild.channels.create({
                name: `voice-${channel.name}`,
                type: ChannelType.GuildVoice,
                parent: channel.parentId,
                // Übernimmt die Berechtigungen vom ursprünglichen Kanal
                permissionOverwrites: channel.permissionOverwrites.cache,
            });
            console.log(`[Auto-Voice] Sprachkanal für #${channel.name} erstellt.`);
        } catch (error) {
            console.error(`[Auto-Voice] Fehler beim Erstellen des Sprachkanals für #${channel.name}:`, error);
        }
    },
};