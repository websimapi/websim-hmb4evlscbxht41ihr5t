import * as THREE from 'three';
import { gameState, player, camera, minimapCtx, room } from './game.js';
import { GAME_CONFIG } from './config.js';
import { getGangColor } from './ui.js';

// Three.js Variables
let scene, threeCamera, renderer, groundPlane;
export let raycaster;
export const threePlayers = {};
const threeBullets = {};
const threeWorldItems = {};
const threeBuildings = {};
const playerHeight = 25;

export function initRenderer(canvas) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2a2a2a);

    threeCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
    threeCamera.position.set(0, 400, 200);
    
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 300, 200);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.left = -1000;
    directionalLight.shadow.camera.right = 1000;
    directionalLight.shadow.camera.top = 1000;
    directionalLight.shadow.camera.bottom = -1000;
    scene.add(directionalLight);

    // Ground
    groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const groundGeo = new THREE.PlaneGeometry(GAME_CONFIG.WORLD_WIDTH, GAME_CONFIG.WORLD_HEIGHT);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.set(GAME_CONFIG.WORLD_WIDTH / 2, -1, GAME_CONFIG.WORLD_HEIGHT / 2);
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    const grid = new THREE.GridHelper(Math.max(GAME_CONFIG.WORLD_WIDTH, GAME_CONFIG.WORLD_HEIGHT), 100);
    grid.position.set(GAME_CONFIG.WORLD_WIDTH / 2, 0, GAME_CONFIG.WORLD_HEIGHT / 2);
    scene.add(grid);

    // Spawn Region Visualizer
    const spawnRegion = GAME_CONFIG.SPAWN_REGION;
    const spawnGeo = new THREE.PlaneGeometry(spawnRegion.width, spawnRegion.height);
    const spawnMat = new THREE.MeshBasicMaterial({ 
        color: parseInt(spawnRegion.color), 
        transparent: true, 
        opacity: 0.2,
        side: THREE.DoubleSide
    });
    const spawnMesh = new THREE.Mesh(spawnGeo, spawnMat);
    spawnMesh.rotation.x = -Math.PI / 2;
    spawnMesh.position.set(spawnRegion.x + spawnRegion.width / 2, 0.1, spawnRegion.y + spawnRegion.height / 2);
    scene.add(spawnMesh);

    // Buildings
    const buildingMat = new THREE.MeshLambertMaterial({ color: 0x34495e });
    GAME_CONFIG.BUILDINGS.forEach((building, i) => {
        const buildingHeight = Math.random() * 100 + 50;
        const buildingGeo = new THREE.BoxGeometry(building.width, buildingHeight, building.height);
        const buildingMesh = new THREE.Mesh(buildingGeo, buildingMat);
        buildingMesh.castShadow = true;
        buildingMesh.receiveShadow = true;
        buildingMesh.position.set(building.x + building.width/2, buildingHeight/2, building.y + building.height/2);
        scene.add(buildingMesh);
        threeBuildings[`building_${i}`] = buildingMesh;
    });

    raycaster = new THREE.Raycaster();
    
    window.addEventListener('resize', resizeRenderer);
}

function resizeRenderer() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    if (renderer) {
        renderer.setSize(width, height);
    }
    if (threeCamera) {
        threeCamera.aspect = width / height;
        threeCamera.updateProjectionMatrix();
    }
}

export function updateCamera() {
    // 2D camera for logic
    camera.x = player.x - window.innerWidth / 2;
    camera.y = player.y - window.innerHeight / 2;
    
    // Clamp 2D camera to world bounds
    camera.x = Math.max(0, Math.min(GAME_CONFIG.WORLD_WIDTH - window.innerWidth, camera.x));
    camera.y = Math.max(0, Math.min(GAME_CONFIG.WORLD_HEIGHT - window.innerHeight, camera.y));

    // 3D camera follows player
    if (threeCamera) {
        const targetPosition = new THREE.Vector3(player.x, 0, player.y);
        const cameraOffset = new THREE.Vector3(0, 450, 250);
        
        const idealPosition = targetPosition.clone().add(cameraOffset);

        threeCamera.position.lerp(idealPosition, 0.05);
        threeCamera.lookAt(targetPosition);
    }
}

export function render() {
    // Sync game state with 3D scene
    syncPlayers();
    syncBullets();
    syncWorldItems();
    
    // Render 3D scene
    if (renderer && scene && threeCamera) {
        renderer.render(scene, threeCamera);
    }
    
    // Draw UI elements like minimap
    drawMinimap();
}

function createPlayerModel(playerData) {
    const group = new THREE.Group();
    const playerColor = new THREE.Color(0xbdc3c7); // Default color for all players

    // Body
    const bodyGeo = new THREE.CapsuleGeometry(10, playerHeight, 4, 8);
    const bodyMat = new THREE.MeshLambertMaterial({ color: playerColor });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    // "Face" indicator
    const faceGeo = new THREE.PlaneGeometry(8, 8);
    const faceMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const faceMesh = new THREE.Mesh(faceGeo, faceMat);
    faceMesh.position.set(0, 10, 10.1);
    group.add(faceMesh);

    group.position.set(playerData.x, playerHeight / 2, playerData.y);
    scene.add(group);
    return group;
}

