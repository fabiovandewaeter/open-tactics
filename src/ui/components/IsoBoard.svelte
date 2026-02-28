<!-- ui/components/IsoBoard.svelte -->
<script lang="ts">
    import { world_store } from "../stores/world";
    import characterSvg from "../assets/character.svg"; // Ton image 2D
    import { get_active_level, get_elevation_at } from "../../engine/board";
    import { onMount } from "svelte";
    import {
        isPlayerTurn,
        player_attempt_move,
        start_combat_from_current_level,
        start_turn_loop,
    } from "../lib/game_controller";

    // Dimensions de la grille
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

    function iso_to_screen(x: number, y: number, zOffset: number = 0) {
        const sx = (x - y) * (TILE_W / 2);
        // On soustrait zOffset pour faire monter visuellement l'élément à l'écran
        const sy = (x + y) * (TILE_H / 2) - zOffset;
        return { sx: sx + ORIGIN_X, sy: sy + ORIGIN_Y };
    }

    function tile_polygon(x: number, y: number) {
        const { sx, sy } = iso_to_screen(x, y);
        const hw = TILE_W / 2;
        const hh = TILE_H / 2;
        return `${sx},${sy - hh} ${sx + hw},${sy} ${sx},${sy + hh} ${sx - hw},${sy}`;
    }

    // Fonction de clic unifiée (sol ET structure)
    function cell_click(x: number, y: number) {
        if (!isPlayerTurn) {
            console.log("Pas ton tour !");
            return;
        }

        player_attempt_move({ x, y });
    }

    // --- LE TRI ISOMÉTRIQUE MIS À JOUR ---
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

        // ⚠️ ASTUCE DE RENDU : Les unités sur une structure ont un z visuel légèrement plus élevé
        // pour passer DEVANT la structure sur laquelle elles se trouvent.
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
                if (a.type === "structure" && b.type === "unit") return -1; // Structure derrière unité
                return 1;
            }
            return a.z - b.z;
        });
    })();

    // --- MOTEUR 3D POUR LES STRUCTURES ---

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
                topE = p(ox + w, oy - d, oz + h),
                topS = p(ox + w, oy + d, oz + h),
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

        // 🧊 LE GROS CUBE : Prend presque toute la case
        if (shape_type === "cube") {
            // w=0.45, d=0.45 laisse une toute petite marge sur la case
            return create_box(0, 0, 0, 0.5, 0.5, height);
        }

        // 📐 LES 4 PENTES (Wedges)
        // On pré-calcule les 4 coins de la case : en haut (h) et en bas (0)
        // N=Nord(Haut), E=Est(Droite), S=Sud(Bas), W=Ouest(Gauche)
        const n = p(-0.5, -0.5, height),
            n0 = p(-0.5, -0.5, 0);
        const e = p(0.5, -0.5, height),
            e0 = p(0.5, -0.5, 0);
        const s = p(0.5, 0.5, height),
            s0 = p(0.5, 0.5, 0);
        const w = p(-0.5, 0.5, height),
            w0 = p(-0.5, 0.5, 0);

        // 1. Pente qui monte vers le Nord-Ouest (Haut-Gauche)
        if (shape_type === "wedge-nw") {
            return [
                { type: "left", points: [w, s0, w0] }, // Mur latéral gauche (triangle)
                { type: "right", points: [n, e0, n0] }, // Le mur arrière-droit est révélé !
                { type: "top", points: [n, e0, s0, w] }, // La pente
            ];
        }

        // 2. Pente qui monte vers le Nord-Est (Haut-Droite)
        if (shape_type === "wedge-ne") {
            return [
                { type: "left", points: [n, w0, n0] }, // Le mur arrière-gauche est révélé !
                { type: "right", points: [e, s0, e0] }, // Mur latéral droit (triangle)
                { type: "top", points: [n, e, s0, w0] },
            ];
        }

        // 3. Pente qui monte vers le Sud-Est (Bas-Droite)
        // (Celle-ci nous fait face, on voit un gros mur plein à droite)
        if (shape_type === "wedge-se") {
            return [
                { type: "left", points: [w0, s, s0] }, // Mur latéral gauche
                { type: "right", points: [e, s, s0, e0] }, // Le gros mur vertical de face
                { type: "top", points: [n0, e, s, w0] },
            ];
        }

        // 4. Pente qui monte vers le Sud-Ouest (Bas-Gauche)
        // (Celle-ci nous fait face, on voit un gros mur plein à gauche)
        if (shape_type === "wedge-sw") {
            return [
                { type: "left", points: [w, s, s0, w0] }, // Le gros mur vertical de face
                { type: "right", points: [e0, s, s0] }, // Mur latéral droit
                { type: "top", points: [n0, e0, s, w] },
            ];
        }

        // 🧱 LA MARCHE (Demi-bloc) : Prend toute la case mais moitié moins haut
        if (shape_type === "step") {
            // On divise la hauteur par 2
            return create_box(0, 0, 0, 0.5, 0.5, height / 2);
        }

        // // Tour de ton ancien code
        // if (shape_type === "tower") {
        //     return [
        //         ...create_box(0, 0, 0, 0.4, 0.4, height * 0.6),
        //         ...create_box(-0.3, -0.3, height * 0.6, 0.1, 0.1, height * 0.2),
        //         ...create_box(0.3, -0.3, height * 0.6, 0.1, 0.1, height * 0.2),
        //         ...create_box(-0.3, 0.3, height * 0.6, 0.1, 0.1, height * 0.2),
        //         ...create_box(0.3, 0.3, height * 0.6, 0.1, 0.1, height * 0.2),
        //     ];
        // }

        return create_box(0, 0, 0, 0.2, 0.2, height * 0.5); // Fallback petit cube
    }
