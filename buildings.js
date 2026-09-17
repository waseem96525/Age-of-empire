// Enhanced buildings with level-based visuals and detailed graphics
function createBuilding(type, x, y, playerIndex, wallet) {
  const def = BUILDINGS[type];
  if (!def) return null;
  const w = wallet || gameState.resources;
  if (!canAfford(w, def.cost)) return null;
  if (!isBuildable(x, y)) return null;
  if (gameState.buildings.some(b => b.x === x && b.y === y)) return null;
  spendResources(w, def.cost);
  const building = {
    type, x, y, playerIndex,
    hp: def.hp, maxHp: def.hp,
    radius: def.radius,
    pop: def.pop,
    level: 1, // New: building level for upgrades
    produceTimer: 0,
    produceQueue: [],
    rallyX: x + 1.25,
    rallyY: y + 1.25,
    id: Date.now() + Math.random(),
    glowPhase: Math.random() * Math.PI * 2,
    constructed: 0,
    // New: upgradeable properties
    upgradeCost: { food: Math.round(def.cost.food * 0.5), wood: Math.round(def.cost.wood * 0.5), gold: Math.round(def.cost.gold * 0.5), stone: Math.round(def.cost.stone * 0.5) }
  };
  if (playerIndex === 0 && def.pop) gameState.maxPopulation += def.pop;
  if (playerIndex === 0) {
    addNotification(`${PLAYER_NAMES[playerIndex]} built ${def.name}`);
    addParticle(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, "#f0c040", 15);
    addParticle(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, "#fff", 8);
    Sound.playBuild();
  }
  return building;
}

// New function to upgrade a building
function upgradeBuilding(building) {
  if (!building || building.level >= 3) return false; // Max level 3
  const cost = building.upgradeCost;
  if (!canAfford(gameState.resources, cost)) return false;
  
  spendResources(gameState.resources, cost);
  
  // Increase level and stats
  building.level++;
  const levelMultiplier = 1 + (building.level - 1) * 0.3; // 30% increase per level
  building.hp = Math.floor(building.hp * levelMultiplier);
  building.maxHp = building.hp;
  building.radius = Math.floor(building.radius * levelMultiplier * 0.5) + Math.floor(building.radius * 0.5); // Smaller radius increase
  building.pop = Math.floor(building.pop * levelMultiplier);
  
  // Update max population if player 0
  if (building.playerIndex === 0) {
    gameState.maxPopulation = Math.max(0, gameState.maxPopulation - (building.pop / levelMultiplier)) + building.pop;
  }
  
  // Visual feedback
  addNotification(`${BUILDINGS[building.type].name} upgraded to Level ${building.level}!`);
  addParticle(building.x * TILE_SIZE + TILE_SIZE / 2, building.y * TILE_SIZE + TILE_SIZE / 2, "#4CAF50", 20);
  addParticle(building.x * TILE_SIZE + TILE_SIZE / 2, building.y * TILE_SIZE + TILE_SIZE / 2, "#fff", 10);
  
  return true;
}

function updateBuildings(dt) {
  for (const b of gameState.buildings) {
    if (b.playerIndex !== 0) continue;
    b.constructed = Math.min(1, b.constructed + dt * 2);
    b.glowPhase += 0.03;
    
    // Add pulsing glow for upgraded buildings
    if (b.level > 1) {
      b.glowIntensity = 0.5 + Math.sin(b.glowPhase) * 0.5 * (b.level - 1) * 0.3;
    }
    
    if (b.produceQueue.length > 0) {
      const unitType = b.produceQueue[0];
      const unitDef = UNITS[unitType.toUpperCase()] || UNITS.PEASANT;
      const buildTime = unitType === "peasant" ? 10 : 15;
      b.produceTimer += dt;
      if (b.produceTimer >= buildTime) {
        b.produceQueue.shift();
        b.produceTimer = 0;
        const px = b.rallyX + (Math.random() - 0.22);
        const py = b.rallyY + (Math.random() - 0.22);
        const unit = createUnit(unitType, px, py, 0, gameState.resources, gameState, true);
        if (unit) {
          gameState.units.push(unit);
          gameState.population += unit.pop;
          addNotification(`${unitDef.name} trained`);
          addParticle(b.x * TILE_SIZE + TILE_SIZE / 2, b.y * TILE_SIZE + TILE_SIZE / 2, "#4CAF50", 12);
          Sound.playTrain();
        }
      }
    }
  }
}

