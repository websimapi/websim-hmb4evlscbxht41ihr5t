import * as PF from 'pathfinding';
import { GAME_CONFIG } from './config.js';

const GRID_SCALE = 20; // Each grid cell is 20x20 world units. Reduced for more precision.
let grid;
let finder;

export function initPathfinding() {
    const gridWidth = Math.ceil(GAME_CONFIG.WORLD_WIDTH / GRID_SCALE);
    const gridHeight = Math.ceil(GAME_CONFIG.WORLD_HEIGHT / GRID_SCALE);
    grid = new PF.Grid(gridWidth, gridHeight);

    // Mark buildings as obstacles, adding a buffer so paths aren't too close to walls.
    const playerRadiusInGrid = Math.ceil(12 / GRID_SCALE); // player radius is 12
    
    GAME_CONFIG.BUILDINGS.forEach(building => {
        const startX = Math.floor(building.x / GRID_SCALE);
        const endX = Math.ceil((building.x + building.width) / GRID_SCALE);
        const startY = Math.floor(building.y / GRID_SCALE);
        const endY = Math.ceil((building.y + building.height) / GRID_SCALE);
        
        // Mark the building cells themselves as unwalkable.
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                if (grid.isWalkableAt(x, y)) {
                    grid.setWalkableAt(x, y, false);
                }
            }
        }

        // We can remove the explicit buffer logic. The pathfinder's inherent grid nature and the
        // `findNearestWalkable` function will prevent paths from starting/ending inside buildings.
        // The collision detection in player.js will handle keeping the player from actually
        // passing through the wall. This allows pathfinding to get as close as possible.
    });

    finder = new PF.AStarFinder({
        allowDiagonal: true,
        dontCrossCorners: true,
        // Heuristic can be adjusted for performance vs accuracy. Manhattan is faster.
        heuristic: PF.Heuristic.manhattan
    });
}

function findNearestWalkable(grid, x, y) {
    if (grid.isWalkableAt(x, y)) {
        return { x, y };
    }

    const maxRadius = 10;
    for (let r = 1; r < maxRadius; r++) {
        for (let i = -r; i <= r; i++) {
            for (let j = -r; j <= r; j++) {
                if (Math.abs(i) !== r && Math.abs(j) !== r) continue;
                const nx = x + i;
                const ny = y + j;
                if (grid.isWalkableAt(nx, ny)) {
                    return { x: nx, y: ny };
                }
            }
        }
    }
    return null; // No walkable node found nearby
}

export function findPath(startPos, endPos) {
    if (!grid) {
        console.error("Pathfinding not initialized.");
        return [];
    }

    const gridClone = grid.clone();

    let startX = Math.floor(startPos.x / GRID_SCALE);
    let startY = Math.floor(startPos.y / GRID_SCALE);
    let endX = Math.floor(endPos.x / GRID_SCALE);
    let endY = Math.floor(endPos.y / GRID_SCALE);

    const nearestStart = findNearestWalkable(gridClone, startX, startY);
    const nearestEnd = findNearestWalkable(gridClone, endX, endY);

    if (!nearestStart || !nearestEnd) {
        console.warn("Could not find walkable start or end for pathfinding.");
        return [];
    }

    const rawPath = finder.findPath(nearestStart.x, nearestStart.y, nearestEnd.x, nearestEnd.y, gridClone);

    if (rawPath.length === 0) {
        return [];
    }

    // Convert path back to world coordinates, centering in the grid cells.
    const worldPath = rawPath.map(node => ({
        x: (node[0] + 0.5) * GRID_SCALE,
        y: (node[1] + 0.5) * GRID_SCALE
    }));

    return smoothPath(worldPath, gridClone);
}

function hasLineOfSight(p1, p2, grid) {
    let x0 = Math.floor(p1.x / GRID_SCALE);
    let y0 = Math.floor(p1.y / GRID_SCALE);
    const x1 = Math.floor(p2.x / GRID_SCALE);
    const y1 = Math.floor(p2.y / GRID_SCALE);

    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;

    while (true) {
        if (!grid.isWalkableAt(x0, y0)) {
            return false;
        }
        if (x0 === x1 && y0 === y1) {
            break;
        }
        const e2 = 2 * err;
        if (e2 >= dy) {
            err += dy;
            x0 += sx;
        }
        if (e2 <= dx) {
            err += dx;
            y0 += sy;
        }
    }
    return true;
}

function smoothPath(path, grid) {
    if (path.length < 3) {
        return path;
    }

    const newPath = [path[0]];
    let i = 0;

    while (i < path.length - 1) {
        let j = i + 2;
        let lastVisibleNodeIndex = i + 1;

        while (j < path.length) {
            if (hasLineOfSight(path[i], path[j], grid)) {
                lastVisibleNodeIndex = j;
                j++;
            } else {
                break;
            }
        }
        
        newPath.push(path[lastVisibleNodeIndex]);
        i = lastVisibleNodeIndex;
    }

    return newPath;
}