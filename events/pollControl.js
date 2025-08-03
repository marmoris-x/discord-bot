const { Events, MessageType } = require('discord.js');

// Erlaubte Rollen für Umfragen
const ALLOWED_POLL_ROLES = [
    '1152365758039478375', // Umfragen zusätzlich freischalten
    '1314312121768743033', // Umfragen zusätzlich freischalten
    '1295090325538344990', // Umfragen freigeschaltet
    '979575516568911902',  // Umfragen freigeschaltet
    '975374626169438218',  // Umfragen freigeschaltet
    '1045748082798755911', // Umfragen freigeschaltet
    '1105937534091010158'  // Umfragen freigeschaltet
];

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Ignoriere Bot-Nachrichten
        if (message.author.bot) return;
        
        // Prüfe ob es sich um eine Umfrage handelt
        if (message.type === MessageType.Poll) {
            // Prüfe ob der User eine der erlaubten Rollen hat
            const member = message.member;
            if (!member) return;
            
            const hasAllowedRole = member.roles.cache.some(role => 
                ALLOWED_POLL_ROLES.includes(role.id)
            );
            
            // Wenn der User keine erlaubte Rolle hat, lösche die Umfrage
            if (!hasAllowedRole) {
                try {
                    await message.delete();
                    console.log(`[POLL BLOCKED] Umfrage von ${message.author.tag} (${message.author.id}) wurde gelöscht - keine Berechtigung`);
                    
                    // Optional: Sende eine ephemeral Nachricht an den User (geht nur bei Slash Commands)
                    // Hier könnten wir eine DM senden oder eine temporäre Nachricht im Channel
                    const warningMessage = await message.channel.send({
                        content: `<@${message.author.id}>, du hast keine Berechtigung, Umfragen zu erstellen. Diese wurde automatisch gelöscht.`
                    });
                    
                    // Lösche die Warnung nach 5 Sekunden
                    setTimeout(async () => {
                        try {
                            await warningMessage.delete();
                        } catch (error) {
                            console.error('Fehler beim Löschen der Warnmeldung:', error);
                        }
                    }, 5000);
                    
                } catch (error) {
                    console.error('Fehler beim Löschen der Umfrage:', error);
                }
            } else {
                console.log(`[POLL ALLOWED] Umfrage von ${message.author.tag} (${message.author.id}) wurde erlaubt`);
            }
        }
    },
};