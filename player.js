import { player, gameState, room, keys, mouse, canvas } from './game.js';
import { GAME_CONFIG } from './config.js';
import { addChatMessage, toggleGangUI, toggleMinimap, showContextMenu, hideContextMenu } from './ui.js';
import { raycaster, groundPlane, threeCamera, threePlayers } from './render.js';
import * as THREE from 'three';
import { findPath } from './pathfinding.js';

export let keyMappings = { ...GAME_CONFIG.KEY_MAPPINGS };

export function initPlayer() {
    loadKeyMappings();
    setupControls();
}

function setupControls() {
    const chatInput = document.getElementById('chatInput');

    // Keyboard
    document.addEventListener('keydown', (e) => {
        const isChatting = document.activeElement === chatInput;

        if (e.key === 'Enter') {
            e.preventDefault();
            if (isChatting) {
                sendChatMessage();
            } else {
                chatInput.focus();
            }
            return;
        }

        if (isChatting) {
            // When chat is focused, ignore other keys for game actions
            return;
        }

        keys[e.key.toLowerCase()] = true;
        
        if (e.key.toLowerCase() === keyMappings.TOGGLE_GANG_UI.key) {
            toggleGangUI();
        }

        if (e.key.toLowerCase() === keyMappings.TOGGLE_MINIMAP.key) {
            toggleMinimap();
        }
        
        if (e.key === keyMappings.WEAPON_1.key) switchWeapon(0);
        if (e.key === keyMappings.WEAPON_2.key) switchWeapon(1);
        if (e.key === keyMappings.WEAPON_3.key) switchWeapon(2);
        if (e.key === keyMappings.WEAPON_4.key) switchWeapon(3);
    });
    
    document.addEventListener('keyup', (e) => {
        // We don't need to check for chat focus here, as releasing a key should always register.
        keys[e.key.toLowerCase()] = false;
    });
    
    // Mouse
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;

        if (mouse.down) {
            handleAttack(); // Allow attacking while holding and dragging
        }
    });
    
    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            mouse.down = true;

            // Check for player click first
            if (handlePlayerClick(e)) {
                return; // Stop further processing if a player was clicked
            }

            // If we didn't click a player, hide the context menu
            hideContextMenu();

            // Clear WASD input to prioritize click
            keys[keyMappings.MOVE_FORWARD.key] = false;
            keys[keyMappings.MOVE_BACKWARD.key] = false;
            keys[keyMappings.MOVE_LEFT.key] = false;
            keys[keyMappings.MOVE_RIGHT.key] = false;
            setMovePath(); // Set path on click
            handleAttack(); // Attack on initial click
        }
    });
    
    canvas.addEventListener('mouseup', (e) => {
        if (e.button === 0) {
            mouse.down = false;
        }
    });

    chatInput.addEventListener('focus', () => {
        // Clear all pressed keys when chat is focused to prevent sticky movement
        for (const key in keys) {
            keys[key] = false;
        }
    });
    
    // Prevent right-click menu
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

function handlePlayerClick(event) {
    const mouseNDC = new THREE.Vector2();
    mouseNDC.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouseNDC.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouseNDC, threeCamera);

    const playerModels = Object.values(threePlayers);
    const intersects = raycaster.intersectObjects(playerModels, true);

    if (intersects.length > 0) {
        let clickedObject = intersects[0].object;
        let parentGroup = null;

        // Find the top-level group for the player
        while (clickedObject.parent && clickedObject.parent !== threeCamera.parent) {
            if (Object.values(threePlayers).includes(clickedObject.parent)) {
                parentGroup = clickedObject.parent;
                break;
            }
            clickedObject = clickedObject.parent;
        }

        if (parentGroup) {
            for (const [clientId, model] of Object.entries(threePlayers)) {
                if (model === parentGroup && clientId !== room.clientId) {
                    // We clicked on another player
                    showContextMenu(event.clientX, event.clientY, {
                        id: clientId,
                        position: model.position,
                        data: gameState.players[clientId]
                    });
                    return true; // Indicates a player was clicked
                }
            }
        }
    }

    return false; // No player was clicked
}

