<!-- ui/components/IsoBoard.svelte -->
<script lang="ts">
    import { world_store } from "../stores/world";
    import { onMount } from "svelte";
    import {
        isAnimating,
        isPlayerTurn,
        player_combat_move,
        player_explore_move,
        start_turn_loop,
    } from "../lib/game_controller";
    import { get_current_unit_id } from "../../engine/combat";
    import { get_reachable_cells, find_path } from "../../engine/pathfinding";
    import {
        get_elevation_at,
        get_occupied_cells,
    } from "../../engine/map/level";
    import { get_active_level } from "../../engine/world";
    import { get } from "svelte/store";
    import { iso_to_screen, SPRITE_H, TILE_H } from "../lib/isometric";
    import HUD from "./hud.svelte";
    import IsoTile from "./iso_tile.svelte";
    import IsoStructure from "./iso_structure.svelte";
    import IsoUnit from "./iso_unit.svelte";

    // Calcule le viewBox serré autour du plateau avec une marge
    $: viewBox = (() => {
        const W = active_level.board.width;
        const H = active_level.board.height;
        const PAD = 60; // marge en pixels autour du plateau

        // Les 4 coins extrêmes du plateau en coords iso :
        // haut  = (0,0)      → sx=0,      sy=0
        // droite = (W-1,0)   → sx=(W-1)*(TILE_W/2), sy=(W-1)*(TILE_H/2)
        // bas   = (W-1,H-1)  → sx=0,      sy=(W+H-2)*(TILE_H/2)
        // gauche = (0,H-1)   → sx=-(H-1)*(TILE_W/2), sy=(H-1)*(TILE_H/2)
        const pts = [
            iso_to_screen(0, 0),
            iso_to_screen(W - 1, 0),
            iso_to_screen(W - 1, H - 1),
            iso_to_screen(0, H - 1),
        ];
        const xs = pts.map((p) => p.sx);
        const ys = pts.map((p) => p.sy);
        const minX = Math.min(...xs) - PAD;
        const minY = Math.min(...ys) - PAD - SPRITE_H; // espace pour les sprites
        const maxX = Math.max(...xs) + PAD;
        const maxY = Math.max(...ys) + PAD + TILE_H;
        return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
    })();

    $: world = $world_store;
    $: active_level = get_active_level(world);
    $: units = active_level.units.map((id) => world.units[id]);
    $: structures = Object.values(active_level.structures);

    let svg_el: SVGElement;
    onMount(() => {
        start_turn_loop();
        const handle_keydown = (e: KeyboardEvent) => {
            // Ignore si le focus est sur un input/button
            const tag = (e.target as HTMLElement).tagName;
            if (tag === "BUTTON" || tag === "INPUT") return;
            handle_svg_keydown(e);
        };

        window.addEventListener("keydown", handle_keydown);
        return () => window.removeEventListener("keydown", handle_keydown);
    });

    let reachable_cells = new Set<string>();
    let hovered_path = new Set<string>();
    let hovered_dest: string | null = null;
    let hovered_structure_id: number | null = null;

    $: if ($isPlayerTurn && !$isAnimating && world.state.mode === "combat") {
        const combat = world.combats[world.state.combat_id];
        const unit_id = get_current_unit_id(combat);
        const unit = world.units[unit_id];
        const mp = combat.unit_statuses[unit_id].current_stats.mp;
        const occupied = get_occupied_cells(active_level, world, unit_id);
        reachable_cells = get_reachable_cells(
            active_level,
            world,
            unit.pos,
            mp,
            occupied,
        );
    } else if (!$isPlayerTurn) {
        reachable_cells = new Set();
        hovered_path = new Set();
    }

    // Navigation clavier
    let focused_tile: { x: number; y: number } | null = null;
    let keyboard_cursor: string | null = null;
    // reset cursor when moving with keyboard
    $: if ($isPlayerTurn) {
        focused_tile = null;
        keyboard_cursor = null;
    }

    $: render_items = (() => {
        const items: Array<{
            type: "tile" | "unit" | "structure" | "structure-hotspot";
            z: number;
            data: any;
        }> = [];
        active_level.board.tiles.forEach((t) =>
            items.push({ type: "tile", z: t.x + t.y, data: t }),
        );
        structures.forEach((s) => {
            items.push({ type: "structure", z: s.pos.x + s.pos.y, data: s });
        });
        units.forEach((u) => {
            const zBonus = get_elevation_at(active_level, u.pos) > 0 ? 0.1 : 0;
            items.push({
                type: "unit",
                z: u.pos.x + u.pos.y + zBonus,
                data: u,
            });
        });
        return items.sort((a, b) => {
            if (a.z === b.z) {
                if (a.type === "tile") return -1;
                if (a.type === "structure" && b.type === "unit") return -1;
                return 1;
            }
            return a.z - b.z;
        });
    })();

    function on_tile_hover(x: number, y: number) {
        if (!$isPlayerTurn || $isAnimating || world.state.mode !== "combat")
            return;

        const target_key = `${x},${y}`;
        if (!reachable_cells.has(target_key)) {
            hovered_path = new Set();
            hovered_dest = null;
            return;
        }

        if (hovered_dest === target_key) return;

        const combat = world.combats[world.state.combat_id];
        const unit_id = get_current_unit_id(combat);
        const unit = world.units[unit_id];
        const occupied = get_occupied_cells(active_level, world, unit_id);

        const path = find_path(
            active_level,
            world,
            unit.pos,
            { x, y },
            occupied,
        );
        if (path) {
            const intermediate = path.slice(1, -1);
            hovered_path = new Set(intermediate.map((c) => `${c.x},${c.y}`));
            hovered_dest = target_key;
        } else {
            hovered_path = new Set();
            hovered_dest = null;
        }
    }

    function clear_hover() {
        hovered_path = new Set();
        hovered_dest = null;
    }

    function handle_svg_keydown(e: KeyboardEvent) {
        const W = active_level.board.width;
        const H = active_level.board.height;

        if (world.state.mode === "combat") {
            if (!$isPlayerTurn || $isAnimating) return;
        } else {
            if ($isAnimating) return;
        }

        if (!focused_tile) {
            if (world.state.mode === "combat") {
                const combat = world.combats[world.state.combat_id];
                const unit_id = get_current_unit_id(combat);
                focused_tile = { ...world.units[unit_id].pos };
            } else {
                focused_tile = { ...units[0].pos };
            }
            on_tile_hover(focused_tile.x, focused_tile.y);
            return;
        }

        let { x, y } = focused_tile;
        if (e.key === "ArrowRight") x = Math.min(W - 1, x + 1);
        else if (e.key === "ArrowLeft") x = Math.max(0, x - 1);
        else if (e.key === "ArrowDown") y = Math.min(H - 1, y + 1);
        else if (e.key === "ArrowUp") y = Math.max(0, y - 1);
        else if (e.key === "Enter" || e.key === " ") {
            cell_click(focused_tile.x, focused_tile.y);
            return;
        } else return;

        e.preventDefault();
        focused_tile = { x, y };
        keyboard_cursor = `${x},${y}`;
        on_tile_hover(x, y);
    }

    async function cell_click(x: number, y: number) {
        if (world.state.mode === "combat") {
            if (!$isPlayerTurn || $isAnimating) return; // garde uniquement en combat
            const combat = world.combats[world.state.combat_id];
            const unit_id = get_current_unit_id(combat);
            const unit = world.units[unit_id];
            const occupied = get_occupied_cells(active_level, world, unit_id);
            const path = find_path(
                active_level,
                world,
                unit.pos,
                { x, y },
                occupied,
            );
            if (!path) return;
            hovered_path = new Set();
            await player_combat_move(path, reachable_cells);
        } else {
            // Pas de guard isAnimating ici — player_explore_move annule lui-même
            const unit = units[0];
            if (!unit) return;
            const occupied = get_occupied_cells(active_level, world, unit.id);
            // Le pathfinding repart DEPUIS LA POSITION ACTUELLE de l'unité (mid-animation)
            const current_pos = get(world_store).units[unit.id].pos;
            const path = find_path(
                active_level,
                world,
                current_pos,
                { x, y },
                occupied,
            );
            if (!path || path.length < 2) return;
            hovered_path = new Set();
            await player_explore_move(path, unit.id);
        }
    }
