require("dotenv").config();
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js"); // <-- Added EmbedBuilder for cooler messages
const cron = require("node-cron");
const axios = require("axios");
const express = require("express");
const app = express(); // <-- NEW
const port = process.env.PORT || 3000; // <-- NEW

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
})

async function postDailyChallenge(client) {
    try {
        console.log("Fetching daily challenge...");
        const response = await axios.post("https://leetcode.com/graphql", {
            query: `
             query {
               activeDailyCodingChallengeQuestion {
                 question {
                   title
                   titleSlug
                   difficulty
                 }
               }
             }
           `
        });

        const q = response.data.data.activeDailyCodingChallengeQuestion.question;
        const msg = `💡 **${q.title}** (${q.difficulty})\n🔗 https://leetcode.com/problems/${q.titleSlug}`;

        const channel = await client.channels.fetch(process.env.CHANNEL_ID);
        channel.send(msg);
        console.log("📢 Posted daily LeetCode challenge!");
        return true; // Return true on success

    } catch (error) {
        console.error("❌ Error fetching challenge:", error.message);
        return false; // Return false on error
    }
}


client.once("clientReady", () => {
    console.log(`Logged In as ${client.user.tag}`);

    // 1. CRON JOB (The Timer)
    // This will call your function every day at 9 AM
    cron.schedule("0 9 * * *", () => {
        console.log("Cron job running...");
        postDailyChallenge(client); // <-- Just calls the function now
    }, {
        timezone: "Asia/Kolkata" // <-- Good practice to set your timezone!
    });
})

client.on("messageCreate", async (message) => { // <-- Made this async
    if (message.author.bot) return;

    // Use a prefix to make commands cleaner
    const prefix = "!";
    if (!message.content.startsWith(prefix)) return;

    // Get the command and arguments
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // ===============
    // COMMANDS
    // ===============

    if (command === "ping") {
        const reply = await message.reply("Pinging...");
        const botLatency = reply.createdTimestamp - message.createdTimestamp;
        const apiLatency = Math.round(client.ws.ping);
        reply.edit(`🏓 Pong!\n**Bot Latency:** ${botLatency}ms\n**API Latency:** ${apiLatency}ms`);
    }

    if (command === "daily") {
        message.reply("💡 On it! Fetching today’s LeetCode challenge...");
        const success = await postDailyChallenge(client); // <-- Calls the same function
        if (!success) {
            message.channel.send("Sorry, I couldn't fetch the challenge. Please check the logs.");
        }
    }


    if (command === "help") {
        const helpEmbed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle("Mr.Semicolon's Commands")
            .setDescription("Here is what I can do:")
            .addFields(
                { name: `${prefix}ping`, value: "Checks my speed (latency)." },
                { name: `${prefix}daily`, value: "Manually posts the LeETCode daily challenge." },
                { name: `${prefix}avatar`, value: "Shows your (or a mentioned user's) avatar." },
                { name: `${prefix}github`, value: "Fetches a GitHub user's profile." }, // <-- Added github to help
                { name: `${prefix}help`, value: "Shows this help message." }
            );
        message.channel.send({ embeds: [helpEmbed] });
    }

    if (command === "avatar") {
        const user = message.mentions.users.first() || message.author; // Get mentioned user or message author
        const avatarEmbed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle(`${user.username}'s Avatar`)
            .setImage(user.displayAvatarURL({ dynamic: true, size: 256 }));
        message.channel.send({ embeds: [avatarEmbed] });
    }

    // Add this inside your "messageCreate" event listener
    if (command === "github") {
        if (!args[0]) {
            return message.reply("Please provide a GitHub username.\n`!github [username]`");
        }

        const username = args[0];
        const apiUrl = `https://api.github.com/users/${username}`;

        try {
            const response = await axios.get(apiUrl, {
                headers: {
                    'User-Agent': 'Mr.SemicolonBot',
                    'Authorization': `token ${process.env.GITHUB_TOKEN}`
                }
            });
            const user = response.data;

            // Create a nice embed message
            const githubEmbed = new EmbedBuilder()
                .setColor("#181717")
                .setTitle(user.name || user.login)
                .setURL(user.html_url)
                .setThumbnail(user.avatar_url)
                .setDescription(user.bio || "No bio provided.")
                .addFields(
                    { name: "Followers", value: String(user.followers), inline: true },
                    { name: "Following", value: String(user.following), inline: true },
                    { name: "Public Repos", value: String(user.public_repos), inline: true }
                )
                .setFooter({ text: `Joined: ${new Date(user.created_at).toLocaleDateString()}` });

            message.channel.send({ embeds: [githubEmbed] });

        } catch (error) {
            if (error.response && error.response.status === 404) {
                message.reply("Couldn't find a GitHub user with that name.");
            } else {
                message.reply("Something went wrong while fetching GitHub data.");
                console.error(error);
            }
        }
    }

});

app.get('/', (req, res) => { // <-- NEW
    res.send('Bot is alive and running!');
});

app.listen(port, () => { // <-- NEW
    console.log(`Web server is listening on port ${port}`);
});

client.login(process.env.DISCORD_TOKEN);