export function updatePlayer(deltaTime) {
    const currentPresence = room.presence[room.clientId];
    if (!currentPresence || currentPresence.health <= 0) return;
    
    let moveX = 0;
    let moveY = 0;
    let usingWASD = false;
    
    // Check for WASD input first
    if (keys[keyMappings.MOVE_FORWARD.key]) { moveY = -1; usingWASD = true; }
    if (keys[keyMappings.MOVE_BACKWARD.key]) { moveY = 1; usingWASD = true; }
    if (keys[keyMappings.MOVE_LEFT.key]) { moveX = -1; usingWASD = true; }
    if (keys[keyMappings.MOVE_RIGHT.key]) { moveX = 1; usingWASD = true; }

    if (usingWASD) {
        // Clear pathfinding path if WASD is used
        if (player.path.length > 0) {
            player.path = [];
        }

        // Normalize diagonal movement
        if (moveX !== 0 && moveY !== 0) {
            moveX *= 0.707;
            moveY *= 0.707;
        }
        
        player.vx = moveX * GAME_CONFIG.PLAYER_SPEED;
        player.vy = moveY * GAME_CONFIG.PLAYER_SPEED;
    } else if (player.path && player.path.length > 0) {
        // Handle pathfinding movement
        const targetNode = player.path[0];
        const dx = targetNode.x - player.x;
        const dy = targetNode.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // When close to the next node, remove it and aim for the one after.
        // This makes movement continuous and removes stuttering at waypoints.
        const moveThreshold = 20; 
        if (distance < moveThreshold) {
            player.path.shift();
            // If there's no next node, stop.
            if (player.path.length === 0) {
                player.vx = 0;
                player.vy = 0;
                return; // Exit early to prevent trying to access path[0] of an empty array
            }
        }
        
        // Always aim for the current first node in the path.
        const currentTarget = player.path[0];
        const targetDx = currentTarget.x - player.x;
        const targetDy = currentTarget.y - player.y;
        
        const angle = Math.atan2(targetDy, targetDx);
        player.vx = Math.cos(angle) * GAME_CONFIG.PLAYER_SPEED;
        player.vy = Math.sin(angle) * GAME_CONFIG.PLAYER_SPEED;

    } else {
        // No movement input
        player.vx = 0;
        player.vy = 0;
    }
    
    // Calculate player angle based on mouse position
    const mouseNDC = new THREE.Vector2();
    mouseNDC.x = (mouse.x / window.innerWidth) * 2 - 1;
    mouseNDC.y = -(mouse.y / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouseNDC, threeCamera);
    const intersectionPoint = new THREE.Vector3();
    const intersectionResult = raycaster.ray.intersectPlane(groundPlane, intersectionPoint);

    if (intersectionResult) {
        const dx = intersectionPoint.x - player.x;
        const dz = intersectionPoint.z - player.y; // Using .z for depth in 3D space
        player.angle = Math.atan2(dx, dz);
    }
    
    // Update position
    player.x += player.vx * deltaTime;
    player.y += player.vy * deltaTime;
    
    // Building collisions
    checkBuildingCollisions();

    // Player collisions
    checkPlayerCollisions();
    
    // World bounds
    player.x = Math.max(25, Math.min(GAME_CONFIG.WORLD_WIDTH - 25, player.x));
    player.y = Math.max(25, Math.min(GAME_CONFIG.WORLD_HEIGHT - 25, player.y));
    
    // Check item pickups
    checkItemPickups();
    
    // Update presence
    room.updatePresence({
        ...player,
        username: currentPresence.username,
        avatarUrl: currentPresence.avatarUrl,
        path: [] // Don't sync path to other players
    });
}

function setMovePath() {
    const mouseNDC = new THREE.Vector2();
    mouseNDC.x = (mouse.x / window.innerWidth) * 2 - 1;
    mouseNDC.y = -(mouse.y / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouseNDC, threeCamera);
    const intersectionPoint = new THREE.Vector3();
    const intersectionResult = raycaster.ray.intersectPlane(groundPlane, intersectionPoint);

    if (intersectionResult) {
        setMovePathToPoint(intersectionPoint.x, intersectionPoint.z);
    }
}

export function setMovePathToPoint(x, z) {
    const startPos = { x: player.x, y: player.y };
    const endPos = { x, y: z };
    const newPath = findPath(startPos, endPos);
    if (newPath && newPath.length > 0) {
        player.path = newPath;
    }
}

function checkBuildingCollisions() {
    const playerRadius = 12;
    GAME_CONFIG.BUILDINGS.forEach(building => {
        const closestX = Math.max(building.x, Math.min(player.x, building.x + building.width));
        const closestZ = Math.max(building.y, Math.min(player.y, building.y + building.height));

        const distanceX = player.x - closestX;
        const distanceZ = player.y - closestZ;
        const distanceSquared = (distanceX * distanceX) + (distanceZ * distanceZ);

        if (distanceSquared < (playerRadius * playerRadius)) {
            const overlap = playerRadius - Math.sqrt(distanceSquared);
            const angle = Math.atan2(distanceZ, distanceX);
            player.x += Math.cos(angle) * overlap;
            player.y += Math.sin(angle) * overlap;
        }
    });
}

