import { Client, GatewayIntentBits } from 'discord.js';
import { AmberLinkManager } from 'amberlink'; // Update with the actual package name

// 1. Initialize Discord Client with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent
    ]
});

// 2. Initialize the AmberLink Manager
// Provides a more robust configuration with default volume and secure settings
const manager = new AmberLinkManager(client, {
    nodes: [
        {
            name: 'Primary Node',
            url: 'localhost:2333',
            password: 'youshallnotpass',
            secure: false
        }
    ],
    defaultVolume: 80,
});

// 3. Setup robust Event Listeners for the Manager
manager.on('nodeConnect', (node) => {
    console.log(`[AmberLink] Successfully connected to node: ${node.name}`);
});

manager.on('nodeError', (node, error) => {
    console.error(`[AmberLink] Node ${node.name} encountered an error:`, error.message);
});

manager.on('trackStart', (player, track) => {
    const channel = client.channels.cache.get(player.textChannel);
    if (channel && channel.isTextBased()) {
        channel.send(`🎵 Now playing: **${track.title}** by **${track.author}**`);
    }
});

manager.on('queueEnd', (player) => {
    const channel = client.channels.cache.get(player.textChannel);
    if (channel && channel.isTextBased()) {
        channel.send(`⏹️ Queue ended. Leaving the voice channel.`);
    }
    player.destroy(); // Clean up player instance to save resources
});

// 4. Handle Discord Bot Ready Event
client.once('ready', () => {
    console.log(`[Bot] Logged in successfully as ${client.user?.tag}`);
    // Initialize the manager with the bot's user ID
    if (client.user) {
        manager.init(client.user.id);
    }
});

// 5. Simple Command Handler
client.on('messageCreate', async (message) => {
    // Ignore bots and DM messages
    if (message.author.bot || !message.guild) return;
    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift()?.toLowerCase();

    if (command === 'play') {
        const query = args.join(' ');
        if (!query) {
            return message.reply('Please provide a song name or URL.');
        }

        const voiceChannel = message.member?.voice.channel;
        if (!voiceChannel) {
            return message.reply('You need to join a voice channel first!');
        }

        // Create the player instance for the guild
        const player = manager.create({
            guildId: message.guild.id,
            voiceChannel: voiceChannel.id,
            textChannel: message.channel.id,
            selfDeafen: true
        });

        // Connect to the voice channel if not already connected
        if (player.state !== 'CONNECTED') player.connect();

        try {
            // Search for the track using AmberLink's search
            const res = await manager.search(query, message.author);
            
            if (!res || !res.tracks || !res.tracks.length) {
                return message.reply('No results found for your query.');
            }

            const track = res.tracks[0];
            player.queue.add(track);
            message.reply(`Added **${track.title}** to the queue.`);

            // Start playback if the player isn't already playing
            if (!player.playing && !player.paused) {
                player.play();
            }
        } catch (error) {
            console.error('Error searching/playing track:', error);
            message.reply('There was an error trying to play that track.');
        }
    }
    
    if (command === 'stop') {
        const player = manager.players.get(message.guild.id);
        if (!player) return message.reply('Nothing is playing right now.');
        
        player.destroy();
        message.reply('Stopped the music and left the voice channel.');
    }
});

// Replace with your actual bot token or use process.env.DISCORD_TOKEN
client.login('YOUR_DISCORD_BOT_TOKEN');
