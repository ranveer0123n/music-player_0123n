/* =========================================================
   Sonify — vanilla JS music player
   Storage keys are namespaced per user.
   ========================================================= */

/* ---------- Firebase ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyBBQk1wz6_ItAmKh1ey44lmrH9fB_I_2as",
  authDomain: "storage-cd101.firebaseapp.com",
  projectId: "storage-cd101",
  storageBucket: "storage-cd101.appspot.com",
  messagingSenderId: "92051542299",
  appId: "1:92051542299:web:4fb73771df5a5164e2c3be",
  measurementId: "G-3N00MV0B68"
};
firebase.initializeApp(firebaseConfig);
const fbStorage = firebase.storage();
const fbDb = firebase.firestore();

/* ---------- Song catalog ---------- */
const songs = [
  { title: "Midnight Drive",   artist: "Imagine Dragons",   src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", cover: "https://picsum.photos/seed/believer/300/300" },
  { title: "Shape of You",     artist: "Ed Sheeran",        src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", cover: "https://picsum.photos/seed/shape/300/300" },
  { title: "Neon Lights",      artist: "The Weeknd",        src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", cover: "https://picsum.photos/seed/neon/300/300" },
  { title: "Sunset Boulevard", artist: "Dua Lipa",          src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3", cover: "https://picsum.photos/seed/sunset/300/300" },
  { title: "Ocean Eyes",       artist: "Billie Eilish",     src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3", cover: "https://picsum.photos/seed/ocean/300/300" },
  { title: "Levitating",       artist: "Dua Lipa",          src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3", cover: "https://picsum.photos/seed/levitate/300/300" },
  { title: "Blinding Lights",  artist: "The Weeknd",        src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3", cover: "https://picsum.photos/seed/blinding/300/300" },
  { title: "Bad Habits",       artist: "Ed Sheeran",        src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3", cover: "https://picsum.photos/seed/badhabits/300/300" },
  { title: "Believer",         artist: "Imagine Dragons",   src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3", cover: "https://picsum.photos/seed/believer2/300/300" },
  { title: "Lost Sky",         artist: "NCS Originals",     src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3", cover: "https://picsum.photos/seed/lostsky/300/300" },
];
const builtInCount = songs.length;

/* ---------- State ---------- */
const audio = new Audio();
let currentIndex = -1;
let queue = songs.map((_, i) => i); // indices currently playable
let isShuffle = false;
let isRepeat = false;
let currentUser = null;
let store = { playlists: {}, favorites: [], recent: [] };
let currentView = "home";
let activePlaylist = null;

/* ---------- Persistence helpers ---------- */
const USERS_KEY = "sonify_users";
const SESSION_KEY = "sonify_session";
const userKey = (u) => `sonify_data_${u}`;

function loadUsers() { return JSON.parse(localStorage.getItem(USERS_KEY) || "{}"); }
function saveUsers(u) { localStorage.setItem(USERS_KEY, JSON.stringify(u)); }
function loadStore(u) {
  return JSON.parse(localStorage.getItem(userKey(u)) || '{"playlists":{},"favorites":[],"recent":[]}');
}
function saveStore() { localStorage.setItem(userKey(currentUser), JSON.stringify(store)); }

/* ============ AUTH ============ */
const authScreen = document.getElementById("auth-screen");
const app = document.getElementById("app");
const authForm = document.getElementById("auth-form");
const authToggle = document.getElementById("auth-toggle");
const authToggleText = document.getElementById("auth-toggle-text");
const authTitle = document.getElementById("auth-title");
const authSubmit = document.getElementById("auth-submit");
const authError = document.getElementById("auth-error");
let authMode = "login";

authToggle.addEventListener("click", (e) => {
  e.preventDefault();
  authMode = authMode === "login" ? "signup" : "login";
  authTitle.textContent = authMode === "login" ? "Log in" : "Sign up";
  authSubmit.textContent = authMode === "login" ? "Log in" : "Sign up";
  authToggleText.textContent = authMode === "login" ? "Don't have an account?" : "Already have an account?";
  authToggle.textContent = authMode === "login" ? "Sign up" : "Log in";
  authError.textContent = "";
});

authForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const username = document.getElementById("auth-username").value.trim();
  const password = document.getElementById("auth-password").value;
  if (!username || !password) return;
  const users = loadUsers();
  if (authMode === "signup") {
    if (users[username]) return (authError.textContent = "User already exists");
    users[username] = password;
    saveUsers(users);
    login(username);
  } else {
    if (users[username] !== password) return (authError.textContent = "Invalid credentials");
    login(username);
  }
});

function login(username) {
  currentUser = username;
  localStorage.setItem(SESSION_KEY, username);
  store = loadStore(username);
  authScreen.classList.add("hidden");
  app.classList.remove("hidden");
  document.getElementById("user-badge").textContent = `👤 ${username}`;
  renderPlaylists();
  setView("home");
}

document.getElementById("logout-btn").addEventListener("click", () => {
  localStorage.removeItem(SESSION_KEY);
  currentUser = null;
  audio.pause();
  app.classList.add("hidden");
  authScreen.classList.remove("hidden");
  authForm.reset();
});

/* Auto-login if session exists */
const savedSession = localStorage.getItem(SESSION_KEY);
if (savedSession && loadUsers()[savedSession]) login(savedSession);

/* ============ VIEWS ============ */
const viewEl = document.getElementById("view");
const searchInput = document.getElementById("search-input");

document.querySelectorAll(".nav-item[data-view]").forEach((btn) => {
  btn.addEventListener("click", () => {
    activePlaylist = null;
    setView(btn.dataset.view);
  });
});

function setView(view) {
  currentView = view;
  document.querySelectorAll(".nav-item").forEach((n) =>
    n.classList.toggle("active", n.dataset.view === view && !activePlaylist)
  );
  render();
}

function render() {
  if (activePlaylist) return renderPlaylistView(activePlaylist);
  switch (currentView) {
    case "home": return renderHome();
    case "search": return renderSearch();
    case "library": return renderLibrary();
    case "liked": return renderLiked();
    case "recent": return renderRecent();
  }
}

/* Home — grid of all songs as cards */
function renderHome() {
  viewEl.innerHTML = `
    <h1>Good evening, ${currentUser}</h1>
    <p class="view-sub">Pick a track to start listening</p>
    <div class="grid">
      ${songs.map((s, i) => songCard(s, i)).join("")}
    </div>`;
  attachCardHandlers();
}

function songCard(s, i) {
  return `
    <div class="card" data-idx="${i}">
      <img src="${s.cover}" alt="${s.title}" loading="lazy"/>
      <button class="play-fab">▶</button>
      <div class="card-title">${s.title}</div>
      <div class="card-artist">${s.artist}</div>
    </div>`;
}

function attachCardHandlers() {
  viewEl.querySelectorAll(".card").forEach((c) => {
    c.addEventListener("click", () => {
      queue = songs.map((_, i) => i);
      playSong(+c.dataset.idx);
    });
  });
}

/* Search — live filtered list */
function renderSearch() {
  const q = searchInput.value.trim().toLowerCase();
  const matches = songs
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !q || s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q));
  viewEl.innerHTML = `
    <h1>Search</h1>
    <p class="view-sub">${q ? `Results for "${q}"` : "Type above to search"}</p>
    ${matches.length ? renderSongList(matches.map((m) => m.i)) : '<p class="empty">No matches</p>'}`;
  attachRowHandlers(matches.map((m) => m.i));
}

searchInput.addEventListener("input", () => {
  if (currentView !== "search") setView("search");
  else renderSearch();
});

/* Library */
function renderLibrary() {
  const names = Object.keys(store.playlists);
  viewEl.innerHTML = `
    <h1>Your Library</h1>
    <p class="view-sub">${names.length} playlist(s)</p>
    <div class="grid">
      <div class="card" id="create-card" style="display:grid;place-items:center;min-height:220px">
        <div style="text-align:center"><div style="font-size:42px">＋</div><div class="card-title">Create playlist</div></div>
      </div>
      ${names.map(n => `
        <div class="card" data-playlist="${n}">
          <img src="https://picsum.photos/seed/${encodeURIComponent(n)}/300/300" alt=""/>
          <div class="card-title">${n}</div>
          <div class="card-artist">${store.playlists[n].length} song(s)</div>
        </div>`).join("")}
    </div>`;
  document.getElementById("create-card").addEventListener("click", promptNewPlaylist);
  viewEl.querySelectorAll("[data-playlist]").forEach((c) => {
    c.addEventListener("click", () => openPlaylist(c.dataset.playlist));
  });
}

/* Liked */
function renderLiked() {
  viewEl.innerHTML = `
    <h1>❤️ Liked Songs</h1>
    <p class="view-sub">${store.favorites.length} song(s)</p>
    ${store.favorites.length ? renderSongList(store.favorites) : '<p class="empty">No liked songs yet</p>'}`;
  attachRowHandlers(store.favorites);
}

/* Recently played */
function renderRecent() {
  viewEl.innerHTML = `
    <h1>🕓 Recently Played</h1>
    <p class="view-sub">${store.recent.length} song(s)</p>
    ${store.recent.length ? renderSongList(store.recent) : '<p class="empty">Nothing here yet — play something!</p>'}`;
  attachRowHandlers(store.recent);
}

/* Playlist detail view */
function renderPlaylistView(name) {
  const ids = store.playlists[name] || [];
  viewEl.innerHTML = `
    <h1>${name}</h1>
    <p class="view-sub">${ids.length} song(s)</p>
    ${ids.length ? renderSongList(ids, true) : '<p class="empty">Add songs from Home or Search</p>'}`;
  attachRowHandlers(ids, name);
}

/* Shared song list renderer.
   showRemove: show ✕ to remove from the current playlist. */
function renderSongList(ids, showRemove = false) {
  return `<div class="song-list">${ids
    .map((id, i) => {
      const s = songs[id];
      if (!s) return "";
      const liked = store.favorites.includes(id) ? "liked" : "";
      const playing = id === currentIndex ? "playing" : "";
      return `
        <div class="song-row ${playing}" data-id="${id}">
          <div class="idx">${i + 1}</div>
          <img src="${s.cover}" alt=""/>
          <div>
            <div class="song-meta-title">${s.title}</div>
            <div class="song-meta-artist">${s.artist}</div>
          </div>
          <button class="like ${liked}" data-action="like">${liked ? "♥" : "♡"}</button>
          <button class="${showRemove ? "add-btn" : "add-btn"}" data-action="${showRemove ? "remove" : "add"}">${showRemove ? "✕" : "＋"}</button>
        </div>`;
    })
    .join("")}</div>`;
}

function attachRowHandlers(ids, playlistName = null) {
  viewEl.querySelectorAll(".song-row").forEach((row) => {
    const id = +row.dataset.id;
    row.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      queue = ids.slice();
      playSong(id);
    });
    row.querySelector('[data-action="like"]').addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavorite(id);
      render();
    });
    const addBtn = row.querySelector('[data-action="add"]');
    if (addBtn) addBtn.addEventListener("click", (e) => { e.stopPropagation(); openAddToPlaylist(id); });
    const removeBtn = row.querySelector('[data-action="remove"]');
    if (removeBtn) removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      store.playlists[playlistName] = store.playlists[playlistName].filter((x) => x !== id);
      saveStore();
      render();
    });
  });
}

