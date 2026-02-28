// engine/map/board.ts
import type { Board } from "../types"

export function create_board(width = 10, height = 10): Board {
    const tiles = [] as Board["tiles"];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            tiles.push({ x, y })
        }
    }
    return { width, height, tiles };
}
