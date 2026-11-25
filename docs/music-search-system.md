# سیستم جست‌وجوی موسیقی — مستند فنی کامل

> ⚠️ **وضعیت: نسخه ۲ پیاده‌سازی شد.** این سند رفتار نسخه ۱ را توصیف می‌کند.
> نسخه ۲ (Intent Router، منفی‌سازی عمومی، Scoring v2، تنوع کنترل‌شده) در
> `src/lib/moodEngine.js` پیاده شده و با `node scripts/test-mood-v2.mjs` تست می‌شود
> (۲۳ تست طلایی). بخش‌های ۱ تا ۱۱ زیر به‌عنوان مرجع نسخه ۱ باقی مانده‌اند.

> ⚠️ **وضعیت: نسخه ۲ پیاده‌سازی شد.** این سند رفتار نسخه ۱ را توصیف می‌کند.
> نسخه ۲ (Intent Router، منفی‌سازی عمومی، Scoring v2، تنوع کنترل‌شده) در
> `src/lib/moodEngine.js` پیاده شده و با `node scripts/test-mood-v2.mjs` تست می‌شود
> (۲۳ تست طلایی). بخش‌های ۱ تا ۱۱ زیر به‌عنوان مرجع نسخه ۱ باقی مانده‌اند.

> این سند برای **دیباگ و تحلیل صحت** سیستم سرچ آهنگ نوشته شده.
> سؤال اصلی: «متنی که کاربر وارد می‌کند، آیا آهنگ درستی را پیشنهاد می‌دهد؟»
> و «تگ‌ها و برچسب‌های احساسی هر آهنگ درست تنظیم شده‌اند؟»

آخرین به‌روزرسانی: ۲۰۲۶-۱۱-۲۵ · نسخه‌ی داده: `music-database.json` با ۴۱ آهنگ

---

## ۱. نقشه‌ی فایل‌ها

| فایل | نقش | حجم |
|---|---|---|
| `public/api/music-database.json` | کاتالوگ آهنگ‌ها + تگ + بردار احساس + متن ترانه | ۴۱ آهنگ |
| `public/api/music-analysis.json` | ویژگی‌های خام DSP هر آهنگ (bpm، انرژی، …) | ۴۶ رکورد |
| `src/lib/moodEngine.js` | موتور اصلی تحلیل متن و رتبه‌بندی | ۵۷۳ خط |
| `api/_mood-engine.js` | فقط `export * from "../src/lib/moodEngine.js"` | ۱ خط |
| `api/_mood-search.js` | هندلر `GET /api/mood-search` | ۲۹ خط |
| `api/_music.js` | موتور دوم `runSearch` + هندلر `GET /api/search` | ۳۳۵ خط |
| `src/Page/Home/MusicSearch/index.jsx` | UI جست‌وجو | ۱۴۵ خط |
| `src/lib/musicUrl.js` | تبدیل مسیر mp3 به URL قابل پخش | ۲۹ خط |

نکته‌ی مهم: **دو موتور مستقل** وجود دارد که خروجی‌شان یکسان نیست (بخش ۷).

---

## ۲. معماری درخواست

```
[کاربر متن می‌نویسد]
        │
        ▼
MusicSearch/index.jsx  ──fetch──▶  GET /api/mood-search?q=...
        │                              │
        │                              ├─ api/_mood-search.js   (اعتبارسنجی طول ۲..۵۰۰)
        │                              ├─ api/_mood-engine.js   (re-export)
        │                              └─ src/lib/moodEngine.js : executeMoodSearch(songs, q)
        │                                       │
        │                                       ├─ normalizeText + transliterateQuery
        │                                       ├─ extractMoodFromQuery  → بردار ۲۴ بعدی
        │                                       └─ امتیازدهی هر آهنگ → sort → top 5
        ▼
{ found, song, mood{...}, bestScore, softMatch, results[] }
```

