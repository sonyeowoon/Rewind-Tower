import { createGame, transition } from '../engine.js';
const actions = ['up','down','left','right','rewind'];
export function solve(stageId, allowRewind = true) {
  const start = createGame(stageId), queue = [{ state:start, parent:-1, action:null }], visited = new Set(), heap = [];
  // Best-first reachability search: prefer outstanding collectibles. Optimal score is not asserted.
  const priority = s => {
    let pending = 0, nearest = Infinity;
    s.mapData.forEach((row,r) => row.forEach((tile,c) => {
      if (['G','H','K'].includes(tile) || (s.isExitOpen && tile === 'E')) {
        pending += tile === 'G' ? 50 : tile === 'E' ? 0 : 15;
        nearest = Math.min(nearest, Math.abs(r-s.playerPosition.row)+Math.abs(c-s.playerPosition.col));
      }
    }));
    return pending + (nearest === Infinity ? 0 : nearest) + (s.moveCount+s.rewindUsedCount)*.15;
  };
  const push = index => {
    const entry = { index, rank:priority(queue[index].state) }; heap.push(entry);
    let i=heap.length-1;
    while (i>0) { const p=(i-1)>>1; if(heap[p].rank<=entry.rank) break; heap[i]=heap[p]; i=p; }
    heap[i]=entry;
  };
  const pop = () => {
    const first=heap[0], last=heap.pop();
    if(heap.length) {
      let i=0;
      while(i*2+1<heap.length) { let child=i*2+1; if(child+1<heap.length&&heap[child+1].rank<heap[child].rank)child++; if(heap[child].rank>=last.rank)break; heap[i]=heap[child];i=child; }
      heap[i]=last;
    }
    return first.index;
  };
  const signature = s => `${s.playerPosition.row},${s.playerPosition.col}|${s.mapData.map(row=>row.join('')).join('')}|${JSON.stringify(s.rewindPosition)}|${s.rewindCount}|${s.keys}`;
  visited.add(signature(start));
  push(0);
  while (heap.length) {
    const index = pop();
    const current = queue[index];
    if (current.state.resultType === 'WIN') {
      const path = []; let cursor = index;
      while (queue[cursor].parent >= 0) { path.push(queue[cursor].action); cursor = queue[cursor].parent; }
      return { actions:path.reverse(), state:current.state, explored:visited.size };
    }
    if (queue.length > 200000) throw new Error(`Solver limit at stage ${stageId}`);
    for (const action of actions) {
      if (!allowRewind && action === 'rewind') continue;
      const next = transition(current.state, action);
      if (next.state === current.state || next.state.resultType === 'LOSE') continue;
      const key = signature(next.state); if (visited.has(key)) continue;
      visited.add(key); queue.push({ state:next.state, parent:index, action }); push(queue.length-1);
    }
  }
  return null;
}
