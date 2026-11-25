/* Golden regression suite for the mood search engine (spec §10).
   Run: node scripts/test-mood-v2.mjs   — must print "ALL PASS". */

import fs from "node:fs";
import { executeMoodSearch } from "../src/lib/moodEngine.js";

const songs = JSON.parse(fs.readFileSync("public/api/music-database.json", "utf8")).songs;
const run = (q, opts = {}) => executeMoodSearch(songs, q, { deterministic: true, ...opts });

let pass = 0, fail = 0;
const results = [];

function check(id, label, cond, detail = "") {
  if (cond) { pass++; results.push(`  ✓ ${id}. ${label}`); }
  else { fail++; results.push(`  ✗ ${id}. ${label}${detail ? " → " + detail : ""}`); }
}

const name = (r) => (r.song ? r.song.name : "—");

/* 1 */
{
  const r = run("ناامیدی");
  check(1, "ناامیدی → hope=0 و sadness>=0.85",
    r.mood.dims.hope === 0 && (r.mood.dims.sadness || 0) >= 0.85,
    `hope=${r.mood.dims.hope} sadness=${r.mood.dims.sadness}`);
}
/* 2 */
{
  const r = run("ناراحتم");
  check(2, "ناراحتم → calm=0 و برنده غمگین",
    (r.mood.dims.calm || 0) === 0 && r.found,
    `calm=${r.mood.dims.calm} song=${name(r)}`);
}
/* 3 */
{
  const r = run("غمگین نباشه");
  const ok = ["Je veux", "On ira", "Hips Don't Lie"].some((n) => name(r).includes(n));
  check(3, "غمگین نباشه → sadness=0 و خروجی شاد",
    (r.mood.dims.sadness || 0) === 0 && ok, `sadness=${r.mood.dims.sadness} song=${name(r)}`);
}
/* 4 */
{
  const r = run("دلم گرفته ولی آهنگ شاد بده");
  check(4, "دلم گرفته ولی شاد → joy>=0.8",
    (r.mood.dims.joy || 0) >= 0.8, `joy=${r.mood.dims.joy} song=${name(r)}`);
}
/* 5 */
{
  const r = run("love");
  check(5, "love → نه direct_lookup و bestScore<=1.2",
    r.intent !== "direct_lookup" && r.bestScore <= 1.2, `intent=${r.intent} score=${r.bestScore}`);
}
/* 6 */
{
  const r = run("عاشقانه");
  const top2 = r.results.slice(0, 2).map((x) => x.song.name);
  check(6, "عاشقانه → Birds of a Feather یا Sweater Weather در ۲ نتیجه اول",
    top2.some((n) => n.includes("Birds of a Feather") || n.includes("Sweater Weather")),
    JSON.stringify(top2));
}
/* 7 */
{
  const r = run("پارتی");
  const ok = ["Hips Don't Lie", "Can't Get You", "I Was Made", "Blinding Lights"].some((n) => name(r).includes(n));
  check(7, "پارتی → از آهنگ‌های پارتی (نه Je veux)", ok, `song=${name(r)}`);
}
/* 8 */
{
  const a = run("غمگین"), b = run("ghamgin"), c = run("sad");
  const setA = a.results.slice(0, 3).map((x) => x.song.id);
  const setB = b.results.slice(0, 3).map((x) => x.song.id);
  const setC = c.results.slice(0, 3).map((x) => x.song.id);
  const overlap = setA.filter((id) => setB.includes(id) || setC.includes(id)).length;
  check(8, "غمگین/ghamgin/sad هم‌راستا و tag>0",
    overlap >= 2 && a.results[0].parts.tag > 0 && b.results[0].parts.tag > 0 && c.results[0].parts.tag > 0,
    `A=${setA} B=${setB} C=${setC}`);
}
/* 9 */
{
  const r = run("عاشقاهن");
  check(9, "عاشقاهن → اصلاح به عاشقانه",
    r.found && (r.mood.dims.romance || 0) > 0.5, `song=${name(r)} romance=${r.mood.dims.romance}`);
}
/* 10 */
{
  const r = run("😭💔");
  check(10, "😭💔 → found و دسته شکست عشقی/غم",
    r.found && ((r.mood.dims.heartbreak || 0) > 0 || (r.mood.dims.sadness || 0) > 0),
    `song=${name(r)}`);
}
/* 11 */
{
  const a = run("فاز دپ"), b = run("فاز لش");
  /* calm piano family — Idea 10 and Idea 22 are the same Gibran Alcocer set,
     so either is a correct answer for a chill request */
  const calmish = ["Idea 10", "Idea 22", "Swing Lynn", "No One Noticed"].some((n) => name(b).includes(n));
  check(11, "فاز دپ → غم، فاز لش → آرام",
    (a.mood.dims.sadness || 0) > 0.5 && calmish, `dep=${name(a)} lash=${name(b)}`);
}
/* 12 */
{
  const a = run("باید بخونم"), b = run("درس");
  const ok = (r) => r.results.slice(0, 2).some((x) => /Idea (10|22)/.test(x.song.name));
  check(12, "باید بخونم/درس → Idea 10 یا 22 در ۲ نتیجه اول",
    ok(a) && ok(b), `${a.results.slice(0,2).map(x=>x.song.name)} | ${b.results.slice(0,2).map(x=>x.song.name)}`);
}
/* 13 */
{
  const a = run("باشگاه"), b = run("ورزش");
  const ok = (r) => r.results.slice(0, 2).some((x) => /Believer|Lose Yourself|Seven Nation|Houdini/.test(x.song.name));
  check(13, "باشگاه/ورزش → Believer/Lose Yourself/Seven Nation/Houdini",
    ok(a) && ok(b), `${a.results.slice(0,2).map(x=>x.song.name)} | ${b.results.slice(0,2).map(x=>x.song.name)}`);
}
/* 14 */
{
  const a = run("کات کردم"), b = run("شکست عشقی");
  const ok = (r) => r.results.slice(0, 3).some((x) => /Winner Takes|Apologize|Rolling in the Deep|Romantic Homicide|Save Your Tears/.test(x.song.name));
  check(14, "کات کردم/شکست عشقی → آهنگ‌های شکست عشقی",
    ok(a) && ok(b), `${a.results.slice(0,3).map(x=>x.song.name)} | ${b.results.slice(0,3).map(x=>x.song.name)}`);
}
/* 15 */
{
  const a = run("رانندگی شب"), b = run("تو ماشین");
  const ok = (r) => r.results.slice(0, 2).some((x) => /Blinding Lights|Save Your Tears|Art Deco/.test(x.song.name));
  check(15, "رانندگی شب/تو ماشین → Blinding/Save Your Tears/Art Deco",
    ok(a) && ok(b), `${a.results.slice(0,2).map(x=>x.song.name)} | ${b.results.slice(0,2).map(x=>x.song.name)}`);
}
/* 16 */
{
  const r = run("استرس دارم");
  check(16, "استرس دارم → calm>=0.9",
    (r.mood.dims.calm || 0) >= 0.9, `calm=${r.mood.dims.calm} song=${name(r)}`);
}
/* 17 */
{
  const r = run("امروز هوا خوبه");
  const warm = ["On ira", "Je veux", "we fell in love in october"].some((n) => name(r).includes(n));
  check(17, "امروز هوا خوبه → found و خروجی گرم",
    r.found && warm, `song=${name(r)}`);
}
/* 18 */
{
  const r = run("آهنگ غمگین بیلی ایلیش");
  check(18, "آهنگ غمگین بیلی ایلیش → hybrid و Happier Than Ever",
    r.intent === "hybrid" && name(r).includes("Happier Than Ever"),
    `intent=${r.intent} song=${name(r)}`);
}
/* 19 */
{
  const r = run("باران");
  const over = r.results.filter((x) => x.parts.audio > 1.0);
  check(19, "باران → audio <= 1.0", over.length === 0, JSON.stringify(over.map((x) => x.parts.audio)));
}
/* 20 */
{
  const r = run("ابی");
  check(20, "ابی → unknown (نه ABBA)",
    r.intent === "unknown" && !r.found, `intent=${r.intent} song=${name(r)}`);
}
/* 21 */
{
  const a = run("eminem"), b = run("ادل");
  check(21, "eminem/ادل → direct_lookup",
    a.intent === "direct_lookup" && b.intent === "direct_lookup" && a.mood.detected === false,
    `${a.intent}/${b.intent} → ${name(a)} / ${name(b)}`);
}
/* 22 */
{
  const seen = new Set();
  let recent = [];
  let allFound = true;
  for (let i = 0; i < 4; i++) {
    const r = executeMoodSearch(songs, "غمگین", { recent, deterministic: false });
    if (!r.found) allFound = false;
    if (r.song) seen.add(r.song.id);
    recent = r.song ? [r.song.id, ...recent] : recent;
  }
  check(22, "غمگین ×۴ با recent → حداقل ۳ آهنگ متفاوت",
    allFound && seen.size >= 3, `distinct=${seen.size} found=${allFound}`);
}
/* 23 */
{
  const a = run("asdfgh"), b = run("قیمت دلار چنده");
  check(23, "asdfgh/قیمت دلار چنده → unknown",
    a.intent === "unknown" && b.intent === "unknown" && !a.found && !b.found,
    `${a.intent}/${b.intent}`);
}

console.log(results.join("\n"));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