`found = results.length > 0 && bestScore >= 0.15` — زیر این آستانه، پیام «آهنگی پیدا نشد» نمایش داده می‌شود.

---

## ۳. مدل داده

### ۳.۱ `music-database.json`

```jsonc
{
  "songs": [{
    "id": 1,
    "name": "The Winner Takes It All",
    "artist": "ABBA",
    "src": "/assets/Music/ABBA%20-%20....mp3",

    "tags":   ["جدایی","شکست عشقی","درد","پشیمانی","بالاد","دراماتیک", ...],  // فارسی
    "tagsEn": ["breakup","heartbreak","loss","pain","regret","ballad", ...], // انگلیسی

    "moods": {                    // ۲۴ بعد، هر کدام ۰..۱
      "sadness": 0.95, "longing": 0.85, "heartbreak": 0.95,
      "melancholy": 0.9, "reflection": 0.8, "loneliness": 0.75,
      "nostalgia": 0.55, "tension": 0.4, "darkness": 0.3
    },

    "analysis": {                 // از DSP
      "bpm": 129, "energy": 4, "dance": 11, "bright": 85,
      "vocals": 31, "dyn": 98,
      "vibe": {                   // ۸ بعد، ۰..۱۰۰
        "sad": 100, "happy": 8, "energetic": 12, "calm": 34,
        "focus": 17, "epic": 94, "romantic": 22, "dark": 0
      }
    },

    "lyrics": "By Med EL BARAKA\nI don't wanna talk...",  // متن کامل
    "lyricsStatus": "fetched_by_agent",                   // یا "missing"
    "lyricsSummary": "ترانه از زبان زنی روایت می‌کند که ...",   // خلاصه فارسی
    "summaryEn": "The song is told from a woman's perspective ...",

    "audioMoodTag": "غمگین-دراماتیک",   // برچسب صوتی فارسی
    "audioMoodEn": "sad-dramatic",
    "energy": "medium",                 // low | medium | high
    "valence": "negative"               // positive | negative | neutral
  }]
}
```

**آمار فعلی**

| مورد | مقدار |
|---|---|
| تعداد آهنگ | ۴۱ |
| کل تگ فارسی | ۸۳۷ (میانگین ۲۰.۴ تگ/آهنگ) |
| کل تگ انگلیسی | ۷۴۴ |
| آهنگ با `moods` | ۴۱ / ۴۱ |
| آهنگ با `lyrics` | ۳۶ / ۴۱ |
| آهنگ بدون متن | id = **19, 20, 34, 39, 41** (`lyricsStatus: "missing"`) |
| نام تکراری | ندارد |

### ۳.۲ `music-analysis.json`

نگاشت `id → { bpm, energy, dyn, brightness, perc, beat, dance, mode, vocals_mod }` — خروجی خام تحلیل صوتی.

- **۴۶ کلید** دارد ولی فقط **۴۱ آهنگ** وجود دارد → کلیدهای `42..46` **یتیم** هستند.
- مقیاس مقادیر با `analysis` داخل database یکسان نیست (`energy` اینجا ۰..۱ است، آنجا ۰..۱۰۰).

### ۳.۳ تاکسونومی تگ‌ها

تگ‌ها آزادانه و دستی نوشته شده‌اند (بدون واژگان کنترل‌شده). نمونه‌ی تگ‌های پرتکرار:

احساس: `غم`, `شادی`, `عشق`, `دلتنگی`, `خشم`, `تنهایی`, `امید`, `پشیمانی`
موقعیت: `شب`, `باران`, `پاییز`, `سفر`, `جشن`
سبک: `بالاد`, `رپ`, `پاپ`, `کلاسیک`, `سینمایی`
مرجع: نام خواننده به فارسی (`ابی`, `ادل`, `امینم`) و نام آهنگ به فینگلیش (`رولینگ این د دیپ`)

---

## ۴. ابعاد احساسی

### ۴.۱ `moods` — ۲۴ بعد (ورودی امتیاز معنایی)

