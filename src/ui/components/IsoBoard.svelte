<script lang="ts">
    import { worldStore } from "../stores/world";
    import type { Unit } from "../../engine/types";
    import characterSvg from "../assets/character.svg";

    // Dimensions
    const TILE_W = 80;
    const TILE_H = 40;
    const ORIGIN_X = 600;
    const ORIGIN_Y = 40;

    // Pawn visuals
    const UNIT_SCALE = 0.6;
    const UNIT_HEIGHT = 18;
    const UNIT_VERTICAL_OFFSET = TILE_H * 0.18;

    const SPRITE_W = 50;
    const SPRITE_H = 60;

    $: world = $worldStore;
    $: units = Object.values(world.units) as Unit[];

    function isoToScreen(x: number, y: number) {
        const sx = (x - y) * (TILE_W / 2);
        const sy = (x + y) * (TILE_H / 2);
        return { sx: sx + ORIGIN_X, sy: sy + ORIGIN_Y };
    }

    function tilePolygon(x: number, y: number) {
        const { sx, sy } = isoToScreen(x, y);
        const hw = TILE_W / 2;
        const hh = TILE_H / 2;
        return `${sx},${sy - hh} ${sx + hw},${sy} ${sx},${sy + hh} ${sx - hw},${sy}`;
    }

    // pawn geometry helpers
    function unitBottomVerts(sx: number, sy: number, scale = UNIT_SCALE) {
        const hw = (TILE_W / 2) * scale;
        const hh = (TILE_H / 2) * scale;
        return [
            { x: sx, y: sy - hh },
            { x: sx + hw, y: sy },
            { x: sx, y: sy + hh },
            { x: sx - hw, y: sy },
        ];
    }
    function unitTopVerts(
        bottomVerts: { x: number; y: number }[],
        height = UNIT_HEIGHT,
    ) {
        return bottomVerts.map((v) => ({ x: v.x, y: v.y - height }));
    }
    function vertsToPoints(verts: { x: number; y: number }[]) {
        return verts.map((v) => `${v.x},${v.y}`).join(" ");
    }

    // Simple move: move first Team A unit to clicked cell
    function cellClick(x: number, y: number) {
        const u = units.find((uu) => uu.team === "A");
        if (!u) return;
        worldStore.update((w) => {
            w.units[u.id].pos = { x, y };
            return { ...w };
        });
    }

    // Créer un tableau combiné de tiles et units, trié par profondeur
    $: renderItems = (() => {
        const items: Array<{
            type: "tile" | "unit";
            z: number;
            data: any;
        }> = [];

        // Ajouter les tiles
        world.board.tiles.forEach((t) => {
            items.push({
                type: "tile",
                z: t.x + t.y,
                data: t,
            });
        });

        // Ajouter les units
        units.forEach((u) => {
            items.push({
                type: "unit",
                z: u.pos.x + u.pos.y,
                data: u,
            });
        });

        // Trier par profondeur
        return items.sort((a, b) => {
            if (a.z === b.z) {
                // En cas d'égalité, on s'assure que la tile est dessinée EN DESSOUS (en premier)
                return a.type === "tile" ? -1 : 1;
            }
            return a.z - b.z;
        });
    })();

    // Projette un point 3D local vers l'écran 2D
    function project3D(
        cx: number,
        cy: number,
        lx: number,
        ly: number,
        lz: number,
        scale: number,
    ) {
        // cx, cy : position du centre de la case à l'écran
        // lx, ly : varient entre -0.5 et 0.5 (les bords de la case)
        // lz : la hauteur (z)
        const sx = cx + (lx - ly) * (TILE_W / 2) * scale;
        const sy = cy + (lx + ly) * (TILE_H / 2) * scale - lz;
        return `${sx},${sy}`;
    }

    type Face = { points: string[]; type: "top" | "left" | "right" };

    function getShapeFaces(
        shapeType: string,
        cx: number,
        cy: number,
        scale: number,
        height: number,
    ): Face[] {
        const p = (lx: number, ly: number, lz: number) =>
            project3D(cx, cy, lx, ly, lz, scale);

        // 🧱 LA FONCTION MAGIQUE : Crée un bloc 3D parfait
        // ox, oy, oz : centre local du bloc (ex: 0, 0, 0 c'est le milieu de la case)
        // w, d, h : demi-largeur (x), demi-profondeur (y), hauteur totale (z)
        const createBox = (
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
            const botS = p(ox + w, oy + d, oz),
                botE = p(ox + w, oy - d, oz),
                botW = p(ox - w, oy + d, oz);
            return [
                { type: "top", points: [topN, topE, topS, topW] },
                { type: "right", points: [topE, topS, botS, botE] },
                { type: "left", points: [topW, topS, botS, botW] },
            ];
        };

        // 🤖 1. LE MECHA (Robot humanoïde)
        if (shapeType === "mecha") {
            return [
                // Jambes (à gauche et à droite du centre)
                ...createBox(-0.2, 0, 0, 0.1, 0.15, height * 0.3),
                ...createBox(0.2, 0, 0, 0.1, 0.15, height * 0.3),
                // Bassin
                ...createBox(0, 0, height * 0.3, 0.25, 0.15, height * 0.15),
                // Torse (plus massif)
                ...createBox(0, 0, height * 0.45, 0.35, 0.2, height * 0.35),
                // Bras (collés au torse)
                ...createBox(-0.45, 0, height * 0.45, 0.1, 0.15, height * 0.35),
                ...createBox(0.45, 0, height * 0.45, 0.1, 0.15, height * 0.35),
                // Tête
                ...createBox(0, 0, height * 0.8, 0.15, 0.15, height * 0.2),
            ];
        }

        // 🚜 2. LE TANK (Engin de siège)
        if (shapeType === "tank") {
            return [
                // Chenilles (longues sur l'axe Y)
                ...createBox(-0.25, 0, 0, 0.1, 0.35, height * 0.25),
                ...createBox(0.25, 0, 0, 0.1, 0.35, height * 0.25),
                // Châssis principal
                ...createBox(0, 0, height * 0.15, 0.2, 0.25, height * 0.3),
                // Tourelle (légèrement reculée vers l'arrière / Nord)
                ...createBox(0, -0.05, height * 0.45, 0.15, 0.15, height * 0.2),
                // Canon (pointé vers l'avant / Sud : oy = +0.2)
                ...createBox(0, 0.2, height * 0.5, 0.04, 0.15, height * 0.08),
            ];
        }

        // 🏰 3. LA TOUR (Superbe avec un scale de 1 sur la case !)
        if (shapeType === "tower") {
            return [
                // Base massive
                ...createBox(0, 0, 0, 0.4, 0.4, height * 0.6),
                // Créneaux (Attention à l'ordre : on dessine l'arrière d'abord !)
                ...createBox(-0.3, -0.3, height * 0.6, 0.1, 0.1, height * 0.2), // Nord (Arrière)
                ...createBox(0.3, -0.3, height * 0.6, 0.1, 0.1, height * 0.2), // Est
                ...createBox(-0.3, 0.3, height * 0.6, 0.1, 0.1, height * 0.2), // Ouest
                ...createBox(0.3, 0.3, height * 0.6, 0.1, 0.1, height * 0.2), // Sud (Avant)
            ];
        }

        // --- Garde tes anciennes formes ici (diamond, pyramid, etc.) ---
        if (shapeType === "diamond") {
            const h = height * 2.5;
            const float = height * 0.5;
            const top = p(0, 0, h + float),
                bottom = p(0, 0, float),
                midZ = h / 2 + float;
            const south = p(0.5, 0.5, midZ),
                east = p(0.5, -0.5, midZ),
                west = p(-0.5, 0.5, midZ);
            return [
                { type: "left", points: [bottom, west, south] },
                { type: "right", points: [bottom, south, east] },
                { type: "top", points: [top, west, south] },
                { type: "left", points: [top, south, east] },
            ];
        }

        // Le CUBE par défaut
        return createBox(0, 0, 0, 0.5, 0.5, height);
    }
    // type Face = { points: string[]; type: "top" | "left" | "right" };

    // function getShapeFaces(
    //     shapeType: string,
    //     cx: number,
    //     cy: number,
    //     scale: number,
    //     height: number,
    // ): Face[] {
    //     const p = (lx: number, ly: number, lz: number) =>
    //         project3D(cx, cy, lx, ly, lz, scale);

    //     if (shapeType === "pyramid") {
    //         const h = height * 1.5; // Plus haut pour une belle pointe
    //         const apex = p(0, 0, h);
    //         const south = p(0.5, 0.5, 0);
    //         const east = p(0.5, -0.5, 0);
    //         const west = p(-0.5, 0.5, 0);

    //         return [
    //             { type: "right", points: [apex, east, south] },
    //             { type: "left", points: [apex, south, west] },
    //         ];
    //     }

    //     if (shapeType === "diamond") {
    //         // CORRECTION : On l'étire en hauteur (x2.5) et on le fait léviter (float)
    //         const h = height * 2.5;
    //         const float = height * 0.5;

    //         const top = p(0, 0, h + float);
    //         const bottom = p(0, 0, float);
    //         const midZ = h / 2 + float;

    //         const south = p(0.5, 0.5, midZ);
    //         const east = p(0.5, -0.5, midZ);
    //         const west = p(-0.5, 0.5, midZ);

    //         // L'ordre est important en SVG : on dessine le dessous d'abord, puis le dessus !
    //         return [
    //             // Moitié basse
    //             { type: "left", points: [bottom, west, south] },
    //             { type: "right", points: [bottom, south, east] },
    //             // Moitié haute
    //             { type: "top", points: [top, west, south] },
    //             { type: "left", points: [top, south, east] }, // On utilise 'left' au lieu de 'right' pour la lumière
    //         ];
    //     }

    //     if (shapeType === "wedge") {
    //         // Une rampe inclinée. Le point haut est au Nord-Ouest, le bas au Sud-Est.
    //         const topW = p(-0.5, 0.5, height);
    //         const topN = p(-0.5, -0.5, height);
    //         const botW = p(-0.5, 0.5, 0);
    //         const botS = p(0.5, 0.5, 0);
    //         const botE = p(0.5, -0.5, 0);

    //         return [
    //             { type: "left", points: [topW, botS, botW] }, // Mur vertical gauche
    //             { type: "top", points: [topN, botE, botS, topW] }, // La pente principale
    //         ];
    //     }

    //     if (shapeType === "obelisk") {
    //         // Démonstration de force : on peut combiner plusieurs blocs pour faire des structures complexes !
    //         const drawBox = (w: number, z: number, h: number): Face[] => {
    //             const topN = p(-w, -w, z + h),
    //                 topE = p(w, -w, z + h),
    //                 topS = p(w, w, z + h),
    //                 topW = p(-w, w, z + h);
    //             const botS = p(w, w, z),
    //                 botE = p(w, -w, z),
    //                 botW = p(-w, w, z);
    //             return [
    //                 { type: "top", points: [topN, topE, topS, topW] },
    //                 { type: "right", points: [topE, topS, botS, botE] },
    //                 { type: "left", points: [topW, topS, botS, botW] },
    //             ];
    //         };

    //         return [
    //             ...drawBox(0.4, 0, height * 0.4), // La base (large mais basse)
    //             ...drawBox(0.15, height * 0.4, height * 1.5), // Le pilier (fin et très haut) posé sur la base
    //         ];
    //     }

    //     // Le CUBE par défaut
    //     const topS = p(0.5, 0.5, height),
    //         topE = p(0.5, -0.5, height),
    //         topW = p(-0.5, 0.5, height),
    //         topN = p(-0.5, -0.5, height);
    //     const botS = p(0.5, 0.5, 0),
    //         botE = p(0.5, -0.5, 0),
    //         botW = p(-0.5, 0.5, 0);

    //     return [
    //         { type: "top", points: [topN, topE, topS, topW] },
    //         { type: "right", points: [topE, topS, botS, botE] },
    //         { type: "left", points: [topW, topS, botS, botW] },
    //     ];
    // }