/* ============ PLAYBACK ============ */
const playerCover  = document.getElementById("player-cover");
const playerTitle  = document.getElementById("player-title");
const playerArtist = document.getElementById("player-artist");
const playerLike   = document.getElementById("player-like");
const btnPlay      = document.getElementById("btn-play");
const btnNext      = document.getElementById("btn-next");
const btnPrev      = document.getElementById("btn-prev");
const btnShuffle   = document.getElementById("btn-shuffle");
const btnRepeat    = document.getElementById("btn-repeat");
const progress     = document.getElementById("progress");
const timeCurrent  = document.getElementById("time-current");
const timeTotal    = document.getElementById("time-total");
const volume       = document.getElementById("volume");

audio.volume = 0.8;

function playSong(index) {
  const s = songs[index];
  if (!s) return;
  currentIndex = index;
  audio.src = s.src;
  audio.play().catch(() => {});
  playerCover.src  = s.cover;
  playerTitle.textContent  = s.title;
  playerArtist.textContent = s.artist;
  playerLike.textContent   = store.favorites.includes(index) ? "♥" : "♡";
  playerLike.classList.toggle("liked", store.favorites.includes(index));
  btnPlay.textContent = "⏸";
  addToRecent(index);
  render();
}

function addToRecent(id) {
  store.recent = [id, ...store.recent.filter((x) => x !== id)].slice(0, 20);
  saveStore();
}

