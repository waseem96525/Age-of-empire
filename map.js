const mapData = [];
const TILE_COLORS = {
  GRASS: '#4a7c3f',
  SAND: '#c2b280',
  WATER: '#2e6b9e',
  FOREST: '#2d5a27',
  MOUNTAIN: '#6b6b6b'
};

const GRASS_VARIATIONS = [
  '#4a7c3f', '#4d8242', '#457638', '#508a45', '#3e7432',
  '#487c3d', '#52904a', '#417036', '#4e8541', '#3a6e2f',
  '#3d7a35', '#559850', '#47823a', '#427838', '#4e9048'
];

function getGrassColor(x, y) {
  const v = Math.sin(x * 0.37 + y * 0.29) * 0.5 + 0.5;
  return GRASS_VARIATIONS[Math.floor(v * GRASS_VARIATIONS.length)];
}

function isWaterNeighbor(mapData, x, y, MAP_WIDTH, MAP_HEIGHT) {
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT) {
      if (mapData[ny][nx] === TILE.WATER) return true;
    }
  }
  return false;
}

function isMountainNeighbor(mapData, x, y, MAP_WIDTH, MAP_HEIGHT) {
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT) {
      if (mapData[ny][nx] === TILE.MOUNTAIN) return true;
    }
  }
  return false;
}

function generateMap() {
  for (let y = 0; y < MAP_HEIGHT; y++) {
    mapData[y] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      const noise = Math.sin(x * 0.15) * Math.cos(y * 0.12) + Math.sin(x * 0.08 + y * 0.08) * 0.5;
      const r = Math.random();
      if (noise > 0.4) {
        mapData[y][x] = TILE.GRASS;
      } else if (noise > 0.2) {
        mapData[y][x] = TILE.SAND;
      } else if (r < 0.08) {
        mapData[y][x] = TILE.WATER;
      } else if (r < 0.12) {
        mapData[y][x] = TILE.FOREST;
      } else if (r < 0.15) {
        mapData[y][x] = TILE.MOUNTAIN;
      } else {
        mapData[y][x] = TILE.GRASS;
      }
    }
  }

  const spawnPoints = [
    [20, 20],
    [8, 31],
    [31, 8],
    [31, 31]
  ];
  for (const [centerX, centerY] of spawnPoints) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const x = centerX + dx;
        const y = centerY + dy;
        if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) {
          mapData[y][x] = TILE.GRASS;
        }
      }
    }
  }

  placeResources();
}

function placeResources() {
  gameState.resourcesOnMap = [];
  const resourceTypes = [
    { type: 'food', count: 25, color: '#4CAF50' },
    { type: 'wood', count: 20, color: '#8B4513' },
    { type: 'gold', count: 12, color: '#FFD700' },
    { type: 'stone', count: 10, color: '#808080' }
  ];

  for (const res of resourceTypes) {
    for (let i = 0; i < res.count; i++) {
      let attempts = 0;
      while (attempts < 100) {
        const rx = Math.floor(Math.random() * MAP_WIDTH);
        const ry = Math.floor(Math.random() * MAP_HEIGHT);
        if (mapData[ry][rx] === TILE.GRASS && !isBuildable(rx, ry)) {
          attempts++;
          continue;
        }
        if (distance(rx, ry, Math.floor(MAP_WIDTH / 2), Math.floor(MAP_HEIGHT / 2)) < 5) {
          attempts++;
          continue;
        }
        let tooClose = false;
        for (const existing of gameState.resourcesOnMap) {
          if (distance(rx, ry, existing.x, existing.y) < 3) {
            tooClose = true;
            break;
          }
        }
        if (!tooClose) {
          gameState.resourcesOnMap.push({
            x: rx, y: ry, type: res.type, amount: 5 + Math.floor(Math.random() * 10),
            maxAmount: 5 + Math.floor(Math.random() * 10), color: res.color,
            depleted: false
          });
          break;
        }
        attempts++;
      }
    }
  }
}

