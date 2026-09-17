// Enhanced map rendering with atmospheric effects, better details, and environmental variety
const mapData = [];

// Day/night cycle lighting
let timeOfDay = 0.5; // 0-1, 0.5 = noon
let timeDirection = 0.0008; // speed

function updateTimeOfDay() {
  timeOfDay += timeDirection;
  if (timeOfDay > 1) { timeOfDay = 1; timeDirection = -timeDirection; }
  if (timeOfDay < 0) { timeOfDay = 0; timeDirection = -timeDirection; }
}

function getAmbientLight() {
  // Smooth bell curve: bright at noon, dark at night
  const t = timeOfDay;
  const brightness = 0.35 + 0.65 * Math.sin(t * Math.PI);
  return brightness;
}

function getSkyTint() {
  // Blue-ish day, warm dusk, dark night
  const t = timeOfDay;
  if (t < 0.25) return { r: 20, g: 25, b: 45 }; // night
  if (t < 0.45) return { r: 60, g: 80, b: 130 }; // dawn
  if (t < 0.75) return { r: 100, g: 140, b: 180 }; // day
  if (t < 0.9) return { r: 120, g: 80, b: 60 }; // dusk
  return { r: 20, g: 25, b: 45 }; // night
}

function applyAtmosphericTint(ctx, ts) {
  const light = getAmbientLight();
  const sky = getSkyTint();
  const tintR = Math.floor(sky.r * (1 - light * 0.3));
  const tintG = Math.floor(sky.g * (1 - light * 0.3));
  const tintB = Math.floor(sky.b * (1 - light * 0.3));
  ctx.fillStyle = `rgba(${tintR},${tintG},${tintB},${0.08 + (1 - light) * 0.15})`;
  ctx.fillRect(0, 0, ts, ts);
}

const TILE_COLORS = {
  GRASS: '#4a7c3f',
  SAND: '#c2b280',
  WATER: '#2e6b9e',
  FOREST: '#2d5a27',
  MOUNTAIN: '#6b6b6b'
};

// Enhanced grass variations with more natural colors
const GRASS_VARIATIONS = [
  '#3d7a35', '#457638', '#487c3d', '#4a7c3f', '#4d8242',
  '#508a45', '#52904a', '#559850', '#4e8541', '#4e9048',
  '#427838', '#47823a', '#3a6e2f', '#3e7432', '#417036'
];

const GRASS_DETAIL_COLORS = [
  '#2e6b2e', '#357a35', '#2d5a27', '#3a6e3a', '#275d27'
];

function getGrassColor(x, y) {
  const v = Math.sin(x * 0.37 + y * 0.29) * 0.5 + 0.5;
  return GRASS_VARIATIONS[Math.floor(v * GRASS_VARIATIONS.length)];
}

