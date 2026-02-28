// engine/combat_types.ts
import type { LevelId, UnitId, Coord, UnitStats } from "./types";

export type CombatId = number
export type SpellId = string

export type Team = "A" | "B"

// during battle only
export type UnitCombatState = {
    id: UnitId,
    pos: Coord,
    team: Team,
    temporary?: boolean, // true for summoned-only-for-combat units
    alive: boolean,
    has_played: boolean,
    current_stats: UnitStats, // change during combats but does not affet unit max stats permanently
    //facing, buffs, debuffs ...
}

// engine/combat_type.ts
export type Combat = {
    id: CombatId,
    // level_id: LevelId,
    // outside_level_id?: LevelId, // where to tp units after combat if different from world.non_combat_current_level
    unit_statuses: Record<UnitId, UnitCombatState>,
    current_turn: number,

    initiative: UnitId[], // play order
    initiative_index: number,
}

export type ActionType = "MOVE" | "WAIT" | "SPELL";

export type CombatAction =
    | { type: "MOVE", unit_id: UnitId, path: Coord[] } // Le chemin complet pour l'animation
    | { type: "SPELL", unit_id: UnitId, target: Coord, spell_id: SpellId }
    | { type: "WAIT", unit_id: UnitId }; // Passer son tour