btnPlay.addEventListener("click", () => {
  if (currentIndex === -1) return playSong(queue[0] ?? 0);
  if (audio.paused) { audio.play(); btnPlay.textContent = "⏸"; }
  else { audio.pause(); btnPlay.textContent = "▶"; }
});

function step(dir) {
  if (currentIndex === -1) return playSong(queue[0] ?? 0);
  let pos = queue.indexOf(currentIndex);
  if (isShuffle) pos = Math.floor(Math.random() * queue.length);
  else pos = (pos + dir + queue.length) % queue.length;
  playSong(queue[pos]);
}
btnNext.addEventListener("click", () => step(1));
btnPrev.addEventListener("click", () => step(-1));

btnShuffle.addEventListener("click", () => {
  isShuffle = !isShuffle;
  btnShuffle.classList.toggle("active", isShuffle);
});
btnRepeat.addEventListener("click", () => {
  isRepeat = !isRepeat;
  btnRepeat.classList.toggle("active", isRepeat);
});

audio.addEventListener("ended", () => {
  if (isRepeat) { audio.currentTime = 0; audio.play(); }
  else step(1);
});

audio.addEventListener("timeupdate", () => {
  if (!audio.duration) return;
  progress.value = (audio.currentTime / audio.duration) * 100;
  timeCurrent.textContent = fmt(audio.currentTime);
  timeTotal.textContent   = fmt(audio.duration);
});
progress.addEventListener("input", () => {
  if (audio.duration) audio.currentTime = (progress.value / 100) * audio.duration;
});
volume.addEventListener("input", () => { audio.volume = +volume.value; });

