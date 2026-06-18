import { useEffect, useState } from "react";

// Lyhna Desktop — app frame (Slice 1 scaffold).
//
// A real product frame, not marketing fluff: the wordmark, the nav, and an honest Receipt Inbox empty
// state. Real indexed data, receipt detail, install snippets, adapter status, and settings arrive in the
// following slices and render over the same frame + the pure core (../core/inboxView). Copy stays inside
// the honesty ceiling — Lyhna shows what was claimed, witnessed, missing, and what needs review; it never
// claims delivery/correctness, and "review before continuing" is never framed as a hard block.

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
  return (
    <section className="screen">
      <Header />
      <div className="panel">
        <h2 className="panel-title">Receipt inbox</h2>
        <div className="empty">
          <p className="empty-title">No receipt library selected.</p>
          <p className="empty-body">
            Choose a local folder of Work Receipt Capsules and Lyhna Desktop will list them here — newest
            first, each showing what was claimed vs. witnessed and what needs review. Lyhna reads only the
            receipt files on your machine; it doesn’t run your agents.
          </p>
          <button type="button" className="btn-primary" disabled title="Folder selection arrives in the next update">
            Select receipt library…
          </button>
          <p className="empty-note">Folder selection is wired in the next update.</p>
        </div>
      </div>
    </section>
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
