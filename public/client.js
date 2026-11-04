const socket = io();
const REACTION_EMOJIS = ["😂", "🤔", "👀", "🤡"];

// ---------- Remember who you are, so a refresh puts you back in your room ----------

function readStorage(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeStorage(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* storage blocked, game still works */ }
}

let playerId = readStorage("imposter-player-id");
if (!playerId) {
  playerId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  writeStorage("imposter-player-id", playerId);
}

let state = null;
let timerInterval = null;

// ---------- Elements ----------

const element = (id) => document.getElementById(id);
const homeScreen = element("home-screen");
const lobbyScreen = element("lobby-screen");
const gameScreen = element("game-screen");
const errorBox = element("error-box");
const nameInput = element("name-input");
const codeInput = element("code-input");
const chatInput = element("chat-input");
const chatSend = element("chat-send");
const messagesList = element("messages");

nameInput.value = readStorage("imposter-name") || "";
const roomFromLink = new URLSearchParams(location.search).get("room");
if (roomFromLink) codeInput.value = roomFromLink.toUpperCase();

// ---------- Small helpers ----------

function showError(text) {
  errorBox.textContent = text;
  errorBox.classList.remove("hidden");
  clearTimeout(showError.timeout);
  showError.timeout = setTimeout(() => errorBox.classList.add("hidden"), 4000);
}

function showScreen(screen) {
  for (const otherScreen of [homeScreen, lobbyScreen, gameScreen]) {
    otherScreen.classList.toggle("hidden", otherScreen !== screen);
  }
  element("leave-button").classList.toggle("hidden", screen === homeScreen);
}

function playerName(id) {
  return state.players.find((player) => player.id === id)?.name || "Someone";
}

function getName() {
  const name = nameInput.value.trim();
  if (!name) {
    showError("Please enter a nickname first.");
    nameInput.focus();
    return null;
  }
  writeStorage("imposter-name", name);
  return name;
}

// ---------- Buttons ----------

element("create-button").onclick = () => {
  const name = getName();
  if (name) socket.emit("createRoom", { playerId, name });
};

element("join-button").onclick = () => {
  const name = getName();
  const roomCode = codeInput.value.trim().toUpperCase();
  if (!name) return;
  if (roomCode.length !== 4) return showError("Room codes have 4 letters.");
  socket.emit("joinRoom", { roomCode, playerId, name });
};
codeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") element("join-button").click();
});

element("start-button").onclick = () => socket.emit("startGame");
element("play-again-button").onclick = () => socket.emit("playAgain");

element("leave-button").onclick = () => {
  if (!confirm("Leave this room?")) return;
  socket.emit("leaveRoom");
};

element("copy-link-button").onclick = async () => {
  const link = `${location.origin}/?room=${state.roomCode}`;
  try {
    await navigator.clipboard.writeText(link);
    element("copy-link-button").textContent = "Copied!";
  } catch {
    prompt("Copy this link:", link);
  }
  setTimeout(() => (element("copy-link-button").textContent = "Copy invite link"), 2000);
};

element("chat-form").onsubmit = (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  socket.emit("sendMessage", text);
  chatInput.value = "";
};

// Vote and reaction buttons are created on every render, so listen on the parent.
element("game-players").onclick = (event) => {
  const button = event.target.closest(".vote-button");
  if (button) socket.emit("vote", button.dataset.playerId);
};
messagesList.onclick = (event) => {
  const button = event.target.closest(".reaction-button");
  if (button) socket.emit("react", { messageId: Number(button.dataset.messageId), emoji: button.dataset.emoji });
};

// ---------- Socket events ----------

socket.on("connect", () => {
  // Rejoin after a refresh or a dropped connection
  const savedRoom = readStorage("imposter-room");
  const savedName = readStorage("imposter-name");
  if (savedRoom && savedName) socket.emit("joinRoom", { roomCode: savedRoom, playerId, name: savedName });
});

socket.on("errorMessage", (text) => {
  // A saved room that no longer exists: quietly forget it
  if (!state && readStorage("imposter-room")) {
    writeStorage("imposter-room", null);
    if (text.startsWith("Room not found")) return;
  }
  showError(text);
});

socket.on("leftRoom", () => {
  state = null;
  writeStorage("imposter-room", null);
  clearInterval(timerInterval);
  showScreen(homeScreen);
});

socket.on("state", (newState) => {
  state = newState;
  writeStorage("imposter-room", state.roomCode);
  render();
});

// ---------- Rendering ----------

function render() {
  if (state.phase === "lobby") renderLobby();
  else renderGame();
}

function renderLobby() {
  showScreen(lobbyScreen);
  const isHost = state.hostId === state.yourId;
  element("lobby-code").textContent = state.roomCode;
  element("lobby-count").textContent = `${state.players.length}/10`;

  const list = element("lobby-players");
  list.replaceChildren();
  for (const player of state.players) {
    const item = document.createElement("li");
    const name = document.createElement("span");
    name.className = "player-name";
    name.textContent = player.name + (player.id === state.yourId ? " (you)" : "");
    const tags = document.createElement("span");
    tags.className = "player-tags";
    tags.textContent = [player.id === state.hostId ? "👑 host" : "", player.score ? `⭐ ${player.score}` : ""]
      .filter(Boolean)
      .join("  ");
    item.append(name, tags);
    list.append(item);
  }

  const enoughPlayers = state.players.length >= 3;
  element("start-button").classList.toggle("hidden", !isHost);
  element("start-button").disabled = !enoughPlayers;
  element("lobby-hint").textContent = !enoughPlayers
    ? "Need at least 3 players. Share the code with your friends!"
    : isHost
      ? "Everyone here? Hit start!"
      : `Waiting for ${playerName(state.hostId)} to start...`;
}

