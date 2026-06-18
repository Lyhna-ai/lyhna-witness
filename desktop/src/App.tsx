import { useCallback, useEffect, useRef, useState } from "react";
import { parseInboxIndex } from "../core/inboxIndex.js";
import { toInboxView, type InboxView, type InboxRow } from "../core/inboxView.js";

// Lyhna Desktop — app frame + real Receipt Inbox (Slices 1–2).
//
// The inbox runs the lyhna-witness engine CLI over a local folder and renders what the capsule files
// already say — claimed vs. witnessed, what's missing, what needs review. It reads only; it does not run
// agents, witness anything, or invent data. Copy stays inside the honesty ceiling, and a not-safe run
// reads as "review before continuing" (never a block).

type ScreenId = "inbox" | "install" | "adapter" | "settings";

const NAV: { id: ScreenId; label: string }[] = [
  { id: "inbox", label: "Receipt inbox" },
  { id: "install", label: "Install" },
  { id: "adapter", label: "Adapter" },
  { id: "settings", label: "Settings" }
];

export function App(): JSX.Element {
  const [screen, setScreen] = useState<ScreenId>("inbox");
  const [version, setVersion] = useState<string>("");

  useEffect(() => {
    let alive = true;
    void window.lyhna?.getVersion().then((v) => {
      if (alive) setVersion(v);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">Lyhna</span>
          <span className="brand-sub">Desktop</span>
        </div>
        <nav className="nav">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={"nav-item" + (screen === item.id ? " is-active" : "")}
              onClick={() => setScreen(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <p className="byo">Your agents use your keys, models, and tools. Lyhna gives you the receipts.</p>
          <p className="ver">{version ? `v${version}` : "renderer (no shell)"}</p>
        </div>
      </aside>

      <main className="main">
        {screen === "inbox" && <InboxScreen />}
        {screen === "install" && <PlaceholderScreen title="Install" what="copy-paste connect snippets for your agents" />}
        {screen === "adapter" && <PlaceholderScreen title="Adapter" what="honest local adapter status" />}
        {screen === "settings" && <PlaceholderScreen title="Settings" what="receipt library path and adapter settings" />}
      </main>
    </div>
  );
}

function Header(): JSX.Element {
  return (
    <header className="hero">
      <h1>Run your agents. Walk away. Come back to receipts.</h1>
      <p className="hero-sub">
        Lyhna shows what your agents <strong>claimed</strong>, what was <strong>witnessed</strong>, what was{" "}
        <strong>missing</strong>, and what <strong>needs review</strong> — from receipts on your own machine.
      </p>
    </header>
  );
}

function InboxScreen(): JSX.Element {
  const [path, setPath] = useState<string | null>(null);
  const [includePartial, setIncludePartial] = useState(false);
  const [view, setView] = useState<InboxView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const hasShell = typeof window.lyhna !== "undefined";
  // Monotonic request token: if the user switches folders / toggles partials mid-load, only the latest
  // request is allowed to commit state — a slower earlier load can't clobber the newer view.
  const reqRef = useRef(0);

  const load = useCallback(async (root: string, ip: boolean) => {
    if (!window.lyhna) {
      setError("Run inside the Lyhna Desktop app to read a receipt library.");
      return;
    }
    const reqId = ++reqRef.current;
    setLoading(true);
    setError(null);
    const res = await window.lyhna.loadInbox(root, ip);
    if (reqRef.current !== reqId) return; // superseded by a newer load — drop this stale result
    if (!res.ok) {
      setError(res.error);
      setView(null);
      setLoading(false);
      return;
    }
    try {
      setView(toInboxView(parseInboxIndex(res.stdout)));
    } catch (e) {
      setError((e as Error).message);
      setView(null);
    }
    setLoading(false);
  }, []);

  const pickLibrary = useCallback(async () => {
    const p = await window.lyhna?.selectLibrary();
    if (p) {
      setPath(p);
      void load(p, includePartial);
    }
  }, [load, includePartial]);

  const openExamples = useCallback(async () => {
    const p = await window.lyhna?.exampleLibraryPath();
    if (p) {
      setPath(p);
      void load(p, includePartial);
    }
  }, [load, includePartial]);

  const togglePartial = useCallback(() => {
    const next = !includePartial;
    setIncludePartial(next);
    if (path) void load(path, next);
  }, [includePartial, path, load]);

  return (
    <section className="screen">
      <Header />
      <div className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Receipt inbox</h2>
          <div className="controls">
            <button type="button" className="btn-primary" onClick={pickLibrary} disabled={!hasShell}>
              Select receipt library…
            </button>
            <button type="button" className="btn-ghost" onClick={openExamples} disabled={!hasShell}>
              Open bundled examples
            </button>
            {path && (
              <button type="button" className="btn-ghost" onClick={() => void load(path, includePartial)} disabled={loading}>
                Refresh
              </button>
            )}
            <label className="check">
              <input type="checkbox" checked={includePartial} onChange={togglePartial} /> Include partial
            </label>
          </div>
        </div>

        {path && <p className="lib-path mono">{path}</p>}

        {!hasShell && (
          <div className="empty">
            <p className="empty-body">
              You’re viewing the renderer outside the desktop shell, so folder access isn’t available. Run{" "}
              <span className="mono">npm start</span> in <span className="mono">desktop/</span> to use the inbox.
            </p>
          </div>
        )}

        {hasShell && !path && !loading && (
          <div className="empty">
            <p className="empty-title">No receipt library selected.</p>
            <p className="empty-body">
              Choose a local folder of Work Receipt Capsules and Lyhna Desktop will list them here — newest
              first, each showing what was claimed vs. witnessed and what needs review. Lyhna reads only the
              receipt files on your machine; it doesn’t run your agents.
            </p>
          </div>
        )}

        {loading && <p className="status">Reading receipts…</p>}

        {error && (
          <div className="error">
            <p className="error-title">Couldn’t read that folder.</p>
            <p className="error-body mono">{error}</p>
          </div>
        )}

        {view && !loading && <InboxList view={view} />}
      </div>
    </section>
  );
}

function InboxList({ view }: { view: InboxView }): JSX.Element {
  if (view.rows.length === 0) {
    return (
      <div className="empty">
        <p className="empty-title">No receipts here yet.</p>
        <p className="empty-body">
          This folder has no Work Receipt Capsules. When your agents route their tool calls through Lyhna, their
          receipts land here. Use <strong>Include partial</strong> to also show handoff-only folders.
        </p>
      </div>
    );
  }
  return (
    <>
      <p className="stats">
        {view.stats.shown < view.stats.count
          ? `Showing ${view.stats.shown} of ${view.stats.count} receipts`
          : `${view.stats.count} receipt${view.stats.count === 1 ? "" : "s"}`}
        {view.stats.flagged > 0 ? ` · ${view.stats.flagged} need review` : ""}
        {view.stats.includedPartial ? " · partial included" : ""}
      </p>
      <ul className="rows">
        {view.rows.map((row) => (
          <ReceiptRow key={row.id} row={row} />
        ))}
      </ul>
    </>
  );
}

function ReceiptRow({ row }: { row: InboxRow }): JSX.Element {
  return (
    <li className="row">
      <div className="row-top">
        <span className="row-title">{row.title}</span>
        {row.kindTag && <span className={"tag tag-" + row.kindTag}>{row.kindTag}</span>}
        <span className={"verdict tone-" + row.verdictTone}>{row.verdictLabel}</span>
      </div>
      {row.objective && <p className="row-objective">{row.objective}</p>}
      {row.countsLine && <p className="row-counts mono">{row.countsLine}</p>}
      {row.agentLabels.length > 0 && (
        <p className="row-agents">
          agents: {row.agentLabels.map((a) => (
            <span key={a} className="chip">
              {a}
            </span>
          ))}
        </p>
      )}
      {(row.receiptId || row.parentLoopId) && (
        <p className="row-ids mono">
          {row.receiptId ? `receipt ${row.receiptId}` : ""}
          {row.receiptId && row.parentLoopId ? " · " : ""}
          {row.parentLoopId ? `loop ${row.parentLoopId}` : ""}
        </p>
      )}
      {(row.warningCount > 0 || row.missingCount > 0) && (
        <p className="row-flags">
          {row.warningCount > 0 ? `⚠ ${row.warningCount} warning${row.warningCount === 1 ? "" : "s"}` : ""}
          {row.warningCount > 0 && row.missingCount > 0 ? " · " : ""}
          {row.missingCount > 0 ? `${row.missingCount} missing file${row.missingCount === 1 ? "" : "s"}` : ""}
        </p>
      )}
      <p className="row-folder mono">{row.folder}</p>
    </li>
  );
}

function PlaceholderScreen({ title, what }: { title: string; what: string }): JSX.Element {
  return (
    <section className="screen">
      <Header />
      <div className="panel">
        <h2 className="panel-title">{title}</h2>
        <div className="empty">
          <p className="empty-body">
            <strong>{title}</strong> — {what}. Added in a later update of Lyhna Desktop. This frame is the
            v1 scaffold; the inbox, receipt detail, install snippets, adapter status, and settings build out
            on top of it.
          </p>
        </div>
      </div>
    </section>
  );
}
