// engine/board.ts
import type { Board, Coord, Level, LevelId, Structure, StructureId, Unit, UnitId, World } from "./types"

export function create_board(width = 10, height = 10): Board {
    const tiles = [] as Board["tiles"];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            tiles.push({ x, y })
        }
    }
    return { width, height, tiles };
}

export function create_empty_level(id: LevelId, width = 10, height = 10): Level {
    return {
        id,
        board: create_board(width, height),
        units: [],
        structures: {},
        next_structure_id: 1,
    };
}

export function create_default_world(): World {
    let world: World = {
        levels: {},
        units: {},
        combats: {},
        state: {
            mode: "explore",
            level_id: 1,
        },
        next_unit_id: 1,
        next_level_id: 1,
        next_combat_id: 1,
    };

    // spawn level
    const id: LevelId = world.next_level_id++;
    const level = create_empty_level(id);
    world.levels[id] = level;

    return world;
}

export function get_active_level(world: World): Level {
    const level_id = world.state.level_id;
    return world.levels[level_id];
}

export function spawn_unit(world: World, unit_partial: Omit<Unit, "id">): UnitId {
    const id: UnitId = world.next_unit_id++;
    const unit: Unit = { id, ...unit_partial };
    world.units[id] = unit;
    return id;
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

export function delete_unit(world: World, unit_id: UnitId) {
    delete world.units[unit_id];
}

/** does not delete the unit from the world */
export function remove_unit_from_level(level: Level, unit_id: UnitId) {
    level.units = level.units.filter(id => id !== unit_id);
}

export function get_elevation_at(level: Level, pos: Coord): number {
    // Cherche s'il y a une structure sur cette case
    const struct = Object.values(level.structures).find(s => s.pos.x === pos.x && s.pos.y === pos.y)
    return struct ? struct.elevation_change : 0
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

    const currentElevation = get_elevation_at(level, unit.pos)
    const targetElevation = get_elevation_at(level, to)

    const elevationDiff = Math.abs(targetElevation - currentElevation)

    const MAX_STEP_HEIGHT = 20;
    if (elevationDiff > MAX_STEP_HEIGHT) {
        console.log(`Mouvement bloqué : La marche est trop haute (${elevationDiff} pixels) ! Max autorisé : ${MAX_STEP_HEIGHT}`);
        return false;
    }

    unit.pos = { x: to.x, y: to.y }
    return true
}

export function get_units_array(world: World) {
    return Object.values(world.units)
}
