import { writable } from "svelte/store"
import type { World } from "../../engine/types"
import { createEmptyWorld, spawnStructure, spawnUnit } from "../../engine/board"

const initial = createEmptyWorld(10, 10)

const UNIT_HEIGHT_REF = 40;

// Les personnages
spawnUnit(initial, {
    name: "Rogue", hp: 30, maxHp: 30, pos: { x: 1, y: 1 }, team: "A", scale: 1.0, shape: "sprite"
})
spawnUnit(initial, {
    name: "Summon", hp: 20, maxHp: 20, pos: { x: 3, y: 2 }, team: "B", scale: 1.0, shape: "sprite"
})

// Les structures (Anciennement Slimes)
spawnStructure(initial, {
    name: "Sommet", pos: { x: 5, y: 5 }, shape: "cube", height: UNIT_HEIGHT_REF, walkable: true, elevationChange: UNIT_HEIGHT_REF
})
// spawnStructure(initial, {
//     name: "Pente NE", pos: { x: 5, y: 6 }, shape: "wedge-ne", height: UNIT_HEIGHT_REF, walkable: true, elevationChange: UNIT_HEIGHT_REF
// })
// spawnStructure(initial, {
//     name: "Pente NW", pos: { x: 6, y: 5 }, shape: "wedge-nw", height: UNIT_HEIGHT_REF, walkable: true, elevationChange: UNIT_HEIGHT_REF
// })
// spawnStructure(initial, {
//     name: "Pente SE", pos: { x: 4, y: 5 }, shape: "wedge-se", height: UNIT_HEIGHT_REF, walkable: true, elevationChange: UNIT_HEIGHT_REF
// })
// spawnStructure(initial, {
//     name: "Pente SW", pos: { x: 5, y: 4 }, shape: "wedge-sw", height: UNIT_HEIGHT_REF, walkable: true, elevationChange: UNIT_HEIGHT_REF
// })

spawnStructure(initial, {
    name: "Marche",
    pos: { x: 5, y: 6 },
    shape: "step",
    height: UNIT_HEIGHT_REF,
    walkable: true,
    elevationChange: UNIT_HEIGHT_REF / 2
})
spawnStructure(initial, {
    name: "Marche",
    pos: { x: 6, y: 5 },
    shape: "step",
    height: UNIT_HEIGHT_REF,
    walkable: true,
    elevationChange: UNIT_HEIGHT_REF / 2
})
spawnStructure(initial, {
    name: "Marche",
    pos: { x: 4, y: 5 },
    shape: "step",
    height: UNIT_HEIGHT_REF,
    walkable: true,
    elevationChange: UNIT_HEIGHT_REF / 2
})
spawnStructure(initial, {
    name: "Marche",
    pos: { x: 5, y: 4 },
    shape: "step",
    height: UNIT_HEIGHT_REF,
    walkable: true,
    elevationChange: UNIT_HEIGHT_REF / 2
})

export const worldStore = writable<World>(initial)