</script>

<div class="hud">
    {#if $world_store.state.mode === "explore"}
        <button on:click={start_combat_from_current_level}
            >⚔️ Lancer le combat</button
        >
    {:else}
        <span>Tour en cours — {isPlayerTurn ? "🟦 Ton tour" : "🔴 IA..."}</span>
    {/if}
</div>

<svg width="1200" height="720" aria-label="Isometric board">
    {#each render_items as item (item.type + "-" + (item.data.id || `${item.data.x}-${item.data.y}`))}
        {#if item.type === "tile"}
            <polygon
                class="tile"
                points={tile_polygon(item.data.x, item.data.y)}
                on:click={() => cell_click(item.data.x, item.data.y)}
            />
        {:else if item.type === "structure"}
            {@const { sx: cx, sy: cy } = iso_to_screen(
                item.data.pos.x,
                item.data.pos.y,
            )}
            <g
                class="structure clickable"
                on:click={() => cell_click(item.data.pos.x, item.data.pos.y)}
            >
                {#each get_shape_faces(item.data.shape, cx, cy, 1, item.data.height) as face}
                    <polygon
                        points={face.points.join(" ")}
                        class="face-{face.type}"
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

    /* Le sol */
    .tile {
        fill: #e6e2d3;
        stroke: #bdb0a0;
        stroke-width: 1px;
        cursor: pointer;
    }
    .tile:hover {
        fill: #f0e8d8;
    }

    /* Le texte */
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

    /* Les entités 3D et la lumière */
    .structure {
        pointer-events: none; /* Laisse le clic passer à travers pour cibler la case */
    }

    /* 💡 Simulation de lumière (Le soleil vient d'en haut à gauche) */
    .face-top {
        fill: #9ca3af;
        stroke: #4b5563;
        stroke-width: 0.5px;
    } /* Face éclairée */
    .face-left {
        fill: #6b7280;
        stroke: #4b5563;
        stroke-width: 0.5px;
    } /* Face à mi-ombre */
    .face-right {
        fill: #4b5563;
        stroke: #374151;
        stroke-width: 0.5px;
    } /* Face dans l'ombre */

    /* Filtre pour l'équipe adverse (ne s'applique qu'au sprite, mais tu peux l'étendre aux faces 3D si besoin) */
    .team-b image {
        filter: hue-rotate(180deg) brightness(0.9);
    }

    /* 🎯 Le style de l'indicateur au sol */
    .unit-indicator {
        /* Le cercle plein : une ombre noire semi-transparente */
        fill: rgba(0, 0, 0, 0.2);

        /* Le contour : un anneau coloré par défaut (Équipe A = Bleu) */
        stroke: #3b82f6;
        stroke-width: 2px;

        /* Un petit effet de transition si tu veux l'animer plus tard */
        /* transition: all 0.2s ease; */
    }

    /* Couleur de l'anneau pour l'équipe B (Rouge) */
    .team-b .unit-indicator {
        stroke: #ef4444;
    }

    /* Optionnel : faire briller l'anneau quand on survole l'unité */
    .entity:hover .unit-indicator {
        fill: rgba(255, 255, 255, 0.3);
        stroke-width: 3px;
    }

    .structure.clickable {
        pointer-events: auto; /* Rend la structure cliquable */
        cursor: pointer;
    }
    .structure.clickable:hover polygon {
        fill-opacity: 0.8; /* Petit retour visuel au survol */
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
</style>
