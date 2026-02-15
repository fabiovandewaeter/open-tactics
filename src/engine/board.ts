import type { Board, Coord, Unit, UnitId, World } from "./types"

export function createBoard(width = 10, height = 10): Board {
    const tiles = [] as Board["tiles"]
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            tiles.push({ x, y })
        }
    }
    return { width, height, tiles }
}

export function createEmptyWorld(width = 10, height = 10): World {
    return {
        board: createBoard(width, height),
        units: {},
        nextId: 1,
    }
}

export function spawnUnit(world: World, unitPartial: Omit<Unit, "id">): UnitId {
    const id: UnitId = world.nextId++
    const unit: Unit = { id, ...unitPartial }
    world.units[id] = unit
    return id
}

export function removeUnit(world: World, id: UnitId) {
    delete world.units[id]
}

export function moveUnit(world: World, id: UnitId, to: Coord) {
    const u = world.units[id]
    if (!u) return false
    if (to.x < 0 || to.y < 0 || to.x >= world.board.width || to.y >= world.board.height) return false
    u.pos = { x: to.x, y: to.y }
    return true
}

export function getUnitsArray(world: World) {
    return Object.values(world.units)
}