</script>

<div class="board-container">
    <div class="hud">
        <HUD {world} />
    </div>

    <div class="board-wrapper">
        <svg
            aria-label="Isometric board"
            role="grid"
            tabindex="0"
            {viewBox}
            bind:this={svg_el}
            on:mouseleave={() => {
                hovered_structure_id = null;
                clear_hover();
            }}
        >
            {#each render_items as item (item.type + "-" + (item.data.id || `${item.data.x}-${item.data.y}`))}
                {#if item.type === "tile"}
                    {@const key = `${item.data.x},${item.data.y}`}
                    <IsoTile
                        x={item.data.x}
                        y={item.data.y}
                        reachable={reachable_cells.has(key)}
                        is_path={hovered_path.has(key)}
                        is_dest={hovered_dest === key}
                        is_keyboard_focus={keyboard_cursor === key}
                        on_click={cell_click}
                        on_hover={on_tile_hover}
                        on_leave={clear_hover}
                    />
                {:else if item.type === "structure"}
                    <!-- La structure est rendue normalement, mais sans pointer-events.
                    Le hotspot (ci-dessous dans le z-order) gère hover/click.
                    On applique l'opacité via style inline pour éviter tout conflit CSS. -->
                    <IsoStructure
                        structure={item.data}
                        is_hovered={hovered_structure_id === item.data.id}
                        on_hover_enter={() =>
                            (hovered_structure_id = item.data.id)}
                        on_hover_leave={() => {
                            hovered_structure_id = null;
                            clear_hover();
                        }}
                        on_click={() =>
                            cell_click(item.data.pos.x, item.data.pos.y)}
                        {on_tile_hover}
                    />
                {:else if item.type === "unit"}
                    <IsoUnit
                        unit={item.data}
                        level={active_level}
                        team={world.state.mode === "combat"
                            ? (world.combats[world.state.combat_id]
                                  .unit_statuses[item.data.id]?.team ?? null)
                            : null}
                    />
                {/if}
            {/each}
        </svg>
    </div>
</div>

<style>
    .board-wrapper {
        flex: 1;
        min-height: 0;
        overflow: hidden;
    }

    svg {
        width: 100%;
        height: 100%;
        touch-action: manipulation;
        user-select: none;
        display: block;
    }

    svg:focus {
        outline: none;
    }
    svg:focus-visible {
        outline: 2px solid #3b82f6;
        outline-offset: 2px;
    }

    .board-container {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100vh;
    }

    .hud {
        padding: 8px;
        display: flex;
        gap: 8px;
        align-items: center;
    }
</style>