</script>

<svg width="1200" height="720" aria-label="Isometric board with 2D sprites">
    {#each renderItems as item (item.type === "tile" ? `tile-${item.data.x}-${item.data.y}` : `unit-${item.data.id}`)}
        {#if item.type === "tile"}
            <polygon
                class="tile"
                points={tilePolygon(item.data.x, item.data.y)}
                on:click={() => cellClick(item.data.x, item.data.y)}
            />
        {:else}
            {@const { sx: cx, sy: cy } = isoToScreen(
                item.data.pos.x,
                item.data.pos.y,
            )}

            <g
                class="unit"
                class:team-a={item.data.team === "A"}
                class:team-b={item.data.team === "B"}
            >
                <image
                    href={characterSvg}
                    x={cx - SPRITE_W / 2}
                    y={cy - SPRITE_H + TILE_H / 4}
                    width={SPRITE_W}
                    height={SPRITE_H}
                />

                <text
                    x={cx}
                    y={cy - SPRITE_H + 7}
                    text-anchor="middle"
                    class="unit-label"
                >
                    {item.data.name}
                </text>
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

    .unit-label {
        font-family: system-ui, Arial, sans-serif;
        font-size: 11px;
        font-weight: 600;
        pointer-events: none;
        fill: #222;
        /* Un petit contour blanc pour que le texte reste lisible par-dessus tout */
        paint-order: stroke;
        stroke: white;
        stroke-width: 2px;
    }

    /* 💡 ASTUCE : Si vous voulez différencier les équipes sans avoir deux SVG différents */
    .team-b image {
        /* Par exemple, inverser les couleurs ou appliquer un filtre sepia/hue-rotate */
        filter: hue-rotate(180deg) brightness(0.9);
    }
</style>
