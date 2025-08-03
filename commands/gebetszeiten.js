const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('gebetszeiten')
		.setDescription('Zeigt die Gebetszeiten für eine Stadt an.')
		.addStringOption(option =>
			option.setName('land')
				.setDescription('Das Land auswählen.')
				.setRequired(true)
				.addChoices(
					{ name: 'Deutschland', value: 'Germany' },
					{ name: 'Österreich', value: 'Austria' },
					{ name: 'Schweiz', value: 'Switzerland' },
				))
		.addStringOption(option =>
			option.setName('stadt')
				.setDescription('Die Stadt eingeben.')
				.setRequired(true)),
	async execute(interaction) {
		const germanMonths = {
			"January": "Januar", "February": "Februar", "March": "März", "April": "April",
			"May": "Mai", "June": "Juni", "July": "Juli", "August": "August",
			"September": "September", "October": "Oktober", "November": "November", "December": "Dezember"
		};

		const germanWeekdays = {
			"Monday": "Montag", "Tuesday": "Dienstag", "Wednesday": "Mittwoch", "Thursday": "Donnerstag",
			"Friday": "Freitag", "Saturday": "Samstag", "Sunday": "Sonntag"
		};

		const stadt = interaction.options.getString('stadt');
		const landValue = interaction.options.getString('land');
		const landChoice = module.exports.data.options.find(opt => opt.name === 'land').choices.find(ch => ch.value === landValue);
		const landName = landChoice ? landChoice.name : landValue;

		await interaction.deferReply({ ephemeral: true });

		try {
			// Step 1: Geocode and verify the location
			const geocodeResponse = await axios.get('https://api.opencagedata.com/geocode/v1/json', {
				params: {
					q: `${stadt}, ${landName}`,
					key: process.env.OPENCAGE_API_KEY,
					language: 'de',
					limit: 1
				}
			});

			const location = geocodeResponse.data.results[0];

			if (!location || (!location.components.city && !location.components.town && !location.components.village)) {
				return interaction.editReply({ content: `Ich konnte die Stadt "${stadt}" in "${landName}" nicht eindeutig identifizieren. Bitte sei genauer oder überprüfe die Schreibweise.` });
			}

			const normalizedCity = location.components.city || location.components.town || location.components.village;
			const normalizedCountry = location.components.country;

			// Step 2: Get prayer times with the verified location
			const response = await axios.get(`https://api.aladhan.com/v1/timingsByAddress`, {
				params: {
					address: `${normalizedCity}, ${normalizedCountry}`,
                    method: 99,
                    methodSettings: '13.8,null,15',
                    shafaq: 'ahmer',
                    school: 0,
                    midnightMode: 1,
                    latitudeAdjustmentMethod: 3,
                    calendarMethod: 'MATHEMATICAL',
                    iso8601: false,
                    adjustment: 1
				}
			});

			const data = response.data.data;
			const timings = data.timings;
			const hijri = data.date.hijri;
			const gregorian = data.date.gregorian;

			const monthDE = germanMonths[gregorian.month.en] || gregorian.month.en;
			const weekdayDE = germanWeekdays[gregorian.weekday.en] || gregorian.weekday.en;

			const embed = new EmbedBuilder()
				.setColor(0xE6007E)
				.setTitle(`📅 Gebetszeiten für \`${gregorian.day}. ${monthDE} ${gregorian.year}\` in ${normalizedCity}, ${landName}`)
				.setDescription(
			                 `__Gebetszeiten bereitgestellt von MyMuslim Community__\n\n` +
			                 `Befehl: </${interaction.commandName}:${interaction.commandId}>\n\n` +
			                 `**🕋 Hijri**\n` +
			                 `\`${hijri.date}\`\n` +
			                 `\`${hijri.month.en} ${hijri.year} AH\`\n\n` +
			                 `**📆 Gregorianisch**\n` +
			                 `\`${gregorian.date}\`\n` +
			                 `\`${monthDE} ${gregorian.year} AD\`\n` +
			                 `\`${weekdayDE}\`\n\n` +
			                 '```\n' +
			                 `🌅 Fajr        ${timings.Fajr}\n` +
			                 `🌞 Shuruq      ${timings.Sunrise}\n` +
			                 `🕑 Dhuhr       ${timings.Dhuhr}\n` +
			                 `🕓 Asr         ${timings.Asr}\n` +
			                 `🌇 Maghrib     ${timings.Maghrib}\n` +
			                 `🌙 Isha        ${timings.Isha}\n` +
			                 `🕛 Mitternacht ${timings.Midnight}\n` +
			                 `🌓 1/3 Nacht   ${timings.Firstthird}\n` +
			                 `🌗 3/3 Nacht   ${timings.Lastthird}\n` +
			                 '```'
			             )
				.setFooter({ text: `Methode: \`Custom\` | Fajr: \`13.8\`° | Isha: \`15\`° | Zeitzone: \`${data.meta.timezone}\` | Stadt: ${stadt}` });
			
			const isPublic = interaction.channel.name.toLowerCase().includes('gebetszeiten');
			if (isPublic) {
				await interaction.deleteReply();
				await interaction.channel.send({ embeds: [embed] });
			} else {
				await interaction.editReply({ embeds: [embed] });
			}

		} catch (error) {
			console.error(error);
			// Check if the interaction is still editable before trying to edit it.
			if (!interaction.replied && !interaction.deferred) return;
			await interaction.editReply({ content: 'Es gab einen Fehler beim Abrufen der Gebetszeiten. Überprüfe die Stadt und das Land.' });
		}
	},
};