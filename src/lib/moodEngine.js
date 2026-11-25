/**
 * Mood Engine v2 — emotional music retrieval.
 *
 * Layers: unified normalizer (emoji / ZWNJ / elongation), Finglish + fuzzy,
 * safe suffix stemming, clause splitter (ولی/اما/but), generic polarity flip,
 * intent router (direct_lookup | hybrid | mood_search | unknown),
 * coverage+cosine scoring with conflict penalty, and controlled diversity
 * (soft cooldown + artist spread + top-band sampling).
 *
 * Public API kept stable: MOOD_DIMS, ARTIST_ALIASES, extractMoodFromQuery(),
 * executeMoodSearch(songs, query, opts).
 */

export const MOOD_DIMS = [
  "sadness", "longing", "nostalgia", "heartbreak", "loneliness",
  "joy", "playfulness", "romance", "sensuality", "warmth",
  "anger", "rebellion", "power", "defiance",
  "calm", "dreaminess", "melancholy", "hope",
  "darkness", "tension", "mystery",
  "energy", "euphoria", "reflection",
];

export const ARTIST_ALIASES = {
  "امینم": "eminem", "امينم": "eminem", "ادل": "adele",
  "ابا": "abba",
  "بیلی": "billie eilish", "بیلی ایلیش": "billie eilish", "بیلی آیلیش": "billie eilish",
  "هری": "harry styles", "هری استایلز": "harry styles",
  "لانا": "lana del rey", "لانا دل ری": "lana del rey",
  "شکیرا": "shakira", "مایکل": "michael jackson", "مایکل جکسون": "michael jackson",
  "ویکند": "the weeknd", "د ویکند": "the weeknd",
  "ایمجین دراگونز": "imagine dragons", "دراگون": "imagine dragons", "ایمجین دراگون": "imagine dragons",
  "تیلور": "taylor swift", "تیلور سویفت": "taylor swift", "تایلور": "taylor swift",
  "زاز": "zaz", "جبران": "gibran alcocer", "جبران الکوثر": "gibran alcocer",
  "اد شیرن": "ed sheeran", "اد شیران": "ed sheeran",
  "دوآ لیپا": "dua lipa", "دوا لیپا": "dua lipa",
  "کیس": "kiss", "آئورا": "aurora", "اورورا": "aurora",
  "کولدپلی": "coldplay", "کلدپلی": "coldplay",
  "لینکین پارک": "scott d. davis", "بک استریت": "backstreet boys",
  "تیم ایمپالا": "tame impala", "د فور وی دی": "d4vd",
  "هارملس": "harmless", "ماریاس": "the marías", "د ماریاس": "the marías",
  "وایت استریپس": "the white stripes", "جاستین بیبر": "justin bieber",
  "وان ریپابلیک": "onerepublic", "کیلی مینوگ": "kylie minogue",
};

/* ══════════════════════════ 1. text pipeline ══════════════════════════ */

const EMOJI_MAP = [
  [/💔/gu, " شکست عشقی "],
  [/[😢😭🥺🥀]/gu, " غمگین "],
  [/[😔😞🌧☔]/gu, " دلتنگی باران "],
  [/[❤😍🥰💕💑]/gu, " عاشقانه "],
  [/[🔥💪🏋⚡]/gu, " ورزش انگیزه "],
  [/[💃🕺🎉🥳🪩]/gu, " پارتی رقص "],
  [/[😡🤬😤]/gu, " عصبانی خشم "],
  [/[😴🌙🌌✨]/gu, " شب آرامش "],
  [/[📚💻🎧☕]/gu, " درس تمرکز "],
  [/[😎🖤😈]/gu, " خفن سرکش "],
  [/[😊😁☀🌸]/gu, " شاد حال خوب "],
];

export function replaceEmojisWithTokens(raw) {
  let s = String(raw || "");
  for (const [re, token] of EMOJI_MAP) s = s.replace(re, token);
  return s;
}

/** Single normalizer for queries, tags, names and aliases. */
export function normalizeText(raw = "") {
  return replaceEmojisWithTokens(String(raw))
    .toLowerCase()
    .replace(/[\u200c\u200b\u00a0]/g, " ")
    .replace(/[يی]/g, "ی")
    .replace(/[كک]/g, "ک")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ةۀ]/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/(.)\1{2,}/gu, "$1$1")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set([
  "من", "تو", "او", "ما", "شما", "اونها", "این", "اون", "که", "با", "به", "از", "در", "را", "رو",
  "برای", "و", "یا", "اگر", "بعد", "پس", "بود", "است", "هست", "میخوام", "میکنم", "دارم", "یه", "یک",
  "فقط", "اهنگ", "موزیک", "موسیقی", "اغنیه", "ترانه", "بذار", "بزار", "بزن", "بگو", "بخون", "بخوان",
  "پخش", "کن", "بکن", "چیزی", "میخواد", "اسم", "برام", "لطفا", "حس", "فاز", "مود", "واسه", "چی",
  "song", "music", "track", "feel", "feels", "feeling", "want", "wanna", "put", "some", "give",
  "play", "the", "a", "an", "to", "of", "for", "and", "or", "in", "on", "with", "is", "are",
  "be", "was", "i", "you", "me", "my", "we", "it", "am",
]);

/* never drop these — they carry polarity / contrast / intensity */
const PROTECTED = new Set([
  "نه", "نیستم", "نیست", "نباشه", "نباش", "نمیخوام", "ندارم", "بدون", "بی", "نا", "غیر", "اصلا",
  "not", "no", "dont", "don't", "without", "never",
  "ولی", "اما", "بجاش", "instead", "but",
  "خیلی", "شدید", "بشدت", "ترین", "کمی", "ملایم", "very", "super", "most", "slightly",
]);

const NEG_PREFIXES = ["نا", "بی", "غیر", "ضد"];

const PHRASES = ["بی حال", "خیلی خوب", "حال خوب", "حال بده", "دلم گرفته", "هوا خوبه"];

function isProtected(t) {
  return PROTECTED.has(t) || NEG_PREFIXES.some((p) => t.startsWith(p) && t.length > p.length + 1);
}

/** strip common Persian suffixes when the stem stays >= 3 chars */
export function stemToken(t) {
  if (!t || t.length < 5) return t;
  if (NEG_PREFIXES.some((p) => t.startsWith(p))) return t; // never cut نا/بی/غیر/ضد
  for (const suf of ["ترین", "های", "ایم", "اید", "اند", "ها", "تر", "ام", "ای", "ش", "م", "ت"]) {
    if (t.length - suf.length >= 3 && t.endsWith(suf)) return t.slice(0, -suf.length);
  }
  return t;
}

function tokenise(s) {
  const raw = s.split(/\s+/).filter(Boolean);
  const merged = [];
  for (let i = 0; i < raw.length; i++) {
    const two = raw[i] + " " + (raw[i + 1] || "");
    if (PHRASES.includes(two)) { merged.push(two); i++; } else merged.push(raw[i]);
  }
  return merged.filter((t) => t && t.length >= 2 && (!STOPWORDS.has(t) || isProtected(t)));
}

