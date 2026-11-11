const socket = io();

// Keep these lists the same as in server.js
const REACTION_EMOJIS = ["😂", "🤔", "👀", "🤡"];
const AVATAR_EMOJIS = [
  "🐷", "🐸", "🐵", "🐔", "🐶", "🐱", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁",
  "🐮", "🐙", "🦄", "🐲", "👽", "🤡", "💩", "👻", "🤖", "🎃", "🥔", "🍑",
];
const STICKERS = [
  "😂", "🤣", "😭", "😱", "🤔", "🧐", "🤨", "😏", "🙄", "😳",
  "🤡", "💀", "👀", "🫠", "😈", "🤥", "🙈", "💩", "🔥", "👍",
];
const AVATAR_COLORS = ["#ffe0e9", "#e0f0ff", "#e6ffe0", "#fff3d6", "#efe0ff", "#d9fbf6", "#ffe8d6"];

// ---------- Text in both languages ----------

const TEXT = {
  en: {
    title: "🕵️ Who is the Imposter?",
    leave: "Leave",
    switchLanguage: "中文",
    intro: "Everyone gets the same secret word, except one sneaky imposter. Give funny clues, then vote out the imposter!",
    pickAvatar: "Pick your avatar",
    uploadPhoto: "📷 Use my photo",
    nickname: "Your nickname",
    nicknamePlaceholder: "e.g. Captain Potato",
    createRoom: "Create a room",
    orJoin: "or join a friend",
    join: "Join",
    roomCode: "Room code",
    copyLink: "Copy invite link",
    copied: "Copied!",
    copyPrompt: "Copy this link:",
    wordLanguage: "Word language",
    startGame: "Start game",
    needThree: "Need at least 3 players. Share the code with your friends!",
    hostStart: "Everyone here? Hit start!",
    waitingHost: (name) => `Waiting for ${name} to start...`,
    yourWord: "Your secret word",
    playAgain: "Play again",
    send: "Send",
    you: "you",
    host: "host",
    round: (number) => `Round ${number}`,
    yourTurn: "Your turn to give a clue!",
    thinking: (name) => `${name} is thinking...`,
    describePlaceholder: "Describe your word (funny, not obvious!)",
    waitPlaceholder: "Wait for your turn... (stickers are OK 😜)",
    voteNow: "Vote for the imposter!",
    voteLocked: "Vote locked in. Waiting...",
    ghost: "You're a ghost 👻",
    arguePlaceholder: "Argue your case...",
    hauntPlaceholder: "Haunt them with a message...",
    chatPlaceholder: "Say something...",
    votesIn: "The votes are in...",
    gameOver: "Game over!",
    vote: "Vote",
    voted: "Voted",
    hasVoted: "✅ voted",
    imposterTag: "😈 imposter",
    leftTag: "left",
    clueTag: "CLUE",
    imposterWinsTitle: "😈 The imposter wins!",
    playersWinTitle: "🎉 The players win!",
    wordsReveal: (civilianWord, imposterName, imposterWord) =>
      `Players had "${civilianWord}". ${imposterName} (the imposter) had "${imposterWord}".`,
    confirmLeave: "Leave this room?",
    photoFailed: "Could not read that photo. Try another one.",
    codeLength: "Room codes have 4 letters.",
    errors: {
      needName: "Please enter a nickname.",
      refresh: "Something went wrong. Refresh the page.",
      alreadyStarted: "This game already started. Wait for the next one!",
      roomFull: "This room is full.",
      nameTaken: "That nickname is taken in this room.",
      roomNotFound: "Room not found. Check the code.",
      needPlayers: ({ min }) => `You need at least ${min} players to start.`,
    },
    system: {
      gameStarted: () => "Game started! Check your secret word. One of you has a different word...",
      roundStart: ({ round }) => `Round ${round}: describe your word in one funny clue. Don't make it too obvious!`,
      votingStart: () => "Time to vote! Who is the imposter? You can chat while you vote.",
      froze: [
        "{name} forgot how words work 😶",
        "{name} stared at the screen in silence",
        "{name} is buffering 🔄",
        "{name} was too busy eating snacks",
      ],
      eliminated: [
        "{name} has been yeeted out of the group chat.",
        "{name} was escorted out by security.",
        "{name} packed their bags and cried a little.",
        "{name} got voted off faster than a bad haircut.",
        "{name} is now a ghost. Spooky.",
        "{name} has left the chat. Nobody waved.",
        "Bye {name}! Don't let the door hit you.",
      ],
      wasImposter: " They WERE the imposter! 🎉",
      wasNotImposter: " They were NOT the imposter. Oops. 😬",
      tie: [
        "It's a tie! Nobody goes home. Everyone is still suspicious.",
        "Tie vote! You all argued and achieved nothing.",
        "Nobody was voted out. The imposter is laughing somewhere.",
      ],
      imposterWins: ({ name }) => `The imposter ${name} fooled everyone! 😈`,
      playersWin: ({ name }) => `The players win! ${name} was the imposter. 🎉`,
    },
  },
  zh: {
    title: "🕵️ 谁是卧底？",
    leave: "离开",
    switchLanguage: "EN",
    intro: "大家拿到同一个词，只有一个卧底的词不一样。轮流用搞笑的话描述你的词，然后投票把卧底找出来！",
    pickAvatar: "选个头像",
    uploadPhoto: "📷 用我的照片",
    nickname: "你的昵称",
    nicknamePlaceholder: "比如：土豆队长",
    createRoom: "创建房间",
    orJoin: "或者加入朋友的房间",
    join: "加入",
    roomCode: "房间号",
    copyLink: "复制邀请链接",
    copied: "已复制！",
    copyPrompt: "复制这个链接：",
    wordLanguage: "词语语言",
    startGame: "开始游戏",
    needThree: "至少需要 3 个人。把房间号发给朋友吧！",
    hostStart: "人齐了吗？点开始！",
    waitingHost: (name) => `等待 ${name} 开始游戏...`,
    yourWord: "你的秘密词",
    playAgain: "再来一局",
    send: "发送",
    you: "你",
    host: "房主",
    round: (number) => `第 ${number} 轮`,
    yourTurn: "轮到你描述了！",
    thinking: (name) => `${name} 正在想...`,
    describePlaceholder: "描述你的词（要搞笑，别太明显！）",
    waitPlaceholder: "等你的回合...（可以发表情 😜）",
    voteNow: "投票找出卧底！",
    voteLocked: "已投票，等其他人...",
    ghost: "你已经变成鬼了 👻",
    arguePlaceholder: "为自己辩护...",
    hauntPlaceholder: "用消息吓唬他们...",
    chatPlaceholder: "说点什么...",
    votesIn: "投票结果出来了...",
    gameOver: "游戏结束！",
    vote: "投票",
    voted: "已投",
    hasVoted: "✅ 已投",
    imposterTag: "😈 卧底",
    leftTag: "已离开",
    clueTag: "描述",
    imposterWinsTitle: "😈 卧底赢了！",
    playersWinTitle: "🎉 平民赢了！",
    wordsReveal: (civilianWord, imposterName, imposterWord) =>
      `平民的词是「${civilianWord}」，卧底 ${imposterName} 的词是「${imposterWord}」。`,
    confirmLeave: "确定离开房间吗？",
    photoFailed: "读不了这张照片，换一张试试。",
    codeLength: "房间号是 4 个字母。",
    errors: {
      needName: "请输入昵称。",
      refresh: "出错了，请刷新页面。",
      alreadyStarted: "游戏已经开始了，等下一局吧！",
      roomFull: "房间满了。",
      nameTaken: "这个昵称已经有人用了。",
      roomNotFound: "找不到房间，检查一下房间号。",
      needPlayers: ({ min }) => `至少需要 ${min} 个人才能开始。`,
    },
    system: {
      gameStarted: () => "游戏开始！看看你的秘密词。你们当中有一个人的词不一样...",
      roundStart: ({ round }) => `第 ${round} 轮：用一句搞笑的话描述你的词，别太明显！`,
      votingStart: () => "投票时间！谁是卧底？投票时可以聊天。",
      froze: [
        "{name} 突然忘了怎么说话 😶",
        "{name} 盯着屏幕发呆",
        "{name} 正在缓冲中 🔄",
        "{name} 忙着吃零食去了",
      ],
      eliminated: [
        "{name} 被踢出了群聊。",
        "{name} 被保安请出去了。",
        "{name} 收拾行李，偷偷哭了一下。",
        "{name} 被淘汰的速度比剪坏的发型还快。",
        "{name} 现在是一只鬼了，好可怕。",
        "{name} 已退出群聊，没人挥手。",
        "拜拜 {name}！慢走不送。",
      ],
      wasImposter: " 正是卧底！🎉",
      wasNotImposter: " 不是卧底，冤枉啊。😬",
      tie: [
        "平票！没人出局，大家都很可疑。",
        "平票！吵了半天什么都没决定。",
        "没人被淘汰，卧底在偷笑。",
      ],
      imposterWins: ({ name }) => `卧底 ${name} 骗过了所有人！😈`,
      playersWin: ({ name }) => `平民赢了！${name} 就是卧底。🎉`,
    },
  },
};

