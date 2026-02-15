<script lang="ts">
    import { worldStore } from "../stores/world";
    import type { Unit } from "../../engine/types";

    // simple cell size; tweak for mobile
    const CELL = 48;

    // subscribe to the store via $worldStore
    $: world = $worldStore;
    $: units = Object.values(world.units) as Unit[];

    function cellClick(x: number, y: number) {
        // simple example: move the first unit of team A to clicked cell
        const u = units.find((uu) => uu.team === "A");
        if (!u) return;
        // mutate via store.update to trigger reactivity
        worldStore.update((w) => {
            w.units[u.id].pos = { x, y };
            return { ...w };
        });
    }
</script>

<svg width={world.board.width * CELL} height={world.board.height * CELL}>
    {#each world.board.tiles as tile}
        <rect
            class="cell"
            x={tile.x * CELL}
            y={tile.y * CELL}
            width={CELL}
            height={CELL}
            on:click={() => cellClick(tile.x, tile.y)}
        />
    {/each}

    {#each units as u (u.id)}
        <g
            transform={`translate(${u.pos.x * CELL + CELL / 2}, ${u.pos.y * CELL + CELL / 2})`}
        >
            <circle
                class={`unit ${u.team === "A" ? "teamA" : "teamB"}`}
                r={CELL * 0.35}
            />
            <text y="4" text-anchor="middle">{u.name}</text>
        </g>
    {/each}
</svg>

<style>
    svg {
        touch-action: manipulation;
    }
    .cell {
        stroke: #222;
        fill: #efefef;
    }
    .unit {
        stroke: #111;
        stroke-width: 1px;
    }
    .teamA {
        fill: #8ad;
    }
    .teamB {
        fill: #f99;
    }
    text {
        font-family: system-ui, sans-serif;
        font-size: 10px;
        pointer-events: none;
    }
</style>