```
sadness, longing, nostalgia, heartbreak, loneliness,
joy, playfulness, romance, sensuality, warmth,
anger, rebellion, power, defiance,
calm, dreaminess, melancholy, hope,
darkness, tension, mystery,
energy, euphoria, reflection
```

### ۴.۲ `analysis.vibe` — ۸ بعد (ورودی تطبیق صوتی)

```
sad, happy, energetic, calm, focus, epic, romantic, dark      // ۰..۱۰۰
```

پل بین این دو، جدول `DIM_TO_VIBE` است؛ مثلاً:

```js
heartbreak: { sad: 0.8, dark: 0.2 }
power:      { epic: 0.8, energetic: 0.2 }
reflection: { focus: 1 }
```

یعنی «شکست عشقی» ۸۰٪ به وایب `sad` و ۲۰٪ به `dark` نگاشت می‌شود.

---

## ۵. موتور اصلی: `executeMoodSearch`

### ۵.۱ خط لوله‌ی متن

1. **`normalizeText`** — lowercase، یکسان‌سازی `ي→ی`, `ك→ک`, `أإآ→ا`, `ةۀ→ه`, حذف اعراب و **ZWNJ (نیم‌فاصله)**، فشرده‌سازی فاصله‌ها.
2. **`transliterateQuery`** — فینگلیش به فارسی با دیکشنری `FINGLISH_MAP` (~۱۰۰ ورودی):
   `ghamgin→غمگین`, `shad→شاد`, `deltangi→دلتنگی`, `ashegh→عاشق`, `khaste→خسته` …
3. **`extractMoodFromQuery`** به ترتیب:
   - **عبارات مرکب** (`COMPOUND_PHRASES`, ۱۰ الگو) — بالاترین اولویت. مثال: «دلم تنگ شده» → `{longing:1, nostalgia:0.75, sadness:0.55}`.
   - **منفی‌سازی** (فقط ۳ حالت): «شاد نیستم» → غم، «غمگین نباش» → شادی، «خسته نیست» → انرژی.
   - **واژگان احساس** (`MOOD_LEXICON`, ۳۰ ردیف فارسی/انگلیسی) — هر تطابق، وزن ابعاد را با `Math.max` بالا می‌برد (تجمیع بیشینه، نه جمع).
   - **برترین صفت** (`ترین`, `most`, `best`) → ضریب **۱.۲۵**.
   - پیش‌فرض‌ها: energy/valence به ابعاد `energy`/`calm`/`joy`/`sadness` با وزن ۰.۴–۰.۴۵ اضافه می‌شوند.

### ۵.۲ فرمول امتیاز هر آهنگ

```js
semantic = cosine(queryMoods, song.moods)          // 0..1
tag      = min(1, مجموع برخورد تگ‌ها)               // 0..1
audio    = میانگین وزنی vibe روی DIM_TO_VIBE        // 0..1  (+0.2 اگر energy هم‌جهت باشد)

score = 0.50*semantic + 0.25*tag + 0.25*audio
```

سپس:

- **پاداش صفت برتر**: اگر بعد غالب کوئری در آهنگ ≥ ۰.۸۵ باشد → `+0.4`
- **پاداش نام/خواننده**: تطابق کامل `+4.5`، زیررشته `+3.2`، معکوس `+2.8`
- **پاداش نام مستعار فارسی**: «امینم» → Eminem `+4.0`

خروجی: ۵ نتیجه‌ی برتر، `found` اگر بهترین امتیاز ≥ **۰.۱۵**، و `softMatch` اگر < **۰.۲۵**.

### ۵.۳ دروازه‌ی «حس نامشخص»

اگر هیچ بعدی از کوئری تشخیص داده نشود (`moods` خالی)، همه‌ی آهنگ‌ها امتیاز ۰ می‌گیرند و `found=false`.
این عمداً اضافه شده تا ورودی بی‌ربط، آهنگ تصادفی پخش نکند.

---

