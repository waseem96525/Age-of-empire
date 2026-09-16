function createUnit(type, x, y, playerIndex, wallet, popObj, isFree = false) {
  const unitDef = UNITS[type.toUpperCase()];
  if (!unitDef) return null;
  const w = wallet || gameState.resources;
  const p = popObj || gameState;
  if (!isFree && !canAfford(w, unitDef.cost)) return null;
  if (playerIndex === 0 && p.population + unitDef.pop > p.maxPopulation) return null;
  if (!isFree) spendResources(w, unitDef.cost);
  const unit = {
    type: type.toLowerCase(),
    x, y,
    playerIndex,
    hp: unitDef.hp,
    maxHp: unitDef.hp,
    attack: unitDef.attack,
    armor: unitDef.armor,
    speed: unitDef.speed,
    range: unitDef.range,
    pop: unitDef.pop,
    targetX: x, targetY: y,
    task: "idle",
    attackTarget: null,
    attackType: null,
    gatherType: null,
    gatherTimer: 0,
    gatherDone: false,
    homeX: x, homeY: y,
    movePath: null,
    movePathIndex: 0,
    attackTimer: 0,
    id: Date.now() + Math.random(),
    alive: true,
    symbol: unitDef.symbol,
    color: unitDef.color
  };
  if (unit.type === "peasant") {
    unit.gatherType = "food";
    unit.task = "gather";
    const res = findNearestResource(x, y, "food");
    if (res) { unit.targetX = res.x; unit.targetY = res.y; }
  }
  return unit;
}

function findNearestResource(x, y, type) {
  let best = null, bestDist = Infinity;
  for (const r of gameState.resourcesOnMap) {
    if (r.depleted || (type && r.type !== type)) continue;
    const d = distance(x, y, r.x, r.y);
    if (d < bestDist) { bestDist = d; best = r; }
  }
  return best;
}

function updateUnits(dt) {
  for (const u of gameState.units) {
    if (!u.alive) continue;
    u.attackTimer = Math.max(0, u.attackTimer - dt);
    u.gatherTimer = Math.max(0, u.gatherTimer - dt);
    if (u.playerIndex === 0) {
      if (u.task === "gather" && u.gatherType) {
        const dx = u.targetX - u.x;
        const dy = u.targetY - u.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1.2) {
          if (u.gatherDone === false) collectResource(u);
          const next = findNearestResource(u.x, u.y, u.gatherType);
          if (next) { u.targetX = next.x; u.targetY = next.y; u.gatherDone = false; }
          else { u.task = "idle"; u.gatherType = null; }
        } else {
          u.x += dx / dist * u.speed * dt;
          u.y += dy / dist * u.speed * dt;
        }
      } else if (u.task === "attack" && u.attackTarget) {
        const targetUnit = gameState.units.find(v => v.id === u.attackTarget && v.alive);
        const targetBuilding = gameState.buildings.find(b => b.id === u.attackTarget);
        const target = targetUnit || targetBuilding;
        if (!target) { u.attackTarget = null; u.attackType = null; u.task = "idle"; continue; }
        const dx = target.x - u.x;
        const dy = target.y - u.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= u.range + 0.5) {
          if (u.attackTimer <= 0) {
            const dmg = Math.max(1, u.attack - (target.armor || 0));
            target.hp -= dmg;
            u.attackTimer = 1;
            addParticle(target.x * TILE_SIZE + TILE_SIZE / 2, target.y * TILE_SIZE + TILE_SIZE / 2, "#f44336", 5);
            if (target.hp <= 0) {
              if (targetUnit) { targetUnit.alive = false; gameState.population -= targetUnit.pop; }
              if (targetBuilding) { targetBuilding.hp = 0; }
              addNotification(`${targetUnit ? UNITS[targetUnit.type.toUpperCase()].name : BUILDINGS[targetBuilding.type].name} destroyed`);
            }
          }
        } else {
          u.x += dx / dist * u.speed * dt;
          u.y += dy / dist * u.speed * dt;
        }
      } else if (u.task === "move") {
        if (u.movePath && u.movePathIndex < u.movePath.length) {
          const wp = u.movePath[u.movePathIndex];
          const dx = wp.x - u.x;
          const dy = wp.y - u.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 0.3) {
            u.movePathIndex++;
            if (u.movePathIndex >= u.movePath.length) {
              u.task = "idle";
              u.movePath = null;
            }
          } else {
            u.x += dx / dist * u.speed * dt;
            u.y += dy / dist * u.speed * dt;
          }
        } else if (u.targetX !== undefined && u.targetY !== undefined) {
          const dx = u.targetX - u.x;
          const dy = u.targetY - u.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 0.3) {
            u.task = "idle";
          } else {
            u.x += dx / dist * u.speed * dt;
            u.y += dy / dist * u.speed * dt;
          }
        }
      } else if (u.task === "idle") {
        if (u.type === "peasant") {
          u.task = "move";
          u.movePath = findPath(Math.floor(u.x), Math.floor(u.y), Math.floor(u.homeX), Math.floor(u.homeY));
          if (u.movePath) u.movePathIndex = 1;
        }
      }
    }
  }
  gameState.units = gameState.units.filter(u => u.alive);
}

