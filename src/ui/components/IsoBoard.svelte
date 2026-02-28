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
    const SPRITE_W = 50;
    const SPRITE_H = 60;

    // On centre l'origine sur (0,0) en coordonnées SVG brutes,
    // puis on calcule le viewBox exact autour du plateau.
    const ORIGIN_X = 0;
    const ORIGIN_Y = 0;

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

    onMount(() => {
        start_turn_loop();
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

    // Navigation clavier
    let focused_tile: { x: number; y: number } | null = null;

    function handle_svg_keydown(e: KeyboardEvent) {
        if (!$isPlayerTurn || $isAnimating || world.state.mode !== "combat")
            return;

        const W = active_level.board.width;
        const H = active_level.board.height;

        if (!focused_tile) {
            // Démarre au centre si rien n'est focusé
            focused_tile = { x: Math.floor(W / 2), y: Math.floor(H / 2) };
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
        on_tile_hover(x, y);
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

        hovered_path = new Set();
        await player_attempt_move(path, reachable_cells);
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
            // Hotspot invisible rendu APRES la structure pour capter hover/click
            // z légèrement supérieur pour être au-dessus dans le SVG
            items.push({
                type: "structure-hotspot",
                z: s.pos.x + s.pos.y + 0.05,
                data: s,
            });
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

    // Calcule le polygone englobant toutes les faces d'une structure
    // pour le hotspot de détection de survol — couvre toute la hauteur visible
    function get_structure_hit_polygon(
        shape_type: string,
        cx: number,
        cy: number,
        height: number,
    ): string {
        const p = (lx: number, ly: number, lz: number) =>
            project_3D(cx, cy, lx, ly, lz, 1);

        // On veut couvrir le contour extérieur de la structure vue de dessus
        // En iso : les 4 coins du bas + les coins hauts visibles
        if (shape_type === "cube" || shape_type === "step") {
            const h = shape_type === "step" ? height / 2 : height;
            const topN = p(-0.5, -0.5, h);
            const topE = p(0.5, -0.5, h);
            const topS = p(0.5, 0.5, h);
            const topW = p(-0.5, 0.5, h);
            const botE = p(0.5, -0.5, 0); // coin bas de la face droite
            const botS = p(0.5, 0.5, 0);
            const botW = p(-0.5, 0.5, 0);
            // Contour complet : N → E (haut) → botE (bas face droite) → botS → botW → W (haut)
            return [topN, topE, botE, botS, botW, topW].join(" ");
        }

        // Pour les wedges et autres, contour complet avec toutes les faces
        const topN = p(-0.5, -0.5, height);
        const topE = p(0.5, -0.5, height);
        const topS = p(0.5, 0.5, height);
        const topW = p(-0.5, 0.5, height);
        const botE = p(0.5, -0.5, 0);
        const botS = p(0.5, 0.5, 0);
        const botW = p(-0.5, 0.5, 0);
        return [topN, topE, botE, botS, botW, topW].join(" ");
    }
</script>

<div class="board-container">
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

    <div class="board-wrapper">
        <svg
            aria-label="Isometric board"
            role="img"
            {viewBox}
            on:mouseleave={() => {
                hovered_structure_id = null;
                clear_hover();
            }}
        >
            {#each render_items as item (item.type + "-" + (item.data.id || `${item.data.x}-${item.data.y}`))}
                {#if item.type === "tile"}
                    {@const key = `${item.data.x},${item.data.y}`}
                    <polygon
                        class="tile"
                        role="presentation"
                        class:reachable={reachable_cells.has(key)}
                        class:path-hover={hovered_path.has(key)}
                        class:dest-hover={hovered_dest === key}
                        points={tile_polygon(item.data.x, item.data.y)}
                        data-x={item.data.x}
                        data-y={item.data.y}
                        on:click={() => cell_click(item.data.x, item.data.y)}
                        on:keydown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                cell_click(item.data.x, item.data.y);
                            }
                        }}
                        on:mouseenter={() =>
                            on_tile_hover(item.data.x, item.data.y)}
                        on:mouseleave={clear_hover}
                    />
                {:else if item.type === "structure"}
                    {@const { sx: cx, sy: cy } = iso_to_screen(
                        item.data.pos.x,
                        item.data.pos.y,
                    )}
                    {@const key = `${item.data.pos.x},${item.data.pos.y}`}
                    {@const is_hovered = hovered_structure_id === item.data.id}
                    <!--
                La structure est rendue normalement, mais sans pointer-events.
                Le hotspot (ci-dessous dans le z-order) gère hover/click.
                On applique l'opacité via style inline pour éviter tout conflit CSS.
            -->
                    <g
                        class="structure"
                        style="opacity: {is_hovered
                            ? 0.25
                            : 1}; transition: opacity 0.12s ease"
                    >
                        {#each get_shape_faces(item.data.shape, cx, cy, 1, item.data.height) as face}
                            <polygon
                                points={face.points.join(" ")}
                                class="face-{face.type}"
                            />
                        {/each}
                        <text
                            x={cx}
                            y={cy - item.data.height - 5}
                            class="unit-label">{item.data.name}</text
                        >
                    </g>
                {:else if item.type === "structure-hotspot"}
                    {@const { sx: cx, sy: cy } = iso_to_screen(
                        item.data.pos.x,
                        item.data.pos.y,
                    )}
                    {@const key = `${item.data.pos.x},${item.data.pos.y}`}
                    <!--
                Le hotspot a TOUJOURS pointer-events: all — on ne le toggleait jamais.
                C'est lui qui gère mouseenter (→ transparent), mouseleave (→ opaque),
                et le click (sur la case en dessous ou sur lui-même selon l'état).
            -->
                    <polygon
                        class="structure-hotspot"
                        role="presentation"
                        points={get_structure_hit_polygon(
                            item.data.shape,
                            cx,
                            cy,
                            item.data.height,
                        )}
                        on:mouseenter={() => {
                            hovered_structure_id = item.data.id;
                        }}
                        on:mousemove={(e) => {
                            const el = e.currentTarget as SVGElement;
                            el.style.pointerEvents = "none";
                            const under = document.elementFromPoint(
                                e.clientX,
                                e.clientY,
                            );
                            el.style.pointerEvents = "";

                            // Remonte l'arbre DOM pour trouver data-x/data-y sur une tuile
                            let node: Element | null = under;
                            let tx: string | null = null;
                            let ty: string | null = null;
                            while (node && node !== el) {
                                tx = node.getAttribute("data-x");
                                ty = node.getAttribute("data-y");
                                if (tx !== null && ty !== null) break;
                                node = node.parentElement;
                            }

                            if (tx !== null && ty !== null) {
                                on_tile_hover(parseInt(tx), parseInt(ty));
                            }
                            // Si on pointe une unité ou autre non-tuile, on ne touche pas au hover
                        }}
                        on:mouseleave={() => {
                            hovered_structure_id = null;
                            clear_hover();
                        }}
                        on:click={(e) => {
                            if (hovered_structure_id === item.data.id) {
                                // Structure transparente : on cherche l'élément sous la souris
                                // en masquant temporairement le hotspot
                                const el = e.currentTarget as SVGElement;
                                el.style.pointerEvents = "none";
                                const under = document.elementFromPoint(
                                    e.clientX,
                                    e.clientY,
                                );
                                el.style.pointerEvents = "";
                                if (under)
                                    (under as SVGElement).dispatchEvent(
                                        new MouseEvent("click", {
                                            bubbles: false,
                                            clientX: e.clientX,
                                            clientY: e.clientY,
                                        }),
                                    );
                            } else {
                                cell_click(item.data.pos.x, item.data.pos.y);
                            }
                        }}
                    />
                {:else if item.type === "unit"}
                    {@const elevation = get_elevation_at(
                        active_level,
                        item.data.pos,
                    )}
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

    .tile {
        fill: #e6e2d3;
        stroke: #bdb0a0;
        stroke-width: 1px;
        cursor: pointer;
    }
    /* Outline clavier : visible uniquement en navigation clavier, pas à la souris */
    .tile.keyboard-focus {
        stroke: #1d4ed8;
        stroke-width: 2.5px;
    }
    .tile:hover {
        fill: #f0e8d8;
    }
    .tile.reachable {
        fill: #86efac;
        stroke: #22c55e;
    }
    .tile.reachable:hover,
    .tile.dest-hover {
        fill: #4ade80;
        stroke: #22c55e;
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

    /* Structure : pointer-events none, l'opacité est gérée inline */
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

    /* Hotspot : invisible par défaut, couvre la silhouette 3D complète */
    .structure-hotspot {
        fill: transparent;
        stroke: none;
        cursor: pointer;
        pointer-events: all;
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
