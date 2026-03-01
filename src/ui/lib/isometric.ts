// ui/lib/isometric.ts
export const TILE_W = 80;
export const TILE_H = 40;
export const SPRITE_W = 50;
export const SPRITE_H = 60;

// On centre l'origine sur (0,0) en coordonnées SVG brutes,
// puis on calcule le viewBox exact autour du plateau.
export const ORIGIN_X = 0;
export const ORIGIN_Y = 0;

export function iso_to_screen(x: number, y: number, zOffset: number = 0) {
    const sx = (x - y) * (TILE_W / 2);
    const sy = (x + y) * (TILE_H / 2) - zOffset;
    return { sx: sx + ORIGIN_X, sy: sy + ORIGIN_Y };
}

export function tile_polygon(x: number, y: number) {
    const { sx, sy } = iso_to_screen(x, y);
    const hw = TILE_W / 2;
    const hh = TILE_H / 2;
    return `${sx},${sy - hh} ${sx + hw},${sy} ${sx},${sy + hh} ${sx - hw},${sy}`;
}

export function project_3D(
    cx: number,
    cy: number,
    lx: number,
    ly: number,
    lz: number,
    scale: number,
) {
    const sx = cx + (lx - ly) * (TILE_W / 2) * scale;
    const sy = cy + (lx + ly) * (TILE_H / 2) * scale - lz;
    return `${sx},${sy}`;
}

export type Face = { points: string[]; type: "top" | "left" | "right" };

export function get_shape_faces(
    shape_type: string,
    cx: number,
    cy: number,
    scale: number,
    height: number,
): Face[] {
    const p = (lx: number, ly: number, lz: number) =>
        project_3D(cx, cy, lx, ly, lz, scale);
    const create_box = (
        ox: number,
        oy: number,
        oz: number,
        w: number,
        d: number,
        h: number,
    ): Face[] => {
        const topN = p(ox - w, oy - d, oz + h),
            topE = p(ox + w, oy - d, oz + h);
        const topS = p(ox + w, oy + d, oz + h),
            topW = p(ox - w, oy + d, oz + h);
        const bot_s = p(ox + w, oy + d, oz),
            bot_e = p(ox + w, oy - d, oz),
            botW = p(ox - w, oy + d, oz);
        return [
            { type: "top", points: [topN, topE, topS, topW] },
            { type: "right", points: [topE, topS, bot_s, bot_e] },
            { type: "left", points: [topW, topS, bot_s, botW] },
        ];
    };
    if (shape_type === "cube") return create_box(0, 0, 0, 0.5, 0.5, height);
    const n = p(-0.5, -0.5, height),
        n0 = p(-0.5, -0.5, 0);
    const e = p(0.5, -0.5, height),
        e0 = p(0.5, -0.5, 0);
    const s = p(0.5, 0.5, height),
        s0 = p(0.5, 0.5, 0);
    const w = p(-0.5, 0.5, height),
        w0 = p(-0.5, 0.5, 0);
    if (shape_type === "wedge-nw")
        return [
            { type: "left", points: [w, s0, w0] },
            { type: "right", points: [n, e0, n0] },
            { type: "top", points: [n, e0, s0, w] },
        ];
    if (shape_type === "wedge-ne")
        return [
            { type: "left", points: [n, w0, n0] },
            { type: "right", points: [e, s0, e0] },
            { type: "top", points: [n, e, s0, w0] },
        ];
    if (shape_type === "wedge-se")
        return [
            { type: "left", points: [w0, s, s0] },
            { type: "right", points: [e, s, s0, e0] },
            { type: "top", points: [n0, e, s, w0] },
        ];
    if (shape_type === "wedge-sw")
        return [
            { type: "left", points: [w, s, s0, w0] },
            { type: "right", points: [e0, s, s0] },
            { type: "top", points: [n0, e0, s, w] },
        ];
    if (shape_type === "step")
        return create_box(0, 0, 0, 0.5, 0.5, height / 2);
    return create_box(0, 0, 0, 0.2, 0.2, height * 0.5);
}

// Calcule le polygone englobant toutes les faces d'une structure
// pour le hotspot de détection de survol — couvre toute la hauteur visible
export function get_structure_hit_polygon(
    shape_type: string,
    cx: number,
    cy: number,
    height: number,
): string {
    const p = (lx: number, ly: number, lz: number) =>
        project_3D(cx, cy, lx, ly, lz, 1);

    // On veut couvrir le contour extérieur de la structure vue de dessus
    // En iso : les 4 coins du bas + les coins hauts visibles
    if (shape_type === "cube" || shape_type === "step") {
        const h = shape_type === "step" ? height / 2 : height;
        const topN = p(-0.5, -0.5, h);
        const topE = p(0.5, -0.5, h);
        const topS = p(0.5, 0.5, h);
        const topW = p(-0.5, 0.5, h);
        const botE = p(0.5, -0.5, 0); // coin bas de la face droite
        const botS = p(0.5, 0.5, 0);
        const botW = p(-0.5, 0.5, 0);
        // Contour complet : N → E (haut) → botE (bas face droite) → botS → botW → W (haut)
        return [topN, topE, botE, botS, botW, topW].join(" ");
    }

    // Pour les wedges et autres, contour complet avec toutes les faces
    const topN = p(-0.5, -0.5, height);
    const topE = p(0.5, -0.5, height);
    const topS = p(0.5, 0.5, height);
    const topW = p(-0.5, 0.5, height);
    const botE = p(0.5, -0.5, 0);
    const botS = p(0.5, 0.5, 0);
    const botW = p(-0.5, 0.5, 0);
    return [topN, topE, botE, botS, botW, topW].join(" ");
}
