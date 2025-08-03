const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder } = require('discord.js');
const config = require('../config.json');

// Cooldown Maps
const requestCooldowns = new Map();
const editCooldowns = new Map();
const REQUEST_COOLDOWN = 300000; // 5 Minuten
const EDIT_COOLDOWN = 60000; // 1 Minute

// Pending Requests Map
const pendingRequests = new Map();

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		// Slash Commands
		if (interaction.isChatInputCommand()) {
			const command = interaction.client.commands.get(interaction.commandName);

			if (!command) {
				console.error(`No command matching ${interaction.commandName} was found.`);
				return;
			}

			try {
				await command.execute(interaction);
			} catch (error) {
				console.error(error);
				await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
			}
			return;
		}

		// Button Interactions
		if (interaction.isButton()) {
			await handleButtonInteraction(interaction);
			return;
		}

		// Modal Submissions
		if (interaction.isModalSubmit()) {
			await handleModalSubmit(interaction);
			return;
		}

		// Select Menu Interactions
		if (interaction.isUserSelectMenu()) {
			await handleUserSelectMenu(interaction);
			return;
		}
	},
};

// Button Handler
async function handleButtonInteraction(interaction) {
	const customId = interaction.customId;

	try {
		if (customId.startsWith('voice_request_')) {
			await handleVoiceRequest(interaction);
		} else if (customId.startsWith('voice_edit_')) {
			await handleVoiceEdit(interaction);
		} else if (customId.startsWith('voice_kick_')) {
			await handleVoiceKick(interaction);
		} else if (customId.startsWith('request_accept_')) {
			await handleRequestAccept(interaction);
		} else if (customId.startsWith('request_decline_')) {
			await handleRequestDecline(interaction);
		} else if (customId.startsWith('join_voice_')) {
			await handleJoinVoice(interaction);
		} else if (customId.startsWith('delete_message_')) {
			await handleDeleteMessage(interaction);
		}
	} catch (error) {
		console.error('Fehler beim Verarbeiten der Button-Interaktion:', error);
		if (!interaction.replied && !interaction.deferred) {
			await interaction.reply({ content: config.messages.error, ephemeral: true });
		}
	}
}