function getGrassDetailColor(x, y) {
  const v = Math.sin(x * 0.61 + y * 0.47) * 0.5 + 0.5;
  return GRASS_DETAIL_COLORS[Math.floor(v * GRASS_DETAIL_COLORS.length)];
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

// Generate environmental details for each tile
const environmentDetails = [];
function generateEnvironmentDetails() {
  for (let y = 0; y < MAP_HEIGHT; y++) {
    environmentDetails[y] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      // Random seed based on position for deterministic but varied details
      const seed = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const rand = seed - Math.floor(seed);
      const rand2 = Math.sin(x * 39.346 + y * 11.135) * 43758.5453 - Math.floor(Math.sin(x * 39.346 + y * 11.135) * 43758.5453);
      
      environmentDetails[y][x] = {
        flowers: rand < 0.08 ? { x: rand * 0.8 + 0.1, y: rand2 * 0.8 + 0.1, color: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff'][Math.floor(Math.random() * 4)] } : null,
        rocks: rand2 < 0.05 ? { x: rand * 0.8 + 0.1, y: rand2 * 0.8 + 0.1, size: 0.05 + rand * 0.1 } : null,
        grassTufts: Array.from({ length: 2 + Math.floor(rand * 4) }, () => ({
          x: Math.random() * 0.8 + 0.1,
          y: Math.random() * 0.8 + 0.1,
          height: 0.1 + Math.random() * 0.15
        }))
      };
    }
  }
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

  generateEnvironmentDetails();
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

// Enhanced water rendering with reflections, foam, and depth
function renderWater(ctx, pos, ts, x, y, time) {
  const wave1 = Math.sin(x * 0.5 + time * 1.5) * 0.15;
  const wave2 = Math.cos(y * 0.4 + time * 1.2) * 0.1;
  const wave3 = Math.sin(time * 0.8 + x * 0.3 + y * 0.5) * 0.05;
  const depth = 0.2 + wave1 + wave2 + wave3;
  const light = getAmbientLight();

  // Base water with gradient for depth
  const waterGrad = ctx.createLinearGradient(pos.x, pos.y, pos.x, pos.y + ts);
  waterGrad.addColorStop(0, `rgb(${Math.min(255, Math.max(0, 20 + depth * 60))}, ${Math.min(255, Math.max(0, 70 + depth * 60))}, ${Math.min(255, Math.max(0, 140 + depth * 40))})`);
  waterGrad.addColorStop(1, `rgb(${Math.min(255, Math.max(0, 10 + depth * 40))}, ${Math.min(255, Math.max(0, 40 + depth * 50))}, ${Math.min(255, Math.max(0, 120 + depth * 30))})`);
  ctx.fillStyle = waterGrad;
  ctx.fillRect(pos.x, pos.y, ts, ts);

  // Animated wave highlights
  for (let i = 0; i < 5; i++) {
    const wx = pos.x + ts * (0.1 + i * 0.2);
    const wy = pos.y + ts * (0.2 + Math.sin(time * 1.8 + x * 0.7 + i * 1.2) * 0.15);
    const ww = ts * (0.18 + Math.sin(time + i * 1.5) * 0.04);
    const wh = ts * 0.05;
    const alpha = 0.1 + Math.sin(time * 2.5 + x * 0.5 + i * 2) * 0.05;
    ctx.fillStyle = `rgba(140,210,255,${Math.max(0.03, alpha).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(wx, wy, Math.max(1, ww / 2), Math.max(1, wh / 2), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Shimmer effect
  const shimmer = Math.sin(time * 3.5 + x * 0.7 + y * 0.5);
  if (shimmer > 0.8) {
    ctx.fillStyle = `rgba(255,255,255,${((shimmer - 0.8) * 5).toFixed(3)})`;
    ctx.fillRect(pos.x + ts * 0.4, pos.y + ts * 0.2, ts * 0.12, ts * 0.03);
    ctx.fillRect(pos.x + ts * 0.7, pos.y + ts * 0.6, ts * 0.08, ts * 0.02);
  }

  // Foam at shoreline
  if (isWaterNeighbor(mapData, x, y, MAP_WIDTH, MAP_HEIGHT)) {
    // Shore foam
    const shoreGrad = ctx.createLinearGradient(pos.x, pos.y, pos.x, pos.y + ts);
    shoreGrad.addColorStop(0, 'rgba(255,255,255,0.3)');
    shoreGrad.addColorStop(0.3, 'rgba(194,178,128,0.15)');
    shoreGrad.addColorStop(1, 'rgba(194,178,128,0)');
    ctx.fillStyle = shoreGrad;
    ctx.fillRect(pos.x, pos.y, ts, ts);

    // Small foam bubbles at edges
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (let i = 0; i < 3; i++) {
      const fx = pos.x + ((x * 13 + i * 17) % 11) / 11 * ts;
      const fy = pos.y + ((y * 11 + i * 7) % 11) / 11 * ts;
      ctx.beginPath();
      ctx.arc(fx, fy, Math.max(1, ts * 0.03), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Enhanced forest with more tree variety and undergrowth
function renderForest(ctx, pos, ts, x, y, time) {
  const cx = pos.x + ts / 2;
  const cy = pos.y + ts / 2;
  const treeR = ts * 0.35;
  const light = getAmbientLight();

  // Base forest floor
  const forestFloorGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, ts * 0.7);
  forestFloorGrad.addColorStop(0, adjustBrightness('#2d5a27', light));
  forestFloorGrad.addColorStop(1, adjustBrightness('#1b3a1b', light));
  ctx.fillStyle = forestFloorGrad;
  ctx.fillRect(pos.x, pos.y, ts, ts);

  // Determine tree count based on position (deterministic)
  const treeCount = 2 + (Math.sin(x * 13.7 + y * 9.3) > 0.3 ? 1 : 0);
  for (let t = 0; t < treeCount; t++) {
    const ox = (Math.sin(x * 7.1 + t * 2.3) * 0.3 + 0.5) * ts - ts / 2;
    const oy = (Math.cos(y * 6.3 + t * 1.7) * 0.3 + 0.5) * ts - ts / 2;
    const tx = cx + ox;
    const ty = cy + oy;

    // Tree trunk with texture
    ctx.fillStyle = adjustBrightness('#3d2817', light);
    ctx.fillRect(tx - ts * 0.05, ty + treeR * 0.2, ts * 0.1, ts * 0.25);
    ctx.fillStyle = adjustBrightness('#4a3020', light);
    ctx.fillRect(tx - ts * 0.03, ty + treeR * 0.2, ts * 0.06, ts * 0.1);

    // Tree canopy with layered detail
    const canopyGrad = ctx.createRadialGradient(tx, ty - treeR * 0.15, 0, tx, ty, treeR);
    canopyGrad.addColorStop(0, adjustBrightness('#4a8c3c', light));
    canopyGrad.addColorStop(0.3, adjustBrightness('#388e3c', light));
    canopyGrad.addColorStop(0.6, adjustBrightness('#2e7d32', light));
    canopyGrad.addColorStop(0.9, adjustBrightness('#1b5e20', light));
    canopyGrad.addColorStop(1, adjustBrightness('#0d3b10', light));
    ctx.fillStyle = canopyGrad;
    ctx.beginPath();
    ctx.arc(tx, ty, treeR, 0, Math.PI * 2);
    ctx.fill();

    // Canopy highlights
    ctx.fillStyle = `rgba(50,130,50,${0.4 * light})`;
    ctx.beginPath();
    ctx.arc(tx - treeR * 0.18, ty - treeR * 0.35, treeR * 0.55, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(60,150,60,${0.25 * light})`;
    ctx.beginPath();
    ctx.arc(tx + treeR * 0.12, ty + treeR * 0.15, treeR * 0.45, 0, Math.PI * 2);
    ctx.fill();

    // Undergrowth at base
    ctx.fillStyle = 'rgba(30,100,30,0.4)';
    ctx.beginPath();
    ctx.arc(tx + treeR * 0.05, ty - treeR * 0.1, treeR * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + treeR * 0.8, ts * 0.4, ts * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();

  // Fallen leaves
  if (Math.sin(x * 23 + y * 17) > 0.9) {
    ctx.fillStyle = 'rgba(139,69,19,0.3)';
    for (let i = 0; i < 3; i++) {
      const lx = pos.x + ((x * 17 + i * 23) % 11) / 11 * ts;
      const ly = pos.y + ((y * 19 + i * 13) % 11) / 11 * ts;
      ctx.beginPath();
      ctx.arc(lx, ly, ts * 0.04, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Enhanced mountain with more realistic shading and details
function renderMountain(ctx, pos, ts, x, y) {
  const cx = pos.x + ts / 2;
  const baseY = pos.y + ts;
  const peakY = pos.y + ts * 0.1;
  
  // Mountain base shape with gradient
  const mountainGrad = ctx.createLinearGradient(pos.x, peakY, pos.x, baseY);
  mountainGrad.addColorStop(0, '#9a8a7a');
  mountainGrad.addColorStop(0.2, '#7b6b6b');
  mountainGrad.addColorStop(0.5, '#6b6b6b');
  mountainGrad.addColorStop(0.8, '#5a5a5a');
  mountainGrad.addColorStop(1, '#4a4a4a');
  ctx.fillStyle = mountainGrad;
  ctx.beginPath();
  ctx.moveTo(cx, peakY);
  ctx.lineTo(pos.x + ts * 0.1, baseY);
  ctx.lineTo(pos.x + ts * 0.9, baseY);
  ctx.closePath();
  ctx.fill();
  
  // Rocky texture lines
  ctx.strokeStyle = 'rgba(80,80,80,0.4)';
  ctx.lineWidth = Math.max(1, ts * 0.015);
  for (let i = 0; i < 4; i++) {
    const yLine = peakY + ts * (0.2 + i * 0.18);
    ctx.beginPath();
    ctx.moveTo(cx - ts * (0.35 - i * 0.05), yLine);
    ctx.lineTo(cx + ts * (0.35 - i * 0.05), yLine);
    ctx.stroke();
  }
  
  // Snow cap with gradient
  const snowLine = peakY + ts * 0.2;
  const snowGrad = ctx.createLinearGradient(cx, peakY, cx, snowLine);
  snowGrad.addColorStop(0, '#ffffff');
  snowGrad.addColorStop(0.3, '#f0f0f0');
  snowGrad.addColorStop(0.7, '#e8e8e8');
  snowGrad.addColorStop(1, '#d0d0d0');
  ctx.fillStyle = snowGrad;
  ctx.beginPath();
  ctx.moveTo(cx, peakY);
  ctx.lineTo(cx - ts * 0.16, snowLine);
  ctx.lineTo(cx + ts * 0.16, snowLine);
  ctx.closePath();
  ctx.fill();
  
  // Snow highlight
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.moveTo(cx, peakY + ts * 0.03);
  ctx.lineTo(cx - ts * 0.05, snowLine - ts * 0.03);
  ctx.lineTo(cx + ts * 0.05, snowLine - ts * 0.03);
  ctx.closePath();
  ctx.fill();
  
  // Rock shadows
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.beginPath();
  ctx.moveTo(cx + ts * 0.12, baseY);
  ctx.lineTo(cx + ts * 0.02, peakY + ts * 0.05);
  ctx.lineTo(cx - ts * 0.05, peakY + ts * 0.08);
  ctx.closePath();
  ctx.fill();
  
  // Mountain detail - small rocks
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(pos.x + ts * 0.25, pos.y + ts * 0.4, ts * 0.06, ts * 0.08);
  ctx.fillRect(pos.x + ts * 0.55, pos.y + ts * 0.5, ts * 0.05, ts * 0.06);
  
  // Ridge highlight
  if (Math.sin(x * 31 + y * 29) > 0) {
    ctx.strokeStyle = 'rgba(200,200,200,0.15)';
    ctx.lineWidth = Math.max(1, ts * 0.01);
    ctx.beginPath();
    ctx.moveTo(cx - ts * 0.1, peakY + ts * 0.12);
    ctx.lineTo(cx + ts * 0.1, peakY + ts * 0.12);
    ctx.stroke();
  }
}

// Enhanced sand with dunes and texture
function renderSand(ctx, pos, ts, x, y) {
  const baseColor = '#c2b280';
  ctx.fillStyle = baseColor;
  ctx.fillRect(pos.x, pos.y, ts, ts);
  
  // Sand dune gradient
  const duneGrad = ctx.createLinearGradient(pos.x, pos.y, pos.x + ts, pos.y + ts);
  duneGrad.addColorStop(0, 'rgba(194,178,128,0.15)');
  duneGrad.addColorStop(0.5, 'rgba(255,255,255,0.02)');
  duneGrad.addColorStop(1, 'rgba(194,178,128,0.1)');
  ctx.fillStyle = duneGrad;
  ctx.fillRect(pos.x, pos.y, ts, ts);
  
  // Sand texture dots
  for (let i = 0; i < 8; i++) {
    const dx = ((x * 7 + i * 13) % 11) / 11 * ts;
    const dy = ((y * 11 + i * 7) % 11) / 11 * ts;
    const dotSize = ts * (0.03 + Math.sin(x + y + i) * 0.02);
    ctx.fillStyle = `rgba(180,165,110,${(0.25 + Math.sin(x + y + i) * 0.1).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(pos.x + dx, pos.y + dy, Math.max(0.5, dotSize / 2), 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Sand ridges
  ctx.fillStyle = 'rgba(210,195,140,0.15)';
  ctx.fillRect(pos.x, pos.y, ts, ts * 0.03);
  ctx.fillRect(pos.x, pos.y + ts * 0.95, ts, ts * 0.03);
  ctx.fillRect(pos.x + ts * 0.3, pos.y, ts * 0.02, ts);
  ctx.fillRect(pos.x + ts * 0.7, pos.y, ts * 0.02, ts);
  
  // Small debris
  if (Math.sin(x * 29 + y * 31) > 0.92) {
    ctx.fillStyle = 'rgba(139,69,19,0.4)';
    ctx.fillRect(pos.x + ts * 0.2, pos.y + ts * 0.3, ts * 0.05, ts * 0.03);
  }
}

// Enhanced grass with flowers, grass tufts, and environmental details
function renderGrass(ctx, pos, ts, x, y, time) {
  const color = getGrassColor(x, y);
  const light = getAmbientLight();
  const grassColor = adjustBrightness(color, light * 0.85 + 0.15);
  ctx.fillStyle = grassColor;
  ctx.fillRect(pos.x, pos.y, ts, ts);

  // Subtle gradient for depth
  const grassGrad = ctx.createLinearGradient(pos.x, pos.y, pos.x + ts, pos.y + ts);
  grassGrad.addColorStop(0, 'rgba(255,255,255,0.05)');
  grassGrad.addColorStop(1, 'rgba(0,0,0,0.05)');
  ctx.fillStyle = grassGrad;
  ctx.fillRect(pos.x, pos.y, ts, ts);

  // Animated grass blades
  ctx.strokeStyle = adjustBrightness('rgba(74,124,63,0.35)', light);
  ctx.lineWidth = 1;
  const bladeCount = 3 + (Math.sin(x * 5.1 + y * 3.7) > 0 ? 1 : 0);
  for (let i = 0; i < bladeCount; i++) {
    const bx = pos.x + ((x * 3 + i * 7) % 15) / 15 * ts;
    const by = pos.y + ((y * 4 + i * 11) % 15) / 15 * ts;
    const bh = ts * (0.12 + Math.sin(x + y + i + (time || 0) * 0.4) * 0.08);
    ctx.beginPath();
    ctx.moveTo(bx, by + bh);
    ctx.lineTo(bx + 1, by);
    ctx.lineTo(bx + 2, by + bh);
    ctx.stroke();
  }

  // Environmental details from pre-generated data
  if (environmentDetails[y] && environmentDetails[y][x]) {
    const details = environmentDetails[y][x];

    // Flowers
    if (details.flowers) {
      const fx = pos.x + details.flowers.x * ts;
      const fy = pos.y + details.flowers.y * ts;
      ctx.fillStyle = details.flowers.color;
      ctx.beginPath();
      ctx.arc(fx, fy, ts * 0.04, 0, Math.PI * 2);
      ctx.fill();
      // Flower center
      ctx.fillStyle = '#ffff99';
      ctx.beginPath();
      ctx.arc(fx, fy, ts * 0.015, 0, Math.PI * 2);
      ctx.fill();
    }

    // Rocks
    if (details.rocks) {
      const rx = pos.x + details.rocks.x * ts;
      const ry = pos.y + details.rocks.y * ts;
      const rsize = ts * details.rocks.size;
      ctx.fillStyle = adjustBrightness('#7a7a7a', light);
      ctx.beginPath();
      ctx.arc(rx, ry, rsize, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = adjustBrightness('#5a5a5a', light);
      ctx.beginPath();
      ctx.arc(rx - rsize * 0.2, ry - rsize * 0.2, rsize * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Grass tufts
    if (details.grassTufts) {
      for (const tuft of details.grassTufts) {
        const tx = pos.x + tuft.x * ts;
        const ty = pos.y + tuft.y * ts;
        const th = ts * tuft.height;
        const detailColor = getGrassDetailColor(x, y);
        ctx.strokeStyle = detailColor + '80';
        ctx.lineWidth = Math.max(1, ts * 0.015);
        ctx.beginPath();
        ctx.moveTo(tx, ty + th);
        ctx.lineTo(tx, ty);
        ctx.lineTo(tx + 1, ty + th);
        ctx.stroke();
      }
    }
  }

  // Shoreline transition
  if (isWaterNeighbor(mapData, x, y, MAP_WIDTH, MAP_HEIGHT)) {
    const shoreGrad = ctx.createLinearGradient(pos.x, pos.y, pos.x, pos.y + ts);
    shoreGrad.addColorStop(0, 'rgba(194,178,128,0.15)');
    shoreGrad.addColorStop(0.6, 'rgba(194,178,128,0.05)');
    shoreGrad.addColorStop(1, 'rgba(194,178,128,0)');
    ctx.fillStyle = shoreGrad;
    ctx.fillRect(pos.x, pos.y, ts, ts);
  }

  // Mountain shadow transition
  if (isMountainNeighbor(mapData, x, y, MAP_WIDTH, MAP_HEIGHT)) {
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(pos.x, pos.y, ts, ts);
  }

  // Fireflies at night (simulated by game time)
  if (time && Math.sin(time * 0.5 + x * 17 + y * 13) > 0.98) {
    const fireflyAlpha = (Math.sin(time * 2 + x * 13 + y * 7) * 0.5 + 0.5) * 0.6;
    ctx.fillStyle = `rgba(255,255,100,${fireflyAlpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(pos.x + ts * 0.6, pos.y + ts * 0.6, ts * 0.03, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Adjust brightness of a hex color
function adjustBrightness(hex, factor) {
  if (!hex || !hex.startsWith('#')) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.max(0, Math.min(255, Math.round(r * factor)));
  const ng = Math.max(0, Math.min(255, Math.round(g * factor)));
  const nb = Math.max(0, Math.min(255, Math.round(b * factor)));
  return `rgb(${nr},${ng},${nb})`;
}

// Enhanced resource rendering with better visual feedback
function renderResource(ctx, pos, ts, res, time) {
  if (res.depleted) return;
  const cx = pos.x + ts / 2;
  const cy = pos.y + ts / 2;
  const r = ts * 0.42;
  const pulse = 1 + Math.sin(time * 2 + res.x + res.y) * 0.08;
  const rr = r * pulse;
  
  // Outer glow
  const outerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr * 2);
  outerGlow.addColorStop(0, res.color + '33');
  outerGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = outerGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, rr * 2, 0, Math.PI * 2);
  ctx.fill();
  
  // Main resource body
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
  gradient.addColorStop(0, res.color);
  gradient.addColorStop(0.6, res.color);
  gradient.addColorStop(1, res.color + '66');
  ctx.fillStyle = gradient;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(cx, cy, rr, 0, Math.PI * 2);
  ctx.fill();
  
  // Inner shine ring
  const ringGrad = ctx.createRadialGradient(cx, cy, rr * 0.85, cx, cy, rr * 1.15);
  ringGrad.addColorStop(0, 'rgba(255,255,255,0)');
  ringGrad.addColorStop(0.5, 'rgba(255,255,255,0.2)');
  ringGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = ringGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, rr * 1.3, 0, Math.PI * 2);
  ctx.fill();
  
  // Border
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
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
  
  // Resource type icon
  const typeIcons = { food: '\u{1F33E}', wood: '\u{1F528}', gold: '\u{1FAE6}', stone: '\u{1FAA8}' };
  const icon = typeIcons[res.type] || '\u25CF';
  ctx.font = `${Math.max(6, ts * 0.18)}px sans-serif`;
  ctx.fillText(icon, cx, cy + rr + ts * 0.14);
  
  // Subtle aura
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = res.color;
  ctx.beginPath();
  ctx.arc(cx, cy, rr * 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// Enhanced map rendering with ambient occlusion and edge blending
function renderMap(ctx) {
  updateTimeOfDay();
  const time = gameState.gameTime || 0;
  const zoom = gameState.camera.zoom;
  const startX = Math.max(0, Math.floor(gameState.camera.x / (TILE_SIZE * zoom)) - 1);
  const endX = Math.min(MAP_WIDTH, Math.ceil((gameState.camera.x + ctx.canvas.width / (2 * zoom)) / TILE_SIZE) + 1);
  const startY = Math.max(0, Math.floor(gameState.camera.y / (TILE_SIZE * zoom)) - 1);
  const endY = Math.min(MAP_HEIGHT, Math.ceil((gameState.camera.y + ctx.canvas.height / (2 * zoom)) / TILE_SIZE) + 1);

  // First pass: base tiles
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const tile = mapData[y][x];
      const pos = getWorldToScreen(x, y);
      const ts = TILE_SIZE * zoom;

      // Apply atmospheric tint for day/night cycle
      applyAtmosphericTint(ctx, ts);

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
          renderForest(ctx, pos, ts, x, y, time);
          break;
        case TILE.MOUNTAIN:
          renderMountain(ctx, pos, ts, x, y);
          break;
        default:
          renderGrass(ctx, pos, ts, x, y, time);
      }

      // Subtle grid lines for clarity at low zoom
      if (zoom < 0.8) {
        ctx.strokeStyle = 'rgba(0,0,0,0.04)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(pos.x, pos.y, ts, ts);
      }
    }
  }

  // Second pass: resources on top
  for (const res of gameState.resourcesOnMap) {
    renderResource(ctx, getWorldToScreen(res.x, res.y), TILE_SIZE * zoom, res, time);
  }
}

// Enhanced fog of war with smoother transitions
function renderFogOfWar(ctx) {
  const zoom = gameState.camera.zoom;
  const startX = Math.max(0, Math.floor(gameState.camera.x / (TILE_SIZE * zoom)) - 1);
  const endX = Math.min(MAP_WIDTH, Math.ceil((gameState.camera.x + ctx.canvas.width / (2 * zoom)) / TILE_SIZE) + 1);
  const startY = Math.max(0, Math.floor(gameState.camera.y / (TILE_SIZE * zoom)) - 1);
  const endY = Math.min(MAP_HEIGHT, Math.ceil((gameState.camera.y + ctx.canvas.height / (2 * zoom)) / TILE_SIZE) + 1);

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

        // Smoother fog gradient with day/night awareness
        const light = getAmbientLight();
        const gradient = ctx.createRadialGradient(fogX, fogY, ts * 0.1, fogX, fogY, fogR);
        gradient.addColorStop(0, `rgba(0,0,0,${0.85 - light * 0.1})`);
        gradient.addColorStop(0.4, `rgba(0,0,0,${0.7 - light * 0.1})`);
        gradient.addColorStop(0.7, `rgba(0,0,0,${0.5 - light * 0.08})`);
        gradient.addColorStop(1, `rgba(0,0,0,${0.3 - light * 0.05})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(pos.x, pos.y, ts, ts);

        // Fog edge texture
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(pos.x + 0.5, pos.y + 0.5, ts - 1, ts - 1);
      }
    }
  }
}

// Enhanced minimap with better visuals and day/night cycle
function renderMinimap() {
  const canvas = document.getElementById('minimapCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const scaleX = canvas.width / MAP_WIDTH;
  const scaleY = canvas.height / MAP_HEIGHT;
  const light = getAmbientLight();

  // Background with sky tint
  const sky = getSkyTint();
  ctx.fillStyle = `rgb(${sky.r},${sky.g},${sky.b})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const tile = mapData[y][x];
      switch (tile) {
        case TILE.GRASS: ctx.fillStyle = adjustBrightness(getGrassColor(x, y), light); break;
        case TILE.SAND: ctx.fillStyle = adjustBrightness('#c2b280', light); break;
        case TILE.WATER: {
          const wave = Math.sin(gameState.gameTime * 2 + x * 0.5 + y * 0.3) * 0.1;
          const r = Math.floor(30 + wave * 40);
          const g = Math.floor(80 + wave * 30);
          const b = Math.floor(160 + wave * 20);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          break;
        }
        case TILE.FOREST: ctx.fillStyle = adjustBrightness('#1b5e20', light); break;
        case TILE.MOUNTAIN: ctx.fillStyle = adjustBrightness('#555', light); break;
        default: ctx.fillStyle = adjustBrightness('#4a7c3f', light);
      }
      ctx.fillRect(x * scaleX, y * scaleY, scaleX + 1, scaleY + 1);
    }
  }

  // Resources with pulsing
  for (const res of gameState.resourcesOnMap) {
    if (!res.depleted) {
      const pulse = 0.6 + Math.sin(gameState.gameTime * 2 + res.x + res.y) * 0.2;
      ctx.fillStyle = res.color;
      ctx.globalAlpha = 0.7 + pulse * 0.3;
      ctx.fillRect(res.x * scaleX, res.y * scaleY, scaleX + 1, scaleY + 1);
      ctx.globalAlpha = 1;
    }
  }

  // Buildings with player colors
  for (const b of gameState.buildings) {
    ctx.fillStyle = b.playerIndex === gameState.playerIndex ? '#f0c040' : PLAYER_COLORS[b.playerIndex] || '#888';
    ctx.fillRect(b.x * scaleX, b.y * scaleY, scaleX + 2, scaleY + 2);
  }

  // Units with direction indicators
  for (const u of gameState.units) {
    if (!u.alive) continue;
    ctx.fillStyle = u.playerIndex === gameState.playerIndex ? '#4CAF50' : PLAYER_COLORS[u.playerIndex] || '#888';
    ctx.fillRect(u.x * scaleX, u.y * scaleY, scaleX + 1, scaleY + 1);
  }

  // Camera view indicator with rounded corners
  ctx.strokeStyle = 'rgba(240,192,64,0.6)';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 3]);
  const camX = gameState.camera.x / TILE_SIZE;
  const camY = gameState.camera.y / TILE_SIZE;
  const viewW = canvas.width / (gameState.camera.zoom * TILE_SIZE * scaleX);
  const viewH = canvas.height / (gameState.camera.zoom * TILE_SIZE * scaleY);
  ctx.strokeRect(camX * scaleX, camY * scaleY, viewW * scaleX, viewH * scaleY);
  ctx.setLineDash([]);

  // View center marker
  ctx.fillStyle = 'rgba(240,192,64,0.8)';
  ctx.beginPath();
  ctx.arc((camX + viewW/2) * scaleX, (camY + viewH/2) * scaleY, 3, 0, Math.PI * 2);
  ctx.fill();
}

window.mapData = mapData;
window.generateMap = generateMap;
window.renderMap = renderMap;
window.renderFogOfWar = renderFogOfWar;
window.renderMinimap = renderMinimap;
window.updateTimeOfDay = updateTimeOfDay;
window.getAmbientLight = getAmbientLight;
window.getSkyTint = getSkyTint;
window.adjustBrightness = adjustBrightness;