## ۶. موتور دوم: `runSearch` (`/api/search`)

موتور قدیمی‌تر و مستقل، با منطق متفاوت:

- نرمال‌سازی جداگانه (`norm` در `api/_music.js`): ZWNJ را با **حذف** پاک می‌کند (در moodEngine با **فاصله** جایگزین می‌شود → ناسازگاری).
- تطبیق تگ با **Levenshtein** + کلید صوتی (حذف واکه‌ها) + مترادف‌های دوسطحی (`SYNON`, `TRANSLIT`).
- حالت احساس با `MOOD_STEMS` (۸ بعد) که مستقیماً روی `analysis.vibe` ضرب می‌شود:

```js
score = Σ(vibe[dim] * weight) + 0.25 * score_textual   // بی‌سقف، می‌تواند >100 شود
found = score >= 1.5
```

⚠️ چون `vibe` بین ۰ تا ۱۰۰ است، در حالت احساس امتیاز به‌راحتی از ۱۰۰ رد می‌شود و آستانه‌ی `1.5` عملاً بی‌معنی است.

---

## ۷. ناسازگاری دو موتور (شواهد اجرا)

| کوئری | `/api/search` | `/api/mood-search` |
|---|---|---|
| غمگین | The Winner Takes It All (136.4) | The Winner Takes It All (0.62) ✅ |
| شاد | Je veux (125.6) | Je veux (0.62) ✅ |
| عاشقانه | **Birds of a Feather** (136.4) | **Thinking Out Loud** (0.71) ❌ |
| درس | Idea 10 (136.4) | Idea 10 (0.5) ✅ |
| ورزش | Believer (5.6) | Believer (0.59) ✅ |
| خسته | **In the End** (5.6) | **Idea 22** (0.6) ❌ |
| دلتنگی | **Save Your Tears** (136.4) | **Nothing's New** (0.71) ❌ |

UI فعلی فقط از `/api/mood-search` استفاده می‌کند؛ `/api/search` مسیر مرده/قدیمی است ولی پاسخ‌های متناقض می‌دهد.

---

## ۸. ماتریس تست فعلی (اجرا شده روی داده‌ی امروز)

| ورودی | حس تشخیص‌داده‌شده | نتیجه | امتیاز | sem / tag / audio |
|---|---|---|---|---|
| غمگین | Sadness | The Winner Takes It All — ABBA | 0.62 | 0.54 / 0.40 / 0.99 |
| شاد | Joyful | Je veux — ZAZ | 0.62 | 0.64 / 0.40 / 0.82 |
| عاشقانه | Romance | Thinking Out Loud (Piano) — Ed Sheeran | 0.71 | 0.69 / 0.80 / 0.65 |
| دلتنگی | Longing | Nothing's New — Rio Romeo | 0.71 | 0.58 / 0.80 / 0.89 |
| خسته | Tired & Weary | Idea 22 — Gibran Alcocer | 0.60 | 0.71 / 0.00 / 0.99 |
| شادترین آهنگ | Joyful | Je veux — ZAZ | 0.92 | 0.62 / 0.00 / 0.83 |
| آرامش | Calm & Peaceful | Idea 22 — Gibran Alcocer | 0.67 | 0.49 / 0.80 / 0.89 |
| ورزش | Energetic & Pumped | Believer — Imagine Dragons | 0.59 | 0.63 / 0.40 / 0.72 |
| درس | Reflective & Focused | Idea 10 — Gibran Alcocer | 0.50 | 0.58 / 0.00 / 0.85 |
| شکست عشقی | Heartbreak & Sorrow | The Winner Takes It All — ABBA | 0.84 | 0.68 / 1.00 / 0.99 |
| باران | Melancholy & Rainy | No One Noticed — The Marías | 0.57 | 0.57 / 0.00 / **1.12** |
| شب | Dreamy & Ethereal | Swing Lynn (Slowed) — Harmless | 0.62 | 0.54 / 0.80 / 0.59 |
| پارتی | Euphoric & Dance | Je veux — ZAZ | 0.52 | 0.64 / 0.00 / 0.78 |
| ghamgin | Sadness | In the End (Piano) — Scott D. Davis | 0.57 | 0.63 / 0.00 / 1.01 |
| shad | Joyful | Je veux — ZAZ | 0.57 | 0.64 / 0.20 / 0.82 |
| love | Romance | we fell in love in october — girl in red | 3.74 | 0.64 / 0.40 / 0.48 |
| lonely | Loneliness | No One Noticed — The Marías | 0.56 | 0.60 / 0.00 / 1.03 |
| happy | Joyful | Je veux — ZAZ | 0.52 | 0.64 / 0.00 / 0.82 |
| sad | Sadness | In the End (Piano) — Scott D. Davis | 0.57 | 0.63 / 0.00 / 1.01 |
| eminem | — | Houdini — Eminem | 4.70 | 0 / 0.80 / 0 |
| ادل | — | Rolling in the Deep — Adele | 4.20 | 0 / 0.80 / 0 |
| Adele | — | Rolling in the Deep — Adele | 4.50 | 0 / 0.80 / 0 |
| rolling in the deep | — | Rolling in the Deep — Adele | 4.70 | 0 / 0.80 / 0 |
| **ناامیدی** | Sadness | In the End (Piano) | 0.39 | dims: sadness 0.95 **+ hope 0.95** |
| asdfgh | — | ❌ not found | 0 | — |
| امروز هوا خوبه | — | ❌ not found | 0 | — |

