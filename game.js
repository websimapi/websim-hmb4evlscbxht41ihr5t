import * as THREE from 'three';
import { initMultiplayer } from './multiplayer.js';
import { initUI, updateUI } from './ui.js';
import { initPlayer, updatePlayer } from './player.js';
import { initRenderer, render, updateCamera } from './render.js';
import { GAME_CONFIG } from './config.js';
import { initPathfinding } from './pathfinding.js';

// Game State
export let gameState = {
    players: {},
    bullets: {},
    pickups: {},
    territories: {},
    gangScores: { red: 0, blue: 0, green: 0, yellow: 0 },
    worldItems: {}
};

// Player State
export let player = {
    x: 400,
    y: 400,
    vx: 0,
    vy: 0,
    destination: null, // For click-to-move
    path: [], // For pathfinding click-to-move
    health: 100,
    maxHealth: 100,
    mana: 50,
    maxMana: 50,
    level: 1,
    exp: 0,
    expToNext: 100,
    money: 0,
    gang: null,
    weapon: 'fists',
    kills: 0,
    deaths: 0,
    lastShot: 0,
    angle: 0
};

// Game Variables
export let canvas, ctx, minimapCanvas, minimapCtx;
export let room;
export let keys = {};
export let mouse = { x: 0, y: 0, down: false };
export let camera = { x: 0, y: 0 };
let lastTime = 0;
let gameRunning = false;

// Initialize Game
async function initGame() {
    // Load level data first
    try {
        const response = await fetch('test-level.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const levelData = await response.json();
        Object.assign(GAME_CONFIG, levelData);
    } catch (e) {
        console.error("Failed to load level data:", e);
        // Display an error to the user
        const loadingScreen = document.getElementById('loadingScreen');
        loadingScreen.innerHTML = `<div class="loading-title">Error</div><div class="loading-subtitle">Could not load level data. Please refresh the page.</div>`;
        return; // Stop game initialization
    }

    // Setup Canvas
    canvas = document.getElementById('gameCanvas');
    minimapCanvas = document.getElementById('minimapCanvas');
    minimapCtx = minimapCanvas.getContext('2d');

    // Set minimap canvas resolution to match its container size
    const minimapContainer = document.getElementById('minimap');
    minimapCanvas.width = minimapContainer.clientWidth;
    minimapCanvas.height = minimapContainer.clientHeight;

    initRenderer(canvas);
    initUI();
    initPlayer();
    initPathfinding();
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Initialize room here
    room = new WebsimSocket();
    await room.initialize();
    
    // Initialize Multiplayer
    await initMultiplayer();
    
    // Start Game Loop
    gameRunning = true;
    gameLoop();
    
    // Hide loading screen
    document.getElementById('loadingScreen').style.display = 'none';
}

function resizeCanvas() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Resize canvas to match window size
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    
    // Renderer resize is handled in render.js
}

function gameLoop(currentTime = 0) {
    if (!gameRunning) return;
    
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    
    if (deltaTime < 1) { // Prevent large delta times
        update(deltaTime);
        render();
    }
    
    requestAnimationFrame(gameLoop);
}

function update(deltaTime) {
    updatePlayer(deltaTime);
    updateCamera();
    updateBullets(deltaTime);
    updateUI();
}

function updateBullets(deltaTime) {
    Object.entries(gameState.bullets || {}).forEach(([bulletId, bullet]) => {
        bullet.x += bullet.vx * deltaTime;
        bullet.y += bullet.vy * deltaTime;
        bullet.lifetime -= deltaTime;
        
        // Remove expired bullets
        if (bullet.lifetime <= 0) {
            delete gameState.bullets[bulletId];
        }
        
        // Check player collisions
        Object.entries(gameState.players).forEach(([playerId, otherPlayer]) => {
            if (playerId === bullet.shooterId) return;
            
            const distance = Math.sqrt(
                Math.pow(bullet.x - otherPlayer.x, 2) + 
                Math.pow(bullet.y - otherPlayer.y, 2)
            );
            
            if (distance < 15) {
                // Hit player
                if (playerId === room.clientId) {
                    // We got hit
                    room.requestPresenceUpdate(room.clientId, {
                        type: 'damage',
                        damage: bullet.damage
                    });
                }
                delete gameState.bullets[bulletId];
            }
        });
    });
}

// Start the game
initGame();