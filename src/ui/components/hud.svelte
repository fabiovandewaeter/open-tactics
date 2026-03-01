<!-- ui/components/hud.svelte -->
<script lang="ts">
    import { get_current_unit_id } from "../../engine/combat";
    import type { World } from "../../engine/types";
    import {
        finish_turn,
        isPlayerTurn,
        start_combat_from_current_level,
    } from "../lib/game_controller";

    export let world: World;
</script>

{#if world.state.mode === "explore"}
    <button on:click={start_combat_from_current_level}
        >⚔️ Lancer le combat</button
    >
{:else if $isPlayerTurn && world.state.mode === "combat"}
    {@const combat = world.combats[world.state.combat_id]}
    {@const unit_id = get_current_unit_id(combat)}
    {@const mp = combat.unit_statuses[unit_id].current_stats.mp}
    <span>🟦 Ton tour — <strong>{mp} MP</strong> restants</span>
    <button class="end-turn-btn" on:click={finish_turn}>
        ✅ Fin du tour
    </button>
{:else}
    <span>🔴 IA en train de jouer...</span>
{/if}

<style>
    button {
        padding: 6px 14px;
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
    }
    button:hover {
        background: #2563eb;
    }
    .end-turn-btn {
        background: #22c55e !important;
    }
    .end-turn-btn:hover {
        background: #16a34a !important;
    }
</style>
