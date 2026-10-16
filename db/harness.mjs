import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

const MIGRATIONS = new URL("../supabase/migrations/", import.meta.url);
const STUB = new URL("./auth_stub.sql", import.meta.url);

/** Base neuve : imitation de Supabase puis toutes les migrations dans l'ordre. */
export async function freshDb() {
  const db = await PGlite.create();
  await db.exec(readFileSync(STUB, "utf8"));
  for (const f of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    try { await db.exec(readFileSync(new URL(f, MIGRATIONS), "utf8")); }
    catch (e) { throw new Error(`${f} : ${e.message}`); }
  }
  return db;
}

/** Chaque scénario tourne dans une transaction annulée : aucune trace d'un test à l'autre. */
export async function scenario(db, fn) {
  await db.exec("begin");
  try { await fn(); } finally { await db.exec("rollback"); }
}

/** Exécute une requête en tant que `uid` (rôle authenticated), ou en anonyme si uid est null. */
export async function as(db, uid, sql, params = []) {
  await db.exec("savepoint as_user");
  try {
    await db.query("select set_config('request.jwt.claims', $1, true)",
      [uid ? JSON.stringify({ sub: uid, role: "authenticated" }) : ""]);
    await db.exec(`set local role ${uid ? "authenticated" : "anon"}`);
    const res = await db.query(sql, params);
    await db.exec("reset role");
    await db.exec("release savepoint as_user");
    return res.rows;
  } catch (e) {
    await db.exec("rollback to savepoint as_user");
    await db.exec("release savepoint as_user");
    throw e;
  }
}

/** Appelle une fonction scalaire en tant que `uid` et renvoie son résultat. */
export async function rpc(db, uid, fn, args = []) {
  const ph = args.map((_, i) => `$${i + 1}`).join(", ");
  const rows = await as(db, uid, `select ${fn}(${ph}) as r`, args);
  return rows[0].r;
}

/**
 * SQL en superutilisateur dans un point de sauvegarde : un échec attendu (contrainte violée)
 * n'invalide pas la transaction du scénario, les instructions suivantes restent possibles.
 */
export async function su(db, sql) {
  await db.exec("savepoint su");
  try {
    await db.exec(sql);
    await db.exec("release savepoint su");
  } catch (e) {
    await db.exec("rollback to savepoint su");
    await db.exec("release savepoint su");
    throw e;
  }
}

/** Tableau JS -> littéral de tableau PostgreSQL ('{a,b}'). */
export const pgArray = (xs) => `{${xs.join(",")}}`;
