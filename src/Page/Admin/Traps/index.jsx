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
          <p className="text-[#615FFF] text-[12px] font-mono">$ cat /var/log/traps.log</p>
          <h1 className="text-white text-[20px] font-semibold mt-1">Honeypot Trap Logs</h1>
          <p className="text-[#68768C] text-[11px] mt-1">
            Logs from visitors entering /newpage (IP, Device Model, Browser, Location)
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
          loading trap data...
        </div>
      ) : traps.length === 0 ? (
        <div className="py-12 text-center text-[#68768C] text-[13px] border border-dashed border-[#1E293B] rounded-lg">
          هنوز هیچ ردی ثبت نشده! به محض اینکه کسی وارد <code className="text-[#615FFF]">/newpage</code> بشه، اطلاعاتش اینجا میاد.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#1E293B] bg-[#0F172B]">
          <table className="w-full text-left text-[12px] border-collapse">
            <thead>
              <tr className="border-b border-[#1E293B] text-[#68768C] uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Location / Country</th>
                <th className="py-3 px-4">Device Model</th>
                <th className="py-3 px-4">Browser & OS</th>
                <th className="py-3 px-4">Details</th>
                <th className="py-3 px-4 text-right">Action</th>
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
                    <span className="px-2 py-1 rounded bg-[#21295A] text-[#93C5FD] font-medium border border-[#3B82F6]/30">
                      📱 {row.deviceModel || "Unknown"}
                    </span>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap text-[#90A1B9]">
                    <span className="text-white font-medium">{row.browser}</span>
                    <span className="text-[#68768C] ml-1.5">({row.os})</span>
                  </td>
                  <td className="py-3 px-4 text-[#68768C] max-w-[200px] truncate" title={row.userAgent}>
                    <div className="text-[11px] truncate">
                      {row.extra?.screen && <span className="mr-2">🖥 {row.extra.screen}</span>}
                      {row.extra?.timeZone && <span>🕒 {row.extra.timeZone}</span>}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      onClick={() => setDeleteId(row.id)}
                      className="text-[11px] px-2 py-1 rounded border border-[#FF5F56]/30 text-[#FF5F56] hover:bg-[#FF5F56]/10"
                    >
                      del
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
