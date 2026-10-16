import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, scenario, rpc } from "../harness.mjs";
import { seedPilot, G, M, P, u } from "../fixtures.mjs";

let db;
before(async () => { db = await freshDb(); });
const q = async (sql) => (await db.query(sql)).rows;
const payer = (id, cycle, m, amount, status = "valide") => db.exec(
  `insert into payments(id, group_id, cycle_id, membership_id, amount, method, status, declared_by)
   values ('${id}','${G.tontine}','${cycle}','${m}',${amount},'especes','${status}','${P.tres}')`);

test("ouvrir un cycle de tontine verrouille l'ordre et désigne le premier bénéficiaire", () => scenario(db, async () => {
  await seedPilot(db);
  const c = await rpc(db, P.tres, "ouvrir_cycle", [G.tontine, "Octobre 2026", "2026-10-30"]);
  const [cy] = await q(`select round, number, amount_expected, status from cycles where id = '${c}'`);
  assert.deepEqual(cy, { round: 1, number: 1, amount_expected: 5000, status: "ouvert" });
  assert.equal((await q(`select order_locked from groups where id = '${G.tontine}'`))[0].order_locked, true);
  assert.deepEqual(await q(`select membership_id, amount_expected, status from payouts where cycle_id = '${c}'`),
    [{ membership_id: M.tres, amount_expected: 20000, status: "prevu" }]);
}));

test("deux bénéficiaires par cycle", () => scenario(db, async () => {
  await seedPilot(db);
  await db.exec(`update groups set beneficiaries_per_cycle = 2 where id = '${G.tontine}'`);
  const c = await rpc(db, P.tres, "ouvrir_cycle", [G.tontine, "Octobre"]);
  assert.deepEqual((await q(`select membership_id, amount_expected from payouts where cycle_id = '${c}' order by membership_id`)),
    [{ membership_id: M.tres, amount_expected: 10000 }, { membership_id: M.alice, amount_expected: 10000 }]);
}));

test("un seul cycle ouvert, réservé au trésorier", () => scenario(db, async () => {
  await seedPilot(db);
  await assert.rejects(rpc(db, P.alice, "ouvrir_cycle", [G.tontine, "Octobre"]), /Réservé aux trésoriers/);
  await rpc(db, P.tres, "ouvrir_cycle", [G.tontine, "Octobre"]);
  await assert.rejects(rpc(db, P.tres, "ouvrir_cycle", [G.tontine, "Novembre"]), /déjà ouvert/);
}));

test("une cotisation n'a pas de bénéficiaire", () => scenario(db, async () => {
  await seedPilot(db);
  const c = await rpc(db, P.xavier, "ouvrir_cycle", [G.autre, "Octobre"]);
  assert.equal((await q(`select count(*)::int n from payouts where cycle_id = '${c}'`))[0].n, 0);
}));

test("clore : impayés et paiements partiels deviennent des dettes", () => scenario(db, async () => {
  await seedPilot(db);
  const c = await rpc(db, P.tres, "ouvrir_cycle", [G.tontine, "Octobre"]);
  await payer(u(301), c, M.alice, 5000);
  await payer(u(302), c, M.bob, 3000);
  assert.deepEqual(await rpc(db, P.tres, "clore_cycle", [c]), { dettes: 3, montant: 12000 });
  assert.deepEqual(await q(`select membership_id, amount from debts where cycle_id = '${c}' order by membership_id`), [
    { membership_id: M.tres, amount: 5000 }, { membership_id: M.bob, amount: 2000 }, { membership_id: M.invite, amount: 5000 }]);
  assert.equal((await q(`select status from cycles where id = '${c}'`))[0].status, "clos");
}));

test("clore est refusé tant qu'un paiement attend la validation", () => scenario(db, async () => {
  await seedPilot(db);
  const c = await rpc(db, P.tres, "ouvrir_cycle", [G.tontine, "Octobre"]);
  await payer(u(301), c, M.alice, 5000, "declare");
  await assert.rejects(rpc(db, P.tres, "clore_cycle", [c]), /1 paiement\(s\) à valider/);
}));

test("rouvrir le dernier cycle efface ses dettes non réglées", () => scenario(db, async () => {
  await seedPilot(db);
  const c = await rpc(db, P.tres, "ouvrir_cycle", [G.tontine, "Octobre"]);
  await rpc(db, P.tres, "clore_cycle", [c]);
  await rpc(db, P.tres, "rouvrir_cycle", [c]);
  assert.equal((await q(`select status from cycles where id = '${c}'`))[0].status, "ouvert");
  assert.equal((await q(`select count(*)::int n from debts where cycle_id = '${c}'`))[0].n, 0);
}));

test("rouvrir est refusé si une dette du cycle est réglée ou si ce n'est pas le dernier cycle", () => scenario(db, async () => {
  await seedPilot(db);
  const c1 = await rpc(db, P.tres, "ouvrir_cycle", [G.tontine, "Octobre"]);
  await rpc(db, P.tres, "clore_cycle", [c1]);
  await db.exec(`update debts set settled_at = now() where cycle_id = '${c1}' and membership_id = '${M.bob}'`);
  await assert.rejects(rpc(db, P.tres, "rouvrir_cycle", [c1]), /déjà des règlements/);
  await db.exec(`update debts set settled_at = null where cycle_id = '${c1}'`);
  await db.exec(`update payouts set status = 'remis', amount = 20000, method = 'especes', paid_on = current_date where cycle_id = '${c1}'`);
  const c2 = await rpc(db, P.tres, "ouvrir_cycle", [G.tontine, "Novembre"]);
  await rpc(db, P.tres, "clore_cycle", [c2]);
  await assert.rejects(rpc(db, P.tres, "rouvrir_cycle", [c1]), /Seul le dernier cycle/);
}));
