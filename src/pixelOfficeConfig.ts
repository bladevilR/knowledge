type LayoutFurniture = {
  uid: string;
  type: string;
  col: number;
  row: number;
};

type LayoutLike = {
  cols: number;
  rows: number;
  tiles: number[];
  furniture: LayoutFurniture[];
};

type FacingDirection = "up" | "down" | "left" | "right";

type Seat = {
  uid: string;
  col: number;
  row: number;
  facing: FacingDirection;
  facesElectronics: boolean;
};

export type OfficeAgentSlot = {
  idleCol: number;
  idleRow: number;
  idleDirection: "right" | "down" | "up";
  idleMirrored: boolean;
  workCol: number;
  workRow: number;
  workDirection: FacingDirection;
  workMirrored: boolean;
  walkDirection: "right";
  walkMirrored: boolean;
};

type FurnitureMeta = {
  category?: "chairs" | "desks" | "electronics";
  footprintW: number;
  footprintH: number;
  backgroundTiles?: number;
  orientation?: FacingDirection;
  isDesk?: boolean;
};

const FURNITURE_META: Record<string, FurnitureMeta> = {
  CUSHIONED_BENCH: { category: "chairs", footprintW: 1, footprintH: 1 },
  WOODEN_CHAIR_SIDE: {
    category: "chairs",
    footprintW: 1,
    footprintH: 2,
    backgroundTiles: 1,
    orientation: "right",
  },
  "WOODEN_CHAIR_SIDE:left": {
    category: "chairs",
    footprintW: 1,
    footprintH: 2,
    backgroundTiles: 1,
    orientation: "left",
  },
  DESK_FRONT: { category: "desks", footprintW: 3, footprintH: 2, backgroundTiles: 1, isDesk: true },
  TABLE_FRONT: { category: "desks", footprintW: 3, footprintH: 4, isDesk: true },
  SMALL_TABLE_FRONT: { category: "desks", footprintW: 2, footprintH: 2, isDesk: true },
  PC_FRONT_OFF: { category: "electronics", footprintW: 1, footprintH: 2, backgroundTiles: 1 },
  PC_SIDE: { category: "electronics", footprintW: 1, footprintH: 2, backgroundTiles: 1 },
  "PC_SIDE:left": { category: "electronics", footprintW: 1, footprintH: 2, backgroundTiles: 1 },
};

function orientationToFacing(type: string, meta: FurnitureMeta): FacingDirection | null {
  if (meta.orientation) {
    return meta.orientation;
  }
  if (type.endsWith(":left")) {
    return "left";
  }
  return null;
}

function isWalkableTile(layout: LayoutLike, blockedTiles: Set<string>, col: number, row: number): boolean {
  if (col < 0 || row < 0 || col >= layout.cols || row >= layout.rows) {
    return false;
  }
  const tile = layout.tiles[row * layout.cols + col];
  return tile !== 255 && tile !== 0 && !blockedTiles.has(`${col},${row}`);
}