// ---------- Saved settings (so a refresh puts you back in your room) ----------

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

const browserLanguage = (navigator.language || "").toLowerCase().startsWith("zh") ? "zh" : "en";
let language = readStorage("imposter-language") || browserLanguage;
let myAvatar = readStorage("imposter-avatar") || AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)];
let state = null;
let timerInterval = null;

const text = () => TEXT[language];

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
const stickerPanel = element("sticker-panel");

nameInput.value = readStorage("imposter-name") || "";
const roomFromLink = new URLSearchParams(location.search).get("room");
if (roomFromLink) codeInput.value = roomFromLink.toUpperCase();

// ---------- Small helpers ----------

function showError(message) {
  errorBox.textContent = message;
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

function findPlayer(id) {
  return state.players.find((player) => player.id === id);
}

function playerName(id) {
  return findPlayer(id)?.name || "?";
}

// Builds a round avatar: an emoji on a soft color, or a photo.
function createAvatar(avatar, size = "") {
  const circle = document.createElement("div");
  circle.className = `avatar ${size}`;
  if (avatar && avatar.startsWith("data:image/jpeg")) {
    const image = document.createElement("img");
    image.src = avatar;
    image.alt = "";
    circle.append(image);
  } else {
    const emoji = avatar || "👤";
    const colorIndex = [...emoji].reduce((total, character) => total + character.codePointAt(0), 0) % AVATAR_COLORS.length;
    circle.style.background = AVATAR_COLORS[colorIndex];
    circle.textContent = emoji;
  }
  return circle;
}

function getName() {
  const name = nameInput.value.trim();
  if (!name) {
    showError(text().errors.needName);
    nameInput.focus();
    return null;
  }
  writeStorage("imposter-name", name);
  return name;
}

// ---------- Language ----------

function applyLanguage() {
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  document.title = text().title.replace("🕵️ ", "");
  for (const node of document.querySelectorAll("[data-i18n]")) {
    node.textContent = text()[node.dataset.i18n];
  }
  for (const node of document.querySelectorAll("[data-i18n-placeholder]")) {
    node.placeholder = text()[node.dataset.i18nPlaceholder];
  }
  element("language-button").textContent = text().switchLanguage;
  if (state) render();
}

element("language-button").onclick = () => {
  language = language === "en" ? "zh" : "en";
  writeStorage("imposter-language", language);
  applyLanguage();
};

// ---------- Avatar picker ----------

function renderAvatarPicker() {
  element("my-avatar-preview").replaceChildren(createAvatar(myAvatar, "large"));
  const grid = element("avatar-grid");
  grid.replaceChildren();
  for (const emoji of AVATAR_EMOJIS) {
    const button = document.createElement("button");
    button.className = "avatar-choice" + (emoji === myAvatar ? " selected" : "");
    button.textContent = emoji;
    button.onclick = () => setMyAvatar(emoji);
    grid.append(button);
  }
}

function setMyAvatar(avatar) {
  myAvatar = avatar;
  writeStorage("imposter-avatar", avatar);
  renderAvatarPicker();
}

element("upload-button").onclick = () => element("photo-input").click();

// Shrink the photo to a 64x64 square so it is small enough to send to everyone.
element("photo-input").onchange = (event) => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  const image = new Image();
  const objectUrl = URL.createObjectURL(file);
  image.onload = () => {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const side = Math.min(image.width, image.height);
    canvas.getContext("2d").drawImage(
      image,
      (image.width - side) / 2, (image.height - side) / 2, side, side,
      0, 0, size, size
    );
    URL.revokeObjectURL(objectUrl);
    setMyAvatar(canvas.toDataURL("image/jpeg", 0.75));
  };
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    showError(text().photoFailed);
  };
  image.src = objectUrl;
};

