const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const config = require('../config.json');

// Cooldown-Map für Nachrichten
const channelMessageCooldowns = new Map();
const COOLDOWN_TIME = 30000; // 30 Sekunden

module.exports = {
    name: Events.ChannelUpdate,
    async execute(oldChannel, newChannel) {
        console.log(`[DEBUG] Channel Update: ${newChannel.name} (Type: ${newChannel.type})`);
        
        // Nur bei Voice Channels reagieren
        if (newChannel.type !== ChannelType.GuildVoice) {
            console.log(`[DEBUG] Nicht Voice Channel, übersprungen`);
            return;
        }
        
        // Nur bei Channels die bearbeitet werden können
        if (!newChannel.manageable) {
            console.log(`[DEBUG] Channel nicht manageable, übersprungen`);
            return;
        }
        
        // Überprüfen ob sich die Berechtigungen geändert haben
        const permissionChanged = await hasPermissionChanged(oldChannel, newChannel);
        if (!permissionChanged) {
            console.log(`[DEBUG] Keine Berechtigungsänderungen, übersprungen`);
            return;
        }
        
        console.log(`[DEBUG] Berechtigungen geändert, verarbeite...`);
        
        // Cooldown überprüfen
        const cooldownKey = `update_${newChannel.id}`;
        const now = Date.now();
        
        if (channelMessageCooldowns.has(cooldownKey)) {
            const cooldownTime = channelMessageCooldowns.get(cooldownKey);
            if (now < cooldownTime) {
                console.log(`[DEBUG] Noch im Cooldown, übersprungen`);
                return;
            }
        }
        
        // Neuen Channel Owner ermitteln (Nutzer mit Berechtigung 1049600)
        const newChannelOwner = await getChannelOwner(newChannel);
        
        if (!newChannelOwner) {
            console.log(`[DEBUG] Kein neuer Channel Owner gefunden`);
            return;
        }
        
        console.log(`[DEBUG] Neuer Channel Owner: ${newChannelOwner.displayName}`);
        
        // Alten Channel Owner ermitteln
        const oldChannelOwner = await getChannelOwner(oldChannel);
        
        if (oldChannelOwner) {
            console.log(`[DEBUG] Alter Channel Owner: ${oldChannelOwner.displayName}`);
        }
        
        // Nur reagieren wenn sich der Owner tatsächlich geändert hat
        if (oldChannelOwner && newChannelOwner && oldChannelOwner.id === newChannelOwner.id) {
            console.log(`[DEBUG] Kein Owner-Wechsel, übersprungen`);
            return;
        }
        
        console.log(`[DEBUG] Owner-Wechsel erkannt, sende Nachricht...`);

        // Alte Nachricht suchen und löschen
        try {
            const messages = await newChannel.messages.fetch({ limit: 10 });
            const botMessage = messages.find(msg =>
                msg.author.id === newChannel.client.user.id &&
                msg.content.includes('||') && // A simple check for our specific message format
                msg.embeds.length > 0 &&
                msg.embeds[0].title === config.embeds.voiceOwner.title
            );

            if (botMessage) {
                await botMessage.delete();
                console.log(`[DEBUG] Alte Voice-Management-Nachricht gelöscht.`);
            }
        } catch (error) {
            console.error('[ERROR] Fehler beim Löschen der alten Nachricht:', error);
        }
        
        // Embed erstellen
        const embedConfig = config.embeds.voiceOwner;
        const embed = new EmbedBuilder()
            .setTitle(embedConfig.title)
            .setDescription(embedConfig.description.replace('{channel}', newChannel.toString()).replace('{owner}', newChannelOwner.toString()))
            .setColor(config.colors.success)
            .setFooter({ text: embedConfig.footer });
        
        // Buttons erstellen
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`voice_request_${newChannel.id}`)
                    .setLabel(config.buttons.sendRequest)
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`voice_edit_${newChannelOwner.id}_${newChannel.id}`)
                    .setLabel(config.buttons.editVoice)
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`voice_kick_${newChannelOwner.id}_${newChannel.id}`)
                    .setLabel(config.buttons.kickVoice)
                    .setStyle(ButtonStyle.Danger)
            );
        
        try {
            console.log(`[DEBUG] Versuche Nachricht zu senden...`);
            
            // Nachricht direkt in den Voice Channel senden
            const botPermissions = newChannel.permissionsFor(newChannel.guild.members.me);
            console.log(`[DEBUG] Bot Berechtigungen: ${botPermissions.bitfield.toString()}`);
            
            if (botPermissions.has(['SendMessages', 'ViewChannel'])) {
                await newChannel.send({
                	content: `||${newChannelOwner}||`,
                	embeds: [embed],
                	components: [row]
                });
                
                // Cooldown setzen
                channelMessageCooldowns.set(cooldownKey, now + COOLDOWN_TIME);
                
                console.log(`[SUCCESS] Voice Management Nachricht für geänderten Channel "${newChannel.name}" gesendet`);
            } else {
                console.log(`[ERROR] Keine Berechtigung zum Senden von Nachrichten in Voice Channel "${newChannel.name}"`);
                
                // Fallback: In einen Text Channel senden
                const textChannel = newChannel.guild.systemChannel ||
                    newChannel.guild.channels.cache.find(ch => ch.type === ChannelType.GuildText && ch.permissionsFor(newChannel.guild.members.me).has('SendMessages'));
                
                if (textChannel) {
                    await textChannel.send({
                        content: `📢 **Voice Channel Management für "${newChannel.name}" (Besitzer geändert)**`,
                        embeds: [embed],
                        components: [row]
                    });
                    console.log(`[FALLBACK] Nachricht in Text Channel "${textChannel.name}" gesendet`);
                    channelMessageCooldowns.set(cooldownKey, now + COOLDOWN_TIME);
                }
            }
        } catch (error) {
            console.error('[ERROR] Fehler beim Senden der Voice Management Nachricht für geänderten Channel:', error);
        }
    }
};

