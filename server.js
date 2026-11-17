const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");
const { WORD_PAIRS } = require("./words");

const PORT = process.env.PORT || 3000;
const MIN_PLAYERS = 4;
const MAX_PLAYERS = 10;
const TWO_IMPOSTERS_FROM = 7; // 7+ players get 2 imposters
const CLUE_SECONDS = 30;
// A player whose connection drops (e.g. phone switched apps) keeps their seat this long
const RECONNECT_GRACE_MS = 3 * 60 * 1000;
const VOTE_SECONDS = 60;
const REVEAL_SECONDS = 8;
const MAX_NAME_LENGTH = 16;
const MAX_MESSAGE_LENGTH = 120;
const MAX_PHOTO_LENGTH = 20000; // a 64x64 JPEG is usually 2-5 KB
const STICKER_COOLDOWN_MS = 1500;
const LANGUAGES = ["en", "zh"];

// Whiteboard: a player with no word who gets one more letter each round, starting in round 2,
// up to half the word (5+ players only)
const WHITEBOARD_MIN_PLAYERS = 5;
const WHITEBOARD_WIN_POINTS = 3;

// Imposter superpowers: each imposter gets 1 per round, 3 per game
const POWERS = ["glitch", "mosaic", "speed", "flip"];
const POWERS_PER_GAME = 3;
const POWER_SECONDS = 15;
const SPEED_CLUE_SECONDS = 10;

// Keep these lists the same as in public/client.js
const REACTION_EMOJIS = ["😂", "🤔", "👀", "🤡"];
const AVATAR_EMOJIS = [
  "🐷", "🐸", "🐵", "🐔", "🐶", "🐱", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁",
  "🐮", "🐙", "🦄", "🐲", "👽", "🤡", "💩", "👻", "🤖", "🎃", "🥔", "🍑",
];
const STICKERS = [
  "😂", "🤣", "😭", "😱", "🤔", "🧐", "🤨", "😏", "🙄", "😳",
  "🤡", "💀", "👀", "🫠", "😈", "🤥", "🙈", "💩", "🔥", "👍",
];

// How many funny variants each message has (the text lives in public/client.js)
const VARIANT_COUNTS = { froze: 4, eliminated: 7, tie: 3 };

// Glitch: shuffle the letters inside each word, e.g. "cold drink" -> "lcod nkdir"
function scramble(text) {
  return text
    .split(" ")
    .map((word) => shuffle(Array.from(word)).join(""))
    .join(" ");
}

function normalizeWord(word) {
  return String(word || "").toLowerCase().replace(/\s+/g, "");
}

// ---------- Static file server (no framework needed) ----------

const PUBLIC_DIR = path.join(__dirname, "public");
const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

const httpServer = http.createServer((request, response) => {
  const urlPath = request.url.split("?")[0];
  const fileName = urlPath === "/" ? "index.html" : urlPath.slice(1);
  const filePath = path.join(PUBLIC_DIR, fileName);

  // Block paths like "/../server.js"
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    const contentType = CONTENT_TYPES[path.extname(filePath)] || "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType });
    response.end(content);
  });
});

const io = new Server(httpServer);

// ---------- Helpers ----------

const rooms = new Map(); // roomCode -> room

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomVariant(key) {
  return Math.floor(Math.random() * VARIANT_COUNTS[key]);
}

function shuffle(list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function createRoomCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I or O, they look like 1 and 0
  let code;
  do {
    code = "";
    for (let index = 0; index < 4; index++) code += pickRandom(letters.split(""));
  } while (rooms.has(code));
  return code;
}

