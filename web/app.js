/* Lyhna Witness — demo page logic. Vanilla JS, no deps, no build step.
   Renders the EXACT committed receipt from window.LYHNA_HANDOFF
   (generated from examples/hermes-zapier/handoff.json). It never invents data.

   Determinism: nothing time-based is written to disk. setTimeout is used only for
   runtime animation pacing; it does not affect any committed output. */

(function () {
  "use strict";

  var H = window.LYHNA_HANDOFF;

  // ---- label → chip/meaning mapping (single source of truth) ----
  // Order matters: the strongest/most-actionable label wins for the chip.
  function labelFor(labels) {
    var set = labels || [];
    function has(l) { return set.indexOf(l) !== -1; }

    if (has("UNSUPPORTED") || has("DO_NOT_SEND")) {
      return { cls: "chip-bad", text: "DO NOT SEND — claimed but not witnessed" };
    }
    if (has("CLAIMED_ACTUAL_MISMATCH")) {
      return { cls: "chip-warn", text: "MISMATCH — different route than claimed" };
    }
    if (has("NEEDS_HUMAN_APPROVAL")) {
      return { cls: "chip-info", text: "Needs human approval" };
    }
    if (has("SUPPORTED")) {
      return { cls: "chip-ok", text: "OK — witnessed" };
    }
    // Fallback: show the raw labels rather than inventing a rosier story.
    return { cls: "chip-info", text: set.join(", ") || "Unlabeled" };
  }

  // ---- describe what actually crossed the wire ----
  function witnessText(w) {
    if (!w) return "No tool call observed";
    // Wrapper route, e.g. zapier → google_docs.create_document
    if (w.wrapper_family && w.app) {
      var via = w.wrapper_family + " → " + w.app;
      var act = w.action ? "." + w.action : "";
      return "Routed through " + via + act;
    }
    var sys = w.system || "(unknown system)";
    var action = w.action ? " " + w.action : "";
    var res = w.result ? " (" + w.result + ")" : "";
    return "Direct: " + sys + action + res;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function show(node) {
    node.hidden = false;
    // Force reflow so the .show transition runs.
    void node.offsetWidth;
    node.classList.add("show");
  }

  // ---- build one step card (lines start hidden, revealed by the animation) ----
  function buildStepCard(step) {
    var card = el("li", "step");

    card.appendChild(el("div", "step-index", "Step " + (step.index + 1)));

    var claim = step.claimed || {};
    var claimLine = el("div", "line line-claim");
    claimLine.appendChild(el("span", "line-tag", "Agent"));
    claimLine.appendChild(
      el(
        "span",
        "line-body",
        "Agent claim: " + (claim.action || "?") + " in " + (claim.system || "?")
      )
    );
    card.appendChild(claimLine);

    var witnessLine = el("div", "line line-witness");
    witnessLine.appendChild(el("span", "line-tag", "Witness"));
    witnessLine.appendChild(el("span", "line-body", witnessText(step.witnessed)));
    card.appendChild(witnessLine);

    var labelLine = el("div", "line line-label");
    labelLine.appendChild(el("span", "line-tag", "Label"));
    var lab = labelFor(step.labels);
    var chip = el("span", "chip " + lab.cls, lab.text);
    labelLine.appendChild(chip);
    card.appendChild(labelLine);

    return { card: card, lines: [claimLine, witnessLine, labelLine] };
  }

  // ---- capsule ("Client-Ready AI Work Receipt") ----
  function renderCapsule() {
    var safe = H.safe_to_continue === true;

    var statusEl = document.getElementById("capsule-status");
    statusEl.textContent = safe ? "Safe to continue" : "Needs Review / DO NOT SEND";
    // Reset before re-applying so a re-run ("Re-run Witness Capsule") never stacks classes.
    statusEl.classList.remove("safe", "danger");
    statusEl.classList.add(safe ? "safe" : "danger");

    document.getElementById("cap-systems").textContent =
      (H.systems_touched || []).join(", ") || "(none)";

    // One line per unsupported/mismatch step — print the human_note verbatim. Clear first so a
    // re-run does not append the same flags again and overstate what the receipt proves.
    var flags = document.getElementById("cap-flags");
    flags.innerHTML = "";
    var flagged = (H.steps || []).filter(function (s) {
      var l = s.labels || [];
      return (
        l.indexOf("UNSUPPORTED") !== -1 ||
        l.indexOf("DO_NOT_SEND") !== -1 ||
        l.indexOf("CLAIMED_ACTUAL_MISMATCH") !== -1
      );
    });
    if (flagged.length === 0) {
      flags.appendChild(el("li", null, "No mismatches or unsupported steps."));
    } else {
      flagged.forEach(function (s) {
        var li = el("li");
        var sys = (s.claimed && s.claimed.system) || "step " + (s.index + 1);
        li.appendChild(el("span", "flag-system", sys + ": "));
        li.appendChild(document.createTextNode(" " + (s.human_note || "")));
        flags.appendChild(li);
      });
    }

    var safeEl = document.getElementById("cap-safe");
    safeEl.textContent = safe ? "Yes" : "No";
    safeEl.className = safe ? "tag-yes" : "tag-no";

    document.getElementById("cap-next").textContent =
      (H.next_actions && H.next_actions[0]) || "(none)";
  }

  // ---- plain-text capsule for the clipboard ----
  function capsuleText() {
    var safe = H.safe_to_continue === true;
    var lines = [];
    lines.push("Lyhna Witness — Client-Ready AI Work Receipt");
    lines.push("Demo workflow. Simulated tools. Real Lyhna receipt rules.");
    lines.push("");
    lines.push("Objective: " + (H.objective || ""));
    lines.push("Status: " + (safe ? "Safe to continue" : "Needs Review / DO NOT SEND"));
    lines.push("Systems touched: " + (H.systems_touched || []).join(", "));
    lines.push("");
    lines.push("Steps:");
    (H.steps || []).forEach(function (s) {
      var lab = labelFor(s.labels);
      var claim = s.claimed || {};
      lines.push(
        "  " +
          (s.index + 1) +
          ". claim: " +
          (claim.action || "?") +
          " in " +
          (claim.system || "?")
      );
      lines.push("     witness: " + witnessText(s.witnessed));
      lines.push("     label: " + lab.text + "  [" + (s.labels || []).join(", ") + "]");
    });
    lines.push("");
    var flagged = (H.steps || []).filter(function (s) {
      var l = s.labels || [];
      return (
        l.indexOf("UNSUPPORTED") !== -1 ||
        l.indexOf("DO_NOT_SEND") !== -1 ||
        l.indexOf("CLAIMED_ACTUAL_MISMATCH") !== -1
      );
    });
    if (flagged.length) {
      lines.push("Flagged:");
      flagged.forEach(function (s) {
        lines.push("  - " + (s.human_note || ""));
      });
      lines.push("");
    }
    lines.push("Safe to send: " + (safe ? "Yes" : "No"));
    lines.push("Next action: " + ((H.next_actions && H.next_actions[0]) || "(none)"));
    lines.push("");
    lines.push("What Lyhna can say:");
    lines.push("  - This tool call was witnessed.");
    lines.push("  - This claim matched the witnessed action.");
    lines.push("  - This claim had no witnessed evidence.");
    lines.push("  - This route differed from what the agent claimed.");
    lines.push("  - This handoff is safe / not safe to continue.");
    lines.push("");
    lines.push("What Lyhna cannot say:");
    lines.push("  - The client read the email.");
    lines.push("  - The document is business/legally correct.");
    lines.push("  - Every sentence the agent wrote is true.");
    lines.push("  - Anything that happened outside the observed workflow.");
    return lines.join("\n");
  }

  // ---- the run animation: ~1.5s total, three beats per step ----
  function runDemo() {
    var btn = document.getElementById("run-btn");
    btn.disabled = true;
    btn.textContent = "Witnessing…";

    // Objective + run sections.
    document.getElementById("objective-text").textContent = H.objective || "";
    show(document.getElementById("objective"));

    var stepsList = document.getElementById("steps");
    stepsList.innerHTML = "";
    show(document.getElementById("run"));

    var steps = H.steps || [];
    var built = steps.map(function (s) {
      var b = buildStepCard(s);
      stepsList.appendChild(b.card);
      return b;
    });

    // Pace the reveal. Keep the whole thing quick (~1.5s).
    var reduce =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var perStep = reduce ? 0 : 360;
    var perLine = reduce ? 0 : 110;

    var t = 0;
    built.forEach(function (b) {
      setTimeout(function () { show(b.card); }, t);
      b.lines.forEach(function (line, i) {
        setTimeout(function () { show(line); }, t + (i + 1) * perLine);
      });
      t += perStep + b.lines.length * perLine;
    });

    setTimeout(function () {
      renderCapsule();
      show(document.getElementById("capsule"));
      btn.textContent = "Re-run Witness Capsule";
      btn.disabled = false;
    }, t + (reduce ? 0 : 80));
  }

  // ---- copy receipt ----
  function copyReceipt() {
    var status = document.getElementById("copy-status");
    var text = capsuleText();

    function done() { status.textContent = "Copied. Paste it into your AI."; }
    function fail() { status.textContent = "Copy failed — select the receipt manually."; }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () {
        legacyCopy(text) ? done() : fail();
      });
    } else {
      legacyCopy(text) ? done() : fail();
    }
  }

  function legacyCopy(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  // ---- wire up ----
  function init() {
    if (!H) {
      var btn = document.getElementById("run-btn");
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Data missing — run `node web/build-data.mjs`";
      }
      return;
    }
    document.getElementById("run-btn").addEventListener("click", runDemo);
    document.getElementById("copy-btn").addEventListener("click", copyReceipt);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
