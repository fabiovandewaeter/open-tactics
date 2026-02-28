// engine/map/level.ts
import { create_board } from "./board";
import type { LevelId, Level, Coord, Structure, StructureId, Unit, UnitId, World } from "../types";

export function create_empty_level(id: LevelId, width = 10, height = 10): Level {
    return {
        id,
        board: create_board(width, height),
        units: [],
        structures: {},
        next_structure_id: 1,
    };
}

export function add_unit_to_level(level: Level, unit_id: UnitId) {
    if (!level.units.includes(unit_id)) {
        level.units.push(unit_id);
    }
}

export function spawn_structure(level: Level, struct_partial: Omit<Structure, "id">): StructureId {
    const id: StructureId = level.next_structure_id++;
    const structure: Structure = { id, ...struct_partial };
    level.structures[id] = structure;
    return id;
}

/** does not delete the unit from the world */
export function remove_unit_from_level(level: Level, unit_id: UnitId) {
    level.units = level.units.filter(id => id !== unit_id);
}

export function move_unit_in_level(level: Level, unit_id: UnitId, to: Coord, world: World): boolean {
    const unit: Unit = world.units[unit_id];
    if (!unit) {
        return false
    }
    if (!level.units.includes(unit_id)) {
        return false;
    }

    if (to.x < 0 || to.y < 0 || to.x >= level.board.width || to.y >= level.board.height) return false

    unit.pos = { x: to.x, y: to.y }
    return true
}

export function get_occupied_cells(level: Level, world: World, exclude_unit_id?: number): Set<string> {
    const occupied = new Set<string>();
    for (const uid of level.units) {
        if (uid === exclude_unit_id) continue;
        const unit = world.units[uid];
        occupied.add(`${unit.pos.x},${unit.pos.y}`);
    }
    return occupied;
}

export function get_elevation_at(level: Level, pos: Coord): number {
    const struct = Object.values(level.structures).find(s => s.pos.x === pos.x && s.pos.y === pos.y)
    return struct ? struct.height : 0
}