export function hasTokenPhrase(normalizedText, phrase) {
  const p = normalizeText(phrase);
  if (!p) return false;
  const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\s)${escaped}(?=$|\\s)`, "u").test(normalizedText);
}

/* ── Finglish ─────────────────────────────────────────────────────── */
export const FINGLISH_MAP = {
  shad: "شاد", shadi: "شادی", shadman: "شاد", shadab: "شاد", shadtarin: "شادترین",
  kheyli: "خیلی", kheili: "خیلی", kheli: "خیلی",
  ahang: "اهنگ", ahange: "اهنگ", music: "موزیک",
  ghamgin: "غمگین", qamgin: "غمگین", gham: "غم", qam: "غم", ghami: "غم",
  ghose: "غصه", qose: "غصه", ashk: "اشک", gerye: "گریه", geryam: "گریه",
  boghz: "بغض", halam: "حالم", bade: "بده", khoobe: "خوبه", khube: "خوبه",
  delam: "دلم", tang: "تنگ", tangi: "دلتنگی", deltang: "دلتنگ", deltangi: "دلتنگی",
  deltangam: "دلتنگ", gerefte: "گرفته", shode: "شده", shodam: "شدم", shodi: "شدی",
  khoshhal: "خوشحال", khoshhali: "خوشحالی", khoshhalam: "خوشحال",
  ashegh: "عاشق", asheq: "عاشق", asheghane: "عاشقانه", asheqane: "عاشقانه",
  asheghetam: "عاشق", eshgh: "عشق", eshq: "عشق", eshgham: "عشق",
  del: "دل", ghalb: "قلب", shekaste: "شکسته", delshkaste: "دلشکسته",
  tanha: "تنها", tanham: "تنها", tanhayi: "تنهایی", tanhai: "تنهایی", tanhaei: "تنهایی",
  aroom: "ارام", aram: "ارام", aramesh: "ارامش", aramsh: "ارامش",
  khab: "خواب", khabi: "خواب", tamarkoz: "تمرکز", dars: "درس", motalehe: "مطالعه",
  varzesh: "ورزش", bashgah: "باشگاه", tamrin: "تمرین", enerzhi: "انرژی", energy: "انرژی",
  bombe: "بمب", hemasi: "حماسی", angizeshi: "انگیزه", angize: "انگیزه",
  khaste: "خسته", khastam: "خسته", khastegi: "خستگی", depres: "دپرس",
  asabani: "عصبانی", asabi: "عصبی", kheshm: "خشم", khashm: "خشم",
  raghs: "رقص", party: "پارتی", parti: "پارتی", mehmooni: "مهمونی", mehmani: "مهمانی",
  baroon: "باران", barani: "باران", baran: "باران", paeez: "پاییز", zemestan: "زمستان",
  shab: "شب", shabane: "شبانه", tarik: "تاریک", ghadimi: "قدیمی", khaterat: "خاطره",
  nostalzhi: "نوستالژی", mikham: "میخوام", nemikham: "نمیخوام", nabashe: "نباشه",
  nistam: "نیستم", nist: "نیست", bedoon: "بدون", vali: "ولی", ama: "اما",
  lonely: "تنها", lonly: "تنها", lonley: "تنها", alone: "تنها",
  deppressed: "دپرس", depresed: "دپرس", depressed: "دپرس",
  romantik: "رمانتیک", romantic: "رمانتیک", danc: "رقص", dance: "رقص", danceable: "رقص",
  happines: "شادی", happy: "شاد", engery: "انرژی", exited: "هیجان", relaxe: "ریلکس",
  relxing: "ریلکس", chill: "چیل", lash: "لش", stress: "استرس", estress: "استرس",
  naomid: "ناامید", naomidi: "ناامیدی", omid: "امید", omidvar: "امیدوار",
  daghoon: "داغون", daghun: "داغون", dep: "دپ", narahat: "ناراحت", narahatam: "ناراحت",
  bihal: "بی حال", bienergy: "بی انرژی", kat: "کات", jodai: "جدایی", khiyanat: "خیانت",
  khatere: "خاطره", safar: "سفر", ranandegi: "رانندگی", jade: "جاده", mashin: "ماشین",
  khafan: "خفن", gang: "گنگ", bahal: "باحال", gym: "باشگاه", workout: "ورزش",
};

const VOCAB = new Set();
function addVocab(term) {
  const n = normalizeText(term);
  if (n) { VOCAB.add(n); VOCAB.add(stemToken(n)); }
}

export function transliterateQuery(rawQuery) {
  const norm = normalizeText(rawQuery);
  const words = norm.split(/\s+/).filter(Boolean);
  const out = [];
  for (const w of words) out.push(FINGLISH_MAP[w] || w);
  return { original: norm, expanded: out.join(" ") };
}

/* ── Damerau-Levenshtein (adjacent transposition = 1) ─────────────── */
function damerau(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

function fuzzyFix(token) {
  if (token.length < 5 || VOCAB.has(token) || FINGLISH_MAP[token]) return token;
  if (NEG_PREFIXES.some((p) => token.startsWith(p))) return token;
  let best = null, bestD = 2;
  for (const cand of VOCAB) {
    if (Math.abs(cand.length - token.length) > 1) continue;
    const dd = damerau(token, cand);
    if (dd < bestD) { bestD = dd; best = cand; }
  }
  return bestD <= 1 && best ? best : token;
}

/* ══════════════════════ 2. lexicon & phrases ═══════════════════════ */

const CP = (pattern, dims, energy, valence, labelFa, labelEn, flags = {}) => ({
  pattern, dims, energy, valence, labelFa, labelEn, ...flags,
});

export const COMPOUND_PHRASES = [
  CP(/(?:حالم بده|حالم خراب|حال خراب|داغونم|داغون شدم|فاز دپ|بغض دارم|دلم گرفته|میخوام گریه کنم|گریم گرفته|خیلی ناراحتم|ناراحتم|ناراحت|افسرده|غمگین|غمگینم|غمناک|افسردگی|سوگ|ماتم|حالم خوب نیست|feeling down|crying|so sad|depressed)/i,
    { sadness: 0.95, melancholy: 0.85, loneliness: 0.6, reflection: 0.5 }, "low", "negative", "غم و اندوه", "Sadness & Grief"),

  CP(/(?:شکست عشقی|کات کردم|کات|ولم کرد|ترکم کرد|جدا شدیم|جدایی|دلم شکست|دلشکسته|دل شکسته|قلب شکسته|خیانت|برنگشت|پایان عشق|heartbreak|breakup|betrayal|broken heart|dumped me|lost love|cheated)/i,
    { heartbreak: 1.0, sadness: 0.85, longing: 0.65, melancholy: 0.6 }, "medium", "negative", "شکست عشقی", "Heartbreak"),

  CP(/(?:دلم تنگ شده|دلم براش تنگ شده|دلتنگم|دلتنگشم|دلتنگ|دلتنگی|جاش خالیه|جای خالیش|یادم افتاد|حس دلتنگی|بی تو|بدون اون|miss you|miss her|miss him|longing|thinking of you)/i,
    { longing: 1.0, nostalgia: 0.85, melancholy: 0.6, sadness: 0.45 }, "low", "negative", "دلتنگی و خاطره", "Longing"),

  CP(/(?:تنهام|تنهایی|کسی نیست|حس تنهایی|دیده نمیشم|انزوا|گوشه گیر|بی کس|غریب|lonely|alone|isolated|by myself)/i,
    { loneliness: 1.0, melancholy: 0.8, sadness: 0.65, dreaminess: 0.55 }, "low", "negative", "تنهایی", "Loneliness"),

  CP(/(?:عصبانی|اعصابم خورده|کلافه|مخم ترکید|لجم گرفته|خشم|خشمگین|نفرت|انتقام|میخوام داد بزنم|داد بزنم|angry|mad|rage|furious|hate)/i,
    { anger: 1.0, defiance: 0.85, tension: 0.75, power: 0.7, energy: 0.8 }, "high", "negative", "خشم", "Anger"),

  CP(/(?:حال خوب|حالم خوبه|مودم خوبه|امروز هوا خوبه|هوا خوبه|خوشحالم|شادی|شاد|سرحالم|لبخند|انرژی مثبت|خوشبختی|happy|joy|good mood|good vibes|feel good)/i,
    { joy: 0.95, warmth: 0.75, hope: 0.65, playfulness: 0.6, euphoria: 0.5 }, "high", "positive", "شادی و حال خوب", "Joy"),

  CP(/(?:پارتی|مهمونی|مهمانی|میخوام برقصم|بزن برقص|برقصیم|بترکونیم|کلاب|دیسکو|فاز پارتی|رقص|party|dance|club|dancing)/i,
    { energy: 0.95, euphoria: 0.9, sensuality: 0.7, joy: 0.65, playfulness: 0.65 }, "high", "positive", "پارتی و رقص", "Party & Dance", { preferDance: true }),

  CP(/(?:عاشقانه|عاشق شدم|فاز لاو|دوسش دارم|عشق|بغل|دو نفره|رمانتیک|معشوق|in love|romantic|crush|love)/i,
    { romance: 1.0, warmth: 0.8, dreaminess: 0.65, calm: 0.5, longing: 0.4 }, "low", "positive", "عاشقانه", "Romantic"),

  CP(/(?:باشگاه|ورزش|تمرین|دویدن|جیم|انگیزه|قوی باشم|باید بترکونم|موفقیت|پیروزی|قهرمان|تلاش|gym|workout|motivation|fitness)/i,
    { power: 1.0, energy: 0.95, defiance: 0.85, hope: 0.65, tension: 0.5 }, "high", "positive", "ورزش و انگیزه", "Workout"),

  CP(/(?:باید بخونم|درس خوندن|درس|امتحان|مطالعه|تمرکز|کد زدن|کدنویسی|کار کردن|پروژه|کتاب|بی کلام|study|focus|coding|work|instrumental)/i,
    { calm: 0.95, reflection: 0.9, dreaminess: 0.65 }, "low", "neutral", "درس و تمرکز", "Study & Focus", { preferInstrumental: true }),

  CP(/(?:خستم|خسته شدم|خسته|کم اوردم|بی حالم|بی حال|بی انرژی|بی حوصله|بریدم|حسش نیست|نا ندارم|tired|exhausted|burnout|drained)/i,
    { calm: 0.8, melancholy: 0.75, reflection: 0.65, sadness: 0.5 }, "low", "negative", "خستگی", "Tired & Weary"),

  CP(/(?:استرس|اضطراب|فکر و خیال|نگرانم|دلهره|آرامش|ارامش|آروم|اروم|چیل|ریلکس|لش|فاز لش|خوابم نمیبره|خواب|stress|anxious|calm|chill|relax|sleep)/i,
    { calm: 1.0, dreaminess: 0.9, warmth: 0.55, reflection: 0.6 }, "low", "positive", "آرامش", "Calm", { preferInstrumental: true }),

  CP(/(?:بارون|باران|هوای بارونی|پاییز|هوای ابری|زمستون|قهوه|rain|rainy|autumn|fall|cozy)/i,
    { melancholy: 0.8, nostalgia: 0.75, dreaminess: 0.75, calm: 0.7, warmth: 0.45 }, "low", "negative", "باران و پاییز", "Rainy"),

  CP(/(?:رانندگی شب|رانندگی|تو ماشین|جاده|دور دور|نصف شب|خیابون|چراغ|night drive|late night|midnight)/i,
    { darkness: 0.65, longing: 0.7, energy: 0.75, nostalgia: 0.6, dreaminess: 0.55, mystery: 0.45 }, "high", "negative", "رانندگی شب", "Night Drive"),

  CP(/(?:خفن|گنگ|سرکش|طغیان|مغرور|جسور|مرموز|بدگای|villain|dark|rebel|badass|confident)/i,
    { rebellion: 0.9, defiance: 0.9, power: 0.8, darkness: 0.75, mystery: 0.55, energy: 0.75 }, "high", "neutral", "خفن و سرکش", "Dark & Bold"),

  CP(/(?:حوصلم سر رفته|کسل|bored|boring)/i,
    { energy: 0.8, playfulness: 0.75, euphoria: 0.7, joy: 0.65 }, "high", "positive", "بی‌حوصلگی", "Bored"),

  CP(/(?:امید|امیدوار|شروع دوباره|آینده|سفر|آزادی|رها کردن|hope|fresh start|freedom|journey)/i,
    { hope: 1.0, warmth: 0.75, joy: 0.6, power: 0.5, reflection: 0.5 }, "medium", "positive", "امید و شروع دوباره", "Hope"),

  CP(/(?:یاد قدیما|خاطرات گذشته|نوستالژی|روزهای رفته|یادش بخیر|good old days|childhood|retro vibes|take me back)/i,
    { nostalgia: 1.0, longing: 0.75, reflection: 0.6 }, "low", "neutral", "نوستالژی", "Nostalgic"),
];

export const MOOD_LEXICON = [
  { pattern: /(?:غمگین|غمناک|ناراحت|غم|غصه|بغض|اشک|گریه|افسرده|افسردگی|دپرس|ماتم|سوگ|عذاب|زجر|بدبخت|ناامید|پوچ)/i, dims: { sadness: 0.95, melancholy: 0.7 }, energy: "low", valence: "negative", labelFa: "غمگین", labelEn: "Sadness" },
  { pattern: /\b(?:sad|sadness|unhappy|sorrow|grief|pain|tears|crying|cry|depressed|gloomy|weeping|miserable|devastated|hopeless)\b/i, dims: { sadness: 0.95, melancholy: 0.7 }, energy: "low", valence: "negative", labelFa: "غمگین", labelEn: "Sadness" },
  { pattern: /(?:دلتنگ|دلتنگی|دوری|فاصله|چشم به راه|منتظر|انتظار|حسرت|بی تو|بدون تو|جای خالی|نبودن)/i, dims: { longing: 0.95, sadness: 0.5 }, energy: "low", valence: "negative", labelFa: "دلتنگی", labelEn: "Longing" },
  { pattern: /\b(?:longing|miss|missing|yearn|yearning|distance|away|craving|distant)\b/i, dims: { longing: 0.95, sadness: 0.5 }, energy: "low", valence: "negative", labelFa: "دلتنگی", labelEn: "Longing" },
  { pattern: /(?:نوستالژی|خاطره|خاطرات|یادش بخیر|گذشته|قدیما|قدیمی|بچگی|کودکی|روزهای رفته|یادگاری)/i, dims: { nostalgia: 0.95, reflection: 0.6 }, labelFa: "نوستالژی", labelEn: "Nostalgia" },
  { pattern: /\b(?:nostalgia|nostalgic|memory|memories|reminisce|retro|vintage|childhood|flashback|yesterday|remember)\b/i, dims: { nostalgia: 0.95, reflection: 0.6 }, labelFa: "نوستالژی", labelEn: "Nostalgia" },
  { pattern: /(?:شکست|دلشکسته|قلب شکسته|کات|ترکم|ولم|جدایی|نامرد|خیانت|بی وفا|باختم|طلاق|تموم)/i, dims: { heartbreak: 0.95, sadness: 0.8 }, energy: "low", valence: "negative", labelFa: "شکست عشقی", labelEn: "Heartbreak" },
  { pattern: /\b(?:heartbreak|heartbroken|breakup|divorce|rejected|betrayal|cheated|dumped|shattered|left me|split up)\b/i, dims: { heartbreak: 0.95, sadness: 0.8 }, energy: "low", valence: "negative", labelFa: "شکست عشقی", labelEn: "Heartbreak" },
  { pattern: /(?:تنها|تنهایی|بی کس|بی کسی|هیچکس|غریب|غربت|انزوا|خلوت|گوشه گیر|بی همدم)/i, dims: { loneliness: 0.95, sadness: 0.6 }, energy: "low", valence: "negative", labelFa: "تنهایی", labelEn: "Loneliness" },
  { pattern: /\b(?:lonely|loneliness|alone|solitude|isolated|isolation|abandoned|outcast)\b/i, dims: { loneliness: 0.95, sadness: 0.6 }, energy: "low", valence: "negative", labelFa: "تنهایی", labelEn: "Loneliness" },
  { pattern: /(?:شاد|شادی|شادمان|خوشحال|خوشحالی|خنده|لبخند|ذوق|عالی|خوشبخت|خوشبختی|سرور|پرنشاط|حس خوب)/i, dims: { joy: 0.95, euphoria: 0.6 }, energy: "high", valence: "positive", labelFa: "شاد", labelEn: "Joyful" },
  { pattern: /\b(?:happy|happiness|joy|joyful|cheerful|glad|smile|delight|sunshine|celebrate|pleased|blessed)\b/i, dims: { joy: 0.95, euphoria: 0.6 }, energy: "high", valence: "positive", labelFa: "شاد", labelEn: "Joyful" },
  { pattern: /(?:شوخ|شوخی|شیطنت|بامزه|سرگرمی|فان|تفریح|باحال|خنده دار)/i, dims: { playfulness: 0.9, joy: 0.7 }, energy: "high", valence: "positive", labelFa: "شوخ و شاد", labelEn: "Playful" },
  { pattern: /\b(?:playful|fun|silly|quirky|cheeky|amusing|funny)\b/i, dims: { playfulness: 0.9, joy: 0.7 }, energy: "high", valence: "positive", labelFa: "شوخ و شاد", labelEn: "Playful" },
  { pattern: /(?:عاشق|عاشقی|عاشقانه|عشق|رمانتیک|دوست دارم|معشوق|یار|دلبر|جانان|بوسه|بغل|آغوش|ولنتاین|عشقم|مهر)/i, dims: { romance: 0.95, warmth: 0.7 }, energy: "medium", valence: "positive", labelFa: "عاشقانه", labelEn: "Romance" },
  { pattern: /\b(?:romance|romantic|lover|loving|crush|sweetheart|kiss|cuddle|beloved|adore|affection)\b/i, dims: { romance: 0.95, warmth: 0.7 }, energy: "medium", valence: "positive", labelFa: "عاشقانه", labelEn: "Romance" },
  { pattern: /(?:جذاب|هوس|شهوت|داغ|پرشور|فریبنده|طناز|افسونگر)/i, dims: { sensuality: 0.9, romance: 0.6 }, labelFa: "پرشور", labelEn: "Sensual" },
  { pattern: /\b(?:sensual|sexy|intimate|passion|desire|seductive|sultry|lust|attraction)\b/i, dims: { sensuality: 0.9, romance: 0.6 }, labelFa: "پرشور", labelEn: "Sensual" },
  { pattern: /(?:گرما|گرم|صمیمی|صمیمیت|مهربانی|دلنشین|لطیف|دلگرم|دنج|باصفا|نوازش|دلپذیر)/i, dims: { warmth: 0.9, calm: 0.6 }, energy: "low", valence: "positive", labelFa: "گرم و دلنشین", labelEn: "Warm" },
  { pattern: /\b(?:warm|warmth|cozy|comfort|tender|gentle|kindness|snug|soothing|safe)\b/i, dims: { warmth: 0.9, calm: 0.6 }, energy: "low", valence: "positive", labelFa: "گرم و دلنشین", labelEn: "Warm" },
  { pattern: /(?:عصبانی|عصبانیت|خشم|خشمگین|کلافه|حرص|فریاد|متنفرم|تنفر|اعصاب خوردی|شاکی|کفری|کینه|انتقام)/i, dims: { anger: 0.95, tension: 0.7 }, energy: "high", valence: "negative", labelFa: "عصبانی", labelEn: "Angry" },
  { pattern: /\b(?:anger|angry|rage|furious|mad|hate|frustrated|annoyed|pissed|wrath|irritated|bitter)\b/i, dims: { anger: 0.95, tension: 0.7 }, energy: "high", valence: "negative", labelFa: "عصبانی", labelEn: "Angry" },
  { pattern: /(?:یاغی|سرکشی|طغیان|شورش|مبارزه|اعتراض|عصیان|ضد جریان|سرکش|قانون شکن)/i, dims: { rebellion: 0.95, defiance: 0.8 }, energy: "high", labelFa: "سرکش", labelEn: "Rebellious" },
  { pattern: /\b(?:rebel|rebellion|protest|riot|resist|revolution)\b/i, dims: { rebellion: 0.95, defiance: 0.8 }, energy: "high", labelFa: "سرکش", labelEn: "Rebellious" },
  { pattern: /(?:قدرت|قدرتمند|قوی|باصلابت|قهرمان|اراده|شکست ناپذیر|پیروزی|شاه|بمب|انفجاری|سنگین|حماسی|اپیک|شاهکار|باشکوه|حماسه)/i, dims: { power: 0.95, energy: 0.8 }, energy: "high", valence: "positive", labelFa: "حماسی و قدرتمند", labelEn: "Epic" },
  { pattern: /\b(?:power|powerful|strong|strength|epic|triumph|victory|unstoppable|champion|king|invincible|mighty|conquer)\b/i, dims: { power: 0.95, energy: 0.8 }, energy: "high", valence: "positive", labelFa: "حماسی و قدرتمند", labelEn: "Epic" },
  { pattern: /(?:شجاعت|جسارت|ایستادگی|سرسخت|نترس|بی باک|جسور|پررو|کم نیار|کوتاه نیا|مقاومت)/i, dims: { defiance: 0.95, power: 0.7 }, energy: "high", labelFa: "جسور", labelEn: "Defiant" },
  { pattern: /\b(?:defiant|defiance|fearless|brave|bold|undefeated|courage|dare)\b/i, dims: { defiance: 0.95, power: 0.7 }, energy: "high", labelFa: "جسور", labelEn: "Defiant" },
  { pattern: /(?:آرام|آرامش|آروم|ریلکس|ملایم|سکوت|صلح|بی استرس|استراحت|خواب آور|خوابم میاد|بی کلام|پیانو|یوگا|مدیتیشن|آسوده)/i, dims: { calm: 0.95, reflection: 0.5 }, energy: "low", valence: "positive", labelFa: "آرامش", labelEn: "Calm" },
  { pattern: /\b(?:calm|peace|peaceful|quiet|relax|relaxing|relaxed|chill|chilling|sleep|sleepy|soothing|serene|tranquil|meditative|rest)\b/i, dims: { calm: 0.95, reflection: 0.5 }, energy: "low", valence: "positive", labelFa: "آرامش", labelEn: "Calm" },
  { pattern: /(?:خسته|خستگی|خستم|بریدم|بی حال|بی رمق|کوفته|فرسوده|نا ندارم|جون ندارم)/i, dims: { calm: 0.85, melancholy: 0.65, reflection: 0.6, sadness: 0.4 }, energy: "low", valence: "neutral", labelFa: "خسته", labelEn: "Tired" },
  { pattern: /\b(?:tired|exhausted|fatigued|burnout|weary|worn out|drained|exhaustion|need rest)\b/i, dims: { calm: 0.85, melancholy: 0.65, reflection: 0.6, sadness: 0.4 }, energy: "low", valence: "neutral", labelFa: "خسته", labelEn: "Tired" },
  { pattern: /(?:رویایی|رویا|خیال|فانتزی|ابر|آسمان|ستاره|شب|مهتاب|فضا|کیهانی|ماه|افسون)/i, dims: { dreaminess: 0.95, calm: 0.5 }, labelFa: "رویایی", labelEn: "Dreamy" },
  { pattern: /\b(?:dream|dreamy|dreaming|ethereal|floating|stars|night|starlight|mystical|fantasy|universe|sky)\b/i, dims: { dreaminess: 0.95, calm: 0.5 }, labelFa: "رویایی", labelEn: "Dreamy" },
  { pattern: /(?:ملانکولی|دلگیر|ابری|باران|بارونی|پاییز|غروب|حال سنگین|هوای گرفته)/i, dims: { melancholy: 0.95, sadness: 0.6, calm: 0.4 }, energy: "low", labelFa: "ملانکولیک", labelEn: "Melancholy" },
  { pattern: /\b(?:melancholy|melancholic|somber|wistful|rain|rainy|autumn|dreary|gloomy|moody)\b/i, dims: { melancholy: 0.95, sadness: 0.6, calm: 0.4 }, energy: "low", labelFa: "ملانکولیک", labelEn: "Melancholy" },
  { pattern: /(?:امید|امیدواری|پرامید|روشنایی|آینده|ایمان|توکل|معجزه|طلوع|صبح|ساختن|موفقیت)/i, dims: { hope: 0.95, joy: 0.5 }, energy: "medium", valence: "positive", labelFa: "امیدبخش", labelEn: "Hopeful" },
  { pattern: /\b(?:hope|hopeful|optimism|bright|believe|tomorrow|sunrise|future|faith|miracle)\b/i, dims: { hope: 0.95, joy: 0.5 }, energy: "medium", valence: "positive", labelFa: "امیدبخش", labelEn: "Hopeful" },
  { pattern: /(?:تاریک|دارک|سیاه|ظلمت|سایه|گوتیک|مخوف|بی رحم|وحشت)/i, dims: { darkness: 0.95, tension: 0.6 }, energy: "medium", valence: "negative", labelFa: "دارک", labelEn: "Dark" },
  { pattern: /\b(?:dark|darkness|shadow|gothic|sinister|evil|obscure|creepy)\b/i, dims: { darkness: 0.95, tension: 0.6 }, energy: "medium", valence: "negative", labelFa: "دارک", labelEn: "Dark" },
  { pattern: /(?:اضطراب|استرس|تنش|دلهره|تپش قلب|نگرانی|سراسیمه|درام|دلشوره|ترس|هول)/i, dims: { tension: 0.95, darkness: 0.5 }, energy: "high", valence: "negative", labelFa: "پرتنش", labelEn: "Tense" },
  { pattern: /\b(?:tension|tense|dramatic|anxious|anxiety|stressed|nervous|panic|suspense|thriller)\b/i, dims: { tension: 0.95, darkness: 0.5 }, energy: "high", valence: "negative", labelFa: "پرتنش", labelEn: "Tense" },
  { pattern: /(?:مرموز|رمزآلود|معما|پنهان|راز|مبهم|ناشناخته|اسرار)/i, dims: { mystery: 0.95, dreaminess: 0.5 }, labelFa: "مرموز", labelEn: "Mysterious" },
  { pattern: /\b(?:mystery|mysterious|secret|enigmatic|occult|hidden|puzzle|riddle)\b/i, dims: { mystery: 0.95, dreaminess: 0.5 }, labelFa: "مرموز", labelEn: "Mysterious" },
  { pattern: /(?:انرژی|پرانرژی|اکتیو|هیجان|ورزش|باشگاه|بدنسازی|دویدن|تمرین|بیس دار|رپ|پمپ|بترکون|هایپ|بوکس|مسابقه)/i, dims: { energy: 0.95, power: 0.7 }, energy: "high", valence: "positive", labelFa: "پرانرژی", labelEn: "Energetic" },
  { pattern: /\b(?:energy|energetic|hype|hyped|workout|gym|running|upbeat|pumped|training|fitness|hardcore)\b/i, dims: { energy: 0.95, power: 0.7 }, energy: "high", valence: "positive", labelFa: "پرانرژی", labelEn: "Energetic" },
  { pattern: /(?:سرخوشی|پرواز|رقص|پارتی|جشن|دنس|کلاب|پایکوبی|عروسی|مهمونی)/i, dims: { euphoria: 0.95, energy: 0.85, joy: 0.8 }, energy: "high", valence: "positive", labelFa: "سرخوش", labelEn: "Euphoric" },
  { pattern: /\b(?:euphoria|euphoric|party|dance|dancing|club|rave|celebration|disco|dancefloor)\b/i, dims: { euphoria: 0.95, energy: 0.85, joy: 0.8 }, energy: "high", valence: "positive", labelFa: "سرخوش", labelEn: "Euphoric" },
  { pattern: /(?:تمرکز|فکر|تفکر|تأمل|درس|مطالعه|کار|کتاب|کد|کدنویسی|برنامه نویسی|درون نگری|عمیق|فلسفی|ذهن)/i, dims: { reflection: 0.95, calm: 0.6 }, energy: "medium", labelFa: "تمرکز", labelEn: "Focus" },
  { pattern: /\b(?:reflection|reflective|thinking|thoughtful|focus|focusing|study|studying|reading|coding|programming|contemplation|work)\b/i, dims: { reflection: 0.95, calm: 0.6 }, energy: "medium", labelFa: "تمرکز", labelEn: "Focus" },
];

export const DIM_TO_VIBE = {
  sadness: { sad: 1 }, melancholy: { sad: 0.7, calm: 0.3 }, longing: { sad: 0.6, romantic: 0.4 },
  heartbreak: { sad: 0.8, dark: 0.2 }, loneliness: { sad: 0.6, calm: 0.2 },
  nostalgia: { sad: 0.4, calm: 0.3 },
  joy: { happy: 1 }, playfulness: { happy: 0.7, energetic: 0.3 }, euphoria: { happy: 0.6, energetic: 0.4 },
  romance: { romantic: 1 }, sensuality: { romantic: 0.6, dark: 0.2 }, warmth: { happy: 0.4, calm: 0.4 },
  anger: { dark: 0.6, energetic: 0.4 }, rebellion: { energetic: 0.5, dark: 0.3 },
  power: { epic: 0.8, energetic: 0.2 }, defiance: { epic: 0.5, energetic: 0.3 },
  calm: { calm: 1 }, dreaminess: { calm: 0.5, romantic: 0.3 },
  hope: { happy: 0.5, calm: 0.3 },
  darkness: { dark: 1 }, tension: { dark: 0.5, epic: 0.3 }, mystery: { dark: 0.4, calm: 0.3 },
  energy: { energetic: 1 }, reflection: { focus: 1 },
};

/* build the fuzzy vocabulary once */
for (const k of Object.keys(FINGLISH_MAP)) { addVocab(k); addVocab(FINGLISH_MAP[k]); }
for (const a of Object.keys(ARTIST_ALIASES)) { addVocab(a); addVocab(ARTIST_ALIASES[a]); }
for (const e of MOOD_LEXICON) {
  const src = e.pattern.source.replace(/^\(\?:/, "").replace(/\)$/i, "").replace(/\\b/g, "");
  for (const term of src.split("|")) {
    const t = term.replace(/\\s[*+]/g, " ").replace(/\\(.)/g, "$1").trim();
    if (t && !/[\\()[\]?*+]/.test(t)) addVocab(t);
  }
}
for (const d of MOOD_DIMS) addVocab(d);

/* ═════════════════ 3. clauses, negation, intensity ═════════════════ */

const CONTRAST_RE = /(\s+ولی\s+|\s+اما\s+|\s+بجاش\s+|\s+ولی\s+نه\s+|\s+but\s+|\s+instead\s+)/i;

function splitClauses(q) {
  const m = CONTRAST_RE.exec(q);
  if (!m) return { before: "", after: q };
  return { before: q.slice(0, m.index), after: q.slice(m.index + m[0].length) };
}

const INTENSIFY = /(?:خیلی|بشدت|شدید|حسابی|فوق العاده|ترین|super|very|extremely|most)/i;
const SOFTEN = /(?:کمی|یکم|یه ذره|ملایم|سبک|slightly|a bit|soft)/i;

/* generic polarity flip: dimension -> replacement vector when negated */
const FLIP = {
  hope: { zero: ["hope"], add: { sadness: 0.9, melancholy: 0.75, darkness: 0.45, reflection: 0.4 } },
  joy: { zero: ["joy", "euphoria"], add: { sadness: 0.85, melancholy: 0.7, loneliness: 0.4 } },
  sadness: { zero: ["sadness", "melancholy", "heartbreak"], add: { joy: 0.85, hope: 0.65, warmth: 0.55, energy: 0.5 } },
  calm: { zero: ["calm"], add: { tension: 0.85 } },
  energy: { zero: ["energy", "power"], add: { calm: 0.8, melancholy: 0.65, reflection: 0.55 } },
  romance: { zero: ["romance"], add: { power: 0.6, defiance: 0.55, energy: 0.65 } },
  anger: { zero: ["anger", "tension"], add: { calm: 0.9, warmth: 0.65, dreaminess: 0.55 } },
};

/* word -> the mood dimension it belongs to, used by the flip layer */
const WORD_TO_DIM = [
  ["hope", /(?:امید|hope|optimis)/i],
  ["joy", /(?:شاد|خوشحال|happy|joy|خوشبخت|euphor)/i],
  ["sadness", /(?:غم|ناراحت|sad|melanchol|افسرده|دلگیر)/i],
  ["calm", /(?:ارام|آرام|اروم|calm|relax|ریلکس|سکوت)/i],
  ["energy", /(?:انرژی|energy|پرانرژی|قدرت|power)/i],
  ["romance", /(?:عاشق|عشق|love|romant|رمانتیک)/i],
  ["anger", /(?:عصب|خشم|angry|anger|استرس|tension|تنش)/i],
];

const NEG_TOKENS = new Set([
  "نیستم", "نیست", "نباشه", "نباش", "نمیخوام", "ندارم", "نشدم", "نباشم", "بدون",
  "not", "no", "dont", "don't", "without", "never",
]);

function applyNegation(text, moods) {
  const tokens = text.split(/\s+/).filter(Boolean);
  const touched = new Set();

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    let base = null;
    for (const p of NEG_PREFIXES) {
      if (t.length > p.length + 1 && t.startsWith(p)) { base = t.slice(p.length); break; }
    }
    const nextTwo = tokens.slice(i + 1, i + 3);
    const negatedAfter = nextTwo.some((n) => NEG_TOKENS.has(n));
    const prevTwo = tokens.slice(Math.max(0, i - 2), i);
    const negatedBefore = prevTwo.some((n) => NEG_TOKENS.has(n));

    if (!base && !negatedAfter && !negatedBefore) continue;

    const target = base || t;
    const dim = WORD_TO_DIM.find(([, re]) => re.test(target))?.[0];
    if (!dim || touched.has(dim)) continue;

    const rule = FLIP[dim];
    if (!rule) continue;
    for (const d of rule.zero) moods[d] = 0;
    for (const [d, w] of Object.entries(rule.add)) {
      moods[d] = Math.max(moods[d] || 0, w);
    }
    touched.add(dim);
  }

  return moods;
}

/* ══════════════════════ 4. mood extraction ═════════════════════════ */

export function extractMoodFromQuery(queryRaw) {
  const raw = String(queryRaw || "").trim();
  const { before, after } = splitClauses(raw);
  const primary = after || raw;
  const isSuperlative = INTENSIFY.test(raw);
  const isSoft = SOFTEN.test(raw);

  const { original: qNorm, expanded } = transliterateQuery(primary);
  const unified = `${qNorm} ${expanded}`;

  const moods = {};
  let energy = "medium";
  let valence = "neutral";
  let labelFa = "";
  let labelEn = "";
  let preferInstrumental = false;
  let preferDance = false;

  const bump = (dims, mult = 1) => {
    for (const [d, w] of Object.entries(dims)) {
      moods[d] = Math.max(moods[d] || 0, w * mult);
    }
  };

  let compoundHit = false;
  for (const entry of COMPOUND_PHRASES) {
    if (entry.pattern.test(raw) || entry.pattern.test(primary) || entry.pattern.test(unified)) {
      bump(entry.dims, isSuperlative ? 1.25 : 1);
      if (entry.energy) energy = entry.energy;
      if (entry.valence) valence = entry.valence;
      if (entry.labelFa && !labelFa) labelFa = entry.labelFa;
      if (entry.labelEn && !labelEn) labelEn = entry.labelEn;
      if (entry.preferInstrumental) preferInstrumental = true;
      if (entry.preferDance) preferDance = true;
      compoundHit = true;
    }
  }

  for (const entry of MOOD_LEXICON) {
    if (entry.pattern.test(raw) || entry.pattern.test(primary) || entry.pattern.test(unified)) {
      if (compoundHit && valence === "negative" && entry.valence === "positive") continue;
      bump(entry.dims, isSuperlative ? 1.25 : 1);
      if (!compoundHit && entry.energy) energy = entry.energy;
      if (!compoundHit && entry.valence) valence = entry.valence;
      if (!labelFa && entry.labelFa) labelFa = entry.labelFa;
      if (!labelEn && entry.labelEn) labelEn = entry.labelEn;
    }
  }

  /* defaults run BEFORE the negation layer so a flipped dimension stays flipped
     (e.g. "غمگین نباشه" must not get sadness back from the valence default) */
  if (energy === "high") moods.energy = Math.max(moods.energy || 0, 0.45);
  if (energy === "low" && (moods.sadness || 0) < 0.6 && (moods.heartbreak || 0) < 0.6) {
    moods.calm = Math.max(moods.calm || 0, 0.45);
  }
  if (valence === "positive") moods.joy = Math.max(moods.joy || 0, 0.4);
  if (valence === "negative") moods.sadness = Math.max(moods.sadness || 0, 0.4);

  applyNegation(unified, moods);

  if (isSoft) {
    for (const d of ["anger", "energy", "darkness"]) if (moods[d]) moods[d] *= 0.7;
    moods.calm = Math.max(moods.calm || 0, 0.45);
  }

  if (before) {
    const b = extractMoodFromQuery(before);
    const opposite = (b.valence === "positive" && valence === "negative")
      || (b.valence === "negative" && valence === "positive");
    if (!opposite) {
      for (const [d, w] of Object.entries(b.moods)) {
        moods[d] = Math.max(moods[d] || 0, w * 0.25);
      }
    }
  }

  if (!labelFa) {
    const top = Object.entries(moods).sort((a, b) => b[1] - a[1])[0];
    if (top) {
      const e = MOOD_LEXICON.find((x) => x.dims[top[0]]);
      if (e) { labelFa = e.labelFa; labelEn = e.labelEn; }
    }
  }

  const dominantDim = Object.entries(moods).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  return {
    moods,
    energy,
    valence,
    isSuperlative,
    isSoft,
    preferInstrumental,
    preferDance,
    dominantDim,
    labelFa: labelFa || "",
    labelEn: labelEn || "",
  };
}

/* ═══════════════════════ 5. scoring ════════════════════════════════ */

function computeSemanticScore(queryMoods, songMoods, songNormL2) {
  let dot = 0, qSum = 0, qSq = 0;
  for (const [dim, qw] of Object.entries(queryMoods)) {
    if (qw <= 0) continue;
    dot += qw * (songMoods[dim] || 0);
    qSum += qw;
    qSq += qw * qw;
  }
  if (qSum === 0) return 0;

  const coverage = dot / qSum;
  const cosine = songNormL2 > 0 ? dot / (Math.sqrt(qSq) * songNormL2) : 0;

  let conflict = 0;
  const qPositive = (queryMoods.joy || 0) >= 0.6 || (queryMoods.euphoria || 0) >= 0.6;
  const qCalm = (queryMoods.calm || 0) >= 0.7;
  const qParty = (queryMoods.euphoria || 0) >= 0.8 && (queryMoods.energy || 0) >= 0.8;

  if (qPositive && ((songMoods.heartbreak || 0) >= 0.7 || (songMoods.sadness || 0) >= 0.7)) conflict += 0.28;
  if (qCalm && ((songMoods.anger || 0) >= 0.55 || (songMoods.energy || 0) >= 0.8)) conflict += 0.25;
  if (qParty && (songMoods.calm || 0) >= 0.6) conflict += 0.2;

  return Math.max(0, Math.min(1, 0.7 * coverage + 0.3 * cosine - conflict));
}

function computeAudioScore(qm, song) {
  let acc = 0, wsum = 0;
  const vibe = (song.analysis && song.analysis.vibe) || {};

  for (const [dim, qw] of Object.entries(qm.moods)) {
    const map = DIM_TO_VIBE[dim];
    if (!map || qw <= 0) continue;
    for (const [vKey, vw] of Object.entries(map)) {
      acc += qw * vw * ((vibe[vKey] || 0) / 100);
      wsum += qw * vw;
    }
  }

  let audio = wsum > 0 ? acc / wsum : 0;

  if (qm.energy && song.energy) {
    if (qm.energy === song.energy) audio += 0.12;
    else if ((qm.energy === "high" && song.energy === "low") || (qm.energy === "low" && song.energy === "high")) audio -= 0.18;
  }
  const calmQuery = (qm.moods.calm || 0) >= 0.9;
  if (!calmQuery && qm.valence && qm.valence !== "neutral" && song.valence && song.valence !== "neutral") {
    if (qm.valence === song.valence) audio += 0.08;
    else audio -= 0.12;
  }
  if (qm.preferInstrumental && song.lyricsStatus === "instrumental") audio += 0.18;
  if (qm.preferDance && ((song.analysis && song.analysis.dance) || 0) >= 65 && song.energy === "high") audio += 0.15;

  return Math.max(0, Math.min(1, audio));
}

function tagScoreFor(qTokens, song) {
  const fa = (song.tags || []).map(normalizeText);
  const en = (song.tagsEn || []).map((t) => String(t).toLowerCase());
  let exact = 0, stem = 0;

  for (const tok of qTokens) {
    if (tok.length < 2) continue;
    const st = stemToken(tok);
    if (fa.some((t) => hasTokenPhrase(t, tok)) || en.some((t) => hasTokenPhrase(t, tok))) { exact++; continue; }
    if (st !== tok && (fa.some((t) => hasTokenPhrase(t, st)) || en.some((t) => hasTokenPhrase(t, st)))) stem++;
  }
  return Math.min(1, exact * 0.45 + stem * 0.3);
}

const MOOD_HIJACK = new Set([
  "love", "stay", "sad", "bad", "end", "miss", "tears", "deep", "flowers", "romantic",
  "happier", "beanie", "yellow", "heat", "waves", "cold", "fire", "rain",
]);

/* ═════════════════════ 6. prepared songs ═══════════════════════════ */

const PREP_CACHE = new WeakMap();

function prepare(songs) {
  let prep = PREP_CACHE.get(songs);
  if (prep) return prep;
  prep = songs.map((song) => {
    const moods = song.moods || {};
    let normL2 = 0;
    for (const v of Object.values(moods)) normL2 += v * v;
    const artistNorm = normalizeText(song.artist);
    return {
      song,
      moods,
      normL2: Math.sqrt(normL2),
      nameNorm: normalizeText(song.name),
      artistNorm,
      aliasNorm: (song.aliases || []).map(normalizeText),
      artistAlias: Object.entries(ARTIST_ALIASES)
        .filter(([, en]) => artistNorm.includes(normalizeText(en)))
        .map(([fa]) => normalizeText(fa)),
    };
  });
  PREP_CACHE.set(songs, prep);
  return prep;
}

function detectArtist(queryNorm, prep = []) {
  for (const [fa, en] of Object.entries(ARTIST_ALIASES)) {
    const f = normalizeText(fa);
    if (hasTokenPhrase(queryNorm, f) || queryNorm.includes(f)) {
      return { key: normalizeText(en), label: fa };
    }
  }
  /* direct English artist name ("eminem", "adele", "billie eilish") */
  for (const p of prep) {
    if (!p.artistNorm) continue;
    if (p.artistNorm === queryNorm || hasTokenPhrase(queryNorm, p.artistNorm) || queryNorm.includes(p.artistNorm)) {
      return { key: p.artistNorm, label: p.song.artist };
    }
  }
  return null;
}

function detectTitleHit(queryNorm, queryTokens, prep) {
  const multi = queryTokens.length >= 2;
  for (const p of prep) {
    if (hasTokenPhrase(queryNorm, p.nameNorm)) return p;
    if (p.aliasNorm.some((a) => a && hasTokenPhrase(queryNorm, a))) return p;
  }
  if (multi) {
    for (const p of prep) {
      if (p.nameNorm.length >= 6 && queryNorm.includes(p.nameNorm)) return p;
    }
    return null;
  }
  const tok = queryTokens[0];
  if (!tok || MOOD_HIJACK.has(tok)) return null;
  for (const p of prep) {
    if (p.nameNorm.includes(tok) && p.nameNorm.length - tok.length <= 12) return p;
  }
  return null;
}

/* ═══════════════════════ 7. diversity ══════════════════════════════ */

const COOLDOWN_PENALTIES = [0.22, 0.14, 0.08, 0.04];

function diversifyResults(scored, { recentIds = [], intent = "mood_search", deterministic = false } = {}) {
  if (intent === "direct_lookup" || scored.length <= 1) return scored.slice(0, 5);

  const adjusted = scored.map((item) => {
    const idx = recentIds.indexOf(item.song.id);
    const penalty = idx !== -1 && idx < COOLDOWN_PENALTIES.length ? COOLDOWN_PENALTIES[idx] : 0;
    return { ...item, rankScore: Math.max(0, item.rawScore - penalty) };
  });
  adjusted.sort((a, b) => b.rankScore - a.rankScore);

  if (intent === "mood_search") {
    const seen = new Set();
    for (const item of adjusted) {
      const key = String(item.song.artist || "").toLowerCase();
      if (seen.has(key)) item.rankScore = Math.max(0, item.rankScore - 0.06);
      else seen.add(key);
    }
    adjusted.sort((a, b) => b.rankScore - a.rankScore);
  }

  const bestRank = adjusted[0].rankScore;
  const band = adjusted.filter((it) => it.rankScore >= bestRank - 0.07).slice(0, 4);

  let winner = band[0];
  if (!deterministic && band.length > 1) {
    const weights = band.map((it) => Math.pow(Math.max(0.01, it.rankScore), 4));
    const total = weights.reduce((s, w) => s + w, 0);
    let r = Math.random() * total;
    for (let i = 0; i < band.length; i++) {
      r -= weights[i];
      if (r <= 0) { winner = band[i]; break; }
    }
  }

  const rest = adjusted.filter((it) => it.song.id !== winner.song.id);
  return [winner, ...rest].slice(0, 5);
}

/* ═════════════════════════ 8. public API ═══════════════════════════ */

function publicSong(song) {
  return {
    id: song.id,
    name: song.name,
    artist: song.artist,
    src: song.src,
    tags: (song.tags || []).slice(0, 10),
    tagsEn: (song.tagsEn || []).slice(0, 8),
    analysis: song.analysis || null,
    lyricsStatus: song.lyricsStatus || null,
    audioMoodTag: song.audioMoodTag || null,
    audioMoodEn: song.audioMoodEn || null,
    summary: song.lyricsSummary || null,
    summaryEn: song.summaryEn || null,
  };
}

function reasonFor(intent, qm) {
  if (intent === "direct_lookup") return "نتیجه‌ی جست‌وجوی مستقیم نام آهنگ یا خواننده";
  if (intent === "hybrid") return `ترکیب خواننده و حس: ${qm.labelFa || "همان خواننده"}`;
  if (qm.labelFa) return `تطابق با حس ${qm.labelFa}`;
  return "نزدیک‌ترین آهنگ به ورودی شما";
}

export function executeMoodSearch(songs, queryRaw, opts = {}) {
  const query = String(queryRaw || "").trim();
  const recentIds = Array.isArray(opts.recent) ? opts.recent : [];
  const deterministic = Boolean(opts.deterministic);
  const limit = Math.min(Math.max(Number(opts.limit) || 5, 1), 10);

  const qNorm = normalizeText(query);
  const baseTokens = tokenise(qNorm).map((t) => fuzzyFix(t));
  const expandedTokens = transliterateQuery(query).expanded.split(/\s+/).filter(Boolean).map((t) => fuzzyFix(t));
  const tagTokens = [...new Set([...baseTokens, ...expandedTokens])];
  const qm = extractMoodFromQuery(query);
  const hasMood = Object.keys(qm.moods).filter((k) => qm.moods[k] > 0).length > 0;

  const prep = prepare(songs || []);
  const artistHit = detectArtist(qNorm, prep);
  const titleHit = detectTitleHit(qNorm, baseTokens, prep);

  let intent = "unknown";
  if (artistHit && hasMood) intent = "hybrid";
  else if (artistHit || titleHit) intent = "direct_lookup";
  else if (hasMood) intent = "mood_search";

  const empty = {
    found: false,
    intent,
    softMatch: false,
    bestScore: 0,
    mood: {
      detected: hasMood,
      labelFa: intent === "direct_lookup" ? "جست‌وجوی مستقیم" : qm.labelFa,
      labelEn: intent === "direct_lookup" ? "Direct lookup" : qm.labelEn,
      dominantDim: qm.dominantDim,
      dims: qm.moods,
      energy: qm.energy,
      valence: qm.valence,
    },
    matchReasonFa: "",
    song: null,
    results: [],
  };

  if (intent === "unknown") return empty;

  const scored = prep.map((p) => {
    const semantic = hasMood ? computeSemanticScore(qm.moods, p.moods, p.normL2) : 0;
    const tag = tagTokens.length ? tagScoreFor(tagTokens, p.song) : 0;
    const audio = hasMood ? computeAudioScore(qm, p.song) : 0;

    let score = 0.55 * semantic + 0.25 * tag + 0.2 * audio;

    if (qm.isSuperlative && qm.dominantDim && (p.moods[qm.dominantDim] || 0) >= 0.85) score += 0.2;

    if (!qm.preferInstrumental && (qm.moods.calm || 0) < 0.7 && p.song.lyricsStatus === "instrumental") {
      score -= 0.04;
    }

    const isThisArtist = Boolean(artistHit) && (p.artistNorm.includes(artistHit.key) || p.artistAlias.some((a) => qNorm.includes(a)));

    if (intent === "direct_lookup") {
      if (p.nameNorm === qNorm || hasTokenPhrase(qNorm, p.nameNorm)) score += 4.5;
      else if (p.aliasNorm.some((a) => a && hasTokenPhrase(qNorm, a))) score += 4.0;
      else if (!MOOD_HIJACK.has(qNorm) && baseTokens.length === 1 && p.nameNorm.includes(qNorm) && p.nameNorm.length - qNorm.length <= 12) score += 3.2;
      if (isThisArtist) score += 4.5;
    }

    /* hybrid: the artist is a filter, not a flat win — the mood still ranks the
       songs of that artist against each other */
    if (intent === "hybrid" && isThisArtist) score += 0.45;

    return { song: p.song, rawScore: Math.max(0, Math.min(10, score)), parts: { semantic, tag, audio } };
  });

  scored.sort((a, b) => b.rawScore - a.rawScore);

  const best = scored[0];
  const FOUND = 0.28, SOFT = 0.42;
  const found = Boolean(best && best.rawScore >= FOUND);

  const ranked = found
    ? diversifyResults(scored.filter((s) => s.rawScore >= FOUND), { recentIds, intent, deterministic })
    : [];

  const results = ranked.slice(0, limit).map((r) => ({
    song: publicSong(r.song),
    score: Math.round(r.rawScore * 100) / 100,
    rankScore: Math.round((r.rankScore ?? r.rawScore) * 100) / 100,
    parts: {
      semantic: Math.round(r.parts.semantic * 100) / 100,
      tag: Math.round(r.parts.tag * 100) / 100,
      audio: Math.round(r.parts.audio * 100) / 100,
    },
  }));

  return {
    found,
    intent,
    softMatch: found && best.rawScore < SOFT,
    bestScore: Math.round((best?.rawScore || 0) * 100) / 100,
    mood: {
      detected: hasMood,
      labelFa: intent === "direct_lookup" ? "جست‌وجوی مستقیم" : qm.labelFa,
      labelEn: intent === "direct_lookup" ? "Direct lookup" : qm.labelEn,
      dominantDim: qm.dominantDim,
      dims: qm.moods,
      energy: qm.energy,
      valence: qm.valence,
    },
    matchReasonFa: found ? reasonFor(intent, qm) : "",
    song: results[0] ? results[0].song : null,
    results,
  };
}
