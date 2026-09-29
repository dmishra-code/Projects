# Pathfinder: BFS and DFS Visualizer

An interactive, browser-based pathfinding visualizer that shows how **breadth-first search (BFS)** and **depth-first search (DFS)** explore a 2D grid. Draw walls, move the start and target nodes, and watch each algorithm search cell by cell, so the difference between "shortest path" and "any path" is easy to see.

Built with plain HTML, CSS, and JavaScript. There are no dependencies and no build step.

## Overview

The grid is a graph: each open cell is a node connected to its four neighbors (up, right, down, left), and every move costs the same. That makes it an unweighted graph, which is the setting where BFS is guaranteed to find the shortest path and DFS is not.

- **BFS** uses a queue and expands cells in layers of increasing distance from the start.
- **DFS** uses a stack and follows one branch as far as it can before backtracking.

Both record a parent pointer for every cell they reach. When the target is found, the path is rebuilt by following parent pointers from the target back to the start.

## Features

- 20×20 grid (configurable in one place) with a draggable green start node and red target node
- Click and drag to draw walls; start a drag on an existing wall to erase, or use right-click
- Touch support through pointer events
- BFS and DFS selectable from a dropdown
- Step-by-step animation of the frontier: cells turn amber when they enter the queue or stack, blue when they are visited, and yellow when they are part of the final path
- Animation speed slider (Slow, Medium, Fast) that also works while a search is running
- Live metrics: **Nodes visited** and **Path length**
- A small "Last run on this grid" table so you can compare BFS and DFS on the same maze
- Edge cases handled with clear messages:
  - Target unreachable: the whole reachable area is explored, the path shows "None", and the target shakes
  - Start boxed in by walls
  - Start adjacent to target
  - Walls placed on the start or target are prevented, and moving a node onto a wall replaces the wall
- Visualize, Clear path, Reset grid, and the algorithm selector are disabled during an animation, and the grid is locked, so runs cannot overlap
- Editing the grid after a run clears the stale result automatically
- Keyboard-visible focus styles, screen reader status announcements, and support for `prefers-reduced-motion`

## Complexity Analysis

Let **V** be the number of cells (rows × cols) and **E** the number of connections between neighboring cells. On a 4-connected grid, E is at most 4V, so O(V + E) simplifies to O(V).

| | BFS | DFS |
| --- | --- | --- |
| **Data structure** | Queue (FIFO) | Stack (LIFO) |
| **Time complexity** | O(V + E) = O(rows × cols) | O(V + E) = O(rows × cols) |
| **Space complexity** | O(V) | O(V) |
| **Finds a path if one exists** | Yes | Yes |
| **Shortest path (unweighted)** | **Guaranteed** | Not guaranteed |
| **Typical path shape** | Direct | Long and winding |

Notes on space:

- Both algorithms keep parent and visited arrays of size V.
- BFS's queue holds the current "wavefront". In an open grid it stays small (roughly proportional to the grid perimeter), but its worst case is O(V).
- This DFS pushes every unvisited neighbor and skips stale duplicates when they are popped, so the stack can hold up to O(E) = O(V) entries. A recursive DFS would use O(V) call-stack depth in the worst case instead.

Why the paths differ: BFS reaches every cell at distance *d* before any cell at distance *d + 1*, so the first time it reaches the target is via a shortest route. DFS commits to a direction and only returns when it hits a dead end, so the first route it stumbles on can be far longer than necessary. On the default open grid, BFS finds an 11-step path while DFS finds one with over 100 steps.

## Quickstart

No installation is needed.

**Option 1: open the file**

Double-click `index.html` in any modern browser.

**Option 2: run a local server**

```bash
# Python 3
python3 -m http.server 8000

# or Node.js
npx serve .
```

Then open <http://localhost:8000>.

**Deploy to GitHub Pages**

1. Push `index.html`, `style.css`, `script.js`, and `README.md` to a repository.
2. Go to **Settings → Pages**, set the source to your main branch and the `/ (root)` folder, and save.
3. The site will be live at `https://<your-username>.github.io/<repository-name>/`.

## How to Use

| Action | How |
| --- | --- |
| Draw walls | Click and drag on empty cells |
| Erase walls | Click and drag starting on a wall, or right-click and drag |
| Move start or target | Drag the green or red node |
| Run a search | Choose an algorithm, then press **Visualize** |
| Change speed | Move the slider at any time, even mid-run |
| Remove the search overlay | **Clear path** keeps your walls and nodes |
| Start over | **Reset grid** removes walls and restores the default node positions |

## Project Structure

```
.
├── index.html   # Page structure and controls
├── style.css    # Dark dashboard theme, grid and cell states, animations
├── script.js    # Search core (BFS, DFS, path reconstruction) and UI logic
└── README.md
```

## Configuration

Grid size and animation timing live in the `CONFIG` object at the top of `script.js`:

```js
const CONFIG = {
  rows: 20,
  cols: 20,
  speeds: [
    { label: 'Slow',   step: 70, path: 90 },
    { label: 'Medium', step: 25, path: 50 },
    { label: 'Fast',   step: 6,  path: 25 }
  ],
  defaultSpeed: 1
};
```

`step` is the delay in milliseconds between node expansions, and `path` is the delay between cells when drawing the final path. The board resizes itself to fit whatever `rows` and `cols` you choose.

## Implementation Notes

- **Search first, animate second.** Each algorithm runs to completion instantly and returns a list of frames (one per expanded node, plus the neighbors it added to the queue or stack) and the final path. The animation engine then replays those frames with `async`/`await` and timeouts. This keeps the algorithms pure and testable, and makes it impossible for animation timing to affect results.
- **Definitions.** "Nodes visited" counts every cell that was expanded, including the start and, if reached, the target. "Path length" is the number of steps (moves) from start to target.
- **Neighbor order** is up, right, down, left. DFS pushes neighbors in reverse so it explores up first, which makes its behavior predictable.
- **Testable core.** The search functions are exported when `script.js` is loaded in Node, so you can test them without a browser:

  ```js
  const { runSearch } = require('./script.js');
  const walls = new Uint8Array(400); // 20x20, no walls
  const result = runSearch('bfs', { rows: 20, cols: 20, walls, start: 204, target: 215 });
  console.log(result.found, result.path.length - 1); // true 11
  ```

## Browser Support

Any current version of Chrome, Edge, Firefox, or Safari. The visualizer uses CSS grid, pointer events, and ES2017 `async`/`await`.

## License

Released under the MIT License. Use it, learn from it, and adapt it freely.
