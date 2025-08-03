const { Events, ChannelType } = require('discord.js');

// Die spezifische Kategorie-ID, die überwacht werden soll
const TARGET_CATEGORY_ID = '974687871984361522';

module.exports = {
    name: Events.ChannelDelete,
    async execute(channel) {
        // Ignorieren, wenn der gelöschte Kanal nicht in der Zielkategorie war oder kein Text-/Ankündigungskanal war.
        if (
            channel.parentId !== TARGET_CATEGORY_ID ||
            (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)
        ) {
            return;
        }

        // Den Namen des zugehörigen Sprachkanals ableiten
        const voiceChannelName = `voice-${channel.name}`;

        // Den Sprachkanal im Server (Guild) suchen
        const voiceChannel = channel.guild.channels.cache.find(
            (ch) => ch.name === voiceChannelName && ch.type === ChannelType.GuildVoice
        );

        if (voiceChannel) {
            try {
                await voiceChannel.delete('Zugehöriger Textkanal wurde gelöscht.');
                console.log(`[Auto-Voice] Sprachkanal #${voiceChannel.name} wurde gelöscht.`);
            } catch (error) {
                console.error(`[Auto-Voice] Fehler beim Löschen des Sprachkanals #${voiceChannel.name}:`, error);
            }
        }
    },
};