اسکریپت بازتولید:

```bash
cd <repo>
cat > _t.mjs <<'EOF'
import { executeMoodSearch } from "./src/lib/moodEngine.js";
import fs from "node:fs";
const songs = JSON.parse(fs.readFileSync("./public/api/music-database.json","utf8")).songs;
for (const q of ["غمگین","شاد","عاشقانه","درس"]) {
  const r = executeMoodSearch(songs, q);
  console.log(q, r.found, r.song?.name, r.bestScore, r.results[0]?.parts);
}
EOF
node _t.mjs && rm _t.mjs
```

---

## ۹. مشکلات مشکوک (برای بررسی)

### 🔴 ۹.۱ تناقض معنایی در «ناامیدی»
ورودی `ناامیدی` هم `امید` (hope) را تطبیق می‌دهد و هم `ناامید` (sadness) را، چون هیچ منطق منفی‌سازی برای `hope` وجود ندارد.
نتیجه: `{ sadness: 0.95, hope: 0.95 }` — دو حس متضاد با وزن برابر.
**انتظار:** ناامیدی باید hope را صفر یا معکوس کند.
منطق منفی‌سازی فعلی فقط سه حالت دستی دارد (`isNegatedJoy`, `isNegatedSad`, `isNegatedCalm`) و عمومی نیست.

### 🔴 ۹.۲ امتیاز `audio` می‌تواند از ۱ بیشتر شود
در `executeMoodSearch`:
```js
aud = Math.min(1, acc / wsum);
if (qm.energy === "high" && song.analysis.energy >= 60) aud += 0.2;
```
`Math.min` **قبل** از جمع است → مقدار نهایی تا ۱.۲ می‌رسد (در تست «باران»: 1.12، «ghamgin»: 1.01).
اثر: وزن واقعی صوت از ۰.۲۵ به ۰.۳ می‌رسد و رتبه‌بندی را کج می‌کند.

### 🟠 ۹.۳ آستانه‌ی `found` در `/api/search` بی‌اثر است
امتیاز حالت احساس بی‌سقف است (۱۰۰+) ولی آستانه `1.5` است → تقریباً هر ورودی حسی «پیدا شد» می‌شود.

### 🟠 ۹.۴ دو موتور، دو نتیجه
بخش ۷. برای یک کوئری، دو آهنگ مختلف. اگر `/api/search` جایی مصرف می‌شود، باید یکی‌سازی شود.

