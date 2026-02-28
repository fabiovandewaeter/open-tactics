// engine/combat.ts
import { get_active_level, get_elevation_at } from "./board";
import type { Combat, CombatAction, CombatId, UnitCombatState } from "./combat_types";
import type { UnitId, Coord, World, Unit, Level } from "./types";

export function spawn_combat(world: World, combat_partial: Omit<Combat, "id">): CombatId {
    const id: CombatId = world.next_combat_id++;
    const combat: Combat = { id, ...combat_partial };
    world.combats[id] = combat;
    return id;
}

export function move_unit_in_combat(combat: Combat, unit_id: UnitId, to: Coord, world: World): boolean {
    const unit: Unit = world.units[unit_id];
    if (!unit) {
        return false
    }

    const unit_combat_state: UnitCombatState = combat.unit_statuses[unit_id];
    if (!unit_combat_state) {
        return false;
    }

    const level: Level = get_active_level(world);
    if (!level) {
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

export function compute_ai_turn(combat: Combat, world: World): CombatAction[] {
    const unit_id = get_current_unit_id(combat);
    const unit = world.units[unit_id];

    // LOGIQUE DUMB : L'IA bouge d'une case vers la droite si possible
    const actions: CombatAction[] = [];

    // Ici tu mettrais ton A* (Pathfinding)
    // Simulasation d'un mouvement : case actuelle -> case à droite
    const path = [unit.pos, { x: unit.pos.x + 1, y: unit.pos.y }];

    actions.push({ type: "MOVE", unit_id, path });
    actions.push({ type: "WAIT", unit_id }); // Fin du tour obligatoire

    return actions;
}

// Vérifie si le combat continue (au moins 1 vivant dans chaque équipe)
export function combat_is_active(combat: Combat): boolean {
    const teamA_alive = Object.values(combat.unit_statuses).some(u => u.team === "A" && u.alive);
    const teamB_alive = Object.values(combat.unit_statuses).some(u => u.team === "B" && u.alive);
    return teamA_alive && teamB_alive;
}

// Passe au tour suivant et retourne l'ID de l'unité qui doit jouer
export function next_turn_logic(combat: Combat): UnitId {
    let loop_guard = 0;

    // On boucle tant qu'on tombe sur des morts (pour les sauter)
    do {
        combat.initiative_index++;

        // Si on dépasse la fin de la liste, on boucle au début et on augmente le tour
        if (combat.initiative_index >= combat.initiative.length) {
            combat.initiative_index = 0;
            combat.current_turn++;
        }

        loop_guard++;
        // Sécurité anti-boucle infinie (si tout le monde est mort)
        if (loop_guard > combat.initiative.length + 1) return -1;

    } while (!combat.unit_statuses[combat.initiative[combat.initiative_index]].alive);

    return combat.initiative[combat.initiative_index];
}

// Helper pour savoir qui joue
export function get_current_unit_id(combat: Combat): UnitId {
    return combat.initiative[combat.initiative_index];
}