playerLike.addEventListener("click", () => {
  if (currentIndex === -1) return;
  toggleFavorite(currentIndex);
  const liked = store.favorites.includes(currentIndex);
  playerLike.textContent = liked ? "♥" : "♡";
  playerLike.classList.toggle("liked", liked);
  if (currentView === "liked") render();
});

function fmt(s) {
  s = Math.floor(s || 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/* ============ FAVORITES ============ */
function toggleFavorite(id) {
  if (store.favorites.includes(id)) store.favorites = store.favorites.filter((x) => x !== id);
  else store.favorites.push(id);
  saveStore();
}

/* ============ PLAYLISTS ============ */
document.getElementById("new-playlist-btn").addEventListener("click", promptNewPlaylist);

function promptNewPlaylist() {
  showModal("New playlist", "My playlist", (name) => {
    if (!name || store.playlists[name]) return;
    store.playlists[name] = [];
    saveStore();
    renderPlaylists();
    openPlaylist(name);
  });
}

function renderPlaylists() {
  const ul = document.getElementById("playlist-list");
  ul.innerHTML = Object.keys(store.playlists)
    .map((n) => `<li data-name="${n}">📃 ${n}<button title="Delete">🗑</button></li>`)
    .join("");
  ul.querySelectorAll("li").forEach((li) => {
    li.addEventListener("click", (e) => {
      if (e.target.tagName === "BUTTON") return;
      openPlaylist(li.dataset.name);
    });
    li.querySelector("button").addEventListener("click", (e) => {
      e.stopPropagation();
      delete store.playlists[li.dataset.name];
      saveStore();
      renderPlaylists();
      if (activePlaylist === li.dataset.name) { activePlaylist = null; setView("library"); }
    });
  });
}

function openPlaylist(name) {
  activePlaylist = name;
  document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
  render();
}

function openAddToPlaylist(songId) {
  const names = Object.keys(store.playlists);
  if (!names.length) return promptNewPlaylist();
  showModal("Add to playlist", "", null, names.map((n) => ({
    label: n,
    onClick: () => {
      if (!store.playlists[n].includes(songId)) store.playlists[n].push(songId);
      saveStore();
    }
  })));
}

/* ============ MODAL ============ */
function showModal(title, placeholder, onConfirm, choices = null) {
  const back = document.createElement("div");
  back.className = "modal-backdrop";
  const body = choices
    ? choices.map((c, i) => `<button class="btn-ghost" data-i="${i}" style="display:block;width:100%;text-align:left;padding:10px;border-radius:6px">${c.label}</button>`).join("")
    : `<input id="modal-input" placeholder="${placeholder}" autofocus />`;
  back.innerHTML = `
    <div class="modal">
      <h3>${title}</h3>
      ${body}
      <div class="modal-actions">
        <button class="btn-ghost" id="modal-cancel">Cancel</button>
        ${onConfirm ? '<button class="btn-primary" id="modal-ok">OK</button>' : ""}
      </div>
    </div>`;
  document.body.appendChild(back);
  const close = () => back.remove();
  back.querySelector("#modal-cancel").addEventListener("click", close);
  back.addEventListener("click", (e) => { if (e.target === back) close(); });
  if (onConfirm) {
    const input = back.querySelector("#modal-input");
    input.focus();
    const submit = () => { onConfirm(input.value.trim()); close(); };
    back.querySelector("#modal-ok").addEventListener("click", submit);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  }
  if (choices) {
    back.querySelectorAll("[data-i]").forEach((b) => {
      b.addEventListener("click", () => { choices[+b.dataset.i].onClick(); close(); });
    });
  }
}
