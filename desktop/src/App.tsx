import { useCallback, useEffect, useRef, useState } from "react";
import { parseInboxIndex } from "../core/inboxIndex.js";
import { toInboxView, type InboxView, type InboxRow } from "../core/inboxView.js";
import { buildReceiptDetail, type ReceiptDetail, type DetailStep, type DetailArtifact } from "../core/receiptDetail.js";
import { isSampleFolder } from "../core/sample.js";

// Lyhna Desktop — app frame + Receipt Inbox + Receipt detail (Slices 1–3).
//
// The inbox runs the lyhna-witness engine CLI over a local folder and renders what the capsule files
// already say; the detail view renders one capsule's readable receipt (HANDOFF.md, the main surface) plus
// the engine's own verdict, per-step claimed-vs-witnessed labels, and declared artifacts. It reads only;
// it does not run agents, witness anything, re-judge, or invent data. A not-safe run reads as "review
// before continuing" — never a block.

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
  const [selected, setSelected] = useState<string | null>(null);
  const [sampleNote, setSampleNote] = useState<string | null>(null);

  const hasShell = typeof window.lyhna !== "undefined";
  // Monotonic request token: if the user switches folders / toggles partials mid-load, only the latest
  // request is allowed to commit state — a slower earlier load can't clobber the newer view.
  const reqRef = useRef(0);
  // Mirror of the active library path, so async callbacks (e.g. sample render) can tell whether the user
  // switched libraries while they were awaiting, and bail instead of loading the wrong folder.
  // Mirrors of the active path / partial filter so async callbacks (e.g. the sample render) can tell
  // whether the user moved on while they were awaiting. These are updated SYNCHRONOUSLY in the handlers
  // below (a passive effect would only sync after commit, leaving a window where an IPC could resolve
  // against a stale ref); the effects are a backstop for any other transition.
  const pathRef = useRef<string | null>(null);
  useEffect(() => {
    pathRef.current = path;
  }, [path]);
  const partialRef = useRef(includePartial);
  useEffect(() => {
    partialRef.current = includePartial;
  }, [includePartial]);

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
      setSelected(null);
      setSampleNote(null);
      pathRef.current = p; // sync immediately so an in-flight sample render sees the switch
      setPath(p);
      void load(p, includePartial);
    }
  }, [load, includePartial]);

  const openExamples = useCallback(async () => {
    const p = await window.lyhna?.exampleLibraryPath();
    if (p) {
      setSelected(null);
      setSampleNote(null);
      pathRef.current = p; // sync immediately so an in-flight sample render sees the switch
      setPath(p);
      void load(p, includePartial);
    }
  }, [load, includePartial]);

  const createSample = useCallback(async () => {
    const target = path;
    if (!window.lyhna || !target) return;
    setSampleNote(null);
    setError(null);
    const res = await window.lyhna.createSampleReceipt(target);
    // If the user switched libraries while the CLI ran, drop this result — don't load the old folder's
    // receipts under the newer library path.
    if (pathRef.current !== target) return;
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSampleNote(
      `Created a sample receipt at ${res.folder} — rendered from the bundled demo input by the real engine. ` +
        `Sample data, not a live witnessed run.`
    );
    // Read the CURRENT partial filter (it may have been toggled while the CLI ran).
    void load(target, partialRef.current);
  }, [path, load]);

  const togglePartial = useCallback(() => {
    const next = !includePartial;
    partialRef.current = next; // sync immediately so an in-flight sample refresh uses the new filter
    setIncludePartial(next);
    if (path) void load(path, next);
  }, [includePartial, path, load]);

  if (selected) {
    return <ReceiptDetailScreen folder={selected} onBack={() => setSelected(null)} />;
  }

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
            {path && (
              <button type="button" className="btn-ghost" onClick={createSample} disabled={loading}>
                Create sample receipt
              </button>
            )}
            <label className="check">
              <input type="checkbox" checked={includePartial} onChange={togglePartial} /> Include partial
            </label>
          </div>
        </div>

        {path && <p className="lib-path mono">{path}</p>}

        {sampleNote && <p className="sample-banner">🧪 {sampleNote}</p>}

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

        {view && !loading && <InboxList view={view} onOpen={setSelected} />}
      </div>
    </section>
  );
}