// Hilfsfunktion um zu überprüfen ob sich Berechtigungen geändert haben
async function hasPermissionChanged(oldChannel, newChannel) {
    try {
        const oldPermissions = oldChannel.permissionOverwrites.cache;
        const newPermissions = newChannel.permissionOverwrites.cache;
        
        // Überprüfen ob sich die Anzahl der Permission Overwrites geändert hat
        if (oldPermissions.size !== newPermissions.size) return true;
        
        // Überprüfen ob sich spezifische User-Berechtigungen geändert haben
        for (const [id, newOverwrite] of newPermissions) {
            if (newOverwrite.type === 1) { // User permission overwrite
                const oldOverwrite = oldPermissions.get(id);
                
                if (!oldOverwrite) return true; // Neuer User hinzugefügt
                
                // Überprüfen ob sich die Berechtigungen geändert haben
                if (oldOverwrite.allow.bitfield !== newOverwrite.allow.bitfield ||
                    oldOverwrite.deny.bitfield !== newOverwrite.deny.bitfield) {
                    return true;
                }
            }
        }
        
        // Überprüfen ob User entfernt wurden
        for (const [id, oldOverwrite] of oldPermissions) {
            if (oldOverwrite.type === 1 && !newPermissions.has(id)) {
                return true; // User wurde entfernt
            }
        }
        
        return false;
    } catch (error) {
        console.error('Fehler beim Überprüfen der Berechtigungsänderungen:', error);
        return false;
    }
}

// Hilfsfunktion um Channel Owner zu finden
async function getChannelOwner(channel) {
    try {
        const permissions = channel.permissionOverwrites.cache;
        console.log(`[DEBUG] Anzahl Permission Overwrites: ${permissions.size}`);
        
        for (const [id, overwrite] of permissions) {
            // Überprüfen ob es ein User ist (nicht Rolle oder Bot)
            if (overwrite.type === 1) { // User permission overwrite
                const member = await channel.guild.members.fetch(id).catch(() => null);
                if (member && !member.user.bot) {
                    // Überprüfen ob der User die spezifische Berechtigung 1049600 hat
                    const userPermissions = channel.permissionsFor(member);
                    console.log(`[DEBUG] User: ${member.displayName}, Berechtigungen: ${userPermissions.bitfield.toString()}`);
                    
                    // Prüfe ob die spezifische Berechtigung 1049600 enthalten ist (Bitwise AND)
                    const targetPermission = 1049600n;
                    if ((userPermissions.bitfield & targetPermission) === targetPermission) {
                        console.log(`[DEBUG] ✅ Channel Owner gefunden: ${member.displayName} (hat Berechtigung 1049600 in ${userPermissions.bitfield})`);
                        return member;
                    }
                    
                    console.log(`[DEBUG] User ${member.displayName} hat Berechtigungen ${userPermissions.bitfield}, Bitwise-Check: ${(userPermissions.bitfield & targetPermission)} === ${targetPermission} = ${(userPermissions.bitfield & targetPermission) === targetPermission}`);
                }
            }
        }
        
        console.log(`[DEBUG] ❌ Kein Channel Owner mit Berechtigung 1049600 gefunden`);
        return null;
    } catch (error) {
        console.error('[ERROR] Fehler beim Ermitteln des Channel Owners:', error);
        return null;
    }
}
