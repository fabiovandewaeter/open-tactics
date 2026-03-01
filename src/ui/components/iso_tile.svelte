<!-- ui/components/iso_tile.svelte -->
<script lang="ts">
    import { tile_polygon } from "../lib/isometric";

    export let x: number;
    export let y: number;
    export let reachable: boolean;
    export let is_path: boolean;
    export let is_dest: boolean;
    export let is_keyboard_focus: boolean;

    // import { createEventDispatcher } from "svelte";
    // const dispatch = createEventDispatcher();
    export let on_click: (x: number, y: number) => void;
    export let on_hover: (x: number, y: number) => void;
    export let on_leave: () => void;
</script>

<polygon
    class="tile"
    role="presentation"
    class:reachable
    class:path-hover={is_path}
    class:dest-hover={is_dest}
    class:keyboard-focus={is_keyboard_focus}
    points={tile_polygon(x, y)}
    data-x={x}
    data-y={y}
    on:click={() => on_click(x, y)}
    on:mouseenter={() => on_hover(x, y)}
    on:mouseleave={on_leave}
    on:keydown={(e) => {
        if (e.key === "Enter" || e.key === " ") on_click(x, y);
    }}
/>

<style>
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
</style>
