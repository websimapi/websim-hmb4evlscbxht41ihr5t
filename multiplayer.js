import { gameState, player, room } from './game.js';
import { addChatMessage } from './ui.js';
import { GAME_CONFIG } from './config.js';

function getSpawnPoint() {
    const { x, y, width, height } = GAME_CONFIG.SPAWN_REGION;
    const playerRadius = 30; // Min distance between spawning players
    let spawnX, spawnY;
    let attempts = 0;
    const maxAttempts = 20;

    do {
        spawnX = x + Math.random() * width;
        spawnY = y + Math.random() * height;
        attempts++;

        let isClear = true;
        if (gameState && gameState.players) {
            for (const p of Object.values(gameState.players)) {
                if (p.health > 0) { // Only check against alive players
                    const distance = Math.sqrt(
                        Math.pow(spawnX - p.x, 2) + Math.pow(spawnY - p.y, 2)
                    );
                    if (distance < playerRadius) {
                        isClear = false;
                        break;
                    }
                }
            }
        }
        if (isClear) {
            return { x: spawnX, y: spawnY };
        }

    } while (attempts < maxAttempts);

    // If we couldn't find a clear spot after many tries, just return a random one.
    // The player collision physics will push them apart anyway.
    return { x: spawnX, y: spawnY };
}

export async function initMultiplayer() {
    // Update loading progress
    document.getElementById('loadingFill').style.width = '50%';
    
    // Initialize player data
    const playerData = room.peers[room.clientId];
    document.getElementById('playerName').textContent = playerData.username;
    
    // Subscribe to room updates
    room.subscribeRoomState((roomState) => {
        Object.assign(gameState, roomState);
        updateGangScores();
    });
    
    room.subscribePresence((presence) => {
        // Update players from presence
        Object.entries(presence).forEach(([clientId, playerData]) => {
            if (playerData) {
                gameState.players[clientId] = playerData;
            }
        });
    });
    
    // Handle presence update requests (damage, etc.)
    room.subscribePresenceUpdateRequests((request, fromClientId) => {
        handlePresenceUpdateRequest(request, fromClientId);
    });
    
    // Handle events
    room.onmessage = (event) => {
        handleGameEvent(event.data);
    };
    
    // Before initializing presence, find a spawn point
    const spawnPoint = getSpawnPoint();
    player.x = spawnPoint.x;
    player.y = spawnPoint.y;

    // Initialize player presence
    room.updatePresence({
        ...player,
        username: playerData.username,
        avatarUrl: playerData.avatarUrl
    });
    
    // Initialize room state if needed
    if (!gameState.gangScores) {
        room.updateRoomState({
            gangScores: { red: 0, blue: 0, green: 0, yellow: 0 },
            territories: {},
            worldItems: generateWorldItems()
        });
    }
    
    document.getElementById('loadingFill').style.width = '100%';
}

function generateWorldItems() {
    const items = {};
    
    // Generate weapon pickups
    const weaponNames = Object.keys(GAME_CONFIG.WEAPONS);
    for (let i = 0; i < 10; i++) {
        const weaponName = weaponNames[Math.floor(Math.random() * weaponNames.length)];
        items[`weapon_${i}`] = {
            type: 'weapon',
            weapon: weaponName,
            x: Math.random() * GAME_CONFIG.WORLD_WIDTH,
            y: Math.random() * GAME_CONFIG.WORLD_HEIGHT,
            respawnTime: 0
        };
    }
    
    // Generate money pickups
    for (let i = 0; i < 20; i++) {
        items[`money_${i}`] = {
            type: 'money',
            amount: Math.floor(Math.random() * 50) + 10,
            x: Math.random() * GAME_CONFIG.WORLD_WIDTH,
            y: Math.random() * GAME_CONFIG.WORLD_HEIGHT,
            respawnTime: 0
        };
    }
    
    return items;
}

function handlePresenceUpdateRequest(request, fromClientId) {
    const currentPresence = room.presence[room.clientId];
    
    switch (request.type) {
        case 'damage':
            if (currentPresence.health > 0) {
                const newHealth = Math.max(0, currentPresence.health - request.damage);
                const isDead = newHealth <= 0;
                
                room.updatePresence({
                    ...currentPresence,
                    health: newHealth,
                    deaths: isDead ? currentPresence.deaths + 1 : currentPresence.deaths
                });
                
                if (isDead) {
                    handleDeath();
                    // Award kill to attacker
                    room.requestPresenceUpdate(fromClientId, {
                        type: 'kill',
                        victim: room.clientId
                    });
                }
            }
            break;
            
        case 'kill':
            const updatedPresence = room.presence[room.clientId];
            room.updatePresence({
                ...updatedPresence,
                kills: updatedPresence.kills + 1,
                exp: updatedPresence.exp + 50,
                money: updatedPresence.money + 25
            });
            
            addChatMessage(`${updatedPresence.username} eliminated ${room.peers[request.victim]?.username || 'a player'}!`, 'kill');
            break;
    }
}

function handleDeath() {
    const spawnPoint = getSpawnPoint();
    // Respawn player
    player.x = spawnPoint.x;
    player.y = spawnPoint.y;
    player.vx = 0;
    player.vy = 0;
    player.health = player.maxHealth;
    player.weapon = 'fists';
    
    // Broadcast respawn effect
    room.send({
        type: 'death',
        playerId: room.clientId,
        x: player.x,
        y: player.y
    });
}

function handleGameEvent(event) {
    switch (event.type) {
        case 'connected':
            addChatMessage(`${event.username} joined the game`, 'system');
            break;
            
        case 'disconnected':
            addChatMessage(`${event.username} left the game`, 'system');
            delete gameState.players[event.clientId];
            break;
            
        case 'chat':
            const playerData = gameState.players[event.clientId];
            if (playerData) {
                addChatMessage(`${playerData.username}: ${event.message}`);
            }
            break;
            
        case 'shot':
            createBullet(event.bullet);
            break;
            
        case 'death':
            createDeathEffect(event.x, event.y);
            break;
            
        case 'gang_join':
            addChatMessage(`${event.username} joined ${event.gang} gang!`, 'gang');
            break;
    }
}

function createBullet(bulletData) {
    gameState.bullets[`bullet_${bulletData.shooterId}_${Date.now()}`] = bulletData;
}

function createDeathEffect(x, y) {
    // Visual death effect could be added here
    console.log(`Death effect at ${x}, ${y}`);
}

function updateGangScores() {
    if (gameState.gangScores) {
        document.getElementById('redScore').textContent = gameState.gangScores.red;
        document.getElementById('blueScore').textContent = gameState.gangScores.blue;
        document.getElementById('greenScore').textContent = gameState.gangScores.green;
        document.getElementById('yellowScore').textContent = gameState.gangScores.yellow;
    }
}