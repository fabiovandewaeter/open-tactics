// lib/game_comtroller.ts
import { get } from 'svelte/store';
import { world_store } from '../stores/world'; // Ton store Svelte
import { combat_is_active, next_turn_logic, get_current_unit_id, move_unit_in_combat, spawn_combat } from '../../engine/combat';
import type { Coord, LevelId, UnitId, World } from '../../engine/types';
import { compute_ai_turn } from '../../engine/combat';
import type { CombatAction, CombatId, Team, UnitCombatState } from '../../engine/combat_types';
import { add_unit_to_level, create_empty_level, get_active_level, move_unit_in_level } from '../../engine/board';

/** Retourne le level actuellement affiché, qu'on soit en combat ou en explore. */
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Tente de déplacer une unité. Délègue aux règles du bon contexte.
 * Retourne true si le mouvement est autorisé et effectué.
 */
export function try_move_unit(world: World, unit_id: UnitId, to: Coord): boolean {
    if (world.state.mode === "combat") {
        const combat = world.combats[world.state.combat_id];
        return move_unit_in_combat(combat, unit_id, to, world);
    } else {
        const level = get_active_level(world);
        return move_unit_in_level(level, unit_id, to, world);
    }
}

/**
 * Transition explore -> combat
 */
export function enter_combat(world: World, combat_id: CombatId, combat_level_id: LevelId) {
    if (world.state.mode !== "explore") throw new Error("Already in combat");
    world.state = {
        mode: "combat",
        combat_id,
        level_id: combat_level_id,
        origin_level_id: world.state.level_id,
    };
}

/**
 * Transition combat -> explore (retour au level d'origine)
 */
export function exit_combat(world: World) {
    if (world.state.mode !== "combat") throw new Error("Not in combat");
    const origin = world.state.origin_level_id;
    world.state = { mode: "explore", level_id: origin };
}

// Indicateur pour l'UI : est-ce que le joueur humain peut cliquer ?
// export let isPlayerTurn = false;
import { writable } from 'svelte/store';
export const isPlayerTurn = writable(false);

export async function start_turn_loop() {
    let world = get(world_store);

    if (world.state.mode !== "combat") {
        console.log("Pas en combat, rien à faire.");
        return;
    }

    const combat = world.combats[world.state.combat_id];

    if (!combat || !combat_is_active(combat)) {
        console.log("Combat terminé !");
        return;
    }

    const currentUnitId = get_current_unit_id(combat);
    const unitState = combat.unit_statuses[currentUnitId];

    if (unitState.team === "A") {
        console.log("C'est au JOUEUR de jouer.");
        isPlayerTurn.set(true);
        // On s'arrête ici. On attend que le joueur clique sur une case via l'UI.
        // L'UI appellera player_action() quand le clic aura lieu.
    } else {
        console.log("C'est à l'IA de jouer.");
        isPlayerTurn.set(false);

        // 1. Calculer tout le tour
        const actions = compute_ai_turn(combat, world);

        // 2. Exécuter visuellement
        for (const action of actions) {
            await execute_action(action);
            await sleep(500); // Petite pause entre les actions
        }

        // 3. Fin du tour IA -> On passe au suivant
        finish_turn();
    }
}

// Appelé par l'UI (clic joueur) ou la boucle (IA)
async function execute_action(action: CombatAction) {
    world_store.update(w => {
        if (action.type === "MOVE") {
            const dest = action.path[action.path.length - 1];
            try_move_unit(w, action.unit_id, dest); // Plus besoin de savoir si combat ou pas
        }
        return w;
    });
    if (action.type === "MOVE") await sleep(300);
}

// Appelé quand le joueur a fini son clic ou que l'IA a fini ses actions
export function finish_turn() {
    world_store.update(w => {
        if (w.state.mode !== "combat") {
            throw new Error("finish_turn appelé hors combat");
        }

        const combat = w.combats[w.state.combat_id];
        if (!combat) {
            throw new Error(`Combat ${w.state.combat_id} not found in world.combats`)
        }

        next_turn_logic(combat);
        return w;
    });
    // On relance la boucle pour voir qui est le suivant
    start_turn_loop();
}

// L'UI appelle ça quand on clique sur une case
export async function player_attempt_move(target: Coord) {
    if (!get(isPlayerTurn)) {
        return;
    }

    const w = get(world_store);

    if (w.state.mode !== "combat") {
        // Mode explore : déplacement libre du héros sélectionné
        // TODO: identifier quelle unité le joueur contrôle en explore
        console.log("Déplacement en explore, à implémenter.");
        return;
    }

    const combat = w.combats[w.state.combat_id];
    if (!combat) throw new Error(`Combat ${w.state.combat_id} introuvable`);

    const unitId = get_current_unit_id(combat);

    // Créer l'action
    const action: CombatAction = {
        type: "MOVE",
        unit_id: unitId,
        path: [target] // Ici tu devrais calculer le vrai chemin
    };

    isPlayerTurn.set(false); // On bloque les clics pendant l'anim
    await execute_action(action);
    finish_turn(); // Le joueur a fini (mode simple: 1 mouv = fin tour)
}

export function start_combat_from_current_level() {
    world_store.update(w => {
        if (w.state.mode === "combat") {
            console.warn("Déjà en combat !");
            return w;
        }

        const explore_level = get_active_level(w);
        const unit_ids = explore_level.units;

        if (unit_ids.length < 2) {
            console.warn("Pas assez d'unités pour un combat.");
            return w;
        }

        // Crée un level de combat (copie de l'explore)
        const combat_level_id: LevelId = w.next_level_id++;
        const combat_level = create_empty_level(combat_level_id, explore_level.board.width, explore_level.board.height);
        combat_level.board = explore_level.board; // même board
        combat_level.structures = explore_level.structures;
        w.levels[combat_level_id] = combat_level;

        // Crée les unit_statuses : moitié équipe A, moitié équipe B
        const unit_statuses: Record<UnitId, UnitCombatState> = {};
        const initiative: UnitId[] = [];

        unit_ids.forEach((uid, i) => {
            const unit = w.units[uid];
            const team: Team = i < Math.ceil(unit_ids.length / 2) ? "A" : "B";

            unit_statuses[uid] = {
                id: uid,
                pos: unit.pos,
                team,
                alive: true,
                has_played: false,
                current_stats: { ...unit.max_stats },
            };

            add_unit_to_level(combat_level, uid);
            initiative.push(uid);
        });

        // Spawn le combat
        const combat_id = spawn_combat(w, {
            unit_statuses,
            current_turn: 1,
            initiative,
            initiative_index: 0,
        });

        // Transition explore -> combat
        enter_combat(w, combat_id, combat_level_id);

        return w;
    });

    // Lance la boucle de tour
    start_turn_loop();
}
