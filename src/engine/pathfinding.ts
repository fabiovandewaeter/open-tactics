// engine/pathfinding.ts
import type { Coord, Level, World } from "./types";

/** Manhattan */
function heuristic(a: Coord, b: Coord): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function coord_key(c: Coord) {
    return `${c.x},${c.y}`;
}

function get_neighbors(pos: Coord, level: Level): Coord[] {
    const dirs = [
        { x: 1, y: 0 }, { x: -1, y: 0 },
        { x: 0, y: 1 }, { x: 0, y: -1 },
    ];
    return dirs
        .map(d => ({ x: pos.x + d.x, y: pos.y + d.y }))
        .filter(c =>
            c.x >= 0 && c.y >= 0 &&
            c.x < level.board.width &&
            c.y < level.board.height
        );
}

/** Retourne true si la case contient une structure qui bloque le passage */
function is_blocked_by_structure(level: Level, pos: Coord): boolean {
    const struct = Object.values(level.structures).find(
        s => s.pos.x === pos.x && s.pos.y === pos.y
    );
    // Bloque si la structure existe ET n'est pas walkable
    return struct !== undefined && !struct.walkable;
}

function is_passable(level: Level, world: World, from: Coord, to: Coord, occupied: Set<string>): boolean {
    if (occupied.has(coord_key(to))) return false;
    if (is_blocked_by_structure(level, to)) return false;
    return true;
}

export type PathResult = Coord[] | null; // null = pas de chemin
type AStarNode = {
    coord: Coord;
    g: number;
    f: number;
    parent: string | null;
};

export function find_path(
    level: Level,
    world: World,
    from: Coord,
    to: Coord,
    occupied: Set<string>, // cases bloquées (autres unités)
): PathResult {
    const open = new Map<string, AStarNode>();
    const closed = new Set<string>();
    // ✅ FIX: On garde tous les nœuds visités (open + closed) pour reconstruire le chemin
    const all_nodes = new Map<string, AStarNode>();

    const start_key = coord_key(from);
    const goal_key = coord_key(to);

    const start_node = { coord: from, g: 0, f: heuristic(from, to), parent: null };
    open.set(start_key, start_node);
    all_nodes.set(start_key, start_node);

    while (open.size > 0) {
        let current_key = "";
        let current_node: AStarNode = { coord: from, g: Infinity, f: Infinity, parent: null };
        for (const [k, v] of open) {
            if (v.f < current_node.f) { current_key = k; current_node = v; }
        }

        if (current_key === goal_key) {
            const path: Coord[] = [];
            let key: string | null = current_key;
            while (key) {
                const node = all_nodes.get(key);
                if (!node) break;
                path.unshift(node.coord);
                key = node.parent;
            }
            return path;
        }

        open.delete(current_key);
        closed.add(current_key);

        for (const neighbor of get_neighbors(current_node.coord, level)) {
            const nk = coord_key(neighbor);
            if (closed.has(nk)) continue;
            if (!is_passable(level, world, current_node.coord, neighbor, occupied)) continue;

            const g = current_node.g + 1;
            const existing = open.get(nk);
            if (!existing || g < existing.g) {
                const new_node = { coord: neighbor, g, f: g + heuristic(neighbor, to), parent: current_key };
                open.set(nk, new_node);
                all_nodes.set(nk, new_node);
            }
        }
    }

    return null;
}

/** Toutes les cases atteignables en max `mp` pas */
export function get_reachable_cells(
    level: Level,
    world: World,
    from: Coord,
    mp: number,
    occupied: Set<string>,
): Set<string> {
    const reachable = new Set<string>();
    const queue: { coord: Coord; steps: number }[] = [{ coord: from, steps: 0 }];
    const visited = new Map<string, number>();
    visited.set(coord_key(from), 0);

    while (queue.length > 0) {
        const { coord, steps } = queue.shift()!;
        if (steps >= mp) continue;

        for (const neighbor of get_neighbors(coord, level)) {
            const nk = coord_key(neighbor);
            if (!is_passable(level, world, coord, neighbor, occupied)) continue;
            if ((visited.get(nk) ?? Infinity) <= steps + 1) continue;

            visited.set(nk, steps + 1);
            reachable.add(nk);
            queue.push({ coord: neighbor, steps: steps + 1 });
        }
    }

    return reachable;
}
