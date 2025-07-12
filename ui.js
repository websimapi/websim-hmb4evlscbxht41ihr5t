import { gameState, room, minimapCtx } from './game.js';
import { keyMappings, saveKeyMappings, setMovePathToPoint } from './player.js';
import { GAME_CONFIG } from './config.js';

let contextMenuTarget = null;

export function initUI() {
    setupControlsUI();
    document.getElementById('minimapToggle').addEventListener('click', toggleMinimap);
    setupContextMenu();
    updateControlsDisplay();
}

function setupControlsUI() {
    document.getElementById('controlsIcon').addEventListener('click', openControlsModal);
    document.getElementById('closeControlsModal').addEventListener('click', closeControlsModal);
    document.getElementById('controlsModal').addEventListener('click', (e) => {
        if (e.target.id === 'controlsModal') {
            closeControlsModal();
        }
    });
}

function setupContextMenu() {
    const contextMenu = document.getElementById('playerContextMenu');

    document.addEventListener('click', (e) => {
        if (!contextMenu.contains(e.target) && e.target.id !== 'gameCanvas') {
            hideContextMenu();
        }
    });

    document.getElementById('contextWalkHere').addEventListener('click', () => {
        if (contextMenuTarget && contextMenuTarget.position) {
            setMovePathToPoint(contextMenuTarget.position.x, contextMenuTarget.position.z);
        }
        hideContextMenu();
    });

    document.getElementById('contextPlug').addEventListener('click', () => {
        alert('Feature coming soon: Send a friend request (Plug).');
        hideContextMenu();
    });

    document.getElementById('contextSwap').addEventListener('click', () => {
        alert('Feature coming soon: Send a trade request (Swap).');
        hideContextMenu();
    });

    document.getElementById('contextShakedown').addEventListener('click', () => {
        alert('Feature coming soon: View player inventory (Shakedown).');
        hideContextMenu();
    });
    
    document.getElementById('contextMarkHostile').addEventListener('click', () => {
        alert('Feature coming soon: Mark player as hostile for quick attacks.');
        hideContextMenu();
    });

    document.getElementById('contextCancel').addEventListener('click', () => {
        hideContextMenu();
    });
}

export function showContextMenu(x, y, target) {
    const contextMenu = document.getElementById('playerContextMenu');
    contextMenu.style.display = 'block';
    
    // Position the menu, ensuring it stays within the viewport
    const menuWidth = contextMenu.offsetWidth;
    const menuHeight = contextMenu.offsetHeight;
    const { innerWidth, innerHeight } = window;

    let left = x;
    if (x + menuWidth > innerWidth) {
        left = x - menuWidth;
    }

    let top = y;
    if (y + menuHeight > innerHeight) {
        top = y - menuHeight;
    }
    
    contextMenu.style.left = `${left}px`;
    contextMenu.style.top = `${top}px`;
    
    contextMenuTarget = target;
}

export function hideContextMenu() {
    const contextMenu = document.getElementById('playerContextMenu');
    contextMenu.style.display = 'none';
    contextMenuTarget = null;
}

export function toggleMinimap() {
    const minimap = document.getElementById('minimap');
    const toggleButton = document.getElementById('minimapToggle');
    minimap.classList.toggle('minimized');

    if (minimap.classList.contains('minimized')) {
        toggleButton.textContent = '+';
    } else {
        toggleButton.textContent = '-';
    }
}

export function toggleGangUI() {
    const gangInfo = document.getElementById('gangInfo');
    if (gangInfo.style.display === 'none' || gangInfo.style.display === '') {
        gangInfo.style.display = 'block';
    } else {
        gangInfo.style.display = 'none';
    }
}

