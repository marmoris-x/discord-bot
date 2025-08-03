const { Events, ChannelType, PermissionsBitField, OverwriteType } = require('discord.js');

// Die spezifische Kategorie-ID, die überwacht werden soll
const TARGET_CATEGORY_ID = '974687871984361522';
const EXEMPT_ROLE_ID = '1401662527196364883';

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
            const originalPermissions = channel.permissionOverwrites.cache;
            const voiceChannelPermissions = [];

            // Übernehme @everyone und Benutzer-Berechtigungen vom Textkanal
            originalPermissions.forEach(overwrite => {
                if (overwrite.type === OverwriteType.Member || overwrite.id === channel.guild.roles.everyone.id) {
                    voiceChannelPermissions.push({
                        id: overwrite.id,
                        type: overwrite.type,
                        allow: overwrite.allow.bitfield,
                        deny: overwrite.deny.bitfield,
                    });
                }
            });

            // Füge die spezielle Rollenberechtigung für den Sprachkanal hinzu
            voiceChannelPermissions.push({
                id: EXEMPT_ROLE_ID,
                type: OverwriteType.Role,
                allow: new PermissionsBitField([
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.Connect,
                    PermissionsBitField.Flags.Speak,
                ]).bitfield,
                deny: new PermissionsBitField([
                    PermissionsBitField.Flags.SendMessages,
                ]).bitfield,
            });

            // Erstellt den zugehörigen Sprachkanal mit den neuen Berechtigungen
            const voiceChannel = await channel.guild.channels.create({
                name: `voice-${channel.name}`,
                type: ChannelType.GuildVoice,
                parent: channel.parentId,
                permissionOverwrites: voiceChannelPermissions,
            });
            console.log(`[Auto-Voice] Sprachkanal #${voiceChannel.name} für #${channel.name} erstellt.`);

            // Füge der neuen Rolle Berechtigungen zum TEXTKANAL hinzu (Sehen/Schreiben), damit sie die Nachricht lesen kann
            await channel.permissionOverwrites.edit(EXEMPT_ROLE_ID, {
                ViewChannel: true,
                SendMessages: true,
            });
            console.log(`[Auto-Voice] Berechtigungen für Rolle ${EXEMPT_ROLE_ID} im Textkanal #${channel.name} gesetzt.`);

            // Sende nach einer Sekunde die Willkommensnachricht
            setTimeout(async () => {
                try {
                    const messageContent = `Bitte beschreibe dein Anliegen.\nFalls ein verbaler Austausch erforderlich ist, kann folgender Sprachkanal verwendet werden:\n${voiceChannel}`;
                    await channel.send(messageContent);
                    console.log(`[Auto-Voice] Willkommensnachricht in #${channel.name} gesendet.`);
                } catch (e) {
                    console.error(`[Auto-Voice] Fehler beim Senden der Willkommensnachricht in #${channel.name}:`, e);
                }
            }, 1000);

        } catch (error) {
            console.error(`[Auto-Voice] Fehler beim Erstellen des Sprachkanals für #${channel.name}:`, error);
        }
    },
};