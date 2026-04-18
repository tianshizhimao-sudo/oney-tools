/* =========================================================
   Flow Visualiser — minimal SVG editor (Phase 3)
   Same brand shell, same namespaced storage, same export contract.
   Not a schema form — uses mountCanvasPage instead of mountToolPage.
   ========================================================= */

import { storage, SCOPES } from '../app/storage.js';

const STORE_KEY = 'flow-visualiser';
const NODE_W = 160;
const NODE_H = 56;

function uid(prefix = 'n') {
  return prefix + '-' + Math.random().toString(36).slice(2, 8);
}

function escapeText(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function defaultState() {
  return {
    nodes: [
      { id: 'borrower', label: 'Borrower', x: 80, y: 80 },
      { id: 'lender', label: 'Lender', x: 360, y: 80 },
      { id: 'security', label: 'Security', x: 220, y: 220 },
    ],
    edges: [
      { id: 'e1', from: 'lender', to: 'borrower', label: 'Loan' },
      { id: 'e2', from: 'borrower', to: 'security', label: 'Owns' },
      { id: 'e3', from: 'security', to: 'lender', label: 'Mortgage' },
    ],
  };
}

export function mountFlowEditor(rootEl) {
  let state = storage.get(SCOPES.ANALYSE, STORE_KEY) || defaultState();
  let selected = null;       // { type: 'node'|'edge', id }
  let connectFrom = null;    // node id awaiting target

  function persist() { storage.set(SCOPES.ANALYSE, STORE_KEY, state); }

  function renderToolbar() {
    return `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
        <button type="button" class="btn btn-primary" data-action="add-node">+ Add node</button>
        <button type="button" class="btn btn-secondary" data-action="connect">Connect ${connectFrom ? '(pick target)' : ''}</button>
        <button type="button" class="btn btn-secondary" data-action="rename">Rename</button>
        <button type="button" class="btn btn-secondary" data-action="delete">Delete</button>
        <span style="flex:1"></span>
        <button type="button" class="btn btn-ghost" data-action="export">Export JSON</button>
        <button type="button" class="btn btn-ghost" data-action="import">Import</button>
        <button type="button" class="btn btn-ghost" data-action="reset">Reset</button>
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">
        Click a node to select. Drag to move. Use <strong>Connect</strong> with two consecutive node selections to draw a flow.
      </div>
    `;
  }

  function renderSVG() {
    const nodeMap = Object.fromEntries(state.nodes.map((n) => [n.id, n]));

    const edges = state.edges.map((e) => {
      const a = nodeMap[e.from]; const b = nodeMap[e.to];
      if (!a || !b) return '';
      const x1 = a.x + NODE_W / 2, y1 = a.y + NODE_H / 2;
      const x2 = b.x + NODE_W / 2, y2 = b.y + NODE_H / 2;
      const isSelected = selected && selected.type === 'edge' && selected.id === e.id;
      const stroke = isSelected ? '#2ECC85' : 'rgba(255,255,255,0.40)';
      const labelMid = `${(x1 + x2) / 2},${(y1 + y2) / 2}`;
      return `
        <g data-edge="${e.id}" style="cursor:pointer">
          <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
                stroke="${stroke}" stroke-width="${isSelected ? 2.5 : 1.6}"
                marker-end="url(#arrow)"/>
          ${e.label ? `<rect x="${(x1 + x2) / 2 - 36}" y="${(y1 + y2) / 2 - 10}" width="72" height="20" rx="6"
                       fill="rgba(10,10,10,0.85)" stroke="rgba(255,255,255,0.10)"/>
                       <text x="${labelMid}" text-anchor="middle" dominant-baseline="middle"
                       font-size="11" fill="#fff" font-family="Inter,sans-serif">${escapeText(e.label)}</text>` : ''}
        </g>
      `;
    }).join('');

    const nodes = state.nodes.map((n) => {
      const isSelected = selected && selected.type === 'node' && selected.id === n.id;
      const isConnectSrc = connectFrom === n.id;
      const stroke = isConnectSrc ? '#f2b84b' : (isSelected ? '#2ECC85' : 'rgba(255,255,255,0.20)');
      const fill = isSelected ? 'rgba(46,204,133,0.16)' : 'rgba(37,37,64,0.92)';
      return `
        <g data-node="${n.id}" transform="translate(${n.x},${n.y})" style="cursor:move">
          <rect width="${NODE_W}" height="${NODE_H}" rx="12"
                fill="${fill}" stroke="${stroke}" stroke-width="${isSelected ? 2 : 1.4}"/>
          <text x="${NODE_W / 2}" y="${NODE_H / 2}" text-anchor="middle" dominant-baseline="middle"
                font-size="14" fill="#fff" font-family="Inter,sans-serif" font-weight="600">
            ${escapeText(n.label)}
          </text>
        </g>
      `;
    }).join('');

    return `
      <svg id="flow-canvas" viewBox="0 0 800 480"
           style="width:100%;height:480px;background:rgba(255,255,255,0.02);
                  border:1px solid var(--border);border-radius:14px;display:block">
        <defs>
          <marker id="arrow" viewBox="0 -5 10 10" refX="10" refY="0"
                  markerWidth="9" markerHeight="9" orient="auto">
            <path d="M0,-4L10,0L0,4" fill="rgba(255,255,255,0.55)"/>
          </marker>
        </defs>
        ${edges}
        ${nodes}
      </svg>
    `;
  }

  function render() {
    rootEl.innerHTML = renderToolbar() + renderSVG();
    bind();
  }

  function bind() {
    rootEl.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => onAction(e.currentTarget.dataset.action));
    });

    const svg = rootEl.querySelector('#flow-canvas');
    if (!svg) return;

    svg.addEventListener('mousedown', (e) => {
      const nodeEl = e.target.closest('[data-node]');
      const edgeEl = e.target.closest('[data-edge]');
      if (nodeEl) {
        const id = nodeEl.dataset.node;
        if (connectFrom && connectFrom !== id) {
          state.edges.push({ id: uid('e'), from: connectFrom, to: id, label: '' });
          connectFrom = null;
          persist(); render();
          return;
        }
        if (connectFrom === id) {
          connectFrom = null; render(); return;
        }
        selected = { type: 'node', id };
        startDrag(e, id, svg);
        render();
      } else if (edgeEl) {
        selected = { type: 'edge', id: edgeEl.dataset.edge };
        render();
      } else {
        selected = null;
        render();
      }
    });
  }

  function startDrag(e, nodeId, svg) {
    const node = state.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const startPt = svgPoint(svg, e);
    const startX = node.x, startY = node.y;
    function onMove(ev) {
      const pt = svgPoint(svg, ev);
      node.x = startX + (pt.x - startPt.x);
      node.y = startY + (pt.y - startPt.y);
      render();
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      persist();
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function svgPoint(svg, evt) {
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  function onAction(action) {
    switch (action) {
      case 'add-node': {
        const label = prompt('Node label?', 'Entity');
        if (!label) return;
        state.nodes.push({ id: uid('n'), label, x: 60 + Math.random() * 400, y: 60 + Math.random() * 280 });
        persist(); render();
        break;
      }
      case 'connect': {
        if (selected && selected.type === 'node') {
          connectFrom = selected.id;
          render();
        } else {
          alert('Select a source node first, then click Connect.');
        }
        break;
      }
      case 'rename': {
        if (!selected) return;
        if (selected.type === 'node') {
          const node = state.nodes.find((n) => n.id === selected.id);
          if (!node) return;
          const next = prompt('Rename node:', node.label);
          if (next != null) { node.label = next; persist(); render(); }
        } else {
          const edge = state.edges.find((e) => e.id === selected.id);
          if (!edge) return;
          const next = prompt('Edge label:', edge.label || '');
          if (next != null) { edge.label = next; persist(); render(); }
        }
        break;
      }
      case 'delete': {
        if (!selected) return;
        if (selected.type === 'node') {
          state.nodes = state.nodes.filter((n) => n.id !== selected.id);
          state.edges = state.edges.filter((e) => e.from !== selected.id && e.to !== selected.id);
        } else {
          state.edges = state.edges.filter((e) => e.id !== selected.id);
        }
        selected = null;
        persist(); render();
        break;
      }
      case 'export': {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'oney-flow.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        break;
      }
      case 'import': {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = 'application/json';
        input.addEventListener('change', () => {
          const file = input.files[0]; if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const next = JSON.parse(reader.result);
              if (Array.isArray(next.nodes) && Array.isArray(next.edges)) {
                state = next; persist(); render();
              } else {
                alert('Invalid flow file.');
              }
            } catch { alert('Could not parse JSON.'); }
          };
          reader.readAsText(file);
        });
        input.click();
        break;
      }
      case 'reset': {
        if (!confirm('Reset to default flow?')) return;
        state = defaultState();
        selected = null; connectFrom = null;
        persist(); render();
        break;
      }
    }
  }

  render();
}
