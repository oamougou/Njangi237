// Contrôle du dist avant publication : la v1 est servie sur /v1/ et la v2 ne la met pas en cache.
import { existsSync, readFileSync } from "node:fs";

const dist = new URL("../dist/", import.meta.url);
const lire = (p) => readFileSync(new URL(p, dist), "utf8");
const erreurs = [];
for (const f of ["index.html", "sw.js", "v1/index.html", "v1/sw.js", "v1/manifest.json", "v1/icon-192.png", "v1/icon-512.png"])
  if (!existsSync(new URL(f, dist))) erreurs.push(`manquant : ${f}`);
if (!erreurs.length) {
  const sw = lire("sw.js");
  if (/url:"v1\//.test(sw)) erreurs.push("le service worker de la v2 met des fichiers de la v1 en cache (globIgnores)");
  if (!sw.includes("\\/v1\\/")) erreurs.push("/v1/ n'est pas exclu du repli de navigation de la v2 (navigateFallbackDenylist)");
  if (!lire("v1/sw.js").includes('k.startsWith("njangi237-")')) erreurs.push("le service worker de la v1 peut effacer les caches de la v2");
  if (!lire("v1/index.html").includes('"applica_data_v1"')) erreurs.push("dist/v1/index.html n'est pas la page de la v1");
}
if (erreurs.length) { console.error(erreurs.join("\n")); process.exit(1); }
console.log("dist vérifié : v1 servie sur /v1/, hors du précache de la v2");
