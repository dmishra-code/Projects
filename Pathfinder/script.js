/* ==========================================================================
   Pathfinder: BFS and DFS on an interactive grid (vanilla JavaScript)

   Structure
     1. Configuration
     2. Search core (pure functions, no DOM): BFS, DFS, path reconstruction
     3. UI: grid rendering, drag interactions, animation engine, metrics
   ========================================================================== */
(() => {
  'use strict';

  /* ------------------------------------------------------------------------
     1. Configuration
     ------------------------------------------------------------------------ */

  const CONFIG = {
    rows: 20,
    cols: 20,
    // Delay in ms between animation steps. `step` paces the search frontier,
    // `path` paces the final path highlight. Index matches the speed slider.
    speeds: [
      { label: 'Slow', step: 70, path: 90 },
      { label: 'Medium', step: 25, path: 50 },
      { label: 'Fast', step: 6, path: 25 }
    ],
    defaultSpeed: 1
  };

  // Neighbor order matters for how each algorithm "feels": up, right, down, left.
  const DIRECTIONS = [
    [-1, 0],
    [0, 1],
    [1, 0],
    [0, -1]
  ];

  const MARK = { NONE: 0, QUEUED: 1, VISITED: 2, PATH: 3 };

  const ALGORITHM_INFO = {
    bfs: {
      name: 'BFS',
      description:
        'Explores outward in layers using a queue, so it reaches every cell at distance d before any at d + 1. It always finds the shortest path on an unweighted grid.',
      guaranteesShortest: true,
      pathNote: 'Shortest possible',
      foundSuffix: 'BFS guarantees this is the shortest route.'
    },
    dfs: {
      name: 'DFS',
      description:
        'Follows one branch as deep as it can using a stack, then backtracks. It finds a path if one exists, but the path is usually long and winding.',
      guaranteesShortest: false,
      pathNote: 'Not guaranteed shortest',
      foundSuffix: 'DFS does not guarantee this is the shortest route.'
    }
  };

  /* ------------------------------------------------------------------------
     2. Search core

     Cells are addressed by a flat index: index = row * cols + col.
     Every search returns:
       {
         found:  boolean,
         frames: [{ visit: index, discovered: [index, ...] }, ...],
         path:   [startIndex, ..., targetIndex]  (empty when not found)
       }
     A "frame" is one node expansion: the node that was visited, plus the
     neighbors that were added to the queue/stack while expanding it. The
     animation engine simply replays the frames.
     ------------------------------------------------------------------------ */

  function neighborsOf(index, rows, cols) {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const result = [];

    for (const [dr, dc] of DIRECTIONS) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        result.push(nr * cols + nc);
      }
    }
    return result;
  }

  /**
   * Walks parent pointers from the target back to the start, then reverses.
   * Returns [] if the chain does not lead back to the start.
   */
  function reconstructPath(parent, start, target) {
    const path = [];
    let current = target;
    let guard = parent.length + 1; // protects against a corrupted parent chain

    while (current !== -1 && guard-- > 0) {
      path.push(current);
      if (current === start) break;
      current = parent[current];
    }

    path.reverse();
    return path[0] === start ? path : [];
  }

  /**
   * Breadth-first search. A node is marked as seen (and given its parent) the
   * moment it is enqueued, which is what guarantees the shortest path.
   */
  function breadthFirstSearch({ rows, cols, walls, start, target }) {
    const total = rows * cols;
    const parent = new Int32Array(total).fill(-1);
    const seen = new Uint8Array(total);
    const frames = [];
    const queue = [start];
    let head = 0;

    seen[start] = 1;

    while (head < queue.length) {
      const current = queue[head++];
      const frame = { visit: current, discovered: [] };
      frames.push(frame);

      if (current === target) {
        return { found: true, frames, path: reconstructPath(parent, start, target) };
      }

      for (const next of neighborsOf(current, rows, cols)) {
        if (walls[next] || seen[next]) continue;
        seen[next] = 1;
        parent[next] = current;
        queue.push(next);
        frame.discovered.push(next);
      }
    }

    return { found: false, frames, path: [] };
  }

  /**
   * Depth-first search (iterative, explicit stack). Each stack entry remembers
   * which node pushed it, and the parent pointer is recorded when the entry is
   * popped and actually visited. Neighbors are pushed in reverse so the first
   * direction in DIRECTIONS (up) is explored first.
   */
  function depthFirstSearch({ rows, cols, walls, start, target }) {
    const total = rows * cols;
    const parent = new Int32Array(total).fill(-1);
    const visited = new Uint8Array(total);
    const discovered = new Uint8Array(total);
    const frames = [];
    const stack = [{ node: start, from: -1 }];

    discovered[start] = 1;

    while (stack.length > 0) {
      const { node, from } = stack.pop();
      if (visited[node]) continue; // a stale duplicate entry

      visited[node] = 1;
      parent[node] = from;

      const frame = { visit: node, discovered: [] };
      frames.push(frame);

      if (node === target) {
        return { found: true, frames, path: reconstructPath(parent, start, target) };
      }

      const neighbors = neighborsOf(node, rows, cols);
      for (let i = neighbors.length - 1; i >= 0; i--) {
        const next = neighbors[i];
        if (walls[next] || visited[next]) continue;
        stack.push({ node: next, from: node });
        if (!discovered[next]) {
          discovered[next] = 1;
          frame.discovered.push(next);
        }
      }
    }

    return { found: false, frames, path: [] };
  }

  const ALGORITHMS = {
    bfs: breadthFirstSearch,
    dfs: depthFirstSearch
  };

  function runSearch(algorithm, grid) {
    const search = ALGORITHMS[algorithm];
    if (!search) throw new Error('Unknown algorithm: ' + algorithm);
    return search(grid);
  }

  /** Cells on a straight line between two indices (Bresenham), inclusive. */
  function cellsOnLine(from, to, cols) {
    let r0 = Math.floor(from / cols);
    let c0 = from % cols;
    const r1 = Math.floor(to / cols);
    const c1 = to % cols;
    const dr = Math.abs(r1 - r0);
    const dc = Math.abs(c1 - c0);
    const sr = r0 < r1 ? 1 : -1;
    const sc = c0 < c1 ? 1 : -1;
    let err = dc - dr;
    const cells = [];

    for (;;) {
      cells.push(r0 * cols + c0);
      if (r0 === r1 && c0 === c1) break;
      const e2 = 2 * err;
      if (e2 > -dr) {
        err -= dr;
        c0 += sc;
      }
      if (e2 < dc) {
        err += dc;
        r0 += sr;
      }
    }
    return cells;
  }

  function defaultNodes(rows, cols) {
    const row = Math.floor(rows / 2);
    const offset = Math.floor(cols / 5);
    return {
      start: row * cols + offset,
      target: row * cols + (cols - 1 - offset)
    };
  }

  // Exported so the search functions can be unit-tested in Node.
  const core = {
    neighborsOf,
    reconstructPath,
    breadthFirstSearch,
    depthFirstSearch,
    runSearch,
    cellsOnLine,
    defaultNodes
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = core;
  }

  /* ------------------------------------------------------------------------
     3. UI
     ------------------------------------------------------------------------ */

  function init() {
    const $ = (id) => document.getElementById(id);

    const els = {
      board: $('board'),
      algorithm: $('algorithm'),
      algoDescription: $('algo-description'),
      speed: $('speed'),
      speedValue: $('speed-value'),
      visualize: $('visualize'),
      clear: $('clear-path'),
      reset: $('reset-grid'),
      visited: $('metric-visited'),
      path: $('metric-path'),
      pathNote: $('metric-path-note'),
      status: $('status')
    };

    const rows = Math.max(2, Math.floor(CONFIG.rows));
    const cols = Math.max(2, Math.floor(CONFIG.cols));
    const total = rows * cols;

    const initial = defaultNodes(rows, cols);
    const state = {
      phase: 'idle', // 'idle' | 'running' | 'done'
      algorithm: 'bfs',
      speed: Math.min(CONFIG.speeds.length - 1, Math.max(0, CONFIG.defaultSpeed)),
      walls: new Uint8Array(total),
      start: initial.start,
      target: initial.target,
      current: -1,
      comparison: { bfs: null, dfs: null }
    };
    const marks = new Uint8Array(total);

    /* ----- Build the grid ----- */

    const board = els.board;
    board.style.setProperty('--cols', String(cols));
    board.style.setProperty('--rows', String(rows));
    board.setAttribute(
      'aria-label',
      rows + ' by ' + cols + ' grid. Drag with a mouse or finger to draw walls, and drag the start and target nodes to move them.'
    );

    const cells = new Array(total);
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < total; i++) {
      const el = document.createElement('div');
      el.className = 'cell';
      el.dataset.index = String(i);
      cells[i] = el;
      fragment.appendChild(el);
    }
    board.appendChild(fragment);

    /* ----- Rendering helpers ----- */

    function renderCell(i) {
      let cls = 'cell';

      if (i === state.start) {
        cls += ' start';
      } else if (i === state.target) {
        cls += ' target';
      } else if (state.walls[i]) {
        cls += ' wall';
      } else {
        const mark = marks[i];
        if (mark === MARK.PATH) cls += ' path';
        else if (mark === MARK.VISITED) cls += ' visited';
        else if (mark === MARK.QUEUED) cls += ' queued';
        if (i === state.current) cls += ' current';
      }

      if (cells[i].className !== cls) cells[i].className = cls;
    }

    function renderAll() {
      for (let i = 0; i < total; i++) renderCell(i);
    }

    function setStatus(text, tone) {
      els.status.textContent = text;
      els.status.dataset.tone = tone || 'info';
    }

    function showIdleStatus() {
      setStatus(
        'Draw walls, move the start and target nodes, then press Visualize.',
        'info'
      );
    }

    function updateMetrics(visited, pathText, note) {
      els.visited.textContent = String(visited);
      els.path.textContent = pathText;
      els.pathNote.textContent = note;
    }

    function resetMetrics() {
      updateMetrics(0, '—', 'Steps, start to target');
    }

    function renderComparison() {
      Object.keys(ALGORITHM_INFO).forEach((key) => {
        const row = document.querySelector('[data-compare="' + key + '"]');
        if (!row) return;
        const record = state.comparison[key];
        row.querySelector('.cmp-visited').textContent = record ? String(record.visited) : '—';
        row.querySelector('.cmp-path').textContent = record
          ? record.found
            ? String(record.steps)
            : 'None'
          : '—';
      });
    }

    function renderAlgorithmInfo() {
      els.algoDescription.textContent = ALGORITHM_INFO[state.algorithm].description;
    }

    function renderSpeed() {
      const speed = CONFIG.speeds[state.speed];
      els.speedValue.textContent = speed.label;
      els.speed.setAttribute('aria-valuetext', speed.label);
    }

    function setPhase(phase) {
      state.phase = phase;
      const running = phase === 'running';

      els.visualize.disabled = running;
      els.clear.disabled = running;
      els.reset.disabled = running;
      els.algorithm.disabled = running;
      els.visualize.textContent = running ? 'Running…' : 'Visualize';

      board.classList.toggle('locked', running);
      board.setAttribute('aria-busy', String(running));
    }

    /* ----- State transitions ----- */

    function clearPath() {
      marks.fill(MARK.NONE);
      state.current = -1;
      renderAll();
      resetMetrics();
      setPhase('idle');
      showIdleStatus();
    }

    function invalidateComparison() {
      if (!state.comparison.bfs && !state.comparison.dfs) return;
      state.comparison = { bfs: null, dfs: null };
      renderComparison();
    }

    function resetGrid() {
      const nodes = defaultNodes(rows, cols);
      state.walls.fill(0);
      state.start = nodes.start;
      state.target = nodes.target;
      invalidateComparison();
      clearPath();
    }

    // Called right before any change to walls or node positions. Stale results
    // would no longer match the grid, so they are wiped first.
    function beforeEdit() {
      if (state.phase === 'done') clearPath();
      invalidateComparison();
    }

    /* ----- Animation engine ----- */

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    async function playFrames(frames) {
      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];

        if (state.current !== -1) {
          const previous = state.current;
          state.current = -1;
          renderCell(previous);
        }

        marks[frame.visit] = MARK.VISITED;
        state.current = frame.visit;
        renderCell(frame.visit);

        for (const index of frame.discovered) {
          if (marks[index] === MARK.NONE) {
            marks[index] = MARK.QUEUED;
            renderCell(index);
          }
        }

        els.visited.textContent = String(i + 1);
        await sleep(CONFIG.speeds[state.speed].step); // read live so the slider works mid-run
      }

      if (state.current !== -1) {
        const last = state.current;
        state.current = -1;
        renderCell(last);
      }
    }

    async function playPath(path) {
      // The first and last entries are the start and target nodes, which keep their own look.
      for (let i = 1; i < path.length - 1; i++) {
        marks[path[i]] = MARK.PATH;
        renderCell(path[i]);
        await sleep(CONFIG.speeds[state.speed].path);
      }
    }

    function flashUnreachable() {
      const targetCell = cells[state.target];
      targetCell.classList.add('unreachable');
      setTimeout(() => targetCell.classList.remove('unreachable'), 600);
    }

    function completeRun(result, info) {
      const visited = result.frames.length;
      const steps = result.found ? result.path.length - 1 : null;

      state.comparison[state.algorithm] = { visited, steps, found: result.found };
      renderComparison();
      setPhase('done');

      if (result.found) {
        updateMetrics(visited, String(steps), info.pathNote);

        if (steps === 1) {
          setStatus(
            'Start and target are adjacent, so the path is a single step. ' +
              info.name + ' visited ' + visited + ' nodes.',
            'success'
          );
        } else {
          setStatus(
            info.name + ' found a path of ' + steps + ' steps after visiting ' + visited +
              ' nodes. ' + info.foundSuffix,
            'success'
          );
        }
        return;
      }

      updateMetrics(visited, 'None', 'No route exists');
      flashUnreachable();

      if (visited === 1) {
        setStatus(
          'The start node is boxed in by walls, so nothing else can be reached.',
          'error'
        );
      } else {
        setStatus(
          'No path exists: walls block every route to the target. ' + info.name +
            ' checked all ' + visited + ' reachable nodes.',
          'error'
        );
      }
    }

    async function visualize() {
      if (state.phase === 'running') return;
      if (state.phase === 'done') clearPath();

      const info = ALGORITHM_INFO[state.algorithm];
      const result = runSearch(state.algorithm, {
        rows,
        cols,
        walls: state.walls,
        start: state.start,
        target: state.target
      });

      setPhase('running');
      updateMetrics(0, '—', 'Steps, start to target');
      setStatus('Running ' + info.name + '…', 'progress');

      try {
        await playFrames(result.frames);
        if (result.found) await playPath(result.path);
        completeRun(result, info);
      } catch (error) {
        console.error(error);
        clearPath();
        setStatus('Something went wrong during the animation. Please try again.', 'error');
      } finally {
        if (state.phase === 'running') setPhase('idle');
      }
    }

    /* ----- Pointer interactions ----- */

    let drag = null; // { kind: 'start' | 'target' | 'paint', erase?: boolean, last?: number }

    function cellIndexFromPoint(x, y) {
      const element = document.elementFromPoint(x, y);
      if (!element) return -1;
      const cell = element.closest('.cell');
      if (!cell || !board.contains(cell)) return -1;
      return Number(cell.dataset.index);
    }

    function paintWall(index, erase) {
      if (index === state.start || index === state.target) return;
      const wanted = erase ? 0 : 1;
      if (state.walls[index] === wanted) return;

      beforeEdit();
      state.walls[index] = wanted;
      renderCell(index);
    }

    function moveNode(kind, index) {
      const other = kind === 'start' ? state.target : state.start;
      if (index === other || index === state[kind]) return;

      beforeEdit();
      const previous = state[kind];
      state[kind] = index;
      state.walls[index] = 0; // a node replaces any wall underneath it
      renderCell(previous);
      renderCell(index);
    }

    function onPointerDown(event) {
      if (state.phase === 'running') return;
      if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 2) return;

      const index = cellIndexFromPoint(event.clientX, event.clientY);
      if (index < 0) return;

      const isNode = index === state.start || index === state.target;
      if (isNode && event.button === 2) return;

      event.preventDefault();

      if (index === state.start) {
        drag = { kind: 'start' };
      } else if (index === state.target) {
        drag = { kind: 'target' };
      } else {
        const erase = event.button === 2 || state.walls[index] === 1;
        drag = { kind: 'paint', erase, last: index };
        paintWall(index, erase);
      }

      try {
        board.setPointerCapture(event.pointerId);
      } catch (err) {
        /* Pointer capture is optional; dragging still works without it. */
      }
      board.classList.add('dragging');
    }

    function onPointerMove(event) {
      if (!drag) return;

      const index = cellIndexFromPoint(event.clientX, event.clientY);
      if (index < 0) return;

      if (drag.kind === 'paint') {
        if (index === drag.last) return;
        // Fill in cells skipped by fast pointer movement.
        cellsOnLine(drag.last, index, cols).forEach((cell) => paintWall(cell, drag.erase));
        drag.last = index;
      } else {
        moveNode(drag.kind, index);
      }
    }

    function endDrag() {
      drag = null;
      board.classList.remove('dragging');
    }

    board.addEventListener('pointerdown', onPointerDown);
    board.addEventListener('pointermove', onPointerMove);
    board.addEventListener('pointerup', endDrag);
    board.addEventListener('pointercancel', endDrag);
    board.addEventListener('lostpointercapture', endDrag);
    board.addEventListener('contextmenu', (event) => event.preventDefault());
    board.addEventListener('dragstart', (event) => event.preventDefault());

    /* ----- Controls ----- */

    els.visualize.addEventListener('click', visualize);

    els.clear.addEventListener('click', () => {
      if (state.phase !== 'running') clearPath();
    });

    els.reset.addEventListener('click', () => {
      if (state.phase !== 'running') resetGrid();
    });

    els.algorithm.addEventListener('change', () => {
      state.algorithm = els.algorithm.value in ALGORITHM_INFO ? els.algorithm.value : 'bfs';
      renderAlgorithmInfo();
      if (state.phase === 'done') clearPath();
    });

    els.speed.max = String(CONFIG.speeds.length - 1);
    els.speed.value = String(state.speed);
    els.speed.addEventListener('input', () => {
      state.speed = Math.min(CONFIG.speeds.length - 1, Math.max(0, Number(els.speed.value) || 0));
      renderSpeed();
    });

    /* ----- Boot ----- */

    els.algorithm.value = state.algorithm;
    renderAlgorithmInfo();
    renderSpeed();
    renderComparison();
    renderAll();
    resetMetrics();
    setPhase('idle');
    showIdleStatus();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
})();