function unitAttack(unit, targetType, targetId) {
  if (!unit || !unit.alive) return;
  unit.attackTarget = targetId;
  unit.attackType = targetType;
  unit.task = "attack";
  unit.attackTimer = 0;
}

function unitMove(unit, tx, ty) {
  if (!unit || !unit.alive) return;
  unit.targetX = tx;
  unit.targetY = ty;
  unit.task = "move";
  unit.movePath = findPath(Math.floor(unit.x), Math.floor(unit.y), Math.floor(tx), Math.floor(ty));
  if (unit.movePath) unit.movePathIndex = 1;
  else { unit.movePath = null; unit.movePathIndex = 0; }
}

function unitGather(unit, resType) {
  if (!unit || !unit.alive) return;
  unit.gatherType = resType;
  unit.task = "gather";
  unit.gatherTimer = 0;
  unit.gatherDone = false;
  const res = findNearestResource(unit.x, unit.y, resType);
  if (res) { unit.targetX = res.x; unit.targetY = res.y; }
}

function renderUnits(ctx) {
  for (const u of gameState.units) {
    if (!u.alive) continue;
    const pos = getWorldToScreen(u.x, u.y);
    const ts = TILE_SIZE * gameState.camera.zoom;
    const isSelected = gameState.selectedUnits.some(v => v.id === u.id);
    ctx.fillStyle = u.color;
    ctx.beginPath();
    ctx.arc(pos.x + ts / 2, pos.y + ts / 2, ts * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `${Math.max(10, ts * 0.35)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(u.symbol, pos.x + ts / 2, pos.y + ts / 2 + 1);
    if (u.hp < u.maxHp) {
      const barW = ts * 0.5;
      const barH = 3;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(pos.x + ts / 2 - barW / 2, pos.y - barH - 4, barW, barH);
      const hpRatio = u.hp / u.maxHp;
      const hpColor = hpRatio > 0.5 ? "#4CAF50" : hpRatio > 0.25 ? "#FF9800" : "#f44336";
      ctx.fillStyle = hpColor;
      ctx.fillRect(pos.x + ts / 2 - barW / 2, pos.y - barH - 4, barW * hpRatio, barH);
    }
    if (isSelected) {
      ctx.strokeStyle = "#f0c040";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(pos.x + ts / 2, pos.y + ts / 2, ts * 0.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

window.createUnit = createUnit;
window.updateUnits = updateUnits;
window.renderUnits = renderUnits;
window.unitAttack = unitAttack;
window.unitMove = unitMove;
window.unitGather = unitGather;