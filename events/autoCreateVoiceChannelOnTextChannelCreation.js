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
            // Erstellt den Sprachkanal initial mit den Berechtigungen des Textkanals
            const voiceChannel = await channel.guild.channels.create({
                name: `voice-${channel.name}`,
                type: ChannelType.GuildVoice,
                parent: channel.parentId,
                permissionOverwrites: channel.permissionOverwrites.cache,
            });

            // Iteriere durch die Berechtigungen des NEUEN Sprachkanals und modifiziere sie
            for (const overwrite of voiceChannel.permissionOverwrites.cache.values()) {
                // Fall 1: Rollen-Berechtigung
                if (overwrite.type === OverwriteType.Role) {
                    // Lösche alle Rollen-Berechtigungen, außer @everyone und die Ausnahme-Rolle
                    if (overwrite.id !== EXEMPT_ROLE_ID && overwrite.id !== channel.guild.id) {
                        await overwrite.delete();
                    }
                }
                // Fall 2: Benutzer-Berechtigung
                else if (overwrite.type === OverwriteType.Member) {
                    const member = await channel.guild.members.fetch(overwrite.id).catch(() => null);
                    if (member && !member.user.bot) {
                        // Entziehe dem menschlichen Nutzer die Schreibrechte
                        await overwrite.edit({ SendMessages: false });
                    }
                }
            }

            // Setze die expliziten Rechte für die Ausnahme-Rolle im Sprachkanal
            await voiceChannel.permissionOverwrites.edit(EXEMPT_ROLE_ID, {
                ViewChannel: true,
                Connect: true,
                Speak: true,
            });
            console.log(`[Auto-Voice] Sprachkanal #${voiceChannel.name} für #${channel.name} erstellt.`);

            // Entziehe der Ausnahme-Rolle die Berechtigung, den TEXTKANAL zu sehen
            await channel.permissionOverwrites.edit(EXEMPT_ROLE_ID, {
                ViewChannel: false,
            });
            console.log(`[Auto-Voice] Ansichtsberechtigung für Rolle ${EXEMPT_ROLE_ID} im Textkanal #${channel.name} entzogen.`);

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