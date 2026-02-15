export type Coord = { x: number; y: number }
export type UnitId = number
export type StructureId = number

export type Team = "A" | "B"

export type Unit = {
    id: UnitId
    name: string
    hp: number
    maxHp: number
    pos: Coord
    team: Team
    scale: number
    shape: "sprite"
}

export type Structure = {
    id: StructureId
    name: string
    pos: Coord
    shape: string // "cube", "wedge-nw", etc.
    height: number // Hauteur physique de la structure (ex: 40)
    walkable: boolean // Est-ce qu'on peut monter dessus ?
    elevationChange: number // De combien ça monte (ex: 40 pour cube, 40 pour wedge)
}

export type Tile = {
    x: number
    y: number
    terrain?: string
}

export type Board = {
    width: number
    height: number
    tiles: Tile[]
}

export type World = {
    board: Board
    units: Record<UnitId, Unit>
    structures: Record<StructureId, Structure>
    nextUnitId: number
    nextStructureId: number
}