// ---------- Buttons ----------

element("create-button").onclick = () => {
  const name = getName();
  if (name) socket.emit("createRoom", { playerId, name, avatar: myAvatar, wordLanguage: language });
};

element("join-button").onclick = () => {
  const name = getName();
  const roomCode = codeInput.value.trim().toUpperCase();
  if (!name) return;
  if (roomCode.length !== 4) return showError(text().codeLength);
  socket.emit("joinRoom", { roomCode, playerId, name, avatar: myAvatar });
};
codeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") element("join-button").click();
});

element("start-button").onclick = () => socket.emit("startGame");
element("play-again-button").onclick = () => socket.emit("playAgain");

for (const button of document.querySelectorAll("[data-word-language]")) {
  button.onclick = () => socket.emit("setWordLanguage", button.dataset.wordLanguage);
}

element("leave-button").onclick = () => {
  if (!confirm(text().confirmLeave)) return;
  socket.emit("leaveRoom");
};

element("copy-link-button").onclick = async () => {
  const link = `${location.origin}/?room=${state.roomCode}`;
  const button = element("copy-link-button");
  try {
    await navigator.clipboard.writeText(link);
    button.textContent = text().copied;
  } catch {
    prompt(text().copyPrompt, link);
  }
  setTimeout(() => (button.textContent = text().copyLink), 2000);
};

