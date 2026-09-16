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
    produceTimer: 0,
    produceQueue: [],
    id: Date.now() + Math.random(),
    glowPhase: Math.random() * Math.PI * 2,
    constructed: 0
  };
  if (playerIndex === 0) {
    addNotification(`${PLAYER_NAMES[playerIndex]} built ${def.name}`);
    addParticle(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, "#f0c040", 15);
    addParticle(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, "#fff", 8);
  }
  return building;
}

function updateBuildings(dt) {
  for (const b of gameState.buildings) {
    if (b.playerIndex !== 0) continue;
    b.constructed = Math.min(1, b.constructed + dt * 2);
    b.glowPhase += 0.03;
    if (b.produceQueue.length > 0) {
      const unitType = b.produceQueue[0];
      const unitDef = UNITS[unitType.toUpperCase()] || UNITS.PEASANT;
      const buildTime = unitType === "peasant" ? 10 : 15;
      b.produceTimer += dt;
      if (b.produceTimer >= buildTime) {
        b.produceQueue.shift();
        b.produceTimer = 0;
        const px = b.x + (Math.random() - 0.5);
        const py = b.y + (Math.random() - 0.5);
        const unit = createUnit(unitType, px, py, 0, gameState.resources, gameState, true);
        if (unit) {
          gameState.units.push(unit);
          gameState.population += unit.pop;
          addNotification(`${unitDef.name} trained`);
          addParticle(b.x * TILE_SIZE + TILE_SIZE / 2, b.y * TILE_SIZE + TILE_SIZE / 2, "#4CAF50", 12);
        }
      }
    }
  }
}

function renderBuildings(ctx) {
  const time = gameState.gameTime || 0;
  for (const b of gameState.buildings) {
    const pos = getWorldToScreen(b.x, b.y);
    const ts = TILE_SIZE * gameState.camera.zoom;
    const isPlayer = b.playerIndex === 0;
    const bob = Math.sin(time * 2 + b.glowPhase) * ts * 0.01;
    let baseColor, roofColor, accentColor;
    switch (b.type) {
      case "TOWN_CENTER":
        baseColor = isPlayer ? "#d4a017" : "#6b5a12";
        roofColor = "#8B6914";
        accentColor = isPlayer ? "#ffd700" : "#8B6914";
        break;
      case "BARRACKS":
        baseColor = isPlayer ? "#c41e3a" : "#7a1020";
        roofColor = isPlayer ? "#e53e50" : "#8B1A2A";
        accentColor = isPlayer ? "#ff6b7a" : "#8B1A2A";
        break;
      case "FARM":
        baseColor = isPlayer ? "#4CAF50" : "#2E7D32";
        roofColor = isPlayer ? "#66BB6A" : "#388E3C";
        accentColor = isPlayer ? "#81C784" : "#388E3C";
        break;
      case "LUMBER_CAMP":
        baseColor = isPlayer ? "#8B4513" : "#5a2e0a";
        roofColor = isPlayer ? "#a0522d" : "#6b3a16";
        accentColor = isPlayer ? "#cd853f" : "#6b3a16";
        break;
      case "MINE":
        baseColor = isPlayer ? "#FFD700" : "#8B6914";
        roofColor = "#B8860B";
        accentColor = isPlayer ? "#fffacd" : "#B8860B";
        break;
      case "WALL":
        baseColor = isPlayer ? "#a0a0a0" : "#5a5a5a";
        roofColor = isPlayer ? "#b0b0b0" : "#6a6a6a";
        accentColor = isPlayer ? "#c0c0c0" : "#6a6a6a";
        break;
      case "STABLE":
        baseColor = isPlayer ? "#4169E1" : "#2838a0";
        roofColor = isPlayer ? "#6383f0" : "#3450c0";
        accentColor = isPlayer ? "#8ea0ff" : "#3450c0";
        break;
      default:
        baseColor = "#888";
        roofColor = "#999";
        accentColor = "#aaa";
    }
    ctx.fillStyle = baseColor;
    ctx.fillRect(pos.x + ts * 0.1, pos.y + ts * 0.1 + bob, ts * 0.8, ts * 0.8);
    ctx.strokeStyle = isPlayer ? "#fff" : "#555";
    ctx.lineWidth = 2;
    ctx.strokeRect(pos.x + ts * 0.1, pos.y + ts * 0.1 + bob, ts * 0.8, ts * 0.8);
    if (b.hp < b.maxHp) {
      const barW = ts * 0.8;
      const barH = 5;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(pos.x + ts * 0.1, pos.y - barH - 3, barW, barH);
      const hpRatio = b.hp / b.maxHp;
      const hpColor = hpRatio > 0.5 ? "#4CAF50" : hpRatio > 0.25 ? "#FF9800" : "#f44336";
      ctx.fillStyle = hpColor;
      ctx.fillRect(pos.x + ts * 0.1, pos.y - barH - 3, barW * hpRatio, barH);
    }
    if (b.produceQueue.length > 0) {
      const unitDef = UNITS[b.produceQueue[0].toUpperCase()] || UNITS.PEASANT;
      const progress = b.produceTimer / (b.produceQueue[0] === "peasant" ? 10 : 15);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(pos.x + ts * 0.1, pos.y + ts * 0.85 + bob, ts * 0.8, ts * 0.06);
      ctx.fillStyle = "#4CAF50";
      ctx.fillRect(pos.x + ts * 0.1, pos.y + ts * 0.85 + bob, ts * 0.8 * Math.min(progress, 1), ts * 0.06);
      ctx.fillStyle = "#fff";
      ctx.font = `${Math.max(10, ts * 0.25)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(unitDef.symbol, pos.x + ts / 2, pos.y + ts * 0.5 + bob);
    }
    if (isPlayer) {
      ctx.fillStyle = "rgba(240,192,64,0.3)";
      ctx.beginPath();
      ctx.arc(pos.x + ts / 2, pos.y + ts / 2 + bob, ts * 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(240,192,64,0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pos.x + ts / 2, pos.y + ts / 2 + bob, ts * 0.55, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

window.createBuilding = createBuilding;
window.updateBuildings = updateBuildings;
window.renderBuildings = renderBuildings;