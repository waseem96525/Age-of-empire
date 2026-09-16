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
      } else if (u.task === "repair" && u.attackTarget) {
        const target = gameState.buildings.find(b => b.id === u.attackTarget && b.playerIndex === u.playerIndex);
        if (!target || target.hp >= target.maxHp) {
          u.attackTarget = null;
          u.task = "idle";
          continue;
        }
        const dx = target.x - u.x;
        const dy = target.y - u.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= 1.15) {
          if (u.gatherTimer <= 0) {
            if (gameState.resources.wood > 0) {
              target.hp = Math.min(target.maxHp, target.hp + 10);
              gameState.resources.wood--;
              addParticle(target.x * TILE_SIZE + TILE_SIZE / 2, target.y * TILE_SIZE + TILE_SIZE / 2, "#e1be69", 3);
            } else {
              addNotification("Not enough wood to repair");
              u.task = "idle";
              u.attackTarget = null;
            }
            u.gatherTimer = 0.75;
          }
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

function unitRepair(unit, buildingId) {
  if (!unit || !unit.alive || unit.type !== "peasant") return;
  unit.attackTarget = buildingId;
  unit.attackType = "building";
  unit.task = "repair";
  unit.gatherTimer = 0;
}

function drawUnitHealthBar(ctx, u, cx, y, ts) {
  if (u.hp >= u.maxHp) return;
  const barW = ts * 0.58;
  const barH = Math.max(3, ts * 0.07);
  const hpRatio = u.hp / u.maxHp;
  const hpColor = hpRatio > 0.5 ? "#64b852" : hpRatio > 0.25 ? "#e1a93d" : "#bf3e34";
  ctx.fillStyle = "rgba(20, 18, 12, 0.8)";
  ctx.fillRect(cx - barW / 2, y, barW, barH);
  ctx.fillStyle = hpColor;
  ctx.fillRect(cx - barW / 2 + 1, y + 1, Math.max(0, (barW - 2) * hpRatio), Math.max(1, barH - 2));
}

function drawUnitSilhouette(ctx, u, cx, cy, ts) {
  const scale = ts / 40;
  const teamColor = PLAYER_COLORS[u.playerIndex] || "#4caf50";
  const skin = "#d49a6a";
  const darkSkin = "#a86f4c";
  const robe = u.type === "peasant" ? "#8e7355" : u.type === "archer" ? "#557a3c" : "#7d3f36";
  const metal = "#c8c5b8";

  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.fillStyle = "rgba(23, 30, 18, 0.32)";
  ctx.beginPath();
  ctx.ellipse(0, ts * 0.22, ts * 0.25, ts * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();

  if (u.type === "cavalry") {
    ctx.fillStyle = "#805039";
    ctx.beginPath();
    ctx.ellipse(-ts * 0.04, ts * 0.07, ts * 0.27, ts * 0.17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6a3c2b";
    ctx.fillRect(ts * 0.17, -ts * 0.05, ts * 0.12, ts * 0.2);
    ctx.fillStyle = "#35251f";
    ctx.fillRect(-ts * 0.18, ts * 0.17, ts * 0.06, ts * 0.14);
    ctx.fillRect(ts * 0.1, ts * 0.17, ts * 0.06, ts * 0.14);
    ctx.fillStyle = "#b89152";
    ctx.fillRect(-ts * 0.19, -ts * 0.02, ts * 0.28, ts * 0.08);
  }

  const riderOffset = u.type === "cavalry" ? -ts * 0.12 : 0;
  ctx.fillStyle = "#30383d";
  ctx.fillRect(-ts * 0.11, riderOffset + ts * 0.08, ts * 0.08, ts * 0.18);
  ctx.fillRect(ts * 0.03, riderOffset + ts * 0.08, ts * 0.08, ts * 0.18);

  ctx.fillStyle = u.type === "samurai" ? "#38454d" : robe;
  ctx.beginPath();
  ctx.moveTo(-ts * 0.16, riderOffset - ts * 0.05);
  ctx.lineTo(ts * 0.16, riderOffset - ts * 0.05);
  ctx.lineTo(ts * 0.12, riderOffset + ts * 0.16);
  ctx.lineTo(-ts * 0.12, riderOffset + ts * 0.16);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = teamColor;
  ctx.fillRect(-ts * 0.16, riderOffset + ts * 0.02, ts * 0.32, ts * 0.055);
  ctx.fillStyle = darkSkin;
  ctx.beginPath();
  ctx.arc(0, riderOffset - ts * 0.13, ts * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(-ts * 0.015, riderOffset - ts * 0.145, ts * 0.082, 0, Math.PI * 2);
  ctx.fill();

  if (u.type === "peasant") {
    ctx.fillStyle = "#c8a55a";
    ctx.beginPath();
    ctx.ellipse(0, riderOffset - ts * 0.205, ts * 0.13, ts * 0.042, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#744826";
    ctx.lineWidth = Math.max(2, 2.5 * scale);
    ctx.beginPath();
    ctx.moveTo(ts * 0.12, riderOffset + ts * 0.01);
    ctx.lineTo(ts * 0.27, riderOffset - ts * 0.2);
    ctx.stroke();
    ctx.strokeStyle = "#a2a7a1";
    ctx.beginPath();
    ctx.moveTo(ts * 0.22, riderOffset - ts * 0.22);
    ctx.lineTo(ts * 0.31, riderOffset - ts * 0.16);
    ctx.stroke();
  } else if (u.type === "archer") {
    ctx.strokeStyle = "#8a5b32";
    ctx.lineWidth = Math.max(2, 2.4 * scale);
    ctx.beginPath();
    ctx.arc(ts * 0.2, riderOffset, ts * 0.16, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.strokeStyle = "#e6d4a9";
    ctx.lineWidth = Math.max(1, scale);
    ctx.beginPath();
    ctx.moveTo(ts * 0.2, riderOffset - ts * 0.16);
    ctx.lineTo(ts * 0.2, riderOffset + ts * 0.16);
    ctx.stroke();
  } else if (u.type === "samurai") {
    ctx.fillStyle = "#252b30";
    ctx.beginPath();
    ctx.arc(0, riderOffset - ts * 0.2, ts * 0.115, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#d1b05f";
    ctx.fillRect(-ts * 0.13, riderOffset - ts * 0.165, ts * 0.26, ts * 0.035);
    ctx.strokeStyle = metal;
    ctx.lineWidth = Math.max(2, 2.5 * scale);
    ctx.beginPath();
    ctx.moveTo(ts * 0.1, riderOffset + ts * 0.08);
    ctx.lineTo(ts * 0.28, riderOffset - ts * 0.16);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#69747a";
    ctx.beginPath();
    ctx.moveTo(-ts * 0.1, riderOffset - ts * 0.19);
    ctx.lineTo(ts * 0.1, riderOffset - ts * 0.19);
    ctx.lineTo(ts * 0.06, riderOffset - ts * 0.28);
    ctx.lineTo(-ts * 0.06, riderOffset - ts * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = metal;
    ctx.lineWidth = Math.max(2, 2.5 * scale);
    ctx.beginPath();
    ctx.moveTo(ts * 0.1, riderOffset + ts * 0.08);
    ctx.lineTo(ts * 0.27, riderOffset - ts * 0.18);
    ctx.stroke();
  }
  ctx.restore();
}

function renderUnits(ctx) {
  for (const u of gameState.units) {
    if (!u.alive) continue;
    const pos = getWorldToScreen(u.x, u.y);
    const ts = TILE_SIZE * gameState.camera.zoom;
    const isSelected = gameState.selectedUnits.some(v => v.id === u.id);
    const cx = pos.x + ts / 2;
    const cy = pos.y + ts * 0.54;
    drawUnitSilhouette(ctx, u, cx, cy, ts);
    drawUnitHealthBar(ctx, u, cx, pos.y - ts * 0.08, ts);
    if (isSelected) {
      ctx.strokeStyle = "#f5d66a";
      ctx.lineWidth = Math.max(2, ts * 0.05);
      ctx.beginPath();
      ctx.ellipse(cx, pos.y + ts * 0.72, ts * 0.31, ts * 0.14, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

window.createUnit = createUnit;
window.updateUnits = updateUnits;
window.renderUnits = renderUnits;
window.unitAttack = unitAttack;
window.unitMove = unitMove;
window.unitGather = unitGather;
window.unitRepair = unitRepair;