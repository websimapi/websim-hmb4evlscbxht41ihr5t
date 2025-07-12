export const GAME_CONFIG = {
    WORLD_WIDTH: 2000,
    WORLD_HEIGHT: 1200,
    PLAYER_SPEED: 200,
    SPAWN_REGION: {
        x: 800,
        y: 800,
        width: 400,
        height: 200,
        color: 0x27ae60 
    },
    GANGS: ['red', 'blue', 'green', 'yellow'],
    KEY_MAPPINGS: {
        MOVE_FORWARD: { key: 'w', label: 'Move Forward' },
        MOVE_BACKWARD: { key: 's', label: 'Move Backward' },
        MOVE_LEFT: { key: 'a', label: 'Move Left' },
        MOVE_RIGHT: { key: 'd', label: 'Move Right' },
        INTERACT: { key: 'e', label: 'Interact' },
        RELOAD: { key: 'r', label: 'Reload' },
        TOGGLE_GANG_UI: { key: 'g', label: 'Toggle Gang UI' },
        TOGGLE_MINIMAP: { key: 'm', label: 'Toggle Minimap' },
        CHAT: { key: 't', label: 'Open Chat' },
        WEAPON_1: { key: '1', label: 'Weapon 1' },
        WEAPON_2: { key: '2', label: 'Weapon 2' },
        WEAPON_3: { key: '3', label: 'Weapon 3' },
        WEAPON_4: { key: '4', label: 'Weapon 4' }
    },
    WEAPONS: {
        fists: { damage: 10, range: 30, speed: 2, cost: 0, image: 'fist-icon.png' },
        knife: { damage: 25, range: 40, speed: 3, cost: 50, image: 'knife-icon.png' },
        bat: { damage: 35, range: 50, speed: 1.5, cost: 100, image: 'bat-icon.png' },
        pistol: { damage: 40, range: 200, speed: 2, cost: 200, image: 'pistol-icon.png' },
        rifle: { damage: 60, range: 300, speed: 1, cost: 500, image: 'rifle-icon.png' }
    },
    BUILDINGS: [
        { x: 100, y: 200, width: 200, height: 150, type: 'apartment' },
        { x: 400, y: 300, width: 150, height: 100, type: 'shop' },
        { x: 650, y: 150, width: 100, height: 120, type: 'alley' },
        { x: 850, y: 400, width: 250, height: 200, type: 'warehouse' },
        { x: 1200, y: 250, width: 180, height: 140, type: 'bank' },
        { x: 1500, y: 350, width: 200, height: 180, type: 'casino' }
    ]
};