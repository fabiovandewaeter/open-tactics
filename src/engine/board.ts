import type { Board, Coord, Structure, StructureId, Unit, UnitId, World } from "./types"

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
        structures: {},
        nextUnitId: 1,
        nextStructureId: 1,
    }
}

export function spawnUnit(world: World, unitPartial: Omit<Unit, "id">): UnitId {
    const id: UnitId = world.nextUnitId++
    const unit: Unit = { id, ...unitPartial }
    world.units[id] = unit
    return id
}

export function spawnStructure(world: World, structPartial: Omit<Structure, "id">): StructureId {
    const id: StructureId = world.nextStructureId++
    const structure: Structure = { id, ...structPartial }
    world.structures[id] = structure
    return id
}

export function removeUnit(world: World, id: UnitId) {
    delete world.units[id]
}


export function getElevationAt(world: World, pos: Coord): number {
    // Cherche s'il y a une structure sur cette case
    const struct = Object.values(world.structures).find(s => s.pos.x === pos.x && s.pos.y === pos.y)
    return struct ? struct.elevationChange : 0
}

export function moveUnit(world: World, id: UnitId, to: Coord) {
    const u = world.units[id]
    if (!u) return false

    // 1. Vérifie si on est hors de la map
    if (to.x < 0 || to.y < 0 || to.x >= world.board.width || to.y >= world.board.height) return false

    // 2. Vérifie la règle de hauteur (Z)
    const currentElevation = getElevationAt(world, u.pos)
    const targetElevation = getElevationAt(world, to)

    // On calcule la différence de hauteur (en valeur absolue, que ça monte ou ça descende)
    const elevationDiff = Math.abs(targetElevation - currentElevation)

    // 🌟 NOUVELLE RÈGLE : La hauteur max franchissable en un pas !
    const MAX_STEP_HEIGHT = 20;

    if (elevationDiff > MAX_STEP_HEIGHT) {
        console.log(`Mouvement bloqué : La marche est trop haute (${elevationDiff} pixels) ! Max autorisé : ${MAX_STEP_HEIGHT}`);
        return false;
    }

    // 3. Valide le mouvement
    u.pos = { x: to.x, y: to.y }
    return true
}

export function getUnitsArray(world: World) {
    return Object.values(world.units)
}
