const { Events, ChannelType } = require('discord.js');

// Die spezifische Kategorie-ID, die überwacht werden soll
const TARGET_CATEGORY_ID = '974687871984361522';

module.exports = {
    name: Events.ChannelUpdate,
    async execute(oldChannel, newChannel) {
        // Prüfen, ob der Kanal aus der Zielkategorie verschoben wurde.
        if (
            oldChannel.parentId === TARGET_CATEGORY_ID &&
            newChannel.parentId !== TARGET_CATEGORY_ID &&
            (newChannel.type === ChannelType.GuildText || newChannel.type === ChannelType.GuildAnnouncement)
        ) {
            // Den Namen des zugehörigen Sprachkanals ableiten
            const voiceChannelName = `voice-${newChannel.name}`;

            // Den Sprachkanal im Server (Guild) suchen
            const voiceChannel = newChannel.guild.channels.cache.find(
                (ch) => ch.name === voiceChannelName && ch.type === ChannelType.GuildVoice
            );

            if (voiceChannel) {
                try {
                    await voiceChannel.delete('Zugehöriger Textkanal wurde aus der Kategorie verschoben.');
                    console.log(`[Auto-Voice] Sprachkanal #${voiceChannel.name} wurde gelöscht (Kanal verschoben).`);
                } catch (error) {
                    console.error(`[Auto-Voice] Fehler beim Löschen des Sprachkanals #${voiceChannel.name}:`, error);
                }
            }
        }
    },
};