function renderGame() {
  showScreen(gameScreen);
  const me = state.players.find((player) => player.id === state.yourId);
  const isMyTurn = state.currentSpeakerId === state.yourId;

  element("secret-word").textContent = state.yourWord;

  // Phase label and chat box behaviour
  let phaseText = "";
  let placeholder = "Say something...";
  let canType = true;
  if (state.phase === "clues") {
    phaseText = isMyTurn ? "Your turn to give a clue!" : `${playerName(state.currentSpeakerId)} is thinking...`;
    placeholder = isMyTurn ? "Describe your word (be funny, not obvious!)" : "Wait for your turn...";
    canType = isMyTurn;
  } else if (state.phase === "voting") {
    phaseText = me.alive ? (state.yourVote ? "Vote locked in. Waiting..." : "Vote for the imposter!") : "You're a ghost 👻";
    placeholder = me.alive ? "Argue your case..." : "Haunt them with a message...";
  } else if (state.phase === "reveal") {
    phaseText = "The votes are in...";
  } else if (state.phase === "gameover") {
    phaseText = "Game over!";
  }
  element("phase-label").textContent = `Round ${state.round} · ${phaseText}`;
  chatInput.disabled = !canType;
  chatSend.disabled = !canType;
  chatInput.placeholder = placeholder;
  if (isMyTurn) chatInput.focus();

  renderTimer();
  renderMessages();
  renderGamePlayers(me);
  renderGameOver();
}

function renderTimer() {
  clearInterval(timerInterval);
  const timer = element("timer");
  if (!state.deadline || state.phase === "reveal") {
    timer.textContent = "";
    return;
  }
  const update = () => {
    const secondsLeft = Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000));
    timer.textContent = `${secondsLeft}s`;
    timer.classList.toggle("low", secondsLeft <= 10);
  };
  update();
  timerInterval = setInterval(update, 250);
}

function renderMessages() {
  const nearBottom = messagesList.scrollHeight - messagesList.scrollTop - messagesList.clientHeight < 60;
  messagesList.replaceChildren();

  for (const message of state.messages) {
    const item = document.createElement("li");
    item.className = message.type;

    if (message.type === "system") {
      item.textContent = message.text;
    } else {
      const author = document.createElement("span");
      author.className = "message-author";
      author.textContent = message.playerName;
      item.append(author);
      if (message.type === "clue") {
        const badge = document.createElement("span");
        badge.className = "clue-badge";
        badge.textContent = "CLUE ";
        item.append(badge);
      }
      item.append(document.createTextNode(message.text));

      const reactions = document.createElement("div");
      reactions.className = "reactions";
      for (const emoji of REACTION_EMOJIS) {
        const reactors = message.reactions[emoji] || [];
        const button = document.createElement("button");
        button.className = "reaction-button" + (reactors.includes(state.yourId) ? " mine" : "");
        button.dataset.messageId = message.id;
        button.dataset.emoji = emoji;
        button.textContent = reactors.length ? `${emoji} ${reactors.length}` : emoji;
        reactions.append(button);
      }
      item.append(reactions);
    }
    messagesList.append(item);
  }

  if (nearBottom) messagesList.scrollTop = messagesList.scrollHeight;
}

function renderGamePlayers(me) {
  const list = element("game-players");
  list.replaceChildren();
  const canVote = state.phase === "voting" && me.alive;
  const imposterId = state.reveal?.imposterId;

  element("side-title").textContent = state.phase === "gameover" ? "Scoreboard" : "Players";
  const players = state.phase === "gameover" ? [...state.players].sort((a, b) => b.score - a.score) : state.players;

  for (const player of players) {
    const item = document.createElement("li");
    item.classList.toggle("dead", !player.alive && state.phase !== "gameover");
    item.classList.toggle("offline", !player.connected);
    item.classList.toggle("speaking", player.id === state.currentSpeakerId);
    item.classList.toggle("voted-by-you", player.id === state.yourVote);
    item.classList.toggle("imposter", player.id === imposterId);

    const name = document.createElement("span");
    name.className = "player-name";
    name.textContent = player.name + (player.id === state.yourId ? " (you)" : "");

    const tags = document.createElement("span");
    tags.className = "player-tags";
    const tagParts = [];
    if (player.id === imposterId) tagParts.push("😈 imposter");
    if (state.phase === "voting" && player.hasVoted) tagParts.push("✅ voted");
    if (!player.alive && state.phase !== "gameover") tagParts.push("👻");
    tagParts.push(`⭐ ${player.score}`);
    tags.textContent = tagParts.join("  ");

    item.append(name, tags);
    if (canVote && player.alive && player.id !== state.yourId) {
      const voteButton = document.createElement("button");
      voteButton.className = "vote-button primary";
      voteButton.dataset.playerId = player.id;
      voteButton.textContent = player.id === state.yourVote ? "Voted" : "Vote";
      item.append(voteButton);
    }
    list.append(item);
  }
}

function renderGameOver() {
  const box = element("gameover-box");
  box.classList.toggle("hidden", state.phase !== "gameover");
  if (state.phase !== "gameover") return;

  const isHost = state.hostId === state.yourId;
  const { winner, civilianWord, imposterWord, imposterId } = state.reveal;
  element("winner-text").textContent = winner === "imposter" ? "😈 The imposter wins!" : "🎉 The players win!";
  element("words-text").textContent =
    `Players had "${civilianWord}". ${playerName(imposterId)} (the imposter) had "${imposterWord}".`;
  element("play-again-button").classList.toggle("hidden", !isHost);
  element("play-again-hint").textContent = isHost ? "" : `Waiting for ${playerName(state.hostId)} to start a new game...`;
}