function checkPlayerCollisions() {
    const playerRadius = 12; // Same as building collision for consistency
    const minDistance = playerRadius * 2;

    Object.entries(gameState.players).forEach(([otherId, otherPlayer]) => {
        if (otherId === room.clientId || !otherPlayer || otherPlayer.health <= 0) {
            return; // Don't collide with self, non-existent or dead players
        }

        const dx = player.x - otherPlayer.x;
        const dy = player.y - otherPlayer.y;
        let distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < minDistance) {
            // Handle case where players are perfectly on top of each other
            if (distance === 0) {
                distance = 0.1;
                player.x += 0.1; // Nudge to avoid division by zero
            }

            const overlap = minDistance - distance;
            const angle = Math.atan2(dy, dx);
            
            // Push the local player away
            player.x += Math.cos(angle) * overlap;
            player.y += Math.sin(angle) * overlap;
        }
    });
}

function checkItemPickups() {
    Object.entries(gameState.worldItems || {}).forEach(([itemId, item]) => {
        if (item.respawnTime > Date.now()) return;
        
        const distance = Math.sqrt(
            Math.pow(player.x - item.x, 2) + 
            Math.pow(player.y - item.y, 2)
        );
        
        if (distance < 30) {
            pickupItem(itemId, item);
        }
    });
}

function pickupItem(itemId, item) {
    switch (item.type) {
        case 'weapon':
            player.weapon = item.weapon;
            addChatMessage(`Picked up ${item.weapon}!`, 'system');
            break;
            
        case 'money':
            player.money += item.amount;
            addChatMessage(`+$${item.amount}`, 'system');
            break;
    }
    
    // Remove item temporarily
    room.updateRoomState({
        worldItems: {
            [itemId]: {
                ...item,
                respawnTime: Date.now() + 30000
            }
        }
    });
}

function handleAttack() {
    const currentPresence = room.presence[room.clientId];
    if (!currentPresence || currentPresence.health <= 0) return;
    
    const weapon = GAME_CONFIG.WEAPONS[player.weapon] || GAME_CONFIG.WEAPONS.fists;
    const now = Date.now();
    
    if (now - player.lastShot < 1000 / weapon.speed) return;
    
    player.lastShot = now;
    
    const dirX = Math.sin(player.angle);
    const dirZ = Math.cos(player.angle);
    
    if (weapon.range > 100) {
        // Ranged weapon - create bullet
        const bullet = {
            x: player.x,
            y: player.y,
            vx: dirX * 500,
            vy: dirZ * 500,
            damage: weapon.damage,
            shooterId: room.clientId,
            lifetime: 2
        };
        
        room.updateRoomState({
            bullets: {
                [`bullet_${room.clientId}_${now}`]: bullet
            }
        });
        
        room.send({
            type: 'shot',
            bullet: bullet
        });
    } else {
        // Melee weapon - check direct hits
        Object.entries(gameState.players).forEach(([playerId, otherPlayer]) => {
            if (playerId === room.clientId) return;
            
            const playerDistance = Math.sqrt(
                Math.pow(player.x - otherPlayer.x, 2) + 
                Math.pow(player.y - otherPlayer.y, 2)
            );
            
            if (playerDistance < weapon.range) {
                room.requestPresenceUpdate(playerId, {
                    type: 'damage',
                    damage: weapon.damage
                });
            }
        });
    }
}

function cycleGang() {
    const currentPresence = room.presence[room.clientId];
    if (!currentPresence) return;
    
    const currentGangIndex = GAME_CONFIG.GANGS.indexOf(currentPresence.gang);
    const nextGangIndex = (currentGangIndex + 1) % GAME_CONFIG.GANGS.length;
    const newGang = GAME_CONFIG.GANGS[nextGangIndex];
    
    room.updatePresence({
        ...currentPresence,
        gang: newGang
    });
    
    room.send({
        type: 'gang_join',
        gang: newGang,
        username: currentPresence.username
    });
}

function switchWeapon(index) {
    const weapons = Object.keys(GAME_CONFIG.WEAPONS);
    if (index < weapons.length) {
        player.weapon = weapons[index];
    }
}

function sendChatMessage() {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();
    
    if (message) {
        room.send({
            type: 'chat',
            message: message
        });
        chatInput.value = '';
    }
    
    chatInput.blur();
}

function loadKeyMappings() {
    try {
        const savedMappings = localStorage.getItem('stickMUpKeyMappings');
        if (savedMappings) {
            const parsed = JSON.parse(savedMappings);
            for (const action in parsed) {
                if (keyMappings[action]) {
                    keyMappings[action].key = parsed[action];
                }
            }
        }
    } catch (e) {
        console.error("Could not load key mappings from localStorage.", e);
        keyMappings = { ...GAME_CONFIG.KEY_MAPPINGS };
    }
}

export function saveKeyMappings() {
    try {
        const mappingsToSave = {};
        for (const action in keyMappings) {
            mappingsToSave[action] = keyMappings[action].key;
        }
        localStorage.setItem('stickMUpKeyMappings', JSON.stringify(mappingsToSave));
    } catch (e) {
        console.error("Could not save key mappings to localStorage.", e);
    }
}