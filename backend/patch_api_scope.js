const fs = require('fs');

const path = '/home/fueltracks/fueltracks1/backend/controllers/publicApiController.js';
let content = fs.readFileSync(path, 'utf8');

// Replace buildGroupScope with buildOrgScope
content = content.replace(
`function buildGroupScope(groupId, currentParams) {
  if (!groupId) return { clause: '', params: [] };
  const idx = currentParams.length + 1;
  return {
    clause: \`AND v.id IN (SELECT vehicle_id FROM vehicle_groups WHERE group_id = $\${idx})\`,
    params: [groupId],
  };
}`,
`function buildOrgScope(orgId, groupId, currentParams) {
  const idx = currentParams.length + 1;
  if (groupId) {
    return {
      clause: \`v.id IN (SELECT vehicle_id FROM vehicle_groups WHERE group_id = $\${idx})\`,
      params: [groupId]
    };
  } else {
    return {
      clause: \`v.org_id = $\${idx}\`,
      params: [orgId]
    };
  }
}`
);

// getLiveLocation
content = content.replace(
`    const params = [orgId];

    if (imei) {
      params.push(imei.trim());
      whereImei = \`AND v.imei = $\${params.length}\`;
    }

    const scope = buildGroupScope(groupId, params);
    params.push(...scope.params);

    const result = await db.query(
      \`SELECT
         v.imei,
         v.plate,
         v.name,
         vls.lat,
         vls.lng,
         vls.speed,
         vls.direction,
         vls.voltage,
         vls.battery,
         vls.ignition,
         vls.satellites,
         vls.gsm_signal,
         vls.last_seen AS device_time
       FROM vehicles v
       JOIN vehicle_latest_state vls ON vls.vehicle_id = v.id
       WHERE v.org_id = $1
         \${whereImei}
         \${scope.clause}
       ORDER BY v.plate ASC\`,
      params
    );`,
`    const params = [];

    if (imei) {
      params.push(imei.trim());
      whereImei = \`AND v.imei = $\${params.length}\`;
    }

    const scope = buildOrgScope(orgId, groupId, params);
    params.push(...scope.params);

    const result = await db.query(
      \`SELECT
         v.imei,
         v.plate,
         v.name,
         vls.lat,
         vls.lng,
         vls.speed,
         vls.direction,
         vls.voltage,
         vls.battery,
         vls.ignition,
         vls.satellites,
         vls.gsm_signal,
         vls.last_seen AS device_time
       FROM vehicles v
       JOIN vehicle_latest_state vls ON vls.vehicle_id = v.id
       WHERE \${scope.clause}
         \${whereImei}
       ORDER BY v.plate ASC\`,
      params
    );`
);

