import { writable } from "svelte/store"
import type { World } from "../../engine/types"
import { createEmptyWorld, spawnUnit } from "../../engine/board"

const initial = createEmptyWorld(10, 10)

// place a couple sample units
spawnUnit(initial, {
    name: "Rogue", hp: 30, maxHp: 30, pos: { x: 1, y: 1 }, team: "A",
    scale: 1.0,
    shape: "mecha"
})
spawnUnit(initial, {
    name: "Summon", hp: 20, maxHp: 20, pos: { x: 3, y: 2 }, team: "B",
    scale: 1.0,
    shape: "tower"
})
spawnUnit(initial, {
    name: "Slime", hp: 15, maxHp: 15, pos: { x: 5, y: 5 }, team: "A",
    scale: 1.0,
    shape: "diamond"
})

export const worldStore = writable<World>(initial)
