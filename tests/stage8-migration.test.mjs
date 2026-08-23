import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migrationDirectory = new URL("../drizzle/", import.meta.url);
const migrationMetaDirectory = new URL("../drizzle/meta/", import.meta.url);

function applyMigration(database, source) {
  for (const statement of source.split("--> statement-breakpoint")) {
    if (statement.trim().length > 0) database.exec(statement);
  }
}

async function migrationSources() {
  const names = (await readdir(migrationDirectory))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  return Promise.all(
    names.map(async (name) => ({
      name,
      source: await readFile(new URL(name, migrationDirectory), "utf8"),
    })),
  );
}

async function latestSnapshot() {
  const names = (await readdir(migrationMetaDirectory))
    .filter((name) => /^\d+_snapshot\.json$/u.test(name))
    .sort();
  assert.ok(names.length > 0, "a generated Drizzle snapshot is required");
  return JSON.parse(
    await readFile(new URL(names.at(-1), migrationMetaDirectory), "utf8"),
  );
}

function runtimeForeignKeys(database, tableName) {
  const grouped = new Map();
  for (const row of database.prepare(`PRAGMA foreign_key_list(${tableName})`).all()) {
    const group = grouped.get(row.id) ?? [];
    group.push(row);
    grouped.set(row.id, group);
  }
  return [...grouped.values()]
    .map((rows) => {
      rows.sort((left, right) => left.seq - right.seq);
      return JSON.stringify({
        tableTo: rows[0].table,
        columnsFrom: rows.map((row) => row.from),
        columnsTo: rows.map((row) => row.to),
        onDelete: rows[0].on_delete.toLowerCase(),
        onUpdate: rows[0].on_update.toLowerCase(),
      });
    })
    .sort();
}

function snapshotForeignKeys(table) {
  return Object.values(table.foreignKeys)
    .map((foreignKey) =>
      JSON.stringify({
        tableTo: foreignKey.tableTo,
        columnsFrom: foreignKey.columnsFrom,
        columnsTo: foreignKey.columnsTo,
        onDelete: foreignKey.onDelete.toLowerCase(),
        onUpdate: foreignKey.onUpdate.toLowerCase(),
      }),
    )
    .sort();
}

function insertBaselineRoot(database) {
  database.exec(`
    INSERT INTO acquisition_lineages
      (lineage_key, session_digest, intent, canonical_route, post_action,
       root_logical_id, revision, created_at, expires_at, cleanup_after)
    VALUES
      ('lineage', 'session', 'poc', '/request-poc/', '/request-poc/',
       'logical', 0, 10, 20, 40);
    INSERT INTO acquisition_logical_ids
      (logical_id, lineage_key, parent_logical_id, created_at, cleanup_after)
    VALUES ('logical', 'lineage', NULL, 10, 40);
    INSERT INTO acquisition_nodes
      (node_key, lineage_key, parent_node_key, logical_id, generation,
       source_kind, outcome, revision, created_at, updated_at, expires_at,
       cleanup_after)
    VALUES
      ('node', 'lineage', NULL, 'logical', 0, 'initial', 'fresh', 0,
       10, 10, 20, 40);
    INSERT INTO acquisition_capabilities
      (capability_digest, lineage_key, node_key, session_digest, intent,
       canonical_route, post_action, logical_id, generation, source_kind,
       issued_at, source_expires_at, valid_until, proof_cleanup_after,
       source_cleanup_after, revoked_at, attestation_version,
       attestation_key_id, authorization_attestation)
    VALUES
      ('capability', 'lineage', 'node', 'session', 'poc', '/request-poc/',
       '/request-poc/', 'logical', 0, 'initial', 10, 20, 20, 30, 40,
       NULL, 1, 'test-key', 'test-attestation');
  `);
}

