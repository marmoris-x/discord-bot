const { Events, EmbedBuilder } = require('discord.js');
const config = require('../config.json');

// This will store the message counts for each user
// Structure: Map<userId, Map<channelId, { count: number, timestamp: number }>>
const userMessageCounts = new Map();

// Helper function to check if a timestamp is from the same day
function isSameDay(ts1, ts2) {
    const d1 = new Date(ts1);
    const d2 = new Date(ts2);
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
}

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot || !message.guild) return;

        const { channels, limit, dmEmbed } = config.messageLimiter;
        if (!channels.includes(message.channel.id)) return;

        const userId = message.author.id;
        const channelId = message.channel.id;
        const now = Date.now();

        if (!userMessageCounts.has(userId)) {
            userMessageCounts.set(userId, new Map());
        }

        const userChannels = userMessageCounts.get(userId);

        if (!userChannels.has(channelId) || !isSameDay(userChannels.get(channelId).timestamp, now)) {
            userChannels.set(channelId, { count: 0, timestamp: now });
        }

        const userData = userChannels.get(channelId);

        if (userData.count >= limit) {
            // Limit reached
            await message.delete().catch(console.error);

            const nextPostTime = new Date();
            nextPostTime.setHours(24, 0, 0, 0); // Next day at 00:00
            const timestamp = Math.floor(nextPostTime.getTime() / 1000);

            const embed = new EmbedBuilder()
                .setTitle(dmEmbed.title)
                .setDescription(
                    dmEmbed.description
                        .replace('{user}', `<@${userId}>`)
                        .replace('{limit}', limit)
                        .replace('{channel}', `<#${channelId}>`)
                        .replace('{timestamp}', `<t:${timestamp}:R>`)
                )
                .setColor(dmEmbed.color)
                .setFooter({ text: dmEmbed.footer.text, iconURL: dmEmbed.footer.iconURL })
                .setTimestamp();

            try {
                await message.author.send({ embeds: [embed] });
            } catch (error) {
                console.error(`Could not send DM to ${message.author.tag}.`, error);
            }
        } else {
            // Limit not reached yet
            userData.count++;
            userData.timestamp = now;
        }
    },
};