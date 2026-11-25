import React, { useState, useCallback } from "react";
import Music from "../../../Components/Music";
import Loading from "../../../Components/Loading";
import useClickTrack from "../../../Hooks/useClickTrack";
import { musicUrl } from "../../../lib/musicUrl";

const gray = "#90A1B9";

const API_BASE = "/api";
const RECENT_KEY = "music_recent_ids";
const RECENT_MAX = 5;

const SUGGESTIONS = [
  "دلم گرفته",
  "فاز پارتی",
  "باشگاه",
  "درس و تمرکز",
  "رانندگی شب",
  "عاشقانه",
];

function readRecent() {
  try {
    const raw = sessionStorage.getItem(RECENT_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids.filter((n) => Number.isInteger(n)).slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function pushRecent(id) {
  if (!id) return readRecent();
  const next = [id, ...readRecent().filter((x) => x !== id)].slice(0, RECENT_MAX);
  try {
    sessionStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
  return next;
}

export default function MusicSearch() {
  const [isFocused, setIsFocused] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [songData, setSongData] = useState(null);
  const [detectedMood, setDetectedMood] = useState(null);
  const [matchReason, setMatchReason] = useState("");
  const [isDirectLookup, setIsDirectLookup] = useState(false);
  const [isSoftMatch, setIsSoftMatch] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const { trackClick } = useClickTrack();

  const requestSong = useCallback(async (query, recent) => {
    const params = new URLSearchParams({ q: query });
    if (recent && recent.length) params.set("recent", recent.join(","));

    const res = await fetch(`${API_BASE}/mood-search?${params.toString()}`);
    return res.json();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    trackClick({
      targetType: "button",
      targetId: "music-search",
      targetLabel: "Music Search",
    });

    const q = searchTerm.trim();
    if (!q) {
      setErrorMessage("Please enter search text");
      return;
    }
    if (q.length < 2 && !/\p{Extended_Pictographic}/u.test(q)) {
      setErrorMessage("Please write at least 2 characters");
      return;
    }

    setErrorMessage("");
    setSongData(null);
    setDetectedMood(null);
    setMatchReason("");
    setShowSuggestions(false);
    setSearching(true);

    try {
      const data = await requestSong(q, readRecent());
      if (data.error) {
        setErrorMessage(data.error);
        return;
      }

      const song = data.found ? data.song || (data.results && data.results[0]?.song) : null;
      if (!song) {
        setErrorMessage("No matching song found. Please change the input");
        setShowSuggestions(true);
        return;
      }

      setSongData({ ...song, src: musicUrl(song.src) });
      setLastQuery(q);
      setIsDirectLookup(data.intent === "direct_lookup");
      setIsSoftMatch(Boolean(data.softMatch));
      setMatchReason(data.matchReasonFa || "");
      pushRecent(song.id);

      if (data.intent !== "direct_lookup" && data.mood && data.mood.detected) {
        setDetectedMood({ fa: data.mood.labelFa, en: data.mood.labelEn, energy: data.mood.energy });
      }
    } catch {
      setErrorMessage("Connection error. Please try again");
    } finally {
      setSearching(false);
    }
  };

  /* same query, current song pushed to the top of the cooldown list */
  const handleAnother = async () => {
    if (!lastQuery || searching) return;
    setSearching(true);
    setErrorMessage("");
    try {
      const recent = songData ? pushRecent(songData.id) : readRecent();
      const data = await requestSong(lastQuery, recent);
      const song = data.found ? data.song || data.results?.[0]?.song : null;
      if (!song) {
        setErrorMessage("No other song matches this mood right now");
        return;
      }
      setSongData({ ...song, src: musicUrl(song.src) });
      setIsSoftMatch(Boolean(data.softMatch));
      pushRecent(song.id);
    } catch {
      setErrorMessage("Connection error. Please try again");
    } finally {
      setSearching(false);
    }
  };

  const handleSuggestion = (text) => {
    setSearchTerm(text);
    setErrorMessage("");
    setShowSuggestions(false);
  };

  return (
    <div className="box-3d w-full max-w-full sm:max-w-md lg:max-w-[420px] bg-[#0F172B] p-5 sm:p-6 rounded-2xl border border-[#1E293B] shadow-xl">
      <form
        onSubmit={handleSubmit}
        className="w-full flex flex-col gap-3.5 items-center justify-center"
        style={{ color: gray }}
      >
        <label className="w-full flex flex-col gap-2 text-[12px] sm:text-[13px] text-[#90A1B9]">
          <span>Search a mood or feeling:</span>
          <input
            className="py-2.5 px-3.5 rounded-lg text-[13px] bg-[#020618] text-white focus:outline-0 duration-150 placeholder:text-[#4B576D]"
            style={{ border: `1px solid ${isFocused ? "#615FFF" : "#314158"}` }}
            type="text"
            maxLength={255}
            placeholder="Type something..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setErrorMessage("");
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
        </label>
        <button
          className="rounded-lg bg-[#1D293D] w-full text-[13px] font-medium text-white py-2.5 px-3 cursor-pointer ring-1 ring-[#314158] hover:bg-[#615FFF] hover:ring-[#615FFF] duration-150 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm"
          type="submit"
          disabled={searching}
        >
          {searching ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              <span>Analyzing emotion...</span>
            </>
          ) : (
            "Search & Match Vibe"
          )}
        </button>
      </form>

      {errorMessage && (
        <div className="mt-3 text-center text-red-400 bg-red-500/10 py-2 px-3 rounded-lg flex items-center justify-center gap-2 text-[12px] border border-red-500/20">
          <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{errorMessage}</span>
        </div>
      )}

      {showSuggestions && (
        <div className="mt-3 flex flex-wrap gap-2 justify-center">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleSuggestion(s)}
              className="text-[12px] px-3 py-1.5 rounded-full border border-[#314158] text-[#90A1B9] hover:border-[#615FFF] hover:text-white duration-150 cursor-pointer"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {searching && !errorMessage && <Loading variant="music" />}

      {songData && !searching && !errorMessage && (
        <div className="mt-3 flex flex-col gap-2">
          {isDirectLookup ? (
            <div className="flex items-center justify-center gap-1.5 py-1 px-2.5 rounded-full bg-[#615FFF1A] border border-[#615FFF4D] text-[#C7C6FF] text-[11px] text-center">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#615FFF]"></span>
              <span>نتیجه‌ی جست‌وجوی مستقیم</span>
            </div>
          ) : (
            detectedMood && (
              <div className="flex items-center justify-center gap-1.5 py-1 px-2.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[11px] text-center">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                <span>
                  {isSoftMatch ? "نزدیک‌ترین آهنگ به حال‌وهوات: " : "Detected Vibe: "}
                  <strong>{detectedMood.en || detectedMood.fa}</strong>
                </span>
              </div>
            )
          )}

          <Music songData={songData} autoPlay={false} />

          {matchReason && !isDirectLookup && (
            <p className="text-[11px] text-center text-[#68768C]">{matchReason}</p>
          )}

          <button
            type="button"
            onClick={handleAnother}
            disabled={searching}
            className="w-full text-[11.5px] py-2 rounded-lg border border-[#314158] text-[#90A1B9] hover:border-[#615FFF] hover:text-white duration-150 disabled:opacity-50 cursor-pointer"
          >
            یه آهنگ دیگه با همین حس
          </button>
        </div>
      )}
    </div>
  );
}
