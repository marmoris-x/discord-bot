const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const config = require('../config.json');

// Cooldown-Map für Nachrichten
const channelMessageCooldowns = new Map();
const COOLDOWN_TIME = 30000; // 30 Sekunden

module.exports = {
    name: Events.ChannelCreate,
    async execute(channel) {
        console.log(`[DEBUG] Channel erstellt: ${channel.name} (Type: ${channel.type})`);
        
        // Nur bei Voice Channels reagieren
        if (channel.type !== ChannelType.GuildVoice) {
            console.log(`[DEBUG] Nicht Voice Channel, übersprungen`);
            return;
        }
        
        // Nur bei Channels die bearbeitet werden können
        if (!channel.manageable) {
            console.log(`[DEBUG] Channel nicht manageable, übersprungen`);
            return;
        }
        
        // Cooldown überprüfen
        const cooldownKey = `create_${channel.guild.id}`;
        const now = Date.now();
        
        if (channelMessageCooldowns.has(cooldownKey)) {
            const cooldownTime = channelMessageCooldowns.get(cooldownKey);
            if (now < cooldownTime) {
                console.log(`[DEBUG] Noch im Cooldown, übersprungen`);
                return;
            }
        }
        
        console.log(`[DEBUG] Suche nach Channel Owner mit Berechtigung 1049600...`);
        
        // Channel Owner ermitteln (Nutzer mit Berechtigung 1049600)
        const channelOwner = await getChannelOwner(channel);
        
        if (!channelOwner) {
            console.log(`[DEBUG] Kein Channel Owner gefunden`);
            return;
        }
        
        console.log(`[DEBUG] Channel Owner gefunden: ${channelOwner.displayName}`);
        
        // Embed erstellen
        const embedConfig = config.embeds.voiceOwner;
        const embed = new EmbedBuilder()
            .setTitle(embedConfig.title)
            .setDescription(embedConfig.description.replace('{channel}', channel.toString()).replace('{owner}', channelOwner.toString()))
            .setColor(config.colors.success)
            .setFooter({ text: embedConfig.footer });
        
        // Buttons erstellen
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`voice_request_${channel.id}`)
                    .setLabel(config.buttons.sendRequest)
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`voice_edit_${channelOwner.id}_${channel.id}`)
                    .setLabel(config.buttons.editVoice)
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`voice_kick_${channelOwner.id}_${channel.id}`)
                    .setLabel(config.buttons.kickVoice)
                    .setStyle(ButtonStyle.Danger)
            );
        
        try {
            console.log(`[DEBUG] Versuche Nachricht zu senden...`);
            
            // Nachricht direkt in den Voice Channel senden
            const botPermissions = channel.permissionsFor(channel.guild.members.me);
            console.log(`[DEBUG] Bot Berechtigungen: ${botPermissions.bitfield.toString()}`);
            console.log(`[DEBUG] Hat SendMessages: ${botPermissions.has('SendMessages')}`);
            console.log(`[DEBUG] Hat ViewChannel: ${botPermissions.has('ViewChannel')}`);
            
            if (botPermissions.has(['SendMessages', 'ViewChannel'])) {
                await channel.send({
                	content: `||${channelOwner}||`,
                	embeds: [embed],
                	components: [row]
                });
                
                // Cooldown setzen
                channelMessageCooldowns.set(cooldownKey, now + COOLDOWN_TIME);
                
                console.log(`[SUCCESS] Voice Management Nachricht für neuen Channel "${channel.name}" gesendet`);
            } else {
                console.log(`[ERROR] Keine Berechtigung zum Senden von Nachrichten in Voice Channel "${channel.name}"`);
                
                // Fallback: In einen Text Channel senden
                const textChannel = channel.guild.systemChannel ||
                    channel.guild.channels.cache.find(ch => ch.type === ChannelType.GuildText && ch.permissionsFor(channel.guild.members.me).has('SendMessages'));
                
                if (textChannel) {
                    await textChannel.send({
                        content: `📢 **Voice Channel Management für "${channel.name}"**`,
                        embeds: [embed],
                        components: [row]
                    });
                    console.log(`[FALLBACK] Nachricht in Text Channel "${textChannel.name}" gesendet`);
                    channelMessageCooldowns.set(cooldownKey, now + COOLDOWN_TIME);
                }
            }
        } catch (error) {
            console.error('[ERROR] Fehler beim Senden der Voice Management Nachricht für neuen Channel:', error);
        }
    }
};

// Hilfsfunktion um Channel Owner zu finden
async function getChannelOwner(channel) {
    try {
        const permissions = channel.permissionOverwrites.cache;
        console.log(`[DEBUG] Anzahl Permission Overwrites: ${permissions.size}`);
        
        for (const [id, overwrite] of permissions) {
            console.log(`[DEBUG] Überprüfe Overwrite für ID: ${id}, Type: ${overwrite.type}`);
            
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
                    
                    // Debug: Liste alle User mit Berechtigungen auf
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
