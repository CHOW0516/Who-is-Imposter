# Who is the Imposter? 🕵️

A funny online party game for 4 to 10 friends.

Everyone gets the same secret word, except one imposter who gets a similar but different word (like "Pizza" vs "Burger"). The imposter knows they are the imposter and has superpowers to mess with everyone!

## How to play

1. One player creates a room and shares the 4-letter code (or the invite link).
2. Friends join with the code and a nickname. The host starts the game when there are at least 4 players. With 7 or more players there are **2 imposters**, and they know who their partner is.
3. **Clue time:** players take turns giving one funny clue about their word in the chat (30 seconds each). Don't be too obvious, or the imposter will figure out your word!
4. **Vote time:** everyone votes for who they think is the imposter (60 seconds). You can chat and react with emojis while you vote.
5. The player with the most votes is out. A tie means nobody goes out.
6. **The players win** when every imposter is voted out. **The imposters win** once there are as many imposters left as other players (for example 1 imposter and 1 player).

If your phone loses connection (you switch apps, lock the screen, or refresh), you have 3 minutes to come back and keep your seat. The room stays open for 3 minutes even if everyone drops.

### ⚡ Imposter superpowers
Each imposter can use 1 superpower per round (3 per game). Each one hits one player:
- **👾 Glitch:** their screen shakes and flickers for 15 seconds, and the letters of anything they send get scrambled.
- **🟫 Mosaic:** their chat goes blurry for 15 seconds.
- **⏩ Time accelerate:** their clue timer drops to 10 seconds (only during clue time).
- **🙃 Upside down:** their whole screen flips for 15 seconds.

Everyone sees "Someone used Mosaic on Bob!" but not who did it.

### 🫥 Whiteboard (5+ players)
One player gets no word at all. From round 2 they see one more letter of the players' word each round (one character for Chinese words), up to half the word. Once per game they can tap **Guess the word**: a right guess wins the whole game for them (+3 points), a wrong guess knocks them out.

Extras:
- Pick a funny emoji avatar or use your own photo (it's shrunk to a tiny 64x64 picture).
- Send big emoji stickers any time with the 😜 button, even during someone else's turn.
- Switch the page between English and 中文 with the button at the top. The host picks whether the secret words are English or Chinese in the lobby.
- The host can turn **💩 Gross words** on or off in the lobby (like "Shit" vs "Durian", "尿" vs "菊花茶").

Scores: each player gets +1 when the players win, the imposter gets +3 when they win, and the Whiteboard gets +3 for a right guess. Scores stay across games in the same room.

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

Edit `words.js` and add a line like `["Word for players", "Word for imposter"],` to `ENGLISH_PAIRS` or `CHINESE_PAIRS` (or the `_GROSS_PAIRS` lists for the gross words switch). Which word goes to the imposter is picked at random each game.

## Files

- `server.js`: the game server (rooms, turns, voting, timers)
- `words.js`: the funny word pairs (English and Chinese)
- `public/`: the web page (`index.html`, `style.css`, `client.js`). All page text in both languages is at the top of `client.js`.
