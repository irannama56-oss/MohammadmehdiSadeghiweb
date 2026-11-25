import { listData } from "./_data.js";
import { dbConfigured, pgListSkills } from "./_pg.js";

const isExcludedSkill = (s) =>
  /^(node(\.js)?|express(\.js)?)$/i.test(String(s?.name || "").trim());

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "method not allowed" });
  }
  let skills = [];
  if (dbConfigured()) {
    const dbRows = await pgListSkills();
    if (dbRows) skills = dbRows;
  }
  if (!skills.length) {
    const list = (await listData("skills.json")) || [];
    skills = Array.isArray(list) ? list : [];
  }
  const cleanSkills = skills.filter((s) => !isExcludedSkill(s));
  res.json({ skills: cleanSkills });
}