// Enhanced roof drawing with more detail
function drawRoof(ctx, cx, y, width, height, color, trim, level = 1) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - width / 2, y + height);
  ctx.quadraticCurveTo(cx - width * 0.36, y + height * 0.2, cx, y);
  ctx.quadraticCurveTo(cx + width * 0.36, y + height * 0.2, cx + width / 2, y + height);
  ctx.closePath();
  ctx.fill();
  
  // Add roof details based on level
  if (level >= 2) {
    ctx.strokeStyle = trim;
    ctx.lineWidth = Math.max(1, width * 0.02);
    // Add decorative elements
    for (let i = 0; i < level; i++) {
      const offset = (width * 0.2) * (i + 1) / (level + 1);
      ctx.beginPath();
      ctx.moveTo(cx - width * 0.25 + offset, y + height * 0.3);
      ctx.lineTo(cx - width * 0.25 + offset, y);
      ctx.stroke();
    }
  }
  
  ctx.strokeStyle = trim;
  ctx.lineWidth = Math.max(1, width * 0.035);
  ctx.beginPath();
  ctx.moveTo(cx - width / 2, y + height);
  ctx.quadraticCurveTo(cx, y + height * 0.48, cx + width / 2, y + height);
  ctx.stroke();
}

// Enhanced health bar with level indicator
function drawBuildingHealthBar(ctx, b, x, y, width, ts) {
  if (b.hp >= b.maxHp) return;
  const ratio = Math.max(0, b.hp / b.maxHp);
  const height = Math.max(4, ts * 0.075);
  
  // Background
  ctx.fillStyle = "rgba(22, 18, 11, 0.82)";
  ctx.fillRect(x, y, width, height);
  
  // Health fill with gradient effect
  const gradient = ctx.createLinearGradient(x, y, x + width * ratio, y);
  gradient.addColorStop(0, ratio > 0.5 ? "#69b552" : ratio > 0.25 ? "#e2a83b" : "#c7483c");
  gradient.addColorStop(1, ratio > 0.5 ? "#8ecf6a" : ratio > 0.25 ? "#efb94c" : "#d56a43");
  ctx.fillStyle = gradient;
  ctx.fillRect(x + 1, y + 1, Math.max(0, (width - 2) * ratio), Math.max(1, height - 2));
  
  // Level indicator
  if (b.level > 1) {
    ctx.fillStyle = "rgba(240, 192, 64, 0.8)";
    ctx.font = `bold ${Math.max(8, ts * 0.15)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`Lv.${b.level}`, x + width / 2, y + height / 2);
  }
}

// Enhanced banner with animation
function drawBanner(ctx, x, y, height, color, pulse = 0) {
  ctx.strokeStyle = "#4a3421";
  ctx.lineWidth = Math.max(1.5, height * 0.06);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - height);
  ctx.stroke();
  
  // Animated banner
  const waveHeight = Math.sin(pulse) * height * 0.1;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - height + waveHeight);
  ctx.lineTo(x + height * 0.38, y - height * 0.86 + waveHeight * 0.5);
  ctx.lineTo(x, y - height * 0.68 + waveHeight * 0.3);
  ctx.closePath();
  ctx.fill();
}

// Enhanced building drawing with level-based details
function drawBuildingShape(ctx, b, pos, ts, base, roof, trim, construction) {
  const x = pos.x + ts * 0.08;
  const y = pos.y + ts * (0.08 + (1 - construction) * 0.18);
  const w = ts * 0.84;
  const h = ts * 0.8 * construction;
  const cx = x + w / 2;
  const bottom = y + h;
  const teamColor = PLAYER_COLORS[b.playerIndex] || "#8d3c35";
  const outline = b.playerIndex === 0 ? "#f0d689" : "#482727";
  
  ctx.save();
  ctx.globalAlpha = 0.5 + construction * 0.5;
  ctx.fillStyle = "rgba(20, 26, 16, 0.35)";
  ctx.beginPath();
  ctx.ellipse(cx, bottom + ts * 0.035, w * 0.5, ts * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  
  if (construction < 0.99) {
    ctx.strokeStyle = "#8c6840";
    ctx.lineWidth = Math.max(2, ts * 0.055);
    for (let i = 0; i < 3; i++) {
      const px = x + w * (0.18 + i * 0.29);
      ctx.beginPath();
      ctx.moveTo(px, bottom);
      ctx.lineTo(px + ts * 0.08, y + h * 0.22);
      ctx.stroke();
    }
  }
  
  // Enhanced building type rendering with level-based details
  if (b.type === "TOWN_CENTER") {
    ctx.fillStyle = base;
    ctx.fillRect(x + w * 0.12, y + h * 0.42, w * 0.76, h * 0.5);
    ctx.fillStyle = "#3f2c20";
    ctx.fillRect(cx - w * 0.1, y + h * 0.65, w * 0.2, h * 0.27);
    drawRoof(ctx, cx, y + h * 0.1, w * 0.98, h * 0.4, roof, trim, b.level);
    drawRoof(ctx, cx, y, w * 0.54, h * 0.24, roof, trim, b.level);
    ctx.fillStyle = trim;
    ctx.fillRect(cx - w * 0.035, y - h * 0.055, w * 0.07, h * 0.13);
    drawBanner(ctx, x + w * 0.84, y + h * 0.42, h * 0.6, teamColor, b.glowPhase);
    
    // Level-based decorations
    if (b.level >= 2) {
      // Add towers or extensions
      ctx.fillStyle = trim;
      ctx.fillRect(x + w * 0.05, y + h * 0.1, w * 0.1, h * 0.3);
      ctx.fillRect(x + w * 0.85, y + h * 0.1, w * 0.1, h * 0.3);
    }
    if (b.level >= 3) {
      // Add central spire
      ctx.fillStyle = "#fff";
      ctx.fillRect(cx - w * 0.02, y - h * 0.1, w * 0.04, h * 0.2);
    }
  } else if (b.type === "HOUSE") {
    ctx.fillStyle = base;
    ctx.fillRect(x + w * 0.18, y + h * 0.43, w * 0.64, h * 0.45);
    drawRoof(ctx, cx, y + h * 0.15, w * 0.78, h * 0.38, roof, trim, b.level);
    ctx.fillStyle = "#3e2d22";
    ctx.fillRect(cx - w * 0.09, y + h * 0.62, w * 0.18, h * 0.26);
    ctx.fillStyle = "#e7cf85";
    ctx.fillRect(x + w * 0.27, y + h * 0.58, w * 0.09, h * 0.11);
    
    // Level-based additions
    if (b.level >= 2) {
      ctx.fillStyle = trim;
      ctx.fillRect(x + w * 0.02, y + h * 0.3, w * 0.08, h * 0.4);
      ctx.fillRect(x + w * 0.9, y + h * 0.3, w * 0.08, h * 0.4);
    }
  } else if (b.type === "BARRACKS") {
    ctx.fillStyle = base;
    ctx.fillRect(x + w * 0.08, y + h * 0.42, w * 0.84, h * 0.48);
    drawRoof(ctx, cx, y + h * 0.1, w, h * 0.42, roof, trim, b.level);
    ctx.fillStyle = "#38261f";
    ctx.fillRect(cx - w * 0.11, y + h * 0.61, w * 0.22, h * 0.29);
    ctx.fillStyle = trim;
    ctx.fillRect(x + w * 0.17, y + h * 0.54, w * 0.08, h * 0.12);
    ctx.fillRect(x + w * 0.75, y + h * 0.54, w * 0.08, h * 0.12);
    drawBanner(ctx, x + w * 0.8, y + h * 0.4, h * 0.52, teamColor, b.glowPhase);
    
    // Level-based weapon racks
    if (b.level >= 2) {
      ctx.fillStyle = "#5d4037";
      for (let i = 0; i < b.level - 1; i++) {
        const offset = w * 0.1 + i * w * 0.15;
        ctx.fillRect(x + offset, y + h * 0.3, w * 0.06, h * 0.2);
      }
    }
  } else if (b.type === "FARM") {
    ctx.fillStyle = "#a28039";
    ctx.fillRect(x, y + h * 0.3, w, h * 0.63);
    ctx.strokeStyle = "#d7b553";
    ctx.lineWidth = Math.max(1, ts * 0.025);
    for (let i = 0; i < 5 + (b.level - 1); i++) { // More rows for higher levels
      ctx.beginPath();
      ctx.moveTo(x + w * 0.08, y + h * (0.42 + i * 0.08));
      ctx.lineTo(x + w * 0.92, y + h * (0.34 + i * 0.08));
      ctx.stroke();
    }
    ctx.fillStyle = base;
    ctx.fillRect(x + w * 0.1, y + h * 0.55, w * 0.26, h * 0.34);
    drawRoof(ctx, x + w * 0.23, y + h * 0.4, w * 0.4, h * 0.24, roof, trim, b.level);
    
    // Level-based farm details
    if (b.level >= 2) {
      // Add farmhouse
      ctx.fillStyle = "#8b4513";
      ctx.fillRect(x + w * 0.7, y + h * 0.1, w * 0.25, h * 0.3);
      ctx.fillStyle = "#a0522d";
      ctx.fillRect(x + w * 0.75, y + h * 0.05, w * 0.15, h * 0.05);
    }
  } else if (b.type === "LUMBER_CAMP") {
    ctx.fillStyle = base;
    ctx.fillRect(x + w * 0.12, y + h * 0.45, w * 0.76, h * 0.42);
    drawRoof(ctx, cx, y + h * 0.18, w * 0.9, h * 0.36, roof, trim, b.level);
    ctx.fillStyle = "#6c3f22";
    for (let i = 0; i < 3 + (b.level - 1); i++) { // More wood piles for higher levels
      ctx.fillRect(x + w * (0.05 + i * 0.1), y + h * (0.72 - i * 0.02), w * 0.18, h * 0.1);
    }
    drawBanner(ctx, x + w * 0.8, y + h * 0.43, h * 0.5, teamColor, b.glowPhase);
    
    // Level-based sawmill
    if (b.level >= 2) {
      ctx.fillStyle = "#8b4513";
      ctx.fillRect(x + w * 0.02, y + h * 0.2, w * 0.15, h * 0.3);
      ctx.fillStyle = "#ff0000";
      ctx.fillRect(x + w * 0.05, y + h * 0.25, w * 0.09, h * 0.05); // Saw blade
    }
  } else if (b.type === "MINE") {
    ctx.fillStyle = "#69665d";
    ctx.beginPath();
    ctx.moveTo(x + w * 0.08, bottom);
    ctx.lineTo(x + w * 0.28, y + h * 0.25);
    ctx.lineTo(x + w * 0.73, y + h * 0.18);
    ctx.lineTo(x + w * 0.94, bottom);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#1f2421";
    ctx.beginPath();
    ctx.arc(cx, y + h * 0.69, w * 0.2, Math.PI, 0);
    ctx.lineTo(cx + w * 0.2, bottom);
    ctx.lineTo(cx - w * 0.2, bottom);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = trim;
    ctx.lineWidth = Math.max(2, ts * 0.05);
    ctx.beginPath();
    ctx.moveTo(x + w * 0.18, y + h * 0.75);
    ctx.lineTo(x + w * 0.33, y + h * 0.42);
    ctx.lineTo(x + w * 0.67, y + h * 0.42);
    ctx.lineTo(x + w * 0.82, y + h * 0.75);
    ctx.stroke();
    
    // Level-based mine details
    if (b.level >= 2) {
      // Add mine cart tracks
      ctx.strokeStyle = "#8b4513";
      ctx.lineWidth = Math.max(1, ts * 0.02);
      for (let i = 0; i < b.level - 1; i++) {
        const yOffset = h * 0.1 + i * h * 0.15;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.1, y + yOffset);
        ctx.lineTo(x + w * 0.9, y + yOffset);
        ctx.stroke();
      }
    }
  } else if (b.type === "WALL") {
    ctx.fillStyle = base;
    ctx.fillRect(x, y + h * 0.3, w, h * 0.55);
    ctx.fillStyle = roof;
    const battlements = 2 + Math.floor((b.level - 1) * 1.5); // More battlements for higher levels
    for (let i = 0; i < battlements; i++) {
      ctx.fillRect(x + w * (i * 0.25 + 0.03), y + h * 0.18, w * 0.14, h * 0.18);
    }
    ctx.strokeStyle = trim;
    ctx.lineWidth = Math.max(1, ts * 0.025);
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.57);
    ctx.lineTo(x + w, y + h * 0.57);
    ctx.stroke();
    
    // Level-based reinforcements
    if (b.level >= 2) {
      ctx.fillStyle = "#8b4513";
      ctx.fillRect(x + w * 0.4, y + h * 0.25, w * 0.2, h * 0.1); // Reinforcement beam
    }
  } else if (b.type === "STABLE") {
    ctx.fillStyle = base;
    ctx.fillRect(x + w * 0.08, y + h * 0.43, w * 0.84, h * 0.45);
    drawRoof(ctx, cx, y + h * 0.12, w * 1.02, h * 0.4, roof, trim, b.level);
    ctx.fillStyle = "#39281e";
    ctx.fillRect(cx - w * 0.12, y + h * 0.57, w * 0.24, h * 0.31);
    ctx.fillStyle = trim;
    ctx.fillRect(x + w * 0.22, y + h * 0.55, w * 0.08, h * 0.14);
    ctx.fillRect(x + w * 0.7, y + h * 0.55, w * 0.08, h * 0.14);
    drawBanner(ctx, x + w * 0.82, y + h * 0.42, h * 0.55, teamColor, b.glowPhase);
    
    // Level-based horse details
    if (b.level >= 2) {
      // Add feeding troughs
      ctx.fillStyle = "#8b4513";
      ctx.fillRect(x + w * 0.1, y + h * 0.3, w * 0.15, h * 0.05);
      ctx.fillRect(x + w * 0.75, y + h * 0.3, w * 0.15, h * 0.05);
      // Add hay piles
      ctx.fillStyle = "#ffe4b5";
      for (let i = 0; i < b.level - 1; i++) {
        ctx.beginPath();
        ctx.arc(x + w * (0.2 + i * 0.3), y + h * 0.35, w * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  
  ctx.strokeStyle = outline;
  ctx.lineWidth = Math.max(1, ts * 0.03);
  ctx.strokeRect(x, y + h * 0.42, w, Math.max(1, h * 0.48));
  ctx.restore();
}

// Enhanced renderBuildings with level-based effects
function renderBuildings(ctx) {
  const light = window.getAmbientLight ? window.getAmbientLight() : 1;
  for (const b of gameState.buildings) {
    const pos = getWorldToScreen(b.x, b.y);
    const ts = TILE_SIZE * gameState.camera.zoom;
    const isPlayer = b.playerIndex === 0;
    let baseColor, roofColor, accentColor;
    switch (b.type) {
      case "TOWN_CENTER":
        baseColor = isPlayer ? "#b88d51" : "#76534a";
        roofColor = isPlayer ? "#a43e31" : "#673535";
        accentColor = isPlayer ? "#e1be69" : "#a66f61";
        break;
      case "BARRACKS":
        baseColor = isPlayer ? "#987052" : "#704849";
        roofColor = isPlayer ? "#57353a" : "#4a3033";
        accentColor = isPlayer ? "#d2ae65" : "#95615b";
        break;
      case "HOUSE":
        baseColor = isPlayer ? "#b4895b" : "#79574c";
        roofColor = isPlayer ? "#8c4431" : "#623a36";
        accentColor = isPlayer ? "#e1bd6c" : "#a17162";
        break;
      case "FARM":
        baseColor = isPlayer ? "#ae8b57" : "#7e624d";
        roofColor = isPlayer ? "#83482e" : "#5c4030";
        accentColor = "#e1bb61";
        break;
      case "LUMBER_CAMP":
        baseColor = isPlayer ? "#9d6841" : "#704a36";
        roofColor = isPlayer ? "#71402a" : "#563529";
        accentColor = "#d1aa64";
        break;
      case "MINE":
        baseColor = isPlayer ? "#77776d" : "#555655";
        roofColor = "#55544e";
        accentColor = isPlayer ? "#c5a650" : "#8e7548";
        break;
      case "WALL":
        baseColor = isPlayer ? "#9b9586" : "#6d6964";
        roofColor = isPlayer ? "#c1b78d" : "#8a7c6c";
        accentColor = roofColor;
        break;
      case "STABLE":
        baseColor = isPlayer ? "#9a6f45" : "#704d39";
        roofColor = isPlayer ? "#33594c" : "#3c4944";
        accentColor = isPlayer ? "#d0ae68" : "#996b59";
        break;
      default:
        baseColor = "#888";
        roofColor = "#999";
        accentColor = "#aaa";
    }
    const construction = isPlayer ? Math.max(0.15, b.constructed) : 1;

    // Add pulsing glow effect for upgraded buildings
    const glowEffect = b.level > 1 ? (b.glowIntensity || 0) : 0;

    drawBuildingShape(ctx, b, pos, ts, baseColor, roofColor, accentColor, construction);
    drawBuildingHealthBar(ctx, b, pos.x + ts * 0.1, pos.y - ts * 0.08, ts * 0.8, ts);

    // Enhanced selection effects
    if (isPlayer && gameState.selectedBuilding === b && BUILDINGS[b.type].produces.length > 0) {
      const rally = getWorldToScreen(b.rallyX, b.rallyY);
      ctx.strokeStyle = "rgba(245, 214, 106, 0.55)";
      ctx.lineWidth = Math.max(1, ts * 0.025);
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pos.x + ts / 2, pos.y + ts / 2);
      ctx.lineTo(rally.x + ts / 2, rally.y + ts / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#f5d66a";
      ctx.beginPath();
      ctx.arc(rally.x + ts / 2, rally.y + ts / 2, Math.max(3, ts * 0.1), 0, Math.PI * 2);
      ctx.fill();
      drawBanner(ctx, rally.x + ts / 2, rally.y + ts / 2, ts * 0.38, PLAYER_COLORS[0], b.glowPhase);
    }

    // Enhanced production queue display
    if (b.produceQueue.length > 0) {
      const unitDef = UNITS[b.produceQueue[0].toUpperCase()] || UNITS.PEASANT;
      const progress = b.produceTimer / (b.produceQueue[0] === "peasant" ? 10 : 15);

      // Background
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(pos.x + ts * 0.1, pos.y + ts * 0.91, ts * 0.8, ts * 0.055);

      // Progress bar with gradient
      const progressGradient = ctx.createLinearGradient(pos.x + ts * 0.1, pos.y + ts * 0.91, pos.x + ts * 0.9, pos.y + ts * 0.91);
      progressGradient.addColorStop(0, "#d6b85e");
      progressGradient.addColorStop(1, "#f5ead1");
      ctx.fillStyle = progressGradient;
      ctx.fillRect(pos.x + ts * 0.1, pos.y + ts * 0.91, ts * 0.8 * Math.min(progress, 1), ts * 0.055);

      // Level indicator
      if (b.level > 1) {
        ctx.fillStyle = "rgba(240, 192, 64, 0.8)";
        ctx.font = `bold ${Math.max(9, ts * 0.15)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`Lv.${b.level}`, pos.x + ts / 2, pos.y + ts * 0.85);
      }

      ctx.fillStyle = "#f5ead1";
      ctx.font = `bold ${Math.max(9, ts * 0.2)}px Georgia, serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(unitDef.symbol, pos.x + ts / 2, pos.y + ts * 0.72);
    }
  }
}

window.createBuilding = createBuilding;
window.updateBuildings = updateBuildings;
window.renderBuildings = renderBuildings;
window.upgradeBuilding = upgradeBuilding;