function renderWater(ctx, pos, ts, x, y, time) {
  const wave1 = Math.sin(x * 0.5 + time * 1.5) * 0.15;
  const wave2 = Math.cos(y * 0.4 + time * 1.2) * 0.1;
  const wave3 = Math.sin(time * 0.8 + x * 0.3 + y * 0.5) * 0.05;
  const depth = 0.2 + wave1 + wave2 + wave3;
  const r = Math.min(255, Math.max(0, 30 + depth * 80));
  const g = Math.min(255, Math.max(0, 80 + depth * 70));
  const b = Math.min(255, Math.max(0, 160 + depth * 50));
  ctx.fillStyle = `rgb(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)})`;
  ctx.fillRect(pos.x, pos.y, ts, ts);

  for (let i = 0; i < 4; i++) {
    const wx = pos.x + ts * (0.15 + i * 0.22);
    const wy = pos.y + ts * (0.25 + Math.sin(time * 2 + x * 0.7 + i * 1.2) * 0.12);
    const ww = ts * (0.2 + Math.sin(time + i) * 0.05);
    const wh = ts * 0.06;
    const alpha = 0.12 + Math.sin(time * 3 + x * 0.5 + i * 2) * 0.06;
    ctx.fillStyle = `rgba(140,210,255,${Math.max(0.04, alpha).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(wx, wy, Math.max(1, ww / 2), Math.max(1, wh / 2), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const shimmer = Math.sin(time * 4 + x * 0.7 + y * 0.5);
  if (shimmer > 0.7) {
    ctx.fillStyle = `rgba(255,255,255,${((shimmer - 0.7) * 4).toFixed(3)})`;
    ctx.fillRect(pos.x + ts * 0.45, pos.y + ts * 0.25, ts * 0.1, ts * 0.04);
  }

  if (isWaterNeighbor(mapData, x, y, MAP_WIDTH, MAP_HEIGHT)) {
    const shoreGrad = ctx.createLinearGradient(pos.x, pos.y, pos.x, pos.y + ts);
    shoreGrad.addColorStop(0, 'rgba(194,178,128,0.2)');
    shoreGrad.addColorStop(0.5, 'rgba(194,178,128,0)');
    shoreGrad.addColorStop(1, 'rgba(194,178,128,0)');
    ctx.fillStyle = shoreGrad;
    ctx.fillRect(pos.x, pos.y, ts, ts);
  }
}

function renderForest(ctx, pos, ts, x, y, time) {
  const cx = pos.x + ts / 2;
  const cy = pos.y + ts / 2;
  const treeR = ts * 0.35;

  const treeCount = 2 + (Math.sin(x * 13.7 + y * 9.3) > 0.3 ? 1 : 0);
  for (let t = 0; t < treeCount; t++) {
    const ox = (Math.sin(x * 7.1 + t * 2.3) * 0.3 + 0.5) * ts - ts / 2;
    const oy = (Math.cos(y * 6.3 + t * 1.7) * 0.3 + 0.5) * ts - ts / 2;
    const tx = cx + ox;
    const ty = cy + oy;

    ctx.fillStyle = '#4e342e';
    ctx.fillRect(tx - ts * 0.05, ty + treeR * 0.2, ts * 0.1, ts * 0.22);
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(tx - ts * 0.03, ty + treeR * 0.2, ts * 0.06, ts * 0.08);

    const gradient = ctx.createRadialGradient(tx, ty - treeR * 0.15, 0, tx, ty, treeR);
    gradient.addColorStop(0, '#388e3c');
    gradient.addColorStop(0.5, '#2e7d32');
    gradient.addColorStop(0.8, '#1b5e20');
    gradient.addColorStop(1, '#0d3b10');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(tx, ty, treeR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(50,130,50,0.35)';
    ctx.beginPath();
    ctx.arc(tx - treeR * 0.18, ty - treeR * 0.35, treeR * 0.55, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(60,150,60,0.2)';
    ctx.beginPath();
    ctx.arc(tx + treeR * 0.12, ty + treeR * 0.15, treeR * 0.45, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(30,100,30,0.3)';
    ctx.beginPath();
    ctx.arc(tx + treeR * 0.05, ty - treeR * 0.1, treeR * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + treeR * 0.8, ts * 0.4, ts * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
}

function renderMountain(ctx, pos, ts, x, y) {
  const cx = pos.x + ts / 2;
  const baseY = pos.y + ts;
  const peakY = pos.y + ts * 0.12;

  const mountainGrad = ctx.createLinearGradient(pos.x, peakY, pos.x, baseY);
  mountainGrad.addColorStop(0, '#8a7a7a');
  mountainGrad.addColorStop(0.3, '#6b6b6b');
  mountainGrad.addColorStop(0.7, '#5a5a5a');
  mountainGrad.addColorStop(1, '#4a4a4a');
  ctx.fillStyle = mountainGrad;
  ctx.beginPath();
  ctx.moveTo(cx, peakY);
  ctx.lineTo(pos.x + ts * 0.12, baseY);
  ctx.lineTo(pos.x + ts * 0.88, baseY);
  ctx.closePath();
  ctx.fill();

  const snowLine = peakY + ts * 0.22;
  const snowGrad = ctx.createLinearGradient(cx, peakY, cx, snowLine);
  snowGrad.addColorStop(0, '#ffffff');
  snowGrad.addColorStop(0.4, '#e8e8e8');
  snowGrad.addColorStop(1, '#d0d0d0');
  ctx.fillStyle = snowGrad;
  ctx.beginPath();
  ctx.moveTo(cx, peakY);
  ctx.lineTo(cx - ts * 0.16, snowLine);
  ctx.lineTo(cx + ts * 0.16, snowLine);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.moveTo(cx, peakY + ts * 0.03);
  ctx.lineTo(cx - ts * 0.05, snowLine - ts * 0.03);
  ctx.lineTo(cx + ts * 0.05, snowLine - ts * 0.03);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.beginPath();
  ctx.moveTo(cx + ts * 0.12, baseY);
  ctx.lineTo(cx + ts * 0.02, peakY + ts * 0.05);
  ctx.lineTo(cx - ts * 0.05, peakY + ts * 0.08);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(pos.x + ts * 0.25, pos.y + ts * 0.45, ts * 0.05, ts * 0.08);
  ctx.fillRect(pos.x + ts * 0.55, pos.y + ts * 0.5, ts * 0.04, ts * 0.06);
}

function renderSand(ctx, pos, ts, x, y) {
  ctx.fillStyle = '#c2b280';
  ctx.fillRect(pos.x, pos.y, ts, ts);

  for (let i = 0; i < 6; i++) {
    const dx = ((x * 7 + i * 13) % 11) / 11 * ts;
    const dy = ((y * 11 + i * 7) % 11) / 11 * ts;
    const dotSize = ts * (0.04 + Math.sin(x + y + i) * 0.02);
    ctx.fillStyle = `rgba(180,165,110,${(0.3 + Math.sin(x + y + i) * 0.15).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(pos.x + dx, pos.y + dy, Math.max(0.5, dotSize / 2), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(210,195,140,0.2)';
  ctx.fillRect(pos.x, pos.y, ts, ts * 0.04);
  ctx.fillRect(pos.x, pos.y + ts * 0.93, ts, ts * 0.04);
}

function renderGrass(ctx, pos, ts, x, y, time) {
  const color = getGrassColor(x, y);
  ctx.fillStyle = color;
  ctx.fillRect(pos.x, pos.y, ts, ts);

  ctx.strokeStyle = 'rgba(74,124,63,0.25)';
  ctx.lineWidth = 1;
  const bladeCount = 3 + (Math.sin(x * 5.1 + y * 3.7) > 0 ? 1 : 0);
  for (let i = 0; i < bladeCount; i++) {
    const bx = pos.x + ((x * 3 + i * 7) % 15) / 15 * ts;
    const by = pos.y + ((y * 4 + i * 11) % 15) / 15 * ts;
    const bh = ts * (0.15 + Math.sin(x + y + i + (time || 0) * 0.5) * 0.1);
    ctx.beginPath();
    ctx.moveTo(bx, by + bh);
    ctx.lineTo(bx + 1, by);
    ctx.lineTo(bx + 2, by + bh);
    ctx.stroke();
  }

  if (isWaterNeighbor(mapData, x, y, MAP_WIDTH, MAP_HEIGHT)) {
    ctx.fillStyle = 'rgba(194,178,128,0.12)';
    ctx.fillRect(pos.x, pos.y, ts, ts);
  }

  if (Math.sin(x * 17 + y * 13) > 0.95) {
    ctx.fillStyle = 'rgba(180,160,80,0.4)';
    ctx.fillRect(pos.x + ts * 0.6, pos.y + ts * 0.6, ts * 0.08, ts * 0.08);
  }
}

function renderResource(ctx, pos, ts, res, time) {
  if (res.depleted) return;
  const cx = pos.x + ts / 2;
  const cy = pos.y + ts / 2;
  const r = ts * 0.42;
  const pulse = 1 + Math.sin(time * 2 + res.x + res.y) * 0.05;
  const rr = r * pulse;

  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
  gradient.addColorStop(0, res.color);
  gradient.addColorStop(0.6, res.color);
  gradient.addColorStop(1, res.color + '66');
  ctx.fillStyle = gradient;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(cx, cy, rr, 0, Math.PI * 2);
  ctx.fill();

  const ringGrad = ctx.createRadialGradient(cx, cy, rr * 0.9, cx, cy, rr * 1.1);
  ringGrad.addColorStop(0, 'rgba(255,255,255,0)');
  ringGrad.addColorStop(0.7, 'rgba(255,255,255,0.1)');
  ringGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = ringGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, rr * 1.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, rr, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.max(8, ts * 0.28)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(res.amount.toString(), cx, cy);

  const typeIcons = { food: '\u{1F33E}', wood: '\u{1F528}', gold: '\u{1FAE6}', stone: '\u{1FAA8}' };
  const icon = typeIcons[res.type] || '\u25CF';
  ctx.font = `${Math.max(6, ts * 0.18)}px sans-serif`;
  ctx.fillText(icon, cx, cy + rr + ts * 0.14);

  ctx.globalAlpha = 0.12;
  ctx.fillStyle = res.color;
  ctx.beginPath();
  ctx.arc(cx, cy, rr * 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function renderMap(ctx) {
  const time = gameState.gameTime || 0;
  const zoom = gameState.camera.zoom;
  const startX = Math.max(0, Math.floor(gameState.camera.x / (TILE_SIZE * zoom)) - 1);
  const endX = Math.min(MAP_WIDTH, Math.ceil((gameState.camera.x + ctx.canvas.width / zoom) / (TILE_SIZE * zoom)) + 1);
  const startY = Math.max(0, Math.floor(gameState.camera.y / (TILE_SIZE * zoom)) - 1);
  const endY = Math.min(MAP_HEIGHT, Math.ceil((gameState.camera.y + ctx.canvas.height / zoom) / (TILE_SIZE * zoom)) + 1);

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const tile = mapData[y][x];
      const pos = getWorldToScreen(x, y);
      const ts = TILE_SIZE * zoom;

      switch (tile) {
        case TILE.GRASS:
          renderGrass(ctx, pos, ts, x, y, time);
          break;
        case TILE.SAND:
          renderSand(ctx, pos, ts, x, y);
          break;
        case TILE.WATER:
          renderWater(ctx, pos, ts, x, y, time);
          break;
        case TILE.FOREST:
          renderForest(ctx, pos, ts, x, y);
          break;
        case TILE.MOUNTAIN:
          renderMountain(ctx, pos, ts, x, y);
          break;
        default:
          renderGrass(ctx, pos, ts, x, y, time);
      }

      ctx.strokeStyle = 'rgba(0,0,0,0.05)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(pos.x, pos.y, ts, ts);
    }
  }

  for (const res of gameState.resourcesOnMap) {
    renderResource(ctx, getWorldToScreen(res.x, res.y), TILE_SIZE * zoom, res, time);
  }
}

function renderFogOfWar(ctx) {
  const zoom = gameState.camera.zoom;
  const startX = Math.max(0, Math.floor(gameState.camera.x / (TILE_SIZE * zoom)) - 1);
  const endX = Math.min(MAP_WIDTH, Math.ceil((gameState.camera.x + ctx.canvas.width / zoom) / (TILE_SIZE * zoom)) + 1);
  const startY = Math.max(0, Math.floor(gameState.camera.y / (TILE_SIZE * zoom)) - 1);
  const endY = Math.min(MAP_HEIGHT, Math.ceil((gameState.camera.y + ctx.canvas.height / zoom) / (TILE_SIZE * zoom)) + 1);

  const revealRange = 4;
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      let visible = false;
      for (const unit of gameState.units) {
        if (unit.playerIndex === gameState.playerIndex) {
          if (distance(x, y, unit.x, unit.y) <= revealRange) {
            visible = true;
            break;
          }
        }
      }
      for (const b of gameState.buildings) {
        if (b.playerIndex === gameState.playerIndex) {
          if (distance(x, y, b.x, b.y) <= b.radius + 2) {
            visible = true;
            break;
          }
        }
      }
      if (!visible && gameState.fogOfWar[y] && gameState.fogOfWar[y][x]) {
        const pos = getWorldToScreen(x, y);
        const ts = TILE_SIZE * zoom;

        const fogX = pos.x + ts / 2;
        const fogY = pos.y + ts / 2;
        const fogR = ts * 0.7;

        const gradient = ctx.createRadialGradient(fogX, fogY, ts * 0.15, fogX, fogY, fogR);
        gradient.addColorStop(0, 'rgba(0,0,0,0.9)');
        gradient.addColorStop(0.5, 'rgba(0,0,0,0.8)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.65)');
        ctx.fillStyle = gradient;
        ctx.fillRect(pos.x, pos.y, ts, ts);

        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(pos.x + 0.5, pos.y + 0.5, ts - 1, ts - 1);
      }
    }
  }
}

function renderMinimap() {
  const canvas = document.getElementById('minimapCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const scaleX = canvas.width / MAP_WIDTH;
  const scaleY = canvas.height / MAP_HEIGHT;

  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const tile = mapData[y][x];
      switch (tile) {
        case TILE.GRASS: ctx.fillStyle = getGrassColor(x, y); break;
        case TILE.SAND: ctx.fillStyle = '#c2b280'; break;
        case TILE.WATER: {
          const wave = Math.sin(gameState.gameTime * 2 + x * 0.5 + y * 0.3) * 0.1;
          const r = Math.floor(30 + wave * 40);
          const g = Math.floor(80 + wave * 30);
          const b = Math.floor(160 + wave * 20);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          break;
        }
        case TILE.FOREST: ctx.fillStyle = '#1b5e20'; break;
        case TILE.MOUNTAIN: ctx.fillStyle = '#555'; break;
        default: ctx.fillStyle = '#4a7c3f';
      }
      ctx.fillRect(x * scaleX, y * scaleY, scaleX + 1, scaleY + 1);
    }
  }

  for (const res of gameState.resourcesOnMap) {
    if (!res.depleted) {
      ctx.fillStyle = res.color;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(res.x * scaleX, res.y * scaleY, scaleX + 1, scaleY + 1);
      ctx.globalAlpha = 1;
    }
  }

  for (const b of gameState.buildings) {
    ctx.fillStyle = b.playerIndex === gameState.playerIndex ? '#f0c040' : '#888';
    ctx.fillRect(b.x * scaleX, b.y * scaleY, scaleX + 2, scaleY + 2);
  }

  for (const u of gameState.units) {
    if (!u.alive) continue;
    ctx.fillStyle = u.playerIndex === gameState.playerIndex ? '#4CAF50' : PLAYER_COLORS[u.playerIndex] || '#888';
    ctx.fillRect(u.x * scaleX, u.y * scaleY, scaleX + 1, scaleY + 1);
  }

  ctx.strokeStyle = 'rgba(240,192,64,0.4)';
  ctx.lineWidth = 1;
  const camX = gameState.camera.x / TILE_SIZE;
  const camY = gameState.camera.y / TILE_SIZE;
  const viewW = ctx.canvas.width / (gameState.camera.zoom * TILE_SIZE * scaleX);
  const viewH = ctx.canvas.height / (gameState.camera.zoom * TILE_SIZE * scaleY);
  ctx.strokeRect(camX * scaleX, camY * scaleY, viewW * scaleX, viewH * scaleY);
}

window.mapData = mapData;
window.generateMap = generateMap;
window.renderMap = renderMap;
window.renderFogOfWar = renderFogOfWar;
window.renderMinimap = renderMinimap;