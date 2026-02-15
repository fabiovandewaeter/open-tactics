export type Coord = { x: number; y: number }
export type UnitId = number

export type Team = "A" | "B"

export type Unit = {
    id: UnitId
    name: string
    hp: number
    maxHp: number
    pos: Coord
    team: Team
    scale: number
    shape: string
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
    nextId: number
}
