<!-- ui/components/iso_unit.svelte -->
<script lang="ts">
    import {
        iso_to_screen,
        SPRITE_H,
        SPRITE_W,
        TILE_H,
        TILE_W,
    } from "../lib/isometric";
    import { get_elevation_at } from "../../engine/map/level";
    import type { Unit, Level } from "../../engine/types";
    import characterSvg from "../assets/character.svg";

    export let unit: Unit;
    export let level: Level;
    export let team: "A" | "B" | null = null; // null en mode explore

    $: elevation = get_elevation_at(level, unit.pos);
    $: ({ sx: cx, sy: cy } = iso_to_screen(unit.pos.x, unit.pos.y, elevation));
</script>

<g class="entity" class:team-b={team === "B"}>
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
    <text x={cx} y={cy - SPRITE_H + 7} class="unit-label">{unit.name}</text>
</g>

<style>
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