function deriveSeats(layout: LayoutLike): Seat[] {
  const deskTiles = new Set<string>();
  const electronicsTiles = new Set<string>();

  for (const item of layout.furniture) {
    const meta = FURNITURE_META[item.type];
    if (!meta) {
      continue;
    }
    for (let dr = 0; dr < meta.footprintH; dr += 1) {
      for (let dc = 0; dc < meta.footprintW; dc += 1) {
        const key = `${item.col + dc},${item.row + dr}`;
        if (meta.isDesk) {
          deskTiles.add(key);
        }
        if (meta.category === "electronics") {
          electronicsTiles.add(key);
        }
      }
    }
  }

  const neighborDirections: Array<{ dc: number; dr: number; facing: FacingDirection }> = [
    { dc: 0, dr: -1, facing: "up" },
    { dc: 0, dr: 1, facing: "down" },
    { dc: -1, dr: 0, facing: "left" },
    { dc: 1, dr: 0, facing: "right" },
  ];

  const seats: Seat[] = [];

  for (const item of layout.furniture) {
    const meta = FURNITURE_META[item.type];
    if (!meta || meta.category !== "chairs") {
      continue;
    }

    const bgRows = meta.backgroundTiles ?? 0;
    for (let dr = bgRows; dr < meta.footprintH; dr += 1) {
      for (let dc = 0; dc < meta.footprintW; dc += 1) {
        const col = item.col + dc;
        const row = item.row + dr;
        let facing = orientationToFacing(item.type, meta) ?? "down";

        if (!meta.orientation) {
          for (const direction of neighborDirections) {
            if (deskTiles.has(`${col + direction.dc},${row + direction.dr}`)) {
              facing = direction.facing;
              break;
            }
          }
        }

        const forward = {
          up: { dc: 0, dr: -1 },
          down: { dc: 0, dr: 1 },
          left: { dc: -1, dr: 0 },
          right: { dc: 1, dr: 0 },
        }[facing];

        let facesElectronics = false;
        for (let step = 1; step <= 2 && !facesElectronics; step += 1) {
          const nextCol = col + forward.dc * step;
          const nextRow = row + forward.dr * step;
          if (electronicsTiles.has(`${nextCol},${nextRow}`)) {
            facesElectronics = true;
          }
        }

        seats.push({
          uid: item.uid,
          col,
          row,
          facing,
          facesElectronics,
        });
      }
    }
  }

  return seats.sort((left, right) => {
    if (left.facesElectronics !== right.facesElectronics) {
      return left.facesElectronics ? -1 : 1;
    }
    if (left.row !== right.row) {
      return left.row - right.row;
    }
    return left.col - right.col;
  });
}

function buildBlockedTiles(layout: LayoutLike): Set<string> {
  const blocked = new Set<string>();

  for (const item of layout.furniture) {
    const meta = FURNITURE_META[item.type];
    if (!meta) {
      continue;
    }
    const bgRows = meta.backgroundTiles ?? 0;
    for (let dr = bgRows; dr < meta.footprintH; dr += 1) {
      for (let dc = 0; dc < meta.footprintW; dc += 1) {
        blocked.add(`${item.col + dc},${item.row + dr}`);
      }
    }
  }

  return blocked;
}

function findIdleSpot(
  layout: LayoutLike,
  blockedTiles: Set<string>,
  occupiedIdle: Set<string>,
  seat: Seat,
): { col: number; row: number } {
  const candidates = [
    { dc: 0, dr: 2 },
    { dc: 0, dr: 1 },
    { dc: 1, dr: 2 },
    { dc: -1, dr: 2 },
    { dc: 1, dr: 1 },
    { dc: -1, dr: 1 },
  ];

  for (const candidate of candidates) {
    const col = seat.col + candidate.dc;
    const row = seat.row + candidate.dr;
    const key = `${col},${row}`;
    if (occupiedIdle.has(key)) {
      continue;
    }
    if (isWalkableTile(layout, blockedTiles, col, row)) {
      occupiedIdle.add(key);
      return { col, row };
    }
  }

  occupiedIdle.add(`${seat.col},${seat.row}`);
  return { col: seat.col, row: seat.row };
}

export function deriveAgentSlotsFromLayout(layout: LayoutLike): OfficeAgentSlot[] {
  const seats = deriveSeats(layout).slice(0, 3);
  const blockedTiles = buildBlockedTiles(layout);
  const occupiedIdle = new Set<string>();

  return seats.map((seat) => {
    const idle = findIdleSpot(layout, blockedTiles, occupiedIdle, seat);
    const workMirrored = seat.facing === "left";

    return {
      idleCol: idle.col,
      idleRow: idle.row,
      idleDirection: "right",
      idleMirrored: idle.col > seat.col,
      workCol: seat.col,
      workRow: seat.row,
      workDirection: seat.facing,
      workMirrored,
      walkDirection: "right",
      walkMirrored: idle.col > seat.col,
    };
  });
}
