const { Events } = require('discord.js');

module.exports = {
	name: Events.TypingStart,
	execute(typing) {
		const user = typing.user;
		const channel = typing.channel;
		const time = new Date().toLocaleTimeString('de-DE');

		if (user.bot) return;

		// Prüfen, ob der Bot die Berechtigung hat, in diesem Kanal zu schreiben
		if (channel.permissionsFor(channel.guild.members.me).has('SendMessages')) {
			channel.send(`${user.username} started writing since ${time}`).catch(console.error);
		} else {
			console.log(`[WARNING] Missing 'SendMessages' permission in channel ${channel.id} on server ${channel.guild.name}.`);
		}
	},
};