function InboxList({ view, onOpen }: { view: InboxView; onOpen: (folder: string) => void }): JSX.Element {
  if (view.rows.length === 0) {
    return (
      <div className="empty">
        <p className="empty-title">No receipts here yet.</p>
        <p className="empty-body">
          This folder has no Work Receipt Capsules. When your agents route their tool calls through Lyhna,
          their receipts land here. Use <strong>Include partial</strong> to also show handoff-only folders.
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
        {view.stats.needsReview > 0 ? ` · ${view.stats.needsReview} need review` : ""}
        {view.stats.includedPartial ? " · partial included" : ""}
      </p>
      <ul className="rows">
        {view.rows.map((row) => (
          <ReceiptRow key={row.id} row={row} onOpen={onOpen} />
        ))}
      </ul>
    </>
  );
}

function ReceiptRow({ row, onOpen }: { row: InboxRow; onOpen: (folder: string) => void }): JSX.Element {
  return (
    <li>
      <button type="button" className="row" onClick={() => onOpen(row.folder)}>
        <div className="row-top">
          <span className="row-title">{row.title}</span>
          {isSampleFolder(row.folder) && <span className="tag tag-sample">sample</span>}
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
      </button>
    </li>
  );
}

function labelTone(label: string): string {
  if (label === "SUPPORTED") return "tone-ok";
  if (label.includes("UNSUPPORTED") || label.includes("DO_NOT_SEND") || label.includes("MISMATCH")) return "tone-review";
  return "tone-muted";
}

function ReceiptDetailScreen({ folder, onBack }: { folder: string; onBack: () => void }): JSX.Element {
  const [detail, setDetail] = useState<ReceiptDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    void window.lyhna?.loadReceipt(folder).then((res) => {
      if (!alive) return;
      if (!res.ok) {
        setError(res.error);
        setLoading(false);
        return;
      }
      setDetail(buildReceiptDetail(res.files));
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [folder]);

  return (
    <section className="screen">
      <button type="button" className="btn-ghost back" onClick={onBack}>
        ← Back to inbox
      </button>

      {isSampleFolder(folder) && (
        <p className="sample-banner">
          🧪 Sample receipt — rendered from the bundled demo input, not a live witnessed run.
        </p>
      )}

      {loading && <p className="status">Opening receipt…</p>}
      {error && (
        <div className="error">
          <p className="error-title">Couldn’t open this receipt.</p>
          <p className="error-body mono">{error}</p>
        </div>
      )}

      {detail && !loading && (
        <>
          <div className="panel">
            <div className="detail-head">
              <h2 className="detail-title">{detail.title}</h2>
              <span className={"verdict tone-" + detail.verdictTone}>{detail.verdictLabel}</span>
            </div>
            {detail.objective && <p className="detail-objective">{detail.objective}</p>}
            {detail.summaryLine && <p className="detail-counts mono">{detail.summaryLine}</p>}
            {detail.agentLabels.length > 0 && (
              <p className="row-agents">
                agents: {detail.agentLabels.map((a) => (
                  <span key={a} className="chip">
                    {a}
                  </span>
                ))}
              </p>
            )}
            {(detail.receiptId || detail.parentLoopId) && (
              <p className="row-ids mono">
                {detail.receiptId ? `receipt ${detail.receiptId}` : ""}
                {detail.receiptId && detail.parentLoopId ? " · " : ""}
                {detail.parentLoopId ? `loop ${detail.parentLoopId}` : ""}
              </p>
            )}
            <p className="row-folder mono">{folder}</p>
            {detail.warnings.length > 0 && (
              <ul className="warn-list">
                {detail.warnings.map((w) => (
                  <li key={w}>⚠ {w}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="panel">
            <h3 className="panel-title">The receipt</h3>
            {detail.handoffMarkdown ? (
              <pre className="md">{detail.handoffMarkdown}</pre>
            ) : (
              <p className="empty-body">No readable receipt (HANDOFF.md) in this folder.</p>
            )}
          </div>

          {detail.steps.length > 0 && (
            <div className="panel">
              <h3 className="panel-title">Claimed vs. witnessed</h3>
              <ul className="steps">
                {detail.steps.map((s) => (
                  <StepItem key={s.index} step={s} />
                ))}
              </ul>
            </div>
          )}

          {detail.artifacts.length > 0 && (
            <div className="panel">
              <h3 className="panel-title">Files in this capsule</h3>
              <ul className="artifacts">
                {detail.artifacts.map((a) => (
                  <ArtifactItem key={a.path} artifact={a} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function StepItem({ step }: { step: DetailStep }): JSX.Element {
  return (
    <li className="step">
      <div className="step-labels">
        {step.labels.map((l) => (
          <span key={l} className={"label " + labelTone(l)}>
            {l}
          </span>
        ))}
      </div>
      <p className="step-line">
        <span className="step-k">claimed</span> <span className="mono">{step.claimedText}</span>
      </p>
      <p className="step-line">
        <span className="step-k">witnessed</span> <span className="mono">{step.witnessedText}</span>
      </p>
      {step.note && <p className="step-note">{step.note}</p>}
    </li>
  );
}

function ArtifactItem({ artifact }: { artifact: DetailArtifact }): JSX.Element {
  return (
    <li className="artifact">
      <span className="mono artifact-path">{artifact.path}</span>
      {artifact.role && <span className="artifact-role">{artifact.role}</span>}
      {artifact.trustBoundary && <span className="chip">{artifact.trustBoundary}</span>}
      <span className={artifact.present ? "artifact-present" : "artifact-missing"}>
        {artifact.present ? "present" : "missing"}
      </span>
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
