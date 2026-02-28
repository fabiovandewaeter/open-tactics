<!-- ui/components/IsoBoard.svelte -->
<script lang="ts">
    import { world_store } from "../stores/world";
    import characterSvg from "../assets/character.svg";
    import { onMount } from "svelte";
    import {
        finish_turn,
        isAnimating,
        isPlayerTurn,
        player_attempt_move,
        start_combat_from_current_level,
        start_turn_loop,
    } from "../lib/game_controller";
    import { get_current_unit_id } from "../../engine/combat";
    import { get_reachable_cells, find_path } from "../../engine/pathfinding";
    import type { Coord } from "../../engine/types";
    import {
        get_elevation_at,
        get_occupied_cells,
    } from "../../engine/map/level";
    import { get_active_level } from "../../engine/world";

    const TILE_W = 80;
    const TILE_H = 40;
    const ORIGIN_X = 600;
    const ORIGIN_Y = 40;
    const SPRITE_W = 50;
    const SPRITE_H = 60;

    $: world = $world_store;
    $: active_level = get_active_level(world);
    $: units = active_level.units.map((id) => world.units[id]);
    $: structures = Object.values(active_level.structures);

    onMount(() => {
        start_turn_loop();
    });

    let reachable_cells = new Set<string>();
    let hovered_path = new Set<string>();

    // ✅ Recalcule la zone verte uniquement quand c'est le tour du joueur ET qu'on n'anime pas.
    // Le $isAnimating bloque le recalcul pendant l'animation, évitant le flash de zone verte.
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
        // On vide uniquement quand ce n'est plus le tour du joueur (pas pendant l'anim)
        reachable_cells = new Set();
        hovered_path = new Set();
    }

    function on_tile_hover(x: number, y: number) {
        if (!$isPlayerTurn || $isAnimating || world.state.mode !== "combat")
            return;

        const target_key = `${x},${y}`;
        if (!reachable_cells.has(target_key)) {
            hovered_path = new Set();
            return;
        }

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
        hovered_path = path
            ? new Set(path.map((c) => `${c.x},${c.y}`))
            : new Set();
    }

    function iso_to_screen(x: number, y: number, zOffset: number = 0) {
        const sx = (x - y) * (TILE_W / 2);
        const sy = (x + y) * (TILE_H / 2) - zOffset;
        return { sx: sx + ORIGIN_X, sy: sy + ORIGIN_Y };
    }

    function tile_polygon(x: number, y: number) {
        const { sx, sy } = iso_to_screen(x, y);
        const hw = TILE_W / 2;
        const hh = TILE_H / 2;
        return `${sx},${sy - hh} ${sx + hw},${sy} ${sx},${sy + hh} ${sx - hw},${sy}`;
    }

    async function cell_click(x: number, y: number) {
        if (!$isPlayerTurn || $isAnimating) return;
        if (world.state.mode !== "combat") return;

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

        hovered_path = new Set(); // Vide le chemin survolé immédiatement au clic
        await player_attempt_move(path, reachable_cells);
    }

    $: render_items = (() => {
        const items: Array<{
            type: "tile" | "unit" | "structure";
            z: number;
            data: any;
        }> = [];
        active_level.board.tiles.forEach((t) =>
            items.push({ type: "tile", z: t.x + t.y, data: t }),
        );
        structures.forEach((s) =>
            items.push({ type: "structure", z: s.pos.x + s.pos.y, data: s }),
        );
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

    function project_3D(
        cx: number,
        cy: number,
        lx: number,
        ly: number,
        lz: number,
        scale: number,
    ) {
        const sx = cx + (lx - ly) * (TILE_W / 2) * scale;
        const sy = cy + (lx + ly) * (TILE_H / 2) * scale - lz;
        return `${sx},${sy}`;
    }

    type Face = { points: string[]; type: "top" | "left" | "right" };

    function get_shape_faces(
        shape_type: string,
        cx: number,
        cy: number,
        scale: number,
        height: number,
    ): Face[] {
        const p = (lx: number, ly: number, lz: number) =>
            project_3D(cx, cy, lx, ly, lz, scale);
        const create_box = (
            ox: number,
            oy: number,
            oz: number,
            w: number,
            d: number,
            h: number,
        ): Face[] => {
            const topN = p(ox - w, oy - d, oz + h),
                topE = p(ox + w, oy - d, oz + h);
            const topS = p(ox + w, oy + d, oz + h),
                topW = p(ox - w, oy + d, oz + h);
            const bot_s = p(ox + w, oy + d, oz),
                bot_e = p(ox + w, oy - d, oz),
                botW = p(ox - w, oy + d, oz);
            return [
                { type: "top", points: [topN, topE, topS, topW] },
                { type: "right", points: [topE, topS, bot_s, bot_e] },
                { type: "left", points: [topW, topS, bot_s, botW] },
            ];
        };
        if (shape_type === "cube") return create_box(0, 0, 0, 0.5, 0.5, height);
        const n = p(-0.5, -0.5, height),
            n0 = p(-0.5, -0.5, 0);
        const e = p(0.5, -0.5, height),
            e0 = p(0.5, -0.5, 0);
        const s = p(0.5, 0.5, height),
            s0 = p(0.5, 0.5, 0);
        const w = p(-0.5, 0.5, height),
            w0 = p(-0.5, 0.5, 0);
        if (shape_type === "wedge-nw")
            return [
                { type: "left", points: [w, s0, w0] },
                { type: "right", points: [n, e0, n0] },
                { type: "top", points: [n, e0, s0, w] },
            ];
        if (shape_type === "wedge-ne")
            return [
                { type: "left", points: [n, w0, n0] },
                { type: "right", points: [e, s0, e0] },
                { type: "top", points: [n, e, s0, w0] },
            ];
        if (shape_type === "wedge-se")
            return [
                { type: "left", points: [w0, s, s0] },
                { type: "right", points: [e, s, s0, e0] },
                { type: "top", points: [n0, e, s, w0] },
            ];
        if (shape_type === "wedge-sw")
            return [
                { type: "left", points: [w, s, s0, w0] },
                { type: "right", points: [e0, s, s0] },
                { type: "top", points: [n0, e0, s, w] },
            ];
        if (shape_type === "step")
            return create_box(0, 0, 0, 0.5, 0.5, height / 2);
        return create_box(0, 0, 0, 0.2, 0.2, height * 0.5);
    }
</script>

<div class="hud">
    {#if $world_store.state.mode === "explore"}
        <button on:click={start_combat_from_current_level}
            >⚔️ Lancer le combat</button
        >
    {:else if $isPlayerTurn && world.state.mode === "combat"}
        {@const combat = world.combats[world.state.combat_id]}
        {@const unit_id = get_current_unit_id(combat)}
        {@const mp = combat.unit_statuses[unit_id].current_stats.mp}
        <span>🟦 Ton tour — <strong>{mp} MP</strong> restants</span>
        <button class="end-turn-btn" on:click={finish_turn}
            >✅ Fin du tour</button
        >
    {:else}
        <span>🔴 IA en train de jouer...</span>
    {/if}
</div>

<svg width="1200" height="720" aria-label="Isometric board">
    {#each render_items as item (item.type + "-" + (item.data.id || `${item.data.x}-${item.data.y}`))}
        {#if item.type === "tile"}
            {@const key = `${item.data.x},${item.data.y}`}
            <polygon
                class="tile"
                class:reachable={reachable_cells.has(key)}
                class:path-hover={hovered_path.has(key)}
                points={tile_polygon(item.data.x, item.data.y)}
                on:click={() => cell_click(item.data.x, item.data.y)}
                on:mouseenter={() => on_tile_hover(item.data.x, item.data.y)}
            />
        {:else if item.type === "structure"}
            {@const { sx: cx, sy: cy } = iso_to_screen(
                item.data.pos.x,
                item.data.pos.y,
            )}
            {@const key = `${item.data.pos.x},${item.data.pos.y}`}
            {@const is_reachable = reachable_cells.has(key)}
            {@const is_path = hovered_path.has(key)}
            <g
                class="structure clickable"
                on:click={() => cell_click(item.data.pos.x, item.data.pos.y)}
                on:mouseenter={() =>
                    on_tile_hover(item.data.pos.x, item.data.pos.y)}
            >
                {#each get_shape_faces(item.data.shape, cx, cy, 1, item.data.height) as face}
                    <polygon
                        points={face.points.join(" ")}
                        class="face-{face.type}"
                        class:face-reachable-top={is_reachable &&
                            face.type === "top"}
                        class:face-reachable-left={is_reachable &&
                            face.type === "left"}
                        class:face-reachable-right={is_reachable &&
                            face.type === "right"}
                        class:face-path-top={is_path && face.type === "top"}
                        class:face-path-left={is_path && face.type === "left"}
                        class:face-path-right={is_path && face.type === "right"}
                    />
                {/each}
                <text x={cx} y={cy - item.data.height - 5} class="unit-label"
                    >{item.data.name}</text
                >
            </g>
        {:else if item.type === "unit"}
            {@const elevation = get_elevation_at(active_level, item.data.pos)}
            {@const { sx: cx, sy: cy } = iso_to_screen(
                item.data.pos.x,
                item.data.pos.y,
                elevation,
            )}
            <g class="entity" class:team-b={item.data.team === "B"}>
                <ellipse
                    {cx}
                    {cy}
                    rx={TILE_W * 0.35}
                    ry={TILE_H * 0.35}
                    class="unit-indicator"
                />
                <image
                    href={characterSvg}
                    x={cx - SPRITE_W / 2}
                    y={cy - SPRITE_H + TILE_H / 4}
                    width={SPRITE_W}
                    height={SPRITE_H}
                />
                <text x={cx} y={cy - SPRITE_H + 7} class="unit-label"
                    >{item.data.name}</text
                >
            </g>
        {/if}
    {/each}
</svg>

<style>
    svg {
        touch-action: manipulation;
        user-select: none;
    }

    .tile {
        fill: #e6e2d3;
        stroke: #bdb0a0;
        stroke-width: 1px;
        cursor: pointer;
    }
    .tile:hover {
        fill: #f0e8d8;
    }
    .tile.reachable {
        fill: #86efac;
        stroke: #22c55e;
    }
    .tile.reachable:hover {
        fill: #4ade80;
    }
    .tile.path-hover {
        fill: #fde047;
        stroke: #eab308;
    }

    .unit-label {
        font-family: system-ui, Arial, sans-serif;
        font-size: 11px;
        font-weight: 600;
        pointer-events: none;
        fill: #222;
        text-anchor: middle;
        paint-order: stroke;
        stroke: white;
        stroke-width: 2px;
    }

    /* Structures : faces normales */
    .structure {
        pointer-events: none;
    }
    .face-top {
        fill: #9ca3af;
        stroke: #4b5563;
        stroke-width: 0.5px;
    }
    .face-left {
        fill: #6b7280;
        stroke: #4b5563;
        stroke-width: 0.5px;
    }
    .face-right {
        fill: #4b5563;
        stroke: #374151;
        stroke-width: 0.5px;
    }

    /* ✅ Structures atteignables : teinte verte avec les 3 faces respectant l'éclairage */
    .face-reachable-top {
        fill: #86efac;
        stroke: #22c55e;
    }
    .face-reachable-left {
        fill: #4ade80;
        stroke: #16a34a;
    }
    .face-reachable-right {
        fill: #22c55e;
        stroke: #15803d;
    }

    /* ✅ Structures sur le chemin survolé : teinte jaune */
    .face-path-top {
        fill: #fde047;
        stroke: #eab308;
    }
    .face-path-left {
        fill: #facc15;
        stroke: #ca8a04;
    }
    .face-path-right {
        fill: #eab308;
        stroke: #a16207;
    }

    .team-b image {
        filter: hue-rotate(180deg) brightness(0.9);
    }
    .unit-indicator {
        fill: rgba(0, 0, 0, 0.2);
        stroke: #3b82f6;
        stroke-width: 2px;
    }
    .team-b .unit-indicator {
        stroke: #ef4444;
    }
    .entity:hover .unit-indicator {
        fill: rgba(255, 255, 255, 0.3);
        stroke-width: 3px;
    }

    .structure.clickable {
        pointer-events: auto;
        cursor: pointer;
    }

    .hud {
        padding: 8px;
        display: flex;
        gap: 8px;
        align-items: center;
    }
    .hud button {
        padding: 6px 14px;
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
    }
    .hud button:hover {
        background: #2563eb;
    }
    .end-turn-btn {
        background: #22c55e !important;
    }
    .end-turn-btn:hover {
        background: #16a34a !important;
    }
</style>