function syncPlayers() {
    const seenPlayers = new Set();
    Object.entries(gameState.players).forEach(([clientId, playerData]) => {
        if (!playerData || playerData.health <= 0) {
            if (threePlayers[clientId]) {
                scene.remove(threePlayers[clientId]);
                delete threePlayers[clientId];
            }
            return;
        }
        seenPlayers.add(clientId);

        if (!threePlayers[clientId]) {
            threePlayers[clientId] = createPlayerModel(playerData);
        }

        const model = threePlayers[clientId];
        model.position.set(playerData.x, playerHeight / 2, playerData.y);
        model.rotation.y = playerData.angle;
    });

    // Remove players that have disconnected
    Object.keys(threePlayers).forEach(clientId => {
        if (!seenPlayers.has(clientId)) {
            scene.remove(threePlayers[clientId]);
            delete threePlayers[clientId];
        }
    });
}

function syncBullets() {
    const seenBullets = new Set();
    Object.entries(gameState.bullets || {}).forEach(([bulletId, bulletData]) => {
        seenBullets.add(bulletId);

        if (!threeBullets[bulletId]) {
            const geo = new THREE.SphereGeometry(3, 8, 8);
            const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            threeBullets[bulletId] = new THREE.Mesh(geo, mat);
            scene.add(threeBullets[bulletId]);
        }
        threeBullets[bulletId].position.set(bulletData.x, playerHeight / 2, bulletData.y);
    });

    Object.keys(threeBullets).forEach(bulletId => {
        if (!seenBullets.has(bulletId)) {
            scene.remove(threeBullets[bulletId]);
            delete threeBullets[bulletId];
        }
    });
}

function syncWorldItems() {
    const seenItems = new Set();
    Object.entries(gameState.worldItems || {}).forEach(([itemId, item]) => {
        if (item.respawnTime > Date.now()) {
            if (threeWorldItems[itemId]) {
                scene.remove(threeWorldItems[itemId]);
                delete threeWorldItems[itemId];
            }
            return;
        }
        seenItems.add(itemId);

        if (!threeWorldItems[itemId]) {
            let geo, mat;
            if (item.type === 'weapon') {
                geo = new THREE.BoxGeometry(20, 10, 5);
                mat = new THREE.MeshLambertMaterial({ color: 0xe74c3c });
            } else {
                geo = new THREE.CylinderGeometry(8, 8, 3, 16);
                mat = new THREE.MeshLambertMaterial({ color: 0xf1c40f });
            }
            threeWorldItems[itemId] = new THREE.Mesh(geo, mat);
            threeWorldItems[itemId].castShadow = true;
            scene.add(threeWorldItems[itemId]);
        }
        threeWorldItems[itemId].position.set(item.x, 5, item.y);
        threeWorldItems[itemId].rotation.y += 0.01;
    });

    Object.keys(threeWorldItems).forEach(itemId => {
        if (!seenItems.has(itemId) || (gameState.worldItems[itemId] && gameState.worldItems[itemId].respawnTime > Date.now())) {
            if (threeWorldItems[itemId]) {
                scene.remove(threeWorldItems[itemId]);
                delete threeWorldItems[itemId];
            }
        }
    });
}

function drawMinimap() {
    const minimapWidth = minimapCtx.canvas.width;
    const minimapHeight = minimapCtx.canvas.height;
    minimapCtx.fillStyle = '#000';
    minimapCtx.fillRect(0, 0, minimapWidth, minimapHeight);
    
    // Draw world bounds
    minimapCtx.strokeStyle = '#666';
    minimapCtx.lineWidth = 1;
    minimapCtx.strokeRect(0, 0, minimapWidth, minimapHeight);
    
    // Draw buildings on minimap
    GAME_CONFIG.BUILDINGS.forEach(building => {
        const x = (building.x / GAME_CONFIG.WORLD_WIDTH) * minimapWidth;
        const y = (building.y / GAME_CONFIG.WORLD_HEIGHT) * minimapHeight;
        const width = (building.width / GAME_CONFIG.WORLD_WIDTH) * minimapWidth;
        const height = (building.height / GAME_CONFIG.WORLD_HEIGHT) * minimapHeight;
        
        minimapCtx.fillStyle = '#444';
        minimapCtx.fillRect(x, y, width, height);
    });
    
    // Draw players
    Object.entries(gameState.players).forEach(([playerId, playerData]) => {
        if (!playerData || playerData.health <= 0) return;
        
        const x = (playerData.x / GAME_CONFIG.WORLD_WIDTH) * minimapWidth;
        const y = (playerData.y / GAME_CONFIG.WORLD_HEIGHT) * minimapHeight;
        
        // Player dot
        minimapCtx.fillStyle = playerId === room.clientId ? '#fff' : '#bdc3c780';
        minimapCtx.beginPath();
        minimapCtx.arc(x, y, 3, 0, Math.PI * 2);
        minimapCtx.fill();
        
        // Draw player field-of-view cone
        if (playerData.angle !== undefined) {
            minimapCtx.save();
            minimapCtx.translate(x, y);
            // Map game angle (0 = south) to canvas rotation: 0 = east by default,
            // so rotate by (90° - gameAngle) to point down at 0 and follow game rotation
            minimapCtx.rotate(Math.PI/2 - playerData.angle);
            
            const coneAngle = Math.PI / 2;
            const coneRadius = 8;
            minimapCtx.fillStyle = playerId === room.clientId ? 'rgba(255, 255, 255, 0.5)' : '#bdc3c780';
            minimapCtx.beginPath();
            minimapCtx.moveTo(0, 0);
            minimapCtx.arc(0, 0, coneRadius, -coneAngle / 2, coneAngle / 2);
            minimapCtx.closePath();
            minimapCtx.fill();
            
            minimapCtx.restore();
        }
    });
}

// Export threeCamera and groundPlane for use in other modules
export { threeCamera, groundPlane };