### 🟠 ۹.۵ نرمال‌سازی ZWNJ ناسازگار
- `moodEngine.normalizeText`: ZWNJ → **فاصله**
- `_music.norm`: ZWNJ → **حذف**

«می‌خوام» در یکی می‌شود «می خوام» و در دیگری «میخوام» → تطبیق تگ‌ها یکسان نیست.

### 🟡 ۹.۶ پنج آهنگ بدون متن ترانه
id = 19, 20, 34, 39, 41. بردار `moods` و خلاصه دارند، ولی مبنای متنی ندارند.
سؤال: `moods` این‌ها از کجا آمده؟ (حدس: از تحلیل صوتی، نه متن) → ناهمگونی مبنای برچسب‌گذاری.

### 🟡 ۹.۷ پنج رکورد یتیم در `music-analysis.json`
کلیدهای 42..46 آهنگی در database ندارند.

### 🟡 ۹.۸ فایل‌های mp3 در ریپو نیستند
`public/assets/Music/` در `.gitignore` است و هیچ‌کدام از ۴۱ فایل لوکال موجود نیست.
پخش روی محیط جدید بدون `VITE_MUSIC_BASE` شکست می‌خورد.

### 🟡 ۹.۹ برچسب «Detected Mood» گمراه‌کننده
وقتی هیچ حسی تشخیص داده نمی‌شود ولی با نام/خواننده نتیجه پیدا می‌شود، `labelFa/labelEn` روی «احساس شناسایی شده / Detected Mood» می‌ماند و در UI نمایش داده می‌شود.

### 🟡 ۹.۱۰ تگ‌های نامتقارن
میانگین ۲۰ تگ فارسی ولی ۱۸ تگ انگلیسی؛ بعضی آهنگ‌ها تگ فارسی دارند که معادل انگلیسی ندارد (و برعکس) → امتیاز `tag` بین فارسی/انگلیسی ناهمگون است.

### 🟡 ۹.۱۱ تگ‌های «متا» در کنار تگ‌های احساسی
تگ‌هایی مثل `ابی`, `وینر تیکس ایت آل`, `رولینگ این د دیپ` در همان آرایه‌ی `tags` هستند که تگ‌های احساسی.
اثر: کوئری «ابی» هم از مسیر نام (پاداش ۴.۰) و هم از مسیر تگ امتیاز می‌گیرد → امتیاز دوباره‌شماری.

---

## ۱۰. سؤالات باز برای تحلیلگر

1. آیا `moods` هر آهنگ با **متن ترانه** هم‌خوانی دارد؟ (برای ۳۶ آهنگ با lyric قابل بررسی است)
2. آیا آهنگ‌های هم‌حس، خوشه‌ی درستی می‌سازند؟ (مثلاً همه‌ی `heartbreak ≥ 0.9` واقعاً غمگین‌اند؟)
3. آیا ورودی‌های فارسی روزمره («حالم بده»، «دلم گرفته»، «باید بخونم») به آهنگ درست می‌رسند؟
4. آیا آستانه‌ی ۰.۱۵ برای `found` بیش از حد سخاوتمندانه/سخت‌گیرانه نیست؟
5. وزن‌های ۰.۵ / ۰.۲۵ / ۰.۲۵ بهینه‌اند؟
6. آیا ۲۴ بعد، بیش از حد ریز نیست و باعث هم‌پوشانی (مثل `sadness` و `melancholy` و `heartbreak`) نمی‌شود؟
7. آیا باید موتور دوم (`/api/search`) حذف شود؟

---

## ۱۱. جمع‌بندی یک‌خطی

ساختار کلی سالم است (دروازه‌ی حس نامشخص، بردار ۲۴ بعدی، نگاشت vibe) ولی **سه ایراد قطعی** دارد:
تناقض `ناامیدی`، سرریز `audio > 1`، و دو موتور متناقض. بقیه موارد، بدهی فنی و ناهمگونی داده است.
