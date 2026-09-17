const TILE_SIZE = 40;
const MAP_WIDTH = 40;
const MAP_HEIGHT = 40;
const MAX_ZOOM = 2;
const MIN_ZOOM = 0.5;
const CAMERA_SPEED = 360;

const TILE = { GRASS: 0, WATER: 1, FOREST: 2, MOUNTAIN: 3, SAND: 4, PATH: 5 };

const BUILDINGS = {
  TOWN_CENTER: { name: "Town Center", cost: { food: 100, wood: 100, gold: 0, stone: 50 }, hp: 1000, radius: 3, produces: ["peasant"], pop: 50 },
  HOUSE: { name: "House", cost: { food: 0, wood: 50, gold: 0, stone: 0 }, hp: 200, radius: 1, produces: [], pop: 10 },
  BARRACKS: { name: "Barracks", cost: { food: 150, wood: 200, gold: 50, stone: 100 }, hp: 600, radius: 2, produces: ["samurai", "archer", "warrior"] },
  FARM: { name: "Farm", cost: { food: 50, wood: 100, gold: 0, stone: 50 }, hp: 300, radius: 2, produces: ["food"] },
  LUMBER_CAMP: { name: "Lumber Camp", cost: { food: 50, wood: 100, gold: 0, stone: 50 }, hp: 300, radius: 2, produces: ["wood"] },
  MINE: { name: "Mine", cost: { food: 100, wood: 50, gold: 100, stone: 100 }, hp: 400, radius: 2, produces: ["gold", "stone"] },
  WALL: { name: "Wall", cost: { food: 0, wood: 100, gold: 0, stone: 50 }, hp: 500, radius: 1, produces: [] },
  STABLE: { name: "Stable", cost: { food: 100, wood: 150, gold: 100, stone: 50 }, hp: 500, radius: 2, produces: ["cavalry"] }
};

const UNITS = {
  PEASANT: { name: "Peasant", hp: 80, attack: 5, armor: 0, speed: 1.5, cost: { food: 50 }, pop: 1, symbol: "P", color: "#8B7355", range: 0.8 },
  WARRIOR: { name: "Warrior", hp: 120, attack: 12, armor: 2, speed: 1.3, cost: { food: 60, wood: 40 }, pop: 1, symbol: "W", color: "#8B0000", range: 0.8 },
  ARCHER: { name: "Archer", hp: 80, attack: 14, armor: 1, speed: 1.3, cost: { food: 80, wood: 50 }, pop: 1, symbol: "A", color: "#2E8B57", range: 3.5 },
  SAMURAI: { name: "Samurai", hp: 160, attack: 18, armor: 4, speed: 1.2, cost: { food: 100, gold: 60 }, pop: 2, symbol: "S", color: "#C41E3A", range: 0.8 },
  CAVALRY: { name: "Cavalry", hp: 130, attack: 22, armor: 2, speed: 2.1, cost: { food: 120, gold: 80 }, pop: 2, symbol: "C", color: "#4169E1", range: 0.8 }
};

const PLAYER_COLORS = ["#4CAF50", "#f44336", "#2196F3", "#FF9800"];
const PLAYER_NAMES = ["Your Dynasty", "Red Clan", "Blue Clan", "Orange Clan"];

let gameState = {
  started: false,
  paused: false,
  gameTime: 0,
  selectedUnits: [],
  selectedBuilding: null,
  hoverTile: null,
  buildMode: null,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
  dragEndX: 0,
  dragEndY: 0,
  camera: { x: 0, y: 0, zoom: 1 },
  keys: {},
  resources: { food: 500, wood: 300, gold: 200, stone: 150 },
  population: 0,
  maxPopulation: 50,
  playerIndex: 0,
  buildings: [],
  units: [],
  resourcesOnMap: [],
  particles: [],
  gameOver: false,
  winner: null,
  aiPlayers: [],
  fogOfWar: [],
  lastTime: 0,
  notifications: [],
  logTimer: 0,
  techLevels: { food: 0, wood: 0, gold: 0, stone: 0 },
  // Village development tracking
  villageLevel: 1,
  buildingsBuilt: 0,
  unitsTrained: 0,
  villageXP: 0,
  nextLevelXP: 100
};

function initGameState() {
  gameState.resources = { food: 500, wood: 300, gold: 200, stone: 150 };
  gameState.population = 0;
  gameState.maxPopulation = 0;
  gameState.buildings = [];
  gameState.units = [];
  gameState.selectedUnits = [];
  gameState.selectedBuilding = null;
  gameState.particles = [];
  gameState.gameOver = false;
  gameState.winner = null;
  gameState.gameTime = 0;
  gameState.notifications = [];
  gameState.logTimer = 0;
  gameState.aiPlayers = [];
  gameState.fogOfWar = [];
  gameState.buildMode = null;
  gameState.techLevels = { food: 0, wood: 0, gold: 0, stone: 0 };
  gameState.villageLevel = 1;
  gameState.buildingsBuilt = 0;
  gameState.unitsTrained = 0;
  gameState.villageXP = 0;
  gameState.nextLevelXP = 100;
  gameState.isDragging = false;
  gameState.techLevels = { food: 0, wood: 0, gold: 0, stone: 0 };
  for (let y = 0; y < MAP_HEIGHT; y++) {
    gameState.fogOfWar[y] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      gameState.fogOfWar[y][x] = true;
    }
  }
}

