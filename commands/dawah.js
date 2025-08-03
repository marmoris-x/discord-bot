const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dawah')
        .setDescription('Entfernt eine Rolle und fügt eine andere hinzu.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Der Benutzer, dessen Rollen aktualisiert werden sollen.')
                .setRequired(true)),
    async execute(interaction) {
        const requiredRoleId = '975374626169438218';
        const roleToRemoveId = '976264085660401685';
        const roleToAddId = '1091472701517991936';

        // Check if the member executing the command has the required role
        if (!interaction.member.roles.cache.has(requiredRoleId)) {
            return interaction.reply({ content: 'Du hast nicht die erforderliche Berechtigung, um diesen Befehl zu verwenden.', ephemeral: true });
        }

        const targetUser = interaction.options.getUser('user');
        const targetMember = await interaction.guild.members.fetch(targetUser.id);

        if (!targetMember) {
            return interaction.reply({ content: 'Benutzer nicht im Server gefunden.', ephemeral: true });
        }

        try {
            await interaction.deferReply({ ephemeral: true });

            // Remove the role
            if (targetMember.roles.cache.has(roleToRemoveId)) {
                await targetMember.roles.remove(roleToRemoveId);
            }

            // Add the new role
            if (!targetMember.roles.cache.has(roleToAddId)) {
                await targetMember.roles.add(roleToAddId);
            }

            await interaction.editReply({ content: `Rollen für ${targetUser.tag} wurden erfolgreich aktualisiert.` });

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: 'Es ist ein Fehler beim Aktualisieren der Rollen aufgetreten.' });
        }
    },
};