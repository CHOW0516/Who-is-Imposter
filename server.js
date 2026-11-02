const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");
const { WORD_PAIRS } = require("./words");

const PORT = process.env.PORT || 3000;
const MIN_PLAYERS = 3;
const MAX_PLAYERS = 10;
const CLUE_SECONDS = 45;
const VOTE_SECONDS = 60;
const REVEAL_SECONDS = 8;
const MAX_NAME_LENGTH = 16;
const MAX_MESSAGE_LENGTH = 120;
const REACTION_EMOJIS = ["😂", "🤔", "👀", "🤡"];

const ELIMINATION_LINES = [
  "{name} has been yeeted out of the group chat.",
  "{name} was escorted out by security.",
  "{name} packed their bags and cried a little.",
  "{name} got voted off faster than a bad haircut.",
  "{name} is now a ghost. Spooky.",
  "{name} has left the chat. Nobody waved.",
  "Bye {name}! Don't let the door hit you.",
];
const TIE_LINES = [
  "It's a tie! Nobody goes home. Everyone is still suspicious.",
  "Tie vote! You all argued and achieved nothing.",
  "Nobody was voted out. The imposter is laughing somewhere.",
];
const FROZE_LINES = [
  "...forgot how words work 😶",
  "...stared at the screen in silence",
  "...is buffering 🔄",
  "...was too busy eating snacks",
];

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

function alivePlayers(room) {
  return room.players.filter((player) => player.alive);
}

function findPlayer(room, playerId) {
  return room.players.find((player) => player.id === playerId);
}