// Voice Request Handler
async function handleVoiceRequest(interaction) {
	const userId = interaction.user.id;
	const now = Date.now();

	// Cooldown überprüfen
	if (requestCooldowns.has(userId)) {
		const cooldownTime = requestCooldowns.get(userId);
		if (now < cooldownTime) {
			const remainingTime = Math.ceil((cooldownTime - now) / 60000);
			const time = new Date(cooldownTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Vienna' });
			const message = config.messages.cooldown
				.replace('{minutes}', remainingTime)
				.replace('{time}', time);

			await interaction.reply({
				content: message,
				ephemeral: true
			});
			return;
		}
	}

	// Channel ID aus Button ID extrahieren
	const channelId = interaction.customId.split('_')[2];
	const targetVoiceChannel = interaction.guild.channels.cache.get(channelId);
	
	if (!targetVoiceChannel) {
		await interaction.reply({ content: config.messages.channelNotFound, ephemeral: true });
		return;
	}

	// Channel Owner ermitteln
	const channelOwners = await getChannelOwners(targetVoiceChannel);
	if (channelOwners.length === 0) {
		await interaction.reply({ content: config.messages.ownerNotFound, ephemeral: true });
		return;
	}

	if (channelOwners.some(owner => owner.id === userId)) {
		await interaction.reply({ content: config.messages.selfRequest, ephemeral: true });
		return;
	}

	const member = interaction.member;

	// Request Embed erstellen
	const requestEmbed = new EmbedBuilder()
		.setTitle(config.embeds.voiceRequest.title.replace('{user}', `${member.user.globalName || member.user.username} (${member.user.id})`))
		.setDescription(config.embeds.voiceRequest.description)
		.setColor(config.colors.warning);

	const requestRow = new ActionRowBuilder()
		.addComponents(
			new ButtonBuilder()
				.setCustomId(`request_accept_${userId}_${channelId}`)
				.setLabel(config.buttons.accept)
				.setStyle(ButtonStyle.Success),
			new ButtonBuilder()
				.setCustomId(`request_decline_${userId}_${channelId}`)
				.setLabel(config.buttons.decline)
				.setStyle(ButtonStyle.Danger)
		);

	// Request im Voice Channel des Besitzers senden
	try {
		await targetVoiceChannel.send({
			content: channelOwners.map(owner => `<@${owner.id}>`).join(' '),
			embeds: [requestEmbed],
			components: [requestRow]
		});

		// Cooldown setzen
		requestCooldowns.set(userId, now + REQUEST_COOLDOWN);

		// Pending Request speichern
		pendingRequests.set(userId, {
			requester: member,
			targetChannel: targetVoiceChannel,
			owners: channelOwners
		});

		await interaction.reply({
			content: config.messages.requestSent,
			ephemeral: true
		});
	} catch (error) {
		console.error('Fehler beim Senden der Anfrage:', error);
		await interaction.reply({
			content: config.messages.error,
			ephemeral: true
		});
	}
}

// Voice Edit Handler
async function handleVoiceEdit(interaction) {
	const customIdParts = interaction.customId.split('_');
	const ownerId = customIdParts[2];
	const channelId = customIdParts[3];
	
	if (interaction.user.id !== ownerId) {
		await interaction.reply({
			content: config.messages.actionNotAllowed.replace('{owner}', `<@${ownerId}>`),
			ephemeral: true
		});
		return;
	}


	const voiceChannel = interaction.guild.channels.cache.get(channelId);
	
	if (!voiceChannel) {
		await interaction.reply({ content: config.messages.channelNotFound, ephemeral: true });
		return;
	}

	// Modal erstellen
	const modal = new ModalBuilder()
		.setCustomId(`voice_edit_modal_${channelId}`)
		.setTitle(config.modals.editVoice.title);

	const nameInput = new TextInputBuilder()
		.setCustomId('channel_name')
		.setLabel(config.modals.editVoice.nameLabel)
		.setStyle(TextInputStyle.Short)
		.setValue(voiceChannel.name)
		.setMaxLength(100)
		.setRequired(true);

	const limitInput = new TextInputBuilder()
		.setCustomId('channel_limit')
		.setLabel(config.modals.editVoice.limitLabel)
		.setStyle(TextInputStyle.Short)
		.setValue(voiceChannel.userLimit.toString())
		.setMaxLength(2)
		.setRequired(true);

	const nameRow = new ActionRowBuilder().addComponents(nameInput);
	const limitRow = new ActionRowBuilder().addComponents(limitInput);

	modal.addComponents(nameRow, limitRow);

	await interaction.showModal(modal);
}

// Voice Kick Handler
async function handleVoiceKick(interaction) {
	const customIdParts = interaction.customId.split('_');
	const ownerId = customIdParts[2];
	const channelId = customIdParts[3];
	
	if (interaction.user.id !== ownerId) {
		await interaction.reply({
			content: config.messages.actionNotAllowed.replace('{owner}', `<@${ownerId}>`),
			ephemeral: true
		});
		return;
	}

	const voiceChannel = interaction.guild.channels.cache.get(channelId);
	
	if (!voiceChannel) {
		await interaction.reply({ content: config.messages.channelNotFound, ephemeral: true });
		return;
	}

	const membersInChannel = voiceChannel.members.filter(m => !m.user.bot && m.id !== ownerId);

	if (membersInChannel.size === 0) {
		await interaction.reply({ content: config.messages.noUsersToKick, ephemeral: true });
		return;
	}

	// User Select Menu erstellen
	const userSelect = new UserSelectMenuBuilder()
		.setCustomId(`kick_user_select_${channelId}`)
		.setPlaceholder(config.buttons.kickVoice)
		.setMinValues(1)
		.setMaxValues(1);

	const selectRow = new ActionRowBuilder().addComponents(userSelect);

	await interaction.reply({
		content: 'Wähle einen User aus deinem Voice Channel zum Kicken:',
		components: [selectRow],
		ephemeral: true
	});
}

// Modal Submit Handler
async function handleModalSubmit(interaction) {
	if (interaction.customId.startsWith('voice_edit_modal_')) {
		const channelId = interaction.customId.split('_')[3];
		const voiceChannel = interaction.guild.channels.cache.get(channelId);

		if (!voiceChannel) {
			await interaction.reply({ content: config.messages.channelNotFound, ephemeral: true });
			return;
		}

		const newName = interaction.fields.getTextInputValue('channel_name');
		const newLimit = parseInt(interaction.fields.getTextInputValue('channel_limit'));
		const oldName = voiceChannel.name;
		const oldLimit = voiceChannel.userLimit;

		if (isNaN(newLimit) || newLimit < 0 || newLimit > 99) {
			await interaction.reply({ content: config.messages.invalidLimit, ephemeral: true });
			return;
		}

		try {
			let changed = false;
			let replyMessage = config.messages.editSuccess;

			// Namen nur ändern, wenn er sich unterscheidet
			if (newName !== oldName) {
				const now = Date.now();
				if (editCooldowns.has(interaction.user.id)) {
					const cooldownTime = editCooldowns.get(interaction.user.id);
					if (now < cooldownTime) {
						const remainingTime = Math.ceil((cooldownTime - now) / 1000);
						await interaction.reply({
							content: config.messages.editCooldown.replace('{seconds}', remainingTime),
							ephemeral: true
						});
						return;
					}
				}
				await voiceChannel.setName(newName);
				editCooldowns.set(interaction.user.id, now + EDIT_COOLDOWN);
				replyMessage += `\n**Name:** ${newName}`;
				changed = true;
			}

			// Limit nur ändern, wenn es sich unterscheidet
			if (newLimit !== oldLimit) {
				await voiceChannel.setUserLimit(newLimit);
				replyMessage += `\n**Limit:** ${newLimit === 0 ? 'Unbegrenzt' : newLimit}`;
				changed = true;
			}

			if (changed) {
				await interaction.reply({
					content: replyMessage,
					ephemeral: true
				});
			} else {
				await interaction.reply({
					content: config.messages.noChanges,
					ephemeral: true
				});
			}
		} catch (error) {
			console.error('Fehler beim Bearbeiten des Voice Channels:', error);
			await interaction.reply({ content: config.messages.error, ephemeral: true });
		}
	}
}

// User Select Menu Handler
async function handleUserSelectMenu(interaction) {
	if (interaction.customId.startsWith('kick_user_select_')) {
		const selectedUserId = interaction.values[0];
		const channelId = interaction.customId.split('_')[3];
		const voiceChannel = interaction.guild.channels.cache.get(channelId);

		if (!voiceChannel) {
			await interaction.reply({ content: config.messages.channelNotFound, ephemeral: true });
			return;
		}

		const targetMember = voiceChannel.members.get(selectedUserId);
		if (!targetMember) {
			await interaction.reply({ content: config.messages.userNotInChannel, ephemeral: true });
			return;
		}

		try {
			await targetMember.voice.disconnect();
			await interaction.reply({
				content: config.messages.kickSuccess.replace('{user}', targetMember.displayName),
				ephemeral: true
			});
		} catch (error) {
			console.error('Fehler beim Kicken des Users:', error);
			await interaction.reply({ content: config.messages.kickError, ephemeral: true });
		}
	}
}

// Request Accept Handler
async function handleRequestAccept(interaction) {
	const customIdParts = interaction.customId.split('_');
	const requesterId = customIdParts[2];
	const channelId = customIdParts[3];
	const request = pendingRequests.get(requesterId);

	if (!request) {
		return interaction.update({ content: config.messages.requestNotFound, embeds: [], components: [] });
	}

	if (!request.owners.some(owner => owner.id === interaction.user.id)) {
		return interaction.reply({ content: config.messages.onlyOwner, ephemeral: true });
	}

	// Defer interaction and delete the original message
	await interaction.deferUpdate();
	await interaction.message.delete();

	const acceptEmbed = new EmbedBuilder()
		.setTitle(config.embeds.requestAccepted.title)
		.setDescription(config.embeds.requestAccepted.description)
		.setColor(config.colors.success);

	const joinRow = new ActionRowBuilder()
		.addComponents(
			new ButtonBuilder()
				.setCustomId(`join_voice_${requesterId}_${channelId}`)
				.setLabel(config.buttons.joinVoice)
				.setStyle(ButtonStyle.Primary)
		);

	// Mark request as accepted
	pendingRequests.set(requesterId, { ...request, accepted: true });

	// Send a new message pinging the requester in a spoiler
	await interaction.channel.send({
		content: `||<@${requesterId}>||`,
		embeds: [acceptEmbed],
		components: [joinRow]
	});

	// Send an ephemeral confirmation to the owner
	await interaction.followUp({ content: 'Die Anfrage wurde angenommen.', ephemeral: true });
}

// Request Decline Handler
async function handleRequestDecline(interaction) {
	const requesterId = interaction.customId.split('_')[2];
	const request = pendingRequests.get(requesterId);

	if (!request) {
		return interaction.update({ content: config.messages.requestNotFound, embeds: [], components: [] });
	}

	if (!request.owners.some(owner => owner.id === interaction.user.id)) {
		return interaction.reply({ content: config.messages.onlyOwner, ephemeral: true });
	}

	// Defer interaction and delete the original message
	await interaction.deferUpdate();
	await interaction.message.delete();

	const declineEmbed = new EmbedBuilder()
		.setTitle(config.embeds.requestDeclined.title)
		.setDescription(config.embeds.requestDeclined.description)
		.setColor(config.colors.danger);

	const deleteButton = new ButtonBuilder()
		.setCustomId(`delete_message_${requesterId}`)
		.setLabel(config.buttons.delete)
		.setStyle(ButtonStyle.Secondary);

	const row = new ActionRowBuilder().addComponents(deleteButton);

	// Send a new message pinging the requester in a spoiler
	await interaction.channel.send({
		content: `||<@${requesterId}>||`,
		embeds: [declineEmbed],
		components: [row]
	});

	// Remove the pending request
	pendingRequests.delete(requesterId);

	// Send an ephemeral confirmation to the owner
	await interaction.followUp({ content: 'Die Anfrage wurde abgelehnt.', ephemeral: true });
}

// Delete Message Handler
async function handleDeleteMessage(interaction) {
	const requesterId = interaction.customId.split('_')[2];

	if (interaction.user.id !== requesterId) {
		return interaction.reply({ content: 'Nur der Anfragesteller kann diese Nachricht löschen.', ephemeral: true });
	}

	try {
		await interaction.message.delete();
	} catch (error) {
		console.error('Fehler beim Löschen der Nachricht:', error);
		await interaction.reply({ content: 'Fehler beim Löschen der Nachricht.', ephemeral: true });
	}
}

// Join Voice Handler
async function handleJoinVoice(interaction) {
	const customIdParts = interaction.customId.split('_');
	const userId = customIdParts[2];
	const channelId = customIdParts[3];
	
	if (interaction.user.id !== userId) {
		await interaction.reply({ content: config.messages.notYourRequest, ephemeral: true });
		return;
	}

	const request = pendingRequests.get(userId);

	if (!request || !request.accepted) {
		await interaction.reply({ content: config.messages.requestNotFound, ephemeral: true });
		return;
	}

	const member = interaction.member;
	const currentVoiceChannel = member.voice.channel;

	if (!currentVoiceChannel) {
		await interaction.reply({
			content: config.messages.mustBeInVoice,
			ephemeral: true
		});
		return;
	}

	const targetChannel = interaction.guild.channels.cache.get(channelId);
	if (!targetChannel) {
		await interaction.reply({ content: config.messages.channelNotFound, ephemeral: true });
		return;
	}

	try {
		await member.voice.setChannel(targetChannel);
		pendingRequests.delete(userId);

		// Delete the "Join Voice" message after successful move
		await interaction.message.delete();

		await interaction.reply({
			content: config.messages.moveSuccess,
			ephemeral: true
		});
	} catch (error) {
		console.error('Fehler beim Verschieben des Users:', error);
		await interaction.reply({
			content: config.messages.moveError,
			ephemeral: true
		});
	}
}

// Hilfsfunktion um Channel Owner zu finden
async function getChannelOwners(channel) {
    const owners = [];
    try {
        const permissions = channel.permissionOverwrites.cache;
        const targetPermission = 1049600n;

        for (const [id, overwrite] of permissions) {
            if (overwrite.type === 1) { // User permission overwrite
                if ((overwrite.allow.bitfield & targetPermission) === targetPermission) {
                    const member = await channel.guild.members.fetch(id).catch(() => null);
                    if (member && !member.user.bot) {
                        owners.push(member);
                    }
                }
            }
        }
    } catch (error) {
        console.error('[ERROR] Fehler beim Ermitteln der Channel Owners:', error);
    }
    return owners;
}
