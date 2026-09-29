# Neon Snake

A retro arcade Snake game with a dark, neon-lit look. It runs entirely in the browser with plain HTML, CSS, and JavaScript, so you can host it on GitHub Pages with no build step.

## Project Overview

Steer the snake around a 20×20 board, eat the glowing food, and grow as long as you can. Hitting a wall or your own tail ends the run. The game speeds up as you eat, your best score is saved in the browser, and it plays well on desktop and on phones.

## Tech Stack

- **HTML5** for the page structure and accessible overlays
- **CSS3** for the dark arcade theme, glow effects, and responsive layout (custom properties, grid, flexbox)
- **Vanilla JavaScript (ES6+)** for game logic, input, and rendering
- **HTML5 Canvas 2D API** for drawing the board
- **`localStorage`** for saving the high score
- No frameworks, no canvas libraries, no build tools

The only external request is the *Press Start 2P* web font from Google Fonts. If it fails to load, the game falls back to the system monospace font.

## Features

- 400×400 logical canvas on a 20×20 grid, sharp on high-DPI screens and scaled to fit any viewport
- Game loop on `requestAnimationFrame` with a time accumulator, so speed is consistent across display refresh rates
- Speed increases with every piece of food, from 150 ms per move down to a 60 ms floor
- Input buffering: up to three turns are queued between ticks, and each turn is checked against the previous one, so quick key combos work and 180° reversals into your own neck are impossible
- Food spawns only on free tiles
- Solid walls: hitting one ends the game
- Score, level, and a high score that persists between visits
- Start, pause, resume, game over, and play again flows, with a win state if you fill the whole board
- Auto-pause when the tab is hidden
- Touch support: swipe on the board or use the on-screen D-pad
- Respects `prefers-reduced-motion`
- Screen reader announcements for game state changes

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | Arrow keys or `W` `A` `S` `D` | Swipe on the board, or use the D-pad |
| Start | `Space`, `Enter`, or any move key | Tap **Start game** |
| Pause / resume | `Space`, `P`, or `Esc` | Tap the center D-pad button |
| Play again | `Enter` or `Space` on the game over screen | Tap **Play again** |

## How to Run Locally

The game has no dependencies, so any of these work:

1. **Open the file directly.** Double-click `index.html`.
2. **Use a local server** (recommended, since it matches how GitHub Pages serves the site):

   ```bash
   # Python 3
   python3 -m http.server 8000

   # or Node.js
   npx serve .
   ```

   Then open <http://localhost:8000>.

## Deploy to GitHub Pages

1. Push `index.html`, `style.css`, `app.js`, and `README.md` to the root of a GitHub repository.
2. In the repository, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**, choose your main branch and the `/ (root)` folder, then save.
4. After a minute, the game is live at `https://<your-username>.github.io/<repository-name>/`.

## Project Structure

```
.
├── index.html   # Page structure, HUD, overlay, touch controls
├── style.css    # Theme, layout, animations
├── app.js       # Game state, loop, input, rendering
└── README.md
```

## Configuration

Gameplay is tuned by constants at the top of `app.js`:

| Constant | Default | Effect |
| --- | --- | --- |
| `GRID_SIZE` | `20` | Tiles per side (the board stays 400 px, so tiles resize to match) |
| `BASE_INTERVAL_MS` | `150` | Milliseconds per move at the start |
| `MIN_INTERVAL_MS` | `60` | Fastest the game will go |
| `SPEED_STEP_MS` | `3` | How much faster each food makes the snake |
| `FOODS_PER_LEVEL` | `5` | Food needed to raise the displayed level |
| `POINTS_PER_FOOD` | `10` | Score per food |
| `INPUT_QUEUE_LIMIT` | `3` | Maximum buffered turns |

To reset the saved high score, run `localStorage.removeItem('neon-snake.highScore')` in the browser console.