function cleanText(text, maxLength) {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

// An avatar is either one of our emojis or a small JPEG photo made by the page.
function cleanAvatar(avatar) {
  if (AVATAR_EMOJIS.includes(avatar)) return avatar;
  const isSmallJpeg =
    typeof avatar === "string" &&
    avatar.length <= MAX_PHOTO_LENGTH &&
    /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(avatar);
  return isSmallJpeg ? avatar : pickRandom(AVATAR_EMOJIS);
}

function isImposter(room, playerId) {
  return room.imposterIds.includes(playerId);
}

// The imposters win once they are as many as everyone else; the players win when every imposter is out.
function winnerNow(room) {
  const alive = alivePlayers(room);
  const aliveImposters = alive.filter((player) => isImposter(room, player.id)).length;
  if (aliveImposters === 0) return "civilians";
  if (aliveImposters >= alive.length - aliveImposters) return "imposter";
  return null;
}

function alivePlayers(room) {
  return room.players.filter((player) => player.alive);
}

function findPlayer(room, playerId) {
  return room.players.find((player) => player.id === playerId);
}

// System messages are sent as a key + params, so each player sees them in their own language.
function addSystemMessage(room, key, params = {}) {
  room.messages.push({ id: room.nextMessageId++, type: "system", key, params });
  trimMessages(room);
}

function addPlayerMessage(room, player, fields) {
  room.messages.push({ id: room.nextMessageId++, playerId: player.id, playerName: player.name, ...fields });
  trimMessages(room);
}

function trimMessages(room) {
  if (room.messages.length > 200) room.messages.splice(0, room.messages.length - 200);
}

function clearTimer(room) {
  clearTimeout(room.timer);
  room.timer = null;
  room.deadline = null;
}

function setTimer(room, seconds, onDone) {
  clearTimer(room);
  room.deadline = Date.now() + seconds * 1000;
  room.timer = setTimeout(onDone, seconds * 1000);
}

// Each player gets their own view: they only see their own word.
function sendState(room) {
  const gameOver = room.phase === "gameover";
  for (const player of room.players) {
    if (!player.socketId) continue;
    const playerIsImposter = isImposter(room, player.id);
    const isWhiteboard = player.id === room.whiteboardId;
    const inGame = room.phase !== "lobby";
    let yourRole = null;
    if (inGame) yourRole = playerIsImposter ? "imposter" : isWhiteboard ? "whiteboard" : "player";
    io.to(player.socketId).emit("state", {
      roomCode: room.code,
      phase: room.phase,
      round: room.round,
      wordLanguage: room.wordLanguage,
      grossWords: room.grossWords,
      hostId: room.hostId,
      yourId: player.id,
      yourRole,
      yourWord: !inGame || isWhiteboard ? null : playerIsImposter ? room.imposterWord : room.civilianWord,
      // Imposters know their partner (only when there are 2)
      partnerIds: playerIsImposter ? room.imposterIds.filter((id) => id !== player.id) : [],
      whiteboardHint: inGame && isWhiteboard ? whiteboardHint(room) : null,
      canGuess: isWhiteboard && player.alive && !room.whiteboardGuessed && ["clues", "voting"].includes(room.phase),
      powersLeft: playerIsImposter ? player.powersLeft : null,
      canUsePower: playerIsImposter && canUsePower(room, player),
      yourEffects: Object.fromEntries(
        Object.entries(player.effects || {}).filter(([, until]) => until > Date.now())
      ),
      currentSpeakerId: room.phase === "clues" ? room.speakingOrder[room.speakerIndex] : null,
      deadline: room.deadline,
      players: room.players.map((otherPlayer) => ({
        id: otherPlayer.id,
        name: otherPlayer.name,
        avatar: otherPlayer.avatar,
        alive: otherPlayer.alive,
        connected: Boolean(otherPlayer.socketId),
        score: otherPlayer.score,
        hasVoted: room.phase === "voting" && room.votes.has(otherPlayer.id),
      })),
      yourVote: room.votes.get(player.id) || null,
      messages: room.messages,
      // Only revealed at the end of the game
      reveal: gameOver
        ? {
            imposterIds: room.imposterIds,
            whiteboardId: room.whiteboardId,
            civilianWord: room.civilianWord,
            imposterWord: room.imposterWord,
            winner: room.winner,
          }
        : null,
    });
  }
}

// ---------- Game flow ----------

function startGame(room) {
  const wordPool = WORD_PAIRS[room.wordLanguage];
  const pairs = room.grossWords ? [...wordPool.normal, ...wordPool.gross] : wordPool.normal;
  const [firstWord, secondWord] = pickRandom(pairs);
  const swap = Math.random() < 0.5;
  room.civilianWord = swap ? secondWord : firstWord;
  room.imposterWord = swap ? firstWord : secondWord;
  const imposterCount = room.players.length >= TWO_IMPOSTERS_FROM ? 2 : 1;
  const shuffledPlayers = shuffle(room.players);
  room.imposterIds = shuffledPlayers.slice(0, imposterCount).map((player) => player.id);
  room.whiteboardId = room.players.length >= WHITEBOARD_MIN_PLAYERS ? shuffledPlayers[imposterCount].id : null;
  // The Whiteboard gets the letters in a random order, one more each round (spaces are free)
  room.letterOrder = shuffle(
    Array.from(room.civilianWord)
      .map((character, index) => (character === " " ? null : index))
      .filter((index) => index !== null)
  );
  room.whiteboardGuessed = false;
  room.round = 0;
  room.winner = null;
  room.messages = [];
  for (const player of room.players) {
    player.alive = true;
    player.effects = {};
    player.speedUp = false;
    player.powersLeft = POWERS_PER_GAME;
    player.powerUsedRound = 0;
  }
  addSystemMessage(room, "gameStarted", { imposterCount, hasWhiteboard: Boolean(room.whiteboardId) });
  startClueRound(room);
}

function startClueRound(room) {
  room.round += 1;
  room.phase = "clues";
  room.votes = new Map();
  room.speakingOrder = shuffle(alivePlayers(room).map((player) => player.id));
  room.speakerIndex = -1;
  addSystemMessage(room, "roundStart", { round: room.round });
  nextSpeaker(room);
}

function nextSpeaker(room) {
  room.speakerIndex += 1;
  // Skip players who left
  while (
    room.speakerIndex < room.speakingOrder.length &&
    !findPlayer(room, room.speakingOrder[room.speakerIndex])?.socketId
  ) {
    room.speakerIndex += 1;
  }
  if (room.speakerIndex >= room.speakingOrder.length) {
    startVoting(room);
    return;
  }
  const speakerId = room.speakingOrder[room.speakerIndex];
  const speaker = findPlayer(room, speakerId);
  const seconds = speaker.speedUp ? SPEED_CLUE_SECONDS : CLUE_SECONDS;
  speaker.speedUp = false;
  startSpeakerTimer(room, speakerId, seconds);
}

function startSpeakerTimer(room, speakerId, seconds) {
  setTimer(room, seconds, () => {
    const speaker = findPlayer(room, speakerId);
    if (speaker) addSystemMessage(room, "froze", { name: speaker.name, variant: randomVariant("froze") });
    nextSpeaker(room);
    sendState(room);
  });
}

function whiteboardHint(room) {
  const characters = Array.from(room.civilianWord);
  const letterCount = Math.min(room.round - 1, Math.floor(room.letterOrder.length / 2));
  const revealed = new Set(room.letterOrder.slice(0, Math.max(0, letterCount)));
  return characters.map((character, index) => (character === " " || revealed.has(index) ? character : "_")).join("");
}

function canUsePower(room, player) {
  return (
    player.alive &&
    ["clues", "voting"].includes(room.phase) &&
    player.powersLeft > 0 &&
    player.powerUsedRound !== room.round
  );
}

// Someone dropped out mid-round: end the game now if that decided it.
function endIfDecided(room) {
  const winner = winnerNow(room);
  if (winner) endGame(room, winner);
  return Boolean(winner);
}

function startVoting(room) {
  room.phase = "voting";
  room.votes = new Map();
  addSystemMessage(room, "votingStart");
  setTimer(room, VOTE_SECONDS, () => {
    finishVoting(room);
    sendState(room);
  });
}

function everyoneVoted(room) {
  return alivePlayers(room)
    .filter((player) => player.socketId)
    .every((player) => room.votes.has(player.id));
}

function finishVoting(room) {
  clearTimer(room);
  const voteCounts = new Map();
  for (const targetId of room.votes.values()) {
    voteCounts.set(targetId, (voteCounts.get(targetId) || 0) + 1);
  }
  const highestCount = Math.max(0, ...voteCounts.values());
  const topTargets = [...voteCounts.entries()].filter(([, count]) => count === highestCount);

  if (highestCount === 0 || topTargets.length > 1) {
    addSystemMessage(room, "tie", { variant: randomVariant("tie") });
  } else {
    const eliminated = findPlayer(room, topTargets[0][0]);
    eliminated.alive = false;
    addSystemMessage(room, "eliminated", {
      name: eliminated.name,
      variant: randomVariant("eliminated"),
      wasImposter: isImposter(room, eliminated.id),
    });
  }

  room.phase = "reveal";
  setTimer(room, REVEAL_SECONDS, () => {
    checkWinOrContinue(room);
    sendState(room);
  });
}

function checkWinOrContinue(room) {
  if (!endIfDecided(room)) startClueRound(room);
}

function endGame(room, winner) {
  clearTimer(room);
  room.phase = "gameover";
  room.winner = winner;
  for (const player of room.players) {
    const playerIsImposter = isImposter(room, player.id);
    if (winner === "imposter" && playerIsImposter) player.score += 3;
    if (winner === "civilians" && !playerIsImposter) player.score += 1;
    if (winner === "whiteboard" && player.id === room.whiteboardId) player.score += WHITEBOARD_WIN_POINTS;
  }
  const imposterName = room.imposterIds.map((id) => findPlayer(room, id)?.name || "?").join(" & ");
  if (winner === "whiteboard") {
    addSystemMessage(room, "whiteboardWins", { name: findPlayer(room, room.whiteboardId)?.name || "?" });
  } else {
    addSystemMessage(room, winner === "imposter" ? "imposterWins" : "playersWin", { name: imposterName });
  }
}

function backToLobby(room) {
  clearTimer(room);
  room.phase = "lobby";
  room.imposterIds = [];
  room.whiteboardId = null;
  room.winner = null;
  room.votes = new Map();
  room.messages = [];
  // Drop players who left during the game
  room.players = room.players.filter((player) => player.socketId);
  for (const player of room.players) {
    player.alive = true;
    player.effects = {};
  }
}

function createRoom(wordLanguage) {
  const room = {
    code: createRoomCode(),
    hostId: null,
    players: [],
    phase: "lobby",
    round: 0,
    wordLanguage: LANGUAGES.includes(wordLanguage) ? wordLanguage : "en",
    grossWords: true,
    whiteboardId: null,
    letterOrder: [],
    whiteboardGuessed: false,
    civilianWord: null,
    imposterWord: null,
    imposterIds: [],
    speakingOrder: [],
    speakerIndex: -1,
    votes: new Map(),
    messages: [],
    nextMessageId: 1,
    winner: null,
    timer: null,
    deadline: null,
    deleteTimer: null,
  };
  rooms.set(room.code, room);
  return room;
}

// A player's connection is gone. Keep the game moving, but keep their seat (and the room)
// for a while in case they come back. "graceMs" is 0 when they pressed Leave.
function handlePlayerOffline(room, player, graceMs) {
  player.socketId = null;
  if (room.hostId === player.id) {
    const newHost = room.players.find((otherPlayer) => otherPlayer.socketId);
    if (newHost) room.hostId = newHost.id;
  }
  if (room.phase === "clues" && room.speakingOrder[room.speakerIndex] === player.id) {
    nextSpeaker(room);
  } else if (room.phase === "voting" && everyoneVoted(room)) {
    finishVoting(room);
  }

  clearTimeout(player.removeTimer);
  player.removeTimer = setTimeout(() => removePlayer(room, player), graceMs);

  if (!room.players.some((otherPlayer) => otherPlayer.socketId)) {
    clearTimeout(room.deleteTimer);
    room.deleteTimer = setTimeout(() => {
      if (room.players.some((otherPlayer) => otherPlayer.socketId)) return;
      clearTimer(room);
      rooms.delete(room.code);
    }, RECONNECT_GRACE_MS);
  }
  sendState(room);
}

// The player did not come back in time (or pressed Leave).
function removePlayer(room, player) {
  if (player.socketId || !room.players.includes(player)) return; // they came back, or were already dropped
  if (room.phase === "lobby") {
    room.players = room.players.filter((otherPlayer) => otherPlayer.id !== player.id);
  } else if (player.alive && room.phase !== "gameover") {
    player.alive = false;
    for (const [voterId, targetId] of room.votes) {
      if (voterId === player.id || targetId === player.id) room.votes.delete(voterId);
    }
    addSystemMessage(room, "playerLeft", { name: player.name });
    if (["clues", "voting"].includes(room.phase)) endIfDecided(room);
  }
  if (room.hostId === player.id) {
    const newHost = room.players.find((otherPlayer) => otherPlayer.socketId);
    room.hostId = newHost ? newHost.id : null;
  }
  sendState(room);
}

// ---------- Socket events ----------

io.on("connection", (socket) => {
  let currentRoom = null;
  let currentPlayer = null;

  // Errors are sent as keys so the page can show them in the player's language.
  function sendError(key, params = {}) {
    socket.emit("errorMessage", { key, params });
  }

  // "token" is a secret kept in the player's browser and never shown to others.
  // Other players only ever see the public "id", so nobody can take over someone else's seat.
  function joinRoom(room, rawToken, rawName, rawAvatar) {
    const name = cleanText(rawName, MAX_NAME_LENGTH);
    if (!name) return sendError("needName");
    const token = cleanText(rawToken, 40);
    if (!token) return sendError("refresh");

    // Same browser coming back (refresh or lost connection)
    let player = room.players.find((otherPlayer) => otherPlayer.token === token);
    if (player) {
      if (player.socketId && player.socketId !== socket.id) {
        io.sockets.sockets.get(player.socketId)?.disconnect(true);
      }
      player.socketId = socket.id;
      clearTimeout(player.removeTimer);
    } else {
      if (room.phase !== "lobby") return sendError("alreadyStarted");
      if (room.players.length >= MAX_PLAYERS) return sendError("roomFull");
      const nameTaken = room.players.some((otherPlayer) => otherPlayer.name.toLowerCase() === name.toLowerCase());
      if (nameTaken) return sendError("nameTaken");
      player = {
        id: crypto.randomUUID(),
        token,
        name,
        avatar: cleanAvatar(rawAvatar),
        socketId: socket.id,
        alive: true,
        score: 0,
      };
      room.players.push(player);
    }
    if (!room.hostId) room.hostId = player.id;
    clearTimeout(room.deleteTimer);

    currentRoom = room;
    currentPlayer = player;
    socket.join(room.code);
    sendState(room);
  }

  socket.on("createRoom", ({ token, name, avatar, wordLanguage } = {}) => {
    if (currentRoom) return;
    if (!cleanText(name, MAX_NAME_LENGTH)) return sendError("needName");
    const room = createRoom(wordLanguage);
    joinRoom(room, token, name, avatar);
    if (!currentRoom) rooms.delete(room.code);
  });

  socket.on("joinRoom", ({ roomCode, token, name, avatar } = {}) => {
    if (currentRoom) return;
    const room = rooms.get(cleanText(roomCode, 4).toUpperCase());
    if (!room) return sendError("roomNotFound");
    joinRoom(room, token, name, avatar);
  });

  socket.on("setWordLanguage", (wordLanguage) => {
    const room = currentRoom;
    if (!room || room.hostId !== currentPlayer.id || room.phase !== "lobby") return;
    if (!LANGUAGES.includes(wordLanguage)) return;
    room.wordLanguage = wordLanguage;
    sendState(room);
  });

  socket.on("setGrossWords", (enabled) => {
    const room = currentRoom;
    if (!room || room.hostId !== currentPlayer.id || room.phase !== "lobby") return;
    room.grossWords = Boolean(enabled);
    sendState(room);
  });

  socket.on("usePower", ({ power, targetId } = {}) => {
    const room = currentRoom;
    if (!room || !isImposter(room, currentPlayer.id) || !canUsePower(room, currentPlayer)) return;
    if (!POWERS.includes(power)) return;
    if (power === "speed" && room.phase !== "clues") return; // speed only makes sense during clues
    const target = findPlayer(room, targetId);
    if (!target || !target.alive || isImposter(room, target.id)) return; // not yourself or your partner

    currentPlayer.powersLeft -= 1;
    currentPlayer.powerUsedRound = room.round;
    if (power === "speed") {
      const isSpeakingNow = room.speakingOrder[room.speakerIndex] === target.id;
      const secondsLeft = (room.deadline - Date.now()) / 1000;
      if (isSpeakingNow) {
        if (secondsLeft > SPEED_CLUE_SECONDS) startSpeakerTimer(room, target.id, SPEED_CLUE_SECONDS);
      } else {
        target.speedUp = true; // their next turn is short
      }
    } else {
      target.effects = { ...target.effects, [power]: Date.now() + POWER_SECONDS * 1000 };
      // Refresh everyone when the effect ends so the screen goes back to normal
      setTimeout(() => sendState(room), POWER_SECONDS * 1000 + 100);
    }
    addSystemMessage(room, "powerUsed", { power, name: target.name });
    sendState(room);
  });

  socket.on("guessWord", (rawGuess) => {
    const room = currentRoom;
    if (!room || currentPlayer.id !== room.whiteboardId || !currentPlayer.alive) return;
    if (room.whiteboardGuessed || !["clues", "voting"].includes(room.phase)) return;
    const guess = cleanText(rawGuess, 40);
    if (!guess) return;
    room.whiteboardGuessed = true;

    if (normalizeWord(guess) === normalizeWord(room.civilianWord)) {
      endGame(room, "whiteboard");
    } else {
      currentPlayer.alive = false;
      // Votes for or from a knocked-out player no longer count
      for (const [voterId, targetId] of room.votes) {
        if (voterId === currentPlayer.id || targetId === currentPlayer.id) room.votes.delete(voterId);
      }
      addSystemMessage(room, "whiteboardWrong", { name: currentPlayer.name, guess });
      if (!endIfDecided(room)) {
        if (room.phase === "clues" && room.speakingOrder[room.speakerIndex] === currentPlayer.id) {
          nextSpeaker(room);
        } else if (room.phase === "voting" && everyoneVoted(room)) {
          finishVoting(room);
        }
      }
    }
    sendState(room);
  });

  socket.on("startGame", () => {
    const room = currentRoom;
    if (!room || room.hostId !== currentPlayer.id || room.phase !== "lobby") return;
    const connectedCount = room.players.filter((player) => player.socketId).length;
    if (connectedCount < MIN_PLAYERS) return sendError("needPlayers", { min: MIN_PLAYERS });
    room.players = room.players.filter((player) => player.socketId);
    startGame(room);
    sendState(room);
  });

  socket.on("sendMessage", (rawText) => {
    const room = currentRoom;
    if (!room) return;
    let text = cleanText(rawText, MAX_MESSAGE_LENGTH);
    if (!text) return;
    if ((currentPlayer.effects?.glitch || 0) > Date.now()) text = scramble(text);

    if (room.phase === "clues") {
      // During clue time only the current speaker can type, and that message is their clue.
      if (room.speakingOrder[room.speakerIndex] !== currentPlayer.id) return;
      addPlayerMessage(room, currentPlayer, { type: "clue", text, reactions: {} });
      nextSpeaker(room);
    } else {
      // Dead players can still chat (as ghosts), it adds to the fun.
      addPlayerMessage(room, currentPlayer, { type: "chat", text, reactions: {} });
    }
    sendState(room);
  });

  // Stickers can be sent any time (even during someone else's clue), but not too fast.
  socket.on("sendSticker", (sticker) => {
    const room = currentRoom;
    if (!room || !STICKERS.includes(sticker)) return;
    const now = Date.now();
    if (now - (currentPlayer.lastStickerAt || 0) < STICKER_COOLDOWN_MS) return;
    currentPlayer.lastStickerAt = now;
    addPlayerMessage(room, currentPlayer, { type: "sticker", sticker });
    sendState(room);
  });

  socket.on("react", ({ messageId, emoji } = {}) => {
    const room = currentRoom;
    if (!room || !REACTION_EMOJIS.includes(emoji)) return;
    const message = room.messages.find((item) => item.id === messageId);
    if (!message || !message.reactions) return;
    const reactors = message.reactions[emoji] || [];
    // Tap again to remove your reaction
    message.reactions[emoji] = reactors.includes(currentPlayer.id)
      ? reactors.filter((id) => id !== currentPlayer.id)
      : [...reactors, currentPlayer.id];
    sendState(room);
  });

  socket.on("vote", (targetId) => {
    const room = currentRoom;
    if (!room || room.phase !== "voting" || !currentPlayer.alive) return;
    const target = findPlayer(room, targetId);
    if (!target || !target.alive || target.id === currentPlayer.id) return;
    room.votes.set(currentPlayer.id, target.id);
    if (everyoneVoted(room)) finishVoting(room);
    sendState(room);
  });

  socket.on("playAgain", () => {
    const room = currentRoom;
    if (!room || room.hostId !== currentPlayer.id || room.phase !== "gameover") return;
    backToLobby(room);
    sendState(room);
  });

  socket.on("leaveRoom", () => {
    if (!currentRoom) return;
    const room = currentRoom;
    const player = currentPlayer;
    socket.leave(room.code);
    currentRoom = null;
    currentPlayer = null;
    handlePlayerOffline(room, player, 0);
    socket.emit("leftRoom");
  });

  socket.on("disconnect", () => {
    if (!currentRoom || currentPlayer.socketId !== socket.id) return;
    handlePlayerOffline(currentRoom, currentPlayer, RECONNECT_GRACE_MS);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Who is the Imposter? running at http://localhost:${PORT}`);
});