export function updateUI() {
    const currentPresence = room.presence[room.clientId];
    if (!currentPresence) return;
    const peerData = room.peers[room.clientId];
    
    // Update player info
    if(peerData) {
        document.getElementById('playerName').textContent = peerData.username;
        const avatarImg = document.getElementById('playerAvatar');
        if (avatarImg.src !== peerData.avatarUrl) {
            avatarImg.src = peerData.avatarUrl;
        }
    }
    document.getElementById('playerLevel').textContent = currentPresence.level || 1;
    
    // Update gang icon
    const gang = currentPresence.gang || 'None';
    const gangIcon = document.getElementById('playerGangIcon');
    let iconSrc = 'neutral-gang-icon.png';
    if (gang && gang !== 'None') {
        iconSrc = `${gang}-gang-icon.png`;
    }
    // Check full src path to avoid unnecessary reloads
    if (!gangIcon.src.endsWith(iconSrc)) {
        gangIcon.src = iconSrc;
    }
    
    // Update money display in HUD
    document.getElementById('playerMoney').textContent = currentPresence.money || 0;

    // These elements are no longer visible, but we'll keep the logic in case they are re-introduced
    // Update health bar
    const healthPercent = (currentPresence.health / currentPresence.maxHealth) * 100;
    document.getElementById('healthBar').style.width = healthPercent + '%';
    document.getElementById('healthText').textContent = `${currentPresence.health}/${currentPresence.maxHealth}`;
    
    // Update mana bar
    const manaPercent = (currentPresence.mana / currentPresence.maxMana) * 100;
    document.getElementById('manaBar').style.width = manaPercent + '%';
    document.getElementById('manaText').textContent = `${currentPresence.mana}/${currentPresence.maxMana}`;
    
    // Update exp bar
    const expPercent = (currentPresence.exp / currentPresence.expToNext) * 100;
    document.getElementById('expBar').style.width = expPercent + '%';
    document.getElementById('expText').textContent = `${currentPresence.exp}/${currentPresence.expToNext}`;
    
    // Update weapon info
    document.getElementById('currentWeapon').textContent = currentPresence.weapon || 'fists';
    const weaponName = currentPresence.weapon || 'fists';
    const weaponData = GAME_CONFIG.WEAPONS[weaponName] || GAME_CONFIG.WEAPONS.fists;
    document.getElementById('weaponDamage').textContent = weaponData.damage;
}

export function updateControlsDisplay() {
    const controlsList = document.getElementById('controlsList');
    controlsList.innerHTML = '';
    const staticControls = [
        { label: 'Aim & Attack', key: 'Mouse' },
        ...Object.values(keyMappings).map(m => ({ label: m.label, key: m.key.toUpperCase() }))
    ];
    
    staticControls.forEach(control => {
        const div = document.createElement('div');
        div.textContent = `${control.key} - ${control.label}`;
        controlsList.appendChild(div);
    });
}

function openControlsModal() {
    populateKeybindsModal();
    document.getElementById('controlsModal').style.display = 'flex';
}

function closeControlsModal() {
    document.getElementById('controlsModal').style.display = 'none';
}

function populateKeybindsModal() {
    const container = document.getElementById('keybindsContainer');
    container.innerHTML = '';

    Object.entries(keyMappings).forEach(([action, mapping]) => {
        const row = document.createElement('div');
        row.className = 'control-mapping-row';

        const actionLabel = document.createElement('span');
        actionLabel.className = 'control-action';
        actionLabel.textContent = mapping.label;

        const keyButton = document.createElement('button');
        keyButton.className = 'control-key';
        keyButton.textContent = mapping.key.toUpperCase();
        keyButton.dataset.action = action;

        keyButton.addEventListener('click', () => startKeyRebind(keyButton));

        row.appendChild(actionLabel);
        row.appendChild(keyButton);
        container.appendChild(row);
    });
}

function startKeyRebind(button) {
    document.querySelectorAll('.control-key.editing').forEach(el => {
        el.classList.remove('editing');
        el.textContent = keyMappings[el.dataset.action].key.toUpperCase();
    });

    button.classList.add('editing');
    button.textContent = 'Press a key...';

    const handleKeyDown = (event) => {
        event.preventDefault();
        const newKey = event.key.toLowerCase();
        const action = button.dataset.action;

        for (const act in keyMappings) {
            if (keyMappings[act].key === newKey) {
                alert(`Key "${newKey.toUpperCase()}" is already bound to "${keyMappings[act].label}".`);
                button.classList.remove('editing');
                button.textContent = keyMappings[action].key.toUpperCase();
                document.removeEventListener('keydown', handleKeyDown, true);
                return;
            }
        }
        
        keyMappings[action].key = newKey;
        button.classList.remove('editing');
        button.textContent = newKey.toUpperCase();
        
        saveKeyMappings();
        updateControlsDisplay();

        document.removeEventListener('keydown', handleKeyDown, true);
    };

    document.addEventListener('keydown', handleKeyDown, { capture: true, once: true });
}

export function addChatMessage(message, type = 'normal') {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Remove old messages
    while (chatMessages.children.length > 50) {
        chatMessages.removeChild(chatMessages.firstChild);
    }
}

export function getGangColor(gang) {
    switch (gang) {
        case 'red': return '#e74c3c';
        case 'blue': return '#3498db';
        case 'green': return '#2ecc71';
        case 'yellow': return '#f1c40f';
        default: return '#bdc3c7';
    }
}