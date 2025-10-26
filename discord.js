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
            .setTitle("Mr.Semicolon's Help Menu 🤖")
            .setDescription("Here is a full list of my commands. \n`<argument>` means it's required, `(@user)` means it's optional.")
            .addFields(
                // --- Coding Commands Category ---
                { name: "💻 **Coding Commands**", value: "Commands for developers and coders." },
                {
                    name: `${prefix}daily`,
                    value: "Manually fetches and posts today's LeetCode daily challenge.",
                    inline: false
                },
                {
                    name: `${prefix}leetcode <username> (or ${prefix}lc)`,
                    value: "Fetches a LeetCode user's profile stats, including ranking, reputation, and number of problems solved by difficulty.",
                    inline: false
                },
                {
                    name: `${prefix}github <username>`,
                    value: "Fetches a GitHub user's profile, showing their bio, followers, following count, and number of public repos.",
                    inline: false
                },

                // --- Utility & Fun Category ---
                { name: "🛠️ **Utility & Fun Commands**", value: "Other useful and fun commands." },
                {
                    name: `${prefix}ping`,
                    value: "Checks my response time to the Discord API. (Bot Latency vs. API Latency).",
                    inline: false
                },
                {
                    name: `${prefix}avatar (@user)`,
                    value: "Displays your own avatar. If you mention another user, it will show their avatar instead.",
                    inline: false
                },
                {
                    name: `${prefix}help`,
                    value: "Shows this help message. You're looking at it!",
                    inline: false
                }
            )
            .setFooter({ text: `Bot is online and ready! | ${prefix}command` });

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


    if (command === "leetcode" || command === "lc") {
        if (!args[0]) {
            return message.reply("Please provide a LeetCode username.\n`!leetcode [username]`");
        }

        const username = args[0];
        const LEETCODE_API_URL = "https://leetcode.com/graphql";

        // This is the GraphQL query to get user stats
        const query = `
      query getUserProfile($username: String!) {
        matchedUser(username: $username) {
          username
          profile {
            realName
            ranking
            reputation
          }
          submitStats: submitStatsGlobal {
            acSubmissionNum {
              difficulty
              count
            }
          }
        }
      }
    `;

        // These are the variables to pass into the query
        const variables = { username: username };

        try {
            const response = await axios.post(LEETCODE_API_URL, {
                query: query,
                variables: variables
            });

            const user = response.data.data.matchedUser;

            if (!user) {
                return message.reply("Couldn't find a LeetCode user with that name.");
            }

            // The stats are in an array, so we'll find them by name
            const all = user.submitStats.acSubmissionNum.find(s => s.difficulty === "All").count;
            const easy = user.submitStats.acSubmissionNum.find(s => s.difficulty === "Easy").count;
            const medium = user.submitStats.acSubmissionNum.find(s => s.difficulty === "Medium").count;
            const hard = user.submitStats.acSubmissionNum.find(s => s.difficulty === "Hard").count;

            const leetcodeEmbed = new EmbedBuilder()
                .setColor("#FFA116")
                .setTitle(`${user.username}'s LeetCode Stats`)
                .setURL(`https://leetcode.com/${user.username}`)
                .addFields(
                    { name: "Ranking", value: String(user.profile.ranking), inline: true },
                    { name: "Reputation", value: String(user.profile.reputation), inline: true },
                    { name: "Total Solved", value: `**${all}**`, inline: false },
                    { name: "Easy", value: String(easy), inline: true },
                    { name: "Medium", value: String(medium), inline: true },
                    { name: "Hard", value: String(hard), inline: true }
                );

            message.channel.send({ embeds: [leetcodeEmbed] });

        } catch (error) {
            message.reply("Something went wrong while fetching LeetCode data.");
            console.error("LeetCode User Error:", error.message);
        }
    }

    // Add All Above
});


app.get('/', (req, res) => { // <-- NEW
    res.send('Bot is alive and running!');
});

app.listen(port, () => { // <-- NEW
    console.log(`Web server is listening on port ${port}`);
});

client.login(process.env.DISCORD_TOKEN);