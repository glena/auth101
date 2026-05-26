(function () {
  const deck = document.querySelector("[data-deck]");
  if (!deck) return;

  const deckId = deck.dataset.deck;
  const deckTitle = deck.dataset.title || "Presentation";
  const slides = Array.from(document.querySelectorAll(".slide"));
  const notesData = JSON.parse(document.getElementById("notes-data").textContent || "[]");
  const channelName = `auth101-presenter-${deckId}`;
  const progress = document.querySelector("[data-progress]");
  const counter = document.querySelector("[data-counter]");
  const prevButton = document.querySelector("[data-prev]");
  const nextButton = document.querySelector("[data-next]");
  const notesButton = document.querySelector("[data-notes]");
  const channel = "BroadcastChannel" in window ? new BroadcastChannel(channelName) : null;

  let current = indexFromHash();
  let notesWindow = null;

  function indexFromHash() {
    const value = Number.parseInt(window.location.hash.replace("#", ""), 10);
    if (Number.isFinite(value) && value >= 1 && value <= slides.length) return value - 1;
    return 0;
  }

  function slideTitle(index) {
    const heading = slides[index]?.querySelector("h1, h2, h3");
    return heading ? heading.textContent : `Slide ${index + 1}`;
  }

  function payload() {
    return {
      deckId,
      deckTitle,
      index: current,
      total: slides.length,
      title: slideTitle(current),
      notes: notesData[current] || "",
      nextTitle: current + 1 < slides.length ? slideTitle(current + 1) : "",
      nextNotes: current + 1 < slides.length ? notesData[current + 1] || "" : "",
    };
  }

  function publish() {
    const message = payload();
    if (channel) channel.postMessage(message);
    try {
      localStorage.setItem(channelName, JSON.stringify(message));
    } catch {
      // localStorage can be unavailable in strict browser settings.
    }
    if (notesWindow && !notesWindow.closed && notesWindow.receivePresenterUpdate) {
      notesWindow.receivePresenterUpdate(message);
    }
  }

  function show(index, updateHash = true) {
    current = Math.max(0, Math.min(index, slides.length - 1));
    slides.forEach((slide, slideIndex) => {
      slide.classList.toggle("is-active", slideIndex === current);
      slide.setAttribute("aria-hidden", slideIndex === current ? "false" : "true");
    });
    if (counter) counter.textContent = `${current + 1} / ${slides.length}`;
    if (progress) progress.style.width = `${((current + 1) / slides.length) * 100}%`;
    if (updateHash) history.replaceState(null, "", `#${current + 1}`);
    publish();
  }

  function next() {
    show(current + 1);
  }

  function prev() {
    show(current - 1);
  }

  function notesShell() {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Presenter Notes - ${escapeHtml(deckTitle)}</title>
  <link rel="stylesheet" href="../../assets/presentation.css">
</head>
<body class="notes-shell">
  <header>
    <div>
      <h1 id="deck-title"></h1>
      <div id="slide-count"></div>
    </div>
    <button id="close-notes" type="button">Close</button>
  </header>
  <main>
    <section class="note-card">
      <h2 id="slide-title"></h2>
      <div id="slide-notes"></div>
    </section>
    <section class="note-card">
      <h2 id="next-title"></h2>
      <div id="next-notes"></div>
    </section>
  </main>
  <script>
    const channelName = ${JSON.stringify(channelName)};
    const channel = "BroadcastChannel" in window ? new BroadcastChannel(channelName) : null;
    function render(message) {
      if (!message) return;
      document.getElementById("deck-title").textContent = message.deckTitle;
      document.getElementById("slide-count").textContent = "Slide " + (message.index + 1) + " of " + message.total;
      document.getElementById("slide-title").textContent = message.title;
      document.getElementById("slide-notes").innerHTML = message.notes || "<p>No presenter notes.</p>";
      document.getElementById("next-title").textContent = message.nextTitle ? "Next: " + message.nextTitle : "No next slide";
      document.getElementById("next-notes").innerHTML = message.nextNotes || "<p>No next-slide notes.</p>";
    }
    window.receivePresenterUpdate = render;
    if (channel) channel.onmessage = event => render(event.data);
    window.addEventListener("storage", event => {
      if (event.key === channelName && event.newValue) render(JSON.parse(event.newValue));
    });
    document.getElementById("close-notes").addEventListener("click", () => window.close());
    try {
      const stored = localStorage.getItem(channelName);
      if (stored) render(JSON.parse(stored));
    } catch {}
  </script>
</body>
</html>`;
  }

  function openNotes() {
    notesWindow = window.open("", `${deckId}-presenter-notes`, "popup=yes,width=980,height=760");
    if (!notesWindow) return;
    notesWindow.document.open();
    notesWindow.document.write(notesShell());
    notesWindow.document.close();
    publish();
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (["ArrowRight", "PageDown", " "].includes(event.key)) {
      event.preventDefault();
      next();
    }
    if (["ArrowLeft", "PageUp"].includes(event.key)) {
      event.preventDefault();
      prev();
    }
    if (event.key === "Home") {
      event.preventDefault();
      show(0);
    }
    if (event.key === "End") {
      event.preventDefault();
      show(slides.length - 1);
    }
    if (event.key.toLowerCase() === "n") {
      event.preventDefault();
      openNotes();
    }
  });

  window.addEventListener("hashchange", () => show(indexFromHash(), false));
  prevButton?.addEventListener("click", prev);
  nextButton?.addEventListener("click", next);
  notesButton?.addEventListener("click", openNotes);

  show(current);
})();