function addNotification(text) {
  gameState.notifications.push({ text, time: gameState.gameTime });
  if (gameState.notifications.length > 50) gameState.notifications.shift();
}

function addParticle(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    gameState.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4 - 2,
      life: 1,
      decay: 0.02 + Math.random() * 0.03,
      color,
      size: 2 + Math.random() * 3
    });
  }
}

function canAfford(wallet, cost) {
  if (!wallet || !cost) return false;
  for (const [res, amount] of Object.entries(cost)) {
    if ((wallet[res] || 0) < amount) return false;
  }
  return true;
}

function spendResources(wallet, cost) {
  for (const [res, amount] of Object.entries(cost)) {
    wallet[res] -= amount;
  }
}

function getWorldToScreen(wx, wy) {
  const canvas = document.getElementById("gameCanvas");
  return {
    x: wx * TILE_SIZE * gameState.camera.zoom - gameState.camera.x * gameState.camera.zoom + canvas.width / 2,
    y: wy * TILE_SIZE * gameState.camera.zoom - gameState.camera.y * gameState.camera.zoom + canvas.height / 2
  };
}

function getScreenToWorld(sx, sy) {
  const canvas = document.getElementById("gameCanvas");
  return {
    x: (sx - canvas.width / 2 + gameState.camera.x * gameState.camera.zoom) / (gameState.camera.zoom * TILE_SIZE),
    y: (sy - canvas.height / 2 + gameState.camera.y * gameState.camera.zoom) / (gameState.camera.zoom * TILE_SIZE)
  };
}

function distance(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

function getTile(x, y) {
  if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return TILE.WATER;
  if (!window.mapData) return TILE.GRASS;
  return window.mapData[y][x];
}

function isWalkable(x, y) {
  const t = getTile(x, y);
  return t !== TILE.WATER && t !== TILE.MOUNTAIN;
}

function isBuildable(x, y) {
  if (!isWalkable(x, y)) return false;
  return !gameState.buildings.some(b => b.x === x && b.y === y);
}

function findPath(startX, startY, endX, endY) {
  const open = [{ x: startX, y: startY, g: 0, h: 0, f: 0, parent: null }];
  const closed = new Set();
  let iter = 0;
  while (open.length > 0 && iter < 800) {
    iter++;
    open.sort((a, b) => a.f - b.f);
    const current = open.shift();
    const key = `${current.x},${current.y}`;
    if (closed.has(key)) continue;
    closed.add(key);
    if (current.x === endX && current.y === endY) {
      const path = [];
      let node = current;
      while (node) { path.unshift({ x: node.x, y: node.y }); node = node.parent; }
      return path;
    }
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) continue;
      if (!isWalkable(nx, ny)) continue;
      if (closed.has(`${nx},${ny}`)) continue;
      const g = current.g + (dx !== 0 && dy !== 0 ? 1.4 : 1);
      const h = Math.abs(nx - endX) + Math.abs(ny - endY);
      const f = g + h;
      const existing = open.find(n => n.x === nx && n.y === ny);
      if (existing) {
        if (g < existing.g) { existing.g = g; existing.f = f; existing.parent = current; }
      } else {
        open.push({ x: nx, y: ny, g, h, f, parent: current });
      }
    }
  }
  return null;
}

function isMilitary(type) { return type !== "peasant"; }
function isWorker(type) { return type === "peasant"; }

window.gameState = gameState;
window.TILE = TILE;
window.TILE_SIZE = TILE_SIZE;
window.MAP_WIDTH = MAP_WIDTH;
window.MAP_HEIGHT = MAP_HEIGHT;
window.BUILDINGS = BUILDINGS;
window.UNITS = UNITS;
window.PLAYER_COLORS = PLAYER_COLORS;
window.PLAYER_NAMES = PLAYER_NAMES;
window.canAfford = canAfford;
window.spendResources = spendResources;
window.getWorldToScreen = getWorldToScreen;
window.getScreenToWorld = getScreenToWorld;
window.distance = distance;
window.clamp = clamp;
window.getTile = getTile;
window.isWalkable = isWalkable;
window.isBuildable = isBuildable;
window.findPath = findPath;
window.addNotification = addNotification;
window.addParticle = addParticle;
window.initGameState = initGameState;
