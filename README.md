# Who is the Imposter? 🕵️

A funny online party game for 3 to 10 friends.

Everyone gets the same secret word, except one imposter who gets a similar but different word (like "Pizza" vs "Burger"). The imposter doesn't know they are the imposter!

## How to play

1. One player creates a room and shares the 4-letter code (or the invite link).
2. Friends join with the code and a nickname. The host starts the game when there are at least 3 players.
3. **Clue time:** players take turns giving one funny clue about their word in the chat (45 seconds each). Don't be too obvious, or the imposter will figure out your word!
4. **Vote time:** everyone votes for who they think is the imposter (60 seconds). You can chat and react with emojis while you vote.
5. The player with the most votes is out. A tie means nobody goes out.
6. **The players win** when the imposter is voted out. **The imposter wins** when only 2 players are left.

Extras:
- Pick a funny emoji avatar or use your own photo (it's shrunk to a tiny 64x64 picture).
- Send big emoji stickers any time with the 😜 button, even during someone else's turn.
- Switch the page between English and 中文 with the button at the top. The host picks whether the secret words are English or Chinese in the lobby.

Scores: each player gets +1 when the players win, and the imposter gets +3 when they win. Scores stay across games in the same room.

## Run it on your computer

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm start
```

Open http://localhost:3000. To test alone, open a few private browser windows (each one is a different player).

## Put it online for free (Render)

1. Go to https://render.com and sign in with GitHub.
2. Click **New +** → **Web Service** and pick this repository.
3. Use these settings:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Instance type:** Free
4. Click **Create Web Service**. After a few minutes you get a link like `https://who-is-imposter.onrender.com`. Send it to your friends!

Note: free Render servers sleep after 15 minutes without visitors, so the first visit can take about a minute to load. Rooms live in memory, so they are lost when the server restarts.

## Add your own word pairs

Edit `words.js` and add a line like `["Word for players", "Word for imposter"],` to `ENGLISH_PAIRS` or `CHINESE_PAIRS`. Which word goes to the imposter is picked at random each game.

## Files

- `server.js`: the game server (rooms, turns, voting, timers)
- `words.js`: the funny word pairs (English and Chinese)
- `public/`: the web page (`index.html`, `style.css`, `client.js`). All page text in both languages is at the top of `client.js`.