test("generated migration, snapshot, columns, indexes, checks, and foreign keys agree", async () => {
  const migrations = await migrationSources();
  const snapshot = await latestSnapshot();
  assert.deepEqual(
    migrations.map(({ name }) => name),
    ["0000_acquisition_state_v2.sql"],
  );

  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys=ON");
  try {
    for (const { source } of migrations) applyMigration(database, source);

    const tables = database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name LIKE 'acquisition_%'
         ORDER BY name`,
      )
      .all()
      .map(({ name }) => name);
    assert.deepEqual(tables, [
      "acquisition_capabilities",
      "acquisition_dispatch_observations",
      "acquisition_dispatch_operations",
      "acquisition_dispatches",
      "acquisition_lineages",
      "acquisition_logical_ids",
      "acquisition_nodes",
      "acquisition_result_authorizations",
      "acquisition_result_handles",
      "acquisition_result_sets",
    ]);
    assert.deepEqual(Object.keys(snapshot.tables).sort(), tables);

    const forbiddenColumns = new Set([
      "name",
      "email",
      "organization",
      "country",
      "message",
      "free_text",
      "payload",
    ]);
    for (const tableName of tables) {
      const runtimeColumns = database
        .prepare(`PRAGMA table_info(${tableName})`)
        .all()
        .map(({ name }) => name);
      assert.deepEqual(
        runtimeColumns,
        Object.keys(snapshot.tables[tableName].columns),
        `${tableName} columns drifted from the generated snapshot`,
      );
      assert.equal(
        runtimeColumns.some((name) => forbiddenColumns.has(name)),
        false,
        `${tableName} contains a raw personal-data column`,
      );
      assert.deepEqual(
        runtimeForeignKeys(database, tableName),
        snapshotForeignKeys(snapshot.tables[tableName]),
        `${tableName} foreign keys drifted from the generated snapshot`,
      );

      const tableSql = database
        .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?")
        .get(tableName).sql;
      for (const checkName of Object.keys(
        snapshot.tables[tableName].checkConstraints,
      )) {
        assert.match(tableSql, new RegExp(`\\b${checkName}\\b`, "u"));
      }

      const runtimeIndexes = new Map(
        database
          .prepare(`PRAGMA index_list(${tableName})`)
          .all()
          .filter(({ origin }) => origin === "c")
          .map(({ name, unique }) => [name, Boolean(unique)]),
      );
      for (const index of Object.values(snapshot.tables[tableName].indexes)) {
        assert.equal(
          runtimeIndexes.get(index.name),
          index.isUnique,
          `${index.name} is missing or has the wrong uniqueness`,
        );
      }
    }

    assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal(database.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
  } finally {
    database.close();
  }
});

test("database checks reject route, phase, proof, identity, and observation rebinding", async () => {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys=ON");
  try {
    for (const { source } of await migrationSources()) applyMigration(database, source);
    insertBaselineRoot(database);

    assert.throws(
      () =>
        database
          .prepare(
            `UPDATE acquisition_capabilities
             SET canonical_route='/contact-sales/', post_action='/contact-sales/'
             WHERE capability_digest='capability'`,
          )
          .run(),
      /CHECK constraint failed: ck_acquisition_capabilities_route_action/,
    );
    assert.throws(
      () =>
        database
          .prepare(
            `UPDATE acquisition_nodes SET result_set_key='premature'
             WHERE node_key='node'`,
          )
          .run(),
      /CHECK constraint failed: ck_acquisition_nodes_result_set/,
    );

    database.exec(`
      UPDATE acquisition_nodes
      SET selected_candidate_fingerprint='fingerprint',
          selected_payload_snapshot_ref='snapshot',
          selected_logical_id='logical', selection_kind='parent',
          outcome='ready', revision=1, updated_at=11
      WHERE node_key='node';
    `);
    assert.throws(
      () =>
        database.exec(`
          INSERT INTO acquisition_dispatches
            (dispatch_key, lineage_key, origin_node_key, intent, logical_id,
             origin_generation, idempotency_key, destination_key, created_at,
             cleanup_after)
          VALUES ('bad-dispatch', 'lineage', 'node', 'poc', 'logical', 0,
                  'rebound-idempotency', 'destination', 12, 40)
        `),
      /CHECK constraint failed: ck_acquisition_dispatches_idempotency/,
    );
    database.exec(`
      INSERT INTO acquisition_dispatches
        (dispatch_key, lineage_key, origin_node_key, intent, logical_id,
         origin_generation, idempotency_key, destination_key, created_at,
         cleanup_after)
      VALUES ('dispatch', 'lineage', 'node', 'poc', 'logical', 0,
              'logical', 'destination', 12, 40);
    `);
    assert.throws(
      () =>
        database.exec(`
          INSERT INTO acquisition_dispatch_operations
            (operation_key, dispatch_key, lineage_key, logical_id,
             source_node_key, source_generation, candidate_fingerprint,
             payload_snapshot_ref, authorization_observation_key,
             operation_kind, reserved_at, cleanup_after)
          VALUES ('bad-operation', 'dispatch', 'lineage', 'logical', 'node', 0,
                  'fingerprint', '', NULL, 'dispatch', 13, 40)
        `),
      /CHECK constraint failed: ck_acquisition_dispatch_operations_binding/,
    );
    database.exec(`
      INSERT INTO acquisition_dispatch_operations
        (operation_key, dispatch_key, lineage_key, logical_id,
         source_node_key, source_generation, candidate_fingerprint,
         payload_snapshot_ref, authorization_observation_key,
         operation_kind, reserved_at, cleanup_after)
      VALUES ('operation', 'dispatch', 'lineage', 'logical', 'node', 0,
              'fingerprint', 'snapshot', NULL, 'dispatch', 13, 40);
    `);
    assert.throws(
      () =>
        database.exec(`
          INSERT INTO acquisition_dispatch_observations
            (observation_key, operation_key, observation_digest, outcome,
             evidence_digest, acknowledged_at, observed_at, cleanup_after)
          VALUES ('bad-observation', 'operation', 'digest', 'recorded',
                  NULL, NULL, 14, 40)
        `),
      /CHECK constraint failed: ck_acquisition_dispatch_observations_evidence/,
    );

    database.exec(`
      INSERT INTO acquisition_result_sets
        (result_set_key, session_digest, intent, canonical_route, post_action,
         logical_id, generation, outcome, created_at, cleanup_after)
      VALUES ('result-set', 'session', 'poc', '/request-poc/', '/request-poc/',
              'logical', 0, 'validation', 14, 40);
      INSERT INTO acquisition_result_handles
        (handle_digest, lineage_key, node_key, session_digest, intent,
         canonical_route, post_action, logical_id, generation, representation,
         public_state, return_handle_digest, payload_fingerprint,
         result_set_key, issued_at, expires_at, cleanup_after)
      VALUES ('validation-handle', 'lineage', 'node', 'session', 'poc',
              '/request-poc/', '/request-poc/', 'logical', 0, 'returned_form',
              'validation', NULL, 'fingerprint', 'result-set', 14, 20, 40);
    `);
    assert.throws(
      () =>
        database.exec(`
          INSERT INTO acquisition_result_authorizations
            (handle_digest, session_digest, intent, canonical_route,
             post_action, logical_id, generation, representation, public_state,
             source_kind, proof_class, result_set_key, return_handle_digest,
             delivery_proof_digest, operation_key, observation_key, issued_at,
             expires_at, cleanup_after, attestation_version,
             attestation_key_id, authorization_attestation)
          VALUES ('validation-handle', 'session', 'poc', '/request-poc/',
                  '/request-poc/', 'logical', 0, 'returned_form', 'validation',
                  NULL, 'exact_expiry', 'result-set', NULL, NULL, NULL, NULL,
                  14, 20, 40, 1, 'test-key', 'test-attestation')
        `),
      /CHECK constraint failed: ck_acquisition_result_authorizations_shape/,
    );
    assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    database.close();
  }
});

test("expired state has one partial unique winner per full K while other states remain siblings", async () => {
  const migrations = await migrationSources();
  const source = migrations.map((migration) => migration.source).join("\n");
  assert.match(
    source,
    /CREATE UNIQUE INDEX `uq_acquisition_handles_expired_binding`[\s\S]*WHERE [^;]*public_state[^;]*= 'expired'/u,
  );
  assert.match(
    source,
    /CREATE UNIQUE INDEX `uq_acquisition_result_authorizations_state_binding`[\s\S]*WHERE [^;]*public_state[^;]*= 'expired'/u,
  );
  assert.doesNotMatch(source, /\b(name|email|organization|country|message|free_text)\b/iu);
});