// postLiveLocation
content = content.replace(
`    const params = [orgId];
    const conditions = [];

    if (imeiList.length > 0) {
      const ph = imeiList.map((_, i) => \`$$\${params.length + i + 1}\`).join(', ');
      params.push(...imeiList);
      conditions.push(\`v.imei IN (\${ph})\`);
    }
    if (plateList.length > 0) {
      const ph = plateList.map((_, i) => \`$$\${params.length + i + 1}\`).join(', ');
      params.push(...plateList);
      conditions.push(\`(UPPER(v.plate) IN (\${ph}) OR UPPER(v.name) IN (\${ph}))\`);
    }

    const vehicleWhere = conditions.length > 0 ? \`AND (\${conditions.join(' OR ')})\` : '';
    const scope = buildGroupScope(groupId, params);
    params.push(...scope.params);

    const result = await db.query(
      \`SELECT
         v.imei,
         v.plate,
         v.name,
         vls.lat,
         vls.lng,
         vls.speed,
         vls.direction,
         vls.voltage,
         vls.battery,
         vls.ignition,
         vls.satellites,
         vls.gsm_signal,
         vls.last_seen AS device_time
       FROM vehicles v
       JOIN vehicle_latest_state vls ON vls.vehicle_id = v.id
       WHERE v.org_id = $1
         \${vehicleWhere}
         \${scope.clause}
       ORDER BY v.plate ASC\`,
      params
    );`,
`    const params = [];
    const conditions = [];

    if (imeiList.length > 0) {
      const ph = imeiList.map((_, i) => \`$$\${params.length + i + 1}\`).join(', ');
      params.push(...imeiList);
      conditions.push(\`v.imei IN (\${ph})\`);
    }
    if (plateList.length > 0) {
      const ph = plateList.map((_, i) => \`$$\${params.length + i + 1}\`).join(', ');
      params.push(...plateList);
      conditions.push(\`(UPPER(v.plate) IN (\${ph}) OR UPPER(v.name) IN (\${ph}))\`);
    }

    const vehicleWhere = conditions.length > 0 ? \`AND (\${conditions.join(' OR ')})\` : '';
    const scope = buildOrgScope(orgId, groupId, params);
    params.push(...scope.params);

    const result = await db.query(
      \`SELECT
         v.imei,
         v.plate,
         v.name,
         vls.lat,
         vls.lng,
         vls.speed,
         vls.direction,
         vls.voltage,
         vls.battery,
         vls.ignition,
         vls.satellites,
         vls.gsm_signal,
         vls.last_seen AS device_time
       FROM vehicles v
       JOIN vehicle_latest_state vls ON vls.vehicle_id = v.id
       WHERE \${scope.clause}
         \${vehicleWhere}
       ORDER BY v.plate ASC\`,
      params
    );`
);

// getHistory
content = content.replace(
`    const vehicleParams = [imei.trim(), orgId];
    const vehicleScope  = buildGroupScope(groupId, vehicleParams);
    vehicleParams.push(...vehicleScope.params);

    const vehicleRes = await db.query(
      \`SELECT v.id FROM vehicles v
       WHERE v.imei = $1 AND v.org_id = $2 \${vehicleScope.clause}\`,
      vehicleParams
    );`,
`    const vehicleParams = [imei.trim()];
    const vehicleScope  = buildOrgScope(orgId, groupId, vehicleParams);
    vehicleParams.push(...vehicleScope.params);

    const vehicleRes = await db.query(
      \`SELECT v.id FROM vehicles v
       WHERE v.imei = $1 AND \${vehicleScope.clause}\`,
      vehicleParams
    );`
);

// postHistory
content = content.replace(
`    // ── Resolve vehicle by IMEI or plate ─────────────────────
    let vehicleQuery, vehicleParams;
    if (imei) {
      vehicleQuery  = 'SELECT v.id, v.imei, v.plate, v.name FROM vehicles v WHERE v.imei = $1 AND v.org_id = $2';
      vehicleParams = [String(imei).trim(), orgId];
    } else {
      vehicleQuery  = 'SELECT v.id, v.imei, v.plate, v.name FROM vehicles v WHERE (UPPER(v.plate) = $1 OR UPPER(v.name) = $1) AND v.org_id = $2';
      vehicleParams = [String(plate).trim().toUpperCase(), orgId];
    }

    const scope = buildGroupScope(groupId, vehicleParams);
    vehicleParams.push(...scope.params);
    const vehicleRes = await db.query(\`\${vehicleQuery} \${scope.clause}\`, vehicleParams);`,
`    // ── Resolve vehicle by IMEI or plate ─────────────────────
    let vehicleQuery, vehicleParams;
    if (imei) {
      vehicleQuery  = 'SELECT v.id, v.imei, v.plate, v.name FROM vehicles v WHERE v.imei = $1';
      vehicleParams = [String(imei).trim()];
    } else {
      vehicleQuery  = 'SELECT v.id, v.imei, v.plate, v.name FROM vehicles v WHERE (UPPER(v.plate) = $1 OR UPPER(v.name) = $1)';
      vehicleParams = [String(plate).trim().toUpperCase()];
    }

    const scope = buildOrgScope(orgId, groupId, vehicleParams);
    vehicleParams.push(...scope.params);
    const vehicleRes = await db.query(\`\${vehicleQuery} AND \${scope.clause}\`, vehicleParams);`
);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed publicApiController.js');