element("chat-form").onsubmit = (event) => {
  event.preventDefault();
  const message = chatInput.value.trim();
  if (!message) return;
  socket.emit("sendMessage", message);
  chatInput.value = "";
};

// Sticker panel
for (const sticker of STICKERS) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = sticker;
  button.onclick = () => {
    socket.emit("sendSticker", sticker);
    stickerPanel.classList.add("hidden");
  };
  stickerPanel.append(button);
}
element("sticker-button").onclick = () => stickerPanel.classList.toggle("hidden");

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
  if (savedRoom && savedName) {
    socket.emit("joinRoom", { roomCode: savedRoom, playerId, name: savedName, avatar: myAvatar });
  }
});

socket.on("errorMessage", ({ key, params } = {}) => {
  // A saved room that no longer exists: quietly forget it
  if (!state && readStorage("imposter-room")) {
    writeStorage("imposter-room", null);
    if (key === "roomNotFound") return;
  }
  const message = text().errors[key];
  showError(typeof message === "function" ? message(params || {}) : message || key);
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

  for (const button of document.querySelectorAll("[data-word-language]")) {
    button.classList.toggle("active", button.dataset.wordLanguage === state.wordLanguage);
    button.disabled = !isHost;
  }

  const row = element("lobby-players");
  row.replaceChildren();
  for (const player of state.players) {
    const tag = player.id === state.hostId ? `👑 ${text().host}` : player.score ? `⭐ ${player.score}` : "";
    row.append(createPlayerTile(player, tag));
  }

  const enoughPlayers = state.players.length >= 3;
  element("start-button").classList.toggle("hidden", !isHost);
  element("start-button").disabled = !enoughPlayers;
  element("lobby-hint").textContent = !enoughPlayers
    ? text().needThree
    : isHost
      ? text().hostStart
      : text().waitingHost(playerName(state.hostId));
}

function createPlayerTile(player, tagText) {
  const tile = document.createElement("div");
  tile.className = "player-tile";
  tile.append(createAvatar(player.avatar, "large"));
  const name = document.createElement("div");
  name.className = "player-name";
  name.textContent = player.id === state.yourId ? `${player.name} (${text().you})` : player.name;
  const tag = document.createElement("div");
  tag.className = "player-tag";
  tag.textContent = tagText;
  tile.append(name, tag);
  return tile;
}

function renderGame() {
  showScreen(gameScreen);
  const me = findPlayer(state.yourId);
  const isMyTurn = state.currentSpeakerId === state.yourId;

  element("secret-word").textContent = state.yourWord;

  // Phase label and chat box behaviour
  let phaseText = "";
  let placeholder = text().chatPlaceholder;
  let canType = true;
  if (state.phase === "clues") {
    phaseText = isMyTurn ? text().yourTurn : text().thinking(playerName(state.currentSpeakerId));
    placeholder = isMyTurn ? text().describePlaceholder : text().waitPlaceholder;
    canType = isMyTurn;
  } else if (state.phase === "voting") {
    phaseText = me.alive ? (state.yourVote ? text().voteLocked : text().voteNow) : text().ghost;
    placeholder = me.alive ? text().arguePlaceholder : text().hauntPlaceholder;
  } else if (state.phase === "reveal") {
    phaseText = text().votesIn;
  } else if (state.phase === "gameover") {
    phaseText = text().gameOver;
  }
  element("phase-label").textContent = `${text().round(state.round)} · ${phaseText}`;
  chatInput.disabled = !canType;
  chatSend.disabled = !canType;
  chatInput.placeholder = placeholder;
  if (isMyTurn) chatInput.focus();

  renderTimer();
  renderGamePlayers(me);
  renderMessages();
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

function renderGamePlayers(me) {
  const row = element("game-players");
  row.replaceChildren();
  const canVote = state.phase === "voting" && me.alive;
  const imposterId = state.reveal?.imposterId;

  for (const player of state.players) {
    let tagText = "";
    if (player.id === imposterId) tagText = text().imposterTag;
    else if (!player.connected) tagText = text().leftTag;
    else if (state.phase === "voting" && player.hasVoted) tagText = text().hasVoted;

    const tile = createPlayerTile(player, tagText);
    tile.classList.toggle("dead", !player.alive && state.phase !== "gameover");
    tile.classList.toggle("offline", !player.connected);
    tile.classList.toggle("speaking", player.id === state.currentSpeakerId);
    tile.classList.toggle("voted-by-you", player.id === state.yourVote);
    tile.classList.toggle("imposter", player.id === imposterId);

    if (!player.alive && state.phase !== "gameover") {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "👻";
      tile.append(badge);
    } else if (player.id === state.currentSpeakerId) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "💬";
      tile.append(badge);
    }

    if (canVote && player.alive && player.id !== state.yourId) {
      const voteButton = document.createElement("button");
      voteButton.className = "vote-button primary";
      voteButton.dataset.playerId = player.id;
      voteButton.textContent = player.id === state.yourVote ? text().voted : text().vote;
      tile.append(voteButton);
    }
    row.append(tile);
  }
}

function systemMessageText(message) {
  const lines = text().system;
  const { key, params } = message;
  // Messages with several funny versions pick one by "variant"
  if (Array.isArray(lines[key])) {
    let line = lines[key][params.variant % lines[key].length].replace("{name}", params.name);
    if (key === "eliminated") line += params.wasImposter ? lines.wasImposter : lines.wasNotImposter;
    return line;
  }
  return lines[key] ? lines[key](params) : "";
}

function renderMessages() {
  const nearBottom = messagesList.scrollHeight - messagesList.scrollTop - messagesList.clientHeight < 80;
  messagesList.replaceChildren();

  for (const message of state.messages) {
    const item = document.createElement("li");

    if (message.type === "system") {
      item.className = "system-message" + (message.key === "roundStart" ? " round-divider" : "");
      item.textContent = systemMessageText(message);
      messagesList.append(item);
      continue;
    }

    const isMine = message.playerId === state.yourId;
    const row = document.createElement("div");
    row.className = "message-row" + (isMine ? " mine" : "");
    const sender = findPlayer(message.playerId);
    row.append(createAvatar(sender?.avatar, "small"));

    const body = document.createElement("div");
    body.className = "message-body";
    if (!isMine) {
      const author = document.createElement("div");
      author.className = "message-author";
      author.textContent = message.playerName;
      body.append(author);
    }

    if (message.type === "sticker") {
      const sticker = document.createElement("div");
      sticker.className = "sticker";
      sticker.textContent = message.sticker;
      body.append(sticker);
    } else {
      const bubble = document.createElement("div");
      bubble.className = "bubble";
      if (message.type === "clue") {
        const tag = document.createElement("span");
        tag.className = "clue-tag";
        tag.textContent = text().clueTag;
        bubble.append(tag);
      }
      bubble.append(document.createTextNode(message.text));
      body.append(bubble, createReactions(message));
    }

    row.append(body);
    item.append(row);
    messagesList.append(item);
  }

  if (nearBottom) messagesList.scrollTop = messagesList.scrollHeight;
}

function createReactions(message) {
  const reactions = document.createElement("div");
  reactions.className = "reactions";
  for (const emoji of REACTION_EMOJIS) {
    const reactors = message.reactions[emoji] || [];
    const button = document.createElement("button");
    button.className = "reaction-button";
    if (reactors.includes(state.yourId)) button.classList.add("mine");
    if (!reactors.length) button.classList.add("empty");
    button.dataset.messageId = message.id;
    button.dataset.emoji = emoji;
    button.textContent = reactors.length ? `${emoji} ${reactors.length}` : emoji;
    reactions.append(button);
  }
  return reactions;
}

function renderGameOver() {
  const box = element("gameover-box");
  box.classList.toggle("hidden", state.phase !== "gameover");
  if (state.phase !== "gameover") return;

  const isHost = state.hostId === state.yourId;
  const { winner, civilianWord, imposterWord, imposterId } = state.reveal;
  element("winner-text").textContent = winner === "imposter" ? text().imposterWinsTitle : text().playersWinTitle;
  element("words-text").textContent = text().wordsReveal(civilianWord, playerName(imposterId), imposterWord);

  const scoreboard = element("scoreboard");
  scoreboard.replaceChildren();
  for (const player of [...state.players].sort((first, second) => second.score - first.score)) {
    const item = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = player.name;
    const score = document.createElement("span");
    score.className = "score";
    score.textContent = `⭐ ${player.score}`;
    item.append(createAvatar(player.avatar, "small"), name, score);
    scoreboard.append(item);
  }

  element("play-again-button").classList.toggle("hidden", !isHost);
  element("play-again-hint").textContent = isHost ? "" : text().waitingHost(playerName(state.hostId));
}

// ---------- Start ----------

applyLanguage();
renderAvatarPicker();