function addSystemMessage(room, text) {
  room.messages.push({ id: room.nextMessageId++, type: "system", text });
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
    const isImposter = player.id === room.imposterId;
    io.to(player.socketId).emit("state", {
      roomCode: room.code,
      phase: room.phase,
      round: room.round,
      hostId: room.hostId,
      yourId: player.id,
      yourWord: room.phase === "lobby" ? null : isImposter ? room.imposterWord : room.civilianWord,
      currentSpeakerId: room.phase === "clues" ? room.speakingOrder[room.speakerIndex] : null,
      deadline: room.deadline,
      players: room.players.map((otherPlayer) => ({
        id: otherPlayer.id,
        name: otherPlayer.name,
        alive: otherPlayer.alive,
        connected: Boolean(otherPlayer.socketId),
        score: otherPlayer.score,
        hasVoted: room.phase === "voting" && room.votes.has(otherPlayer.id),
      })),
      yourVote: room.votes.get(player.id) || null,
      messages: room.messages,
      lastResult: room.lastResult,
      // Only revealed at the end of the game
      reveal: gameOver
        ? {
            imposterId: room.imposterId,
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
  const [firstWord, secondWord] = pickRandom(WORD_PAIRS);
  const swap = Math.random() < 0.5;
  room.civilianWord = swap ? secondWord : firstWord;
  room.imposterWord = swap ? firstWord : secondWord;
  room.imposterId = pickRandom(room.players).id;
  room.round = 0;
  room.winner = null;
  room.lastResult = null;
  room.messages = [];
  for (const player of room.players) player.alive = true;
  addSystemMessage(room, "Game started! Check your secret word. One of you has a different word...");
  startClueRound(room);
}

function startClueRound(room) {
  room.round += 1;
  room.phase = "clues";
  room.votes = new Map();
  room.speakingOrder = shuffle(alivePlayers(room).map((player) => player.id));
  room.speakerIndex = -1;
  addSystemMessage(room, `Round ${room.round}: describe your word in one funny clue. Don't make it too obvious!`);
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
  setTimer(room, CLUE_SECONDS, () => {
    const speaker = findPlayer(room, speakerId);
    if (speaker) addSystemMessage(room, `${speaker.name} ${pickRandom(FROZE_LINES)}`);
    nextSpeaker(room);
    sendState(room);
  });
}

function startVoting(room) {
  room.phase = "voting";
  room.votes = new Map();
  addSystemMessage(room, "Time to vote! Who is the imposter? You can chat while you vote.");
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
    room.lastResult = { eliminatedId: null, text: pickRandom(TIE_LINES) };
  } else {
    const eliminated = findPlayer(room, topTargets[0][0]);
    eliminated.alive = false;
    const wasImposter = eliminated.id === room.imposterId;
    room.lastResult = {
      eliminatedId: eliminated.id,
      text:
        pickRandom(ELIMINATION_LINES).replace("{name}", eliminated.name) +
        (wasImposter ? " They WERE the imposter! 🎉" : " They were NOT the imposter. Oops. 😬"),
    };
  }
  addSystemMessage(room, room.lastResult.text);

  room.phase = "reveal";
  setTimer(room, REVEAL_SECONDS, () => {
    checkWinOrContinue(room);
    sendState(room);
  });
}

function checkWinOrContinue(room) {
  const imposter = findPlayer(room, room.imposterId);
  // An imposter who left the game counts as caught.
  const imposterStillIn = imposter && imposter.alive && imposter.socketId;
  const aliveAndConnected = alivePlayers(room).filter((player) => player.socketId);
  if (!imposterStillIn) {
    endGame(room, "civilians");
  } else if (aliveAndConnected.length <= 2) {
    endGame(room, "imposter");
  } else {
    startClueRound(room);
  }
}

function endGame(room, winner) {
  clearTimer(room);
  room.phase = "gameover";
  room.winner = winner;
  for (const player of room.players) {
    const isImposter = player.id === room.imposterId;
    if (winner === "imposter" && isImposter) player.score += 3;
    if (winner === "civilians" && !isImposter) player.score += 1;
  }
  const imposterName = findPlayer(room, room.imposterId)?.name || "Someone";
  addSystemMessage(
    room,
    winner === "imposter"
      ? `The imposter ${imposterName} fooled everyone! 😈`
      : `The players win! ${imposterName} was the imposter. 🎉`
  );
}

function backToLobby(room) {
  clearTimer(room);
  room.phase = "lobby";
  room.imposterId = null;
  room.lastResult = null;
  room.winner = null;
  room.votes = new Map();
  room.messages = [];
  // Drop players who left during the game
  room.players = room.players.filter((player) => player.socketId);
  for (const player of room.players) player.alive = true;
}

function createRoom() {
  const room = {
    code: createRoomCode(),
    hostId: null,
    players: [],
    phase: "lobby",
    round: 0,
    civilianWord: null,
    imposterWord: null,
    imposterId: null,
    speakingOrder: [],
    speakerIndex: -1,
    votes: new Map(),
    messages: [],
    nextMessageId: 1,
    lastResult: null,
    winner: null,
    timer: null,
    deadline: null,
  };
  rooms.set(room.code, room);
  return room;
}

// A player left mid-game: keep the game moving.
function handlePlayerLeft(room, player) {
  if (room.phase === "lobby") {
    room.players = room.players.filter((otherPlayer) => otherPlayer.id !== player.id);
  }
  if (room.hostId === player.id) {
    const newHost = room.players.find((otherPlayer) => otherPlayer.socketId);
    room.hostId = newHost ? newHost.id : null;
  }
  if (!room.players.some((otherPlayer) => otherPlayer.socketId)) {
    clearTimer(room);
    rooms.delete(room.code);
    return;
  }
  if (room.phase === "clues" && room.speakingOrder[room.speakerIndex] === player.id) {
    nextSpeaker(room);
  } else if (room.phase === "voting" && everyoneVoted(room)) {
    finishVoting(room);
  }
  sendState(room);
}

// ---------- Socket events ----------

io.on("connection", (socket) => {
  let currentRoom = null;
  let currentPlayer = null;

  function joinRoom(room, playerId, rawName) {
    const name = cleanText(rawName, MAX_NAME_LENGTH);
    if (!name) return socket.emit("errorMessage", "Please enter a nickname.");
    const safePlayerId = cleanText(playerId, 40);
    if (!safePlayerId) return socket.emit("errorMessage", "Something went wrong. Refresh the page.");

    // Same browser coming back (refresh or lost connection)
    let player = findPlayer(room, safePlayerId);
    if (player) {
      if (player.socketId && player.socketId !== socket.id) {
        io.sockets.sockets.get(player.socketId)?.disconnect(true);
      }
      player.socketId = socket.id;
    } else {
      if (room.phase !== "lobby") return socket.emit("errorMessage", "This game already started. Wait for the next one!");
      if (room.players.length >= MAX_PLAYERS) return socket.emit("errorMessage", "This room is full.");
      const nameTaken = room.players.some((otherPlayer) => otherPlayer.name.toLowerCase() === name.toLowerCase());
      if (nameTaken) return socket.emit("errorMessage", "That nickname is taken in this room.");
      player = { id: safePlayerId, name, socketId: socket.id, alive: true, score: 0 };
      room.players.push(player);
    }
    if (!room.hostId) room.hostId = player.id;

    currentRoom = room;
    currentPlayer = player;
    socket.join(room.code);
    sendState(room);
  }

  socket.on("createRoom", ({ playerId, name } = {}) => {
    if (currentRoom) return;
    if (!cleanText(name, MAX_NAME_LENGTH)) return socket.emit("errorMessage", "Please enter a nickname.");
    const room = createRoom();
    joinRoom(room, playerId, name);
    if (!currentRoom) rooms.delete(room.code);
  });

  socket.on("joinRoom", ({ roomCode, playerId, name } = {}) => {
    if (currentRoom) return;
    const room = rooms.get(cleanText(roomCode, 4).toUpperCase());
    if (!room) return socket.emit("errorMessage", "Room not found. Check the code.");
    joinRoom(room, playerId, name);
  });

  socket.on("startGame", () => {
    const room = currentRoom;
    if (!room || room.hostId !== currentPlayer.id || room.phase !== "lobby") return;
    const connectedCount = room.players.filter((player) => player.socketId).length;
    if (connectedCount < MIN_PLAYERS) {
      return socket.emit("errorMessage", `You need at least ${MIN_PLAYERS} players to start.`);
    }
    room.players = room.players.filter((player) => player.socketId);
    startGame(room);
    sendState(room);
  });

  socket.on("sendMessage", (rawText) => {
    const room = currentRoom;
    if (!room) return;
    const text = cleanText(rawText, MAX_MESSAGE_LENGTH);
    if (!text) return;

    if (room.phase === "clues") {
      // During clue time only the current speaker can type, and that message is their clue.
      if (room.speakingOrder[room.speakerIndex] !== currentPlayer.id) return;
      room.messages.push({
        id: room.nextMessageId++,
        type: "clue",
        playerId: currentPlayer.id,
        playerName: currentPlayer.name,
        text,
        reactions: {},
      });
      trimMessages(room);
      nextSpeaker(room);
    } else {
      // Dead players can still chat (as ghosts), it adds to the fun.
      room.messages.push({
        id: room.nextMessageId++,
        type: "chat",
        playerId: currentPlayer.id,
        playerName: currentPlayer.name,
        text,
        reactions: {},
      });
      trimMessages(room);
    }
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
    player.socketId = null;
    socket.leave(room.code);
    currentRoom = null;
    currentPlayer = null;
    handlePlayerLeft(room, player);
    socket.emit("leftRoom");
  });

  socket.on("disconnect", () => {
    if (!currentRoom || currentPlayer.socketId !== socket.id) return;
    currentPlayer.socketId = null;
    handlePlayerLeft(currentRoom, currentPlayer);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Who is the Imposter? running at http://localhost:${PORT}`);
});
