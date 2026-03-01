<!-- ui/components/iso_structure.svelte -->
<script lang="ts">
    import {
        get_shape_faces,
        get_structure_hit_polygon,
        iso_to_screen,
    } from "../lib/isometric";
    import type { Structure } from "../../engine/types";

    export let structure: Structure;
    export let is_hovered: boolean;
    export let on_hover_enter: () => void;
    export let on_hover_leave: () => void;
    export let on_click: () => void;
    export let on_tile_hover: (x: number, y: number) => void;

    $: ({ sx: cx, sy: cy } = iso_to_screen(structure.pos.x, structure.pos.y));
</script>

<g
    class="structure"
    style="opacity: {is_hovered ? 0.25 : 1}; transition: opacity 0.12s ease"
>
    {#each get_shape_faces(structure.shape, cx, cy, 1, structure.height) as face}
        <polygon points={face.points.join(" ")} class="face-{face.type}" />
    {/each}
    <text x={cx} y={cy - structure.height - 5} class="unit-label"
        >{structure.name}</text
    >
</g>

<!-- Le hotspot a TOUJOURS pointer-events: all — on ne le toggleait jamais.
C'est lui qui gère mouseenter (→ transparent), mouseleave (→ opaque),
et le click (sur la case en dessous ou sur lui-même selon l'état). -->
<polygon
    class="structure-hotspot"
    role="presentation"
    points={get_structure_hit_polygon(
        structure.shape,
        cx,
        cy,
        structure.height,
    )}
    on:mouseenter={on_hover_enter}
    on:mouseleave={on_hover_leave}
    on:mousemove={(e) => {
        const el = e.currentTarget as SVGElement;
        el.style.pointerEvents = "none";
        const under = document.elementFromPoint(e.clientX, e.clientY);
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
    on:click={(e) => {
        if (is_hovered) {
            // Structure transparente : on cherche l'élément sous la souris
            // en masquant temporairement le hotspot
            const el = e.currentTarget as SVGElement;
            el.style.pointerEvents = "none";
            const under = document.elementFromPoint(e.clientX, e.clientY);
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
            on_click();
        }
    }}
/>

<style>
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
</style>
