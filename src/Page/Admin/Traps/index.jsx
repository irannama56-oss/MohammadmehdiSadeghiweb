import { useEffect, useState } from "react";
import { useAdminAuth } from "../../../Hooks/useAdminAuth";
import ConfirmDialog from "../ui/ConfirmDialog";

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString("fa-IR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function TrapsPage() {
  const { authFetch } = useAdminAuth();
  const [traps, setTraps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch("/api/admin/traps");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load trap logs");
      setTraps(json.traps || []);
    } catch (err) {
      setError(err.message || "Failed to load logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    setBusy(true);
    try {
      const res = await authFetch(`/api/admin/traps?id=${deleteId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      setTraps((prev) => prev.filter((t) => t.id !== deleteId));
      if (selectedEntry?.id === deleteId) setSelectedEntry(null);
      setDeleteId(null);
    } catch (err) {
      setError(err.message || "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const handleClearAll = async () => {
    setBusy(true);
    try {
      const res = await authFetch(`/api/admin/traps?clearAll=true`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Clear failed");
      setTraps([]);
      setSelectedEntry(null);
      setShowClearConfirm(false);
    } catch (err) {
      setError(err.message || "Clear failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-[#615FFF] text-[12px] font-mono">$ inspect --target=visitors</p>
          <h1 className="text-white text-[20px] font-semibold mt-1">Visitor Device Inspector</h1>
          <p className="text-[#68768C] text-[11px] mt-1">
            Detailed hardware, network, browser, and IP analytics captured from visitors.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="text-[11px] px-3 py-1.5 rounded-md border border-[#314158] text-[#90A1B9] hover:text-white hover:border-[#615FFF] duration-150"
          >
            {loading ? "loading..." : "refresh()"}
          </button>
          {traps.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              disabled={busy}
              className="text-[11px] px-3 py-1.5 rounded-md border border-[#FF5F56]/30 text-[#FF5F56] hover:bg-[#FF5F56]/10 duration-150"
            >
              clear_all()
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded bg-[#FF5F56]/10 border border-[#FF5F56]/30 text-[#FF5F56] text-[12px]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-[#68768C] text-[13px] font-mono">
          loading visitor records...
        </div>
      ) : traps.length === 0 ? (
        <div className="py-12 text-center text-[#68768C] text-[13px] border border-dashed border-[#1E293B] rounded-lg">
          No visitor records yet. Profiles captured by the visitor inspector will show here.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#1E293B] bg-[#0F172B]">
          <table className="w-full text-left text-[12px] border-collapse">
            <thead>
              <tr className="border-b border-[#1E293B] text-[#68768C] uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Captured At</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Device & Type</th>
                <th className="py-3 px-4">Browser & OS</th>
                <th className="py-3 px-4">Screen & Hardware</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]">
              {traps.map((row) => (
                <tr key={row.id} className="hover:bg-[#131E36] duration-100">
                  <td className="py-3 px-4 text-[#90A1B9] whitespace-nowrap font-mono text-[11px]">
                    {formatDate(row.createdAt)}
                  </td>
                  <td className="py-3 px-4 font-mono font-medium text-white whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded bg-[#1E293B] text-[#58BDAF]">
                      {row.ip}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-[#90A1B9] whitespace-nowrap">
                    <span className="font-semibold text-white mr-1.5">{row.country}</span>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="text-white font-medium">
                        {row.deviceType === "Mobile" || row.deviceType === "Tablet" ? "📱 " : "💻 "}
                        {row.deviceModel || "Unknown Device"}
                      </span>
                      <span className="text-[10px] text-[#615FFF] uppercase tracking-wider">
                        {row.deviceType || "Desktop"}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="text-white font-medium">{row.browser}</span>
                      <span className="text-[11px] text-[#68768C]">{row.os}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[#90A1B9] whitespace-nowrap">
                    <div className="text-[11px]">
                      {row.extra?.screen && <div>Display: {row.extra.screen}</div>}
                      {row.extra?.cpuCores && (
                        <div className="text-[#68768C]">
                          CPU: {row.extra.cpuCores} Cores | RAM: {row.extra.deviceMemory || "N/A"}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedEntry(row)}
                        className="text-[11px] px-2 py-1 rounded border border-[#3B82F6]/30 text-[#93C5FD] hover:bg-[#3B82F6]/10"
                      >
                        view()
                      </button>
                      <button
                        onClick={() => setDeleteId(row.id)}
                        className="text-[11px] px-2 py-1 rounded border border-[#FF5F56]/30 text-[#FF5F56] hover:bg-[#FF5F56]/10"
                      >
                        del()
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detailed inspection modal */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-lg border border-[#1E293B] bg-[#0F172B] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="h-11 flex items-center justify-between px-4 bg-[#0b1220] border-b border-[#1E293B]">
              <p className="text-[12px] font-mono text-[#615FFF]">
                inspector://{selectedEntry.ip}
              </p>
              <button
                onClick={() => setSelectedEntry(null)}
                className="text-[#90A1B9] hover:text-white text-[14px]"
              >
                ✕
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex flex-col gap-4 text-[12px]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded bg-[#070B14] border border-[#1E293B]">
                  <p className="text-[10px] text-[#68768C] uppercase font-semibold text-[#615FFF]">Hardware & Platform</p>
                  <p className="text-white font-medium mt-1">Device: {selectedEntry.deviceModel}</p>
                  <p className="text-[#90A1B9]">Type: {selectedEntry.deviceType}</p>
                  <p className="text-[#90A1B9]">OS: {selectedEntry.os} {selectedEntry.extra?.osVersion || ""}</p>
                  <p className="text-[#90A1B9]">Architecture: {selectedEntry.extra?.architecture || "N/A"} ({selectedEntry.extra?.bitness ? `${selectedEntry.extra.bitness}-bit` : ""})</p>
                </div>

                <div className="p-3 rounded bg-[#070B14] border border-[#1E293B]">
                  <p className="text-[10px] text-[#68768C] uppercase font-semibold text-[#615FFF]">Browser & Engine</p>
                  <p className="text-white font-medium mt-1">Browser: {selectedEntry.browser}</p>
                  <p className="text-[#90A1B9]">Version: {selectedEntry.extra?.browserVersion || "N/A"}</p>
                  <p className="text-[#90A1B9]">Language: {selectedEntry.extra?.language || "N/A"}</p>
                  <p className="text-[#90A1B9]">Timezone: {selectedEntry.extra?.timeZone || "N/A"}</p>
                </div>

                <div className="p-3 rounded bg-[#070B14] border border-[#1E293B]">
                  <p className="text-[10px] text-[#68768C] uppercase font-semibold text-[#615FFF]">Display & Performance</p>
                  <p className="text-[#90A1B9] mt-1">Screen Resolution: {selectedEntry.extra?.screen || "N/A"}</p>
                  <p className="text-[#90A1B9]">Viewport Size: {selectedEntry.extra?.viewport || "N/A"}</p>
                  <p className="text-[#90A1B9]">CPU Cores: {selectedEntry.extra?.cpuCores || "N/A"}</p>
                  <p className="text-[#90A1B9]">Device RAM: {selectedEntry.extra?.deviceMemory || "N/A"}</p>
                  <p className="text-[#90A1B9]">Touch Points: {selectedEntry.extra?.touchPoints ?? "N/A"}</p>
                </div>

                <div className="p-3 rounded bg-[#070B14] border border-[#1E293B]">
                  <p className="text-[10px] text-[#68768C] uppercase font-semibold text-[#615FFF]">GPU & Network</p>
                  <p className="text-white font-medium mt-1 truncate" title={selectedEntry.extra?.gpuRenderer}>
                    GPU: {selectedEntry.extra?.gpuRenderer || "N/A"}
                  </p>
                  <p className="text-[#90A1B9]">Vendor: {selectedEntry.extra?.gpuVendor || "N/A"}</p>
                  <p className="text-[#90A1B9]">Network: {selectedEntry.extra?.network || "N/A"}</p>
                  <p className="text-[#90A1B9]">Referrer: {selectedEntry.extra?.referrer || "Direct"}</p>
                </div>
              </div>

              <div className="p-3 rounded bg-[#070B14] border border-[#1E293B]">
                <p className="text-[10px] text-[#68768C] uppercase mb-1 font-semibold text-[#615FFF]">Full User-Agent String</p>
                <p className="font-mono text-[11px] text-[#90A1B9] break-all select-all">
                  {selectedEntry.userAgent}
                </p>
              </div>
            </div>
            <div className="p-4 bg-[#0b1220] border-t border-[#1E293B] flex justify-end">
              <button
                onClick={() => setSelectedEntry(null)}
                className="text-[12px] px-4 py-1.5 rounded-md border border-[#314158] text-[#90A1B9] hover:text-white"
              >
                close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteId && (
        <ConfirmDialog
          title="Delete Trap Log"
          message="Are you sure you want to delete this recorded log entry?"
          confirmLabel="Delete"
          busy={busy}
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}

      {/* Clear all dialog */}
      {showClearConfirm && (
        <ConfirmDialog
          title="Clear All Trap Logs"
          message="Are you sure you want to permanently clear all recorded entries?"
          confirmLabel="Clear All"
          busy={busy}
          onConfirm={handleClearAll}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
    </div>
  );
}
