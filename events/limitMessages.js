const { Events, EmbedBuilder } = require('discord.js');
const config = require('../config.json');

// This will store the message counts for each user
// Structure: Map<userId, Map<channelId, { count: number, timestamp: number }>>
const userMessageCounts = new Map();

// Helper function to check if a timestamp is from the same day
// Helper function to check if a timestamp is from the same day in a specific timezone
// We use sv-SE locale because it gives a YYYY-MM-DD format.
function isSameDay(ts1, ts2, timeZone) {
    const formatter = new Intl.DateTimeFormat('sv-SE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: timeZone,
    });
    return formatter.format(ts1) === formatter.format(ts2);
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
        const timeZone = 'Europe/Vienna';

        if (!userMessageCounts.has(userId)) {
            userMessageCounts.set(userId, new Map());
        }

        const userChannels = userMessageCounts.get(userId);

        if (!userChannels.has(channelId) || !isSameDay(userChannels.get(channelId).timestamp, now, timeZone)) {
            userChannels.set(channelId, { count: 0, timestamp: now });
        }

        const userData = userChannels.get(channelId);

        if (userData.count >= limit) {
            // Limit reached
            await message.delete().catch(console.error);

            // Calculate next midnight in Vienna
            const now = new Date();
            // Get the offset between UTC and Vienna time. This handles DST automatically.
            const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
            const viennaDate = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Vienna' }));
            const offset = viennaDate.getTime() - utcDate.getTime();

            // Get midnight UTC of the next day
            const todayStr = new Intl.DateTimeFormat('sv-SE', { timeZone }).format(now);
            const tomorrowDateUTC = new Date(todayStr);
            tomorrowDateUTC.setDate(tomorrowDateUTC.getDate() + 1);

            // Adjust the UTC midnight time by the offset to get the correct Vienna midnight timestamp
            const timestamp = Math.floor((tomorrowDateUTC.getTime() - offset) / 1000);

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