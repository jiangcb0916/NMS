#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const APP_JS_PATH = path.join(PROJECT_ROOT, 'static/js/app.js');
const WORKSPACE_CSS_PATH = path.join(PROJECT_ROOT, 'static/css/workspace.css');

function createClassList() {
    const classes = new Set();
    return {
        contains(name) {
            return classes.has(name);
        },
        toggle(name, force) {
            const enabled = force === undefined ? !classes.has(name) : Boolean(force);
            if (enabled) {
                classes.add(name);
            } else {
                classes.delete(name);
            }
            return enabled;
        },
    };
}

function createElement(overrides = {}) {
    const attributes = new Map();
    return {
        classList: createClassList(),
        className: '',
        dataset: {},
        disabled: false,
        hidden: false,
        innerHTML: '',
        style: {},
        textContent: '',
        value: '',
        getAttribute(name) {
            return attributes.get(name);
        },
        removeAttribute(name) {
            attributes.delete(name);
        },
        setAttribute(name, value) {
            attributes.set(name, String(value));
        },
        ...overrides,
    };
}

function extractCssBlock(css, headerPattern) {
    const header = css.match(headerPattern);
    assert.ok(header, `CSS block header not found: ${headerPattern}`);
    const start = css.indexOf('{', header.index + header[0].length);
    assert.notEqual(start, -1, `CSS block opening brace not found: ${headerPattern}`);
    let depth = 0;
    for (let index = start; index < css.length; index += 1) {
        if (css[index] === '{') {
            depth += 1;
        } else if (css[index] === '}') {
            depth -= 1;
            if (depth === 0) {
                return css.slice(start + 1, index);
            }
        }
    }
    assert.fail(`CSS block closing brace not found: ${headerPattern}`);
}

function loadTopologyApp() {
    const elements = new Map();
    const document = {
        addEventListener() {
            // Intentionally ignore DOMContentLoaded so page startup and timers do not run.
        },
        getElementById(id) {
            return elements.get(id) || null;
        },
        querySelectorAll() {
            return [];
        },
        visibilityState: 'visible',
    };
    const window = {
        document,
        localStorage: {
            getItem() {
                return null;
            },
            setItem() {},
        },
        matchMedia() {
            return {matches: false};
        },
        setInterval() {
            throw new Error('page timers must not start in topology UI tests');
        },
    };
    const context = vm.createContext({
        URLSearchParams,
        console,
        document,
        window,
    });
    const source = fs.readFileSync(APP_JS_PATH, 'utf8');
    vm.runInContext(`${source}\n;globalThis.__topologyTest = {\n        buildTopologyGraph,\n        clearTopologyPath,\n        renderTopologyEdge,\n        renderTopologyGraph,\n        topologyState,\n    };`, context, {filename: APP_JS_PATH});
    return {elements, ...context.__topologyTest};
}

function topologyFixture() {
    return {
        nodes: [
            {id: 'core', type: 'core', name: '核心交换机', ip: '172.16.100.5', status: 'online'},
            {id: 'access', type: 'switch', name: '接入交换机', ip: '172.16.100.8', status: 'online'},
            {id: 'firewall', type: 'firewall', name: '防火墙', ip: '172.16.100.3', status: 'online'},
        ],
        edges: [
            {id: 'core-access', source: 'core', target: 'access', status: 'online', link_count: 1, links: []},
            {id: 'core-firewall', source: 'core', target: 'firewall', status: 'online', link_count: 1, links: []},
        ],
    };
}

function confirmedTrace() {
    return {
        target_ip: '172.16.70.17',
        target_mac: '9009-d091-478f',
        target_name: '测试终端',
        final_switch: '172.16.100.8',
        final_interface: 'GE1/0/35',
        result_type: 'terminal',
        hops: [
            {switch_ip: '172.16.100.5', monitor_status: 'online', ingress_interface: 'GE1/0/1'},
            {switch_ip: '172.16.100.8', monitor_status: 'online', ingress_interface: 'GE1/0/35'},
        ],
        connectivity: {
            checked_at: '2026-08-03 10:00:00',
            path_status: 'online',
            terminal: {status: 'online'},
            firewall: {status: 'offline', error: 'SNMP timeout'},
        },
    };
}

const app = loadTopologyApp();

test.beforeEach(() => {
    app.elements.clear();
    Object.assign(app.topologyState, {
        data: topologyFixture(),
        devices: [],
        trace: confirmedTrace(),
        traceMessage: '已定位到普通终端接口',
        traceCode: 0,
        selectedNodeId: '',
        pickerOpen: false,
        pickerIndex: -1,
        pickerMatches: [],
        pickerSelection: null,
    });
});

// TC-001, TC-002
test('confirmed trace activates only the core, access switch, terminal, and their path edges', () => {
    const graph = app.buildTopologyGraph();
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    const terminal = graph.nodes.find((node) => node.type === 'terminal');
    const coreAccess = graph.edges.find((edge) => edge.id === 'core-access');
    const firewallEdge = graph.edges.find((edge) => edge.id === 'core-firewall');
    const terminalEdge = graph.edges.find((edge) => edge.source === 'access' && edge.target === terminal.id);

    assert.equal(nodeById.get('core').active, true);
    assert.equal(nodeById.get('access').active, true);
    assert.equal(terminal.active, true);
    assert.equal(coreAccess.active, true);
    assert.equal(terminalEdge.active, true);
    assert.equal(terminalEdge.status, 'online');

    assert.equal(nodeById.get('firewall').status, 'offline');
    assert.equal(nodeById.get('firewall').active, false);
    assert.equal(firewallEdge.status, 'offline');
    assert.equal(firewallEdge.active, false);
});

// TC-003
test('unconfirmed terminal segment stays unknown and inactive', () => {
    app.topologyState.trace.final_interface = '';
    app.topologyState.trace.result_type = 'partial';

    const graph = app.buildTopologyGraph();
    const terminal = graph.nodes.find((node) => node.type === 'terminal');
    const terminalEdge = graph.edges.find((edge) => edge.source === 'access' && edge.target === terminal.id);

    assert.equal(terminalEdge.status, 'unknown');
    assert.equal(terminalEdge.active, false);
});

// TC-004, TC-005
test('active edges render track and flow layers with status classes', () => {
    const positions = new Map([
        ['source', {x: 100, y: 100}],
        ['target', {x: 200, y: 200}],
    ]);
    const nodes = new Map([
        ['source', {type: 'core'}],
        ['target', {type: 'switch'}],
    ]);

    for (const status of ['offline', 'unknown']) {
        const html = app.renderTopologyEdge(
            {id: status, source: 'source', target: 'target', status, active: true},
            positions,
            nodes,
        );
        assert.match(html, new RegExp(`topology-edge ${status} .*active-path`));
        assert.match(html, /class="topology-edge-track"/);
        assert.match(html, /class="topology-edge-flow"/);
        assert.equal((html.match(/<path/g) || []).length, 2);
    }

    const ordinaryHtml = app.renderTopologyEdge(
        {id: 'ordinary', source: 'source', target: 'target', status: 'online', active: false},
        positions,
        nodes,
    );
    assert.doesNotMatch(ordinaryHtml, /topology-edge-(?:track|flow)/);
    assert.equal((ordinaryHtml.match(/<path/g) || []).length, 1);
});

// CR-001: active path SVG groups must be painted last.
test('graph renderer paints inactive edges before active path edges', () => {
    const workspace = {style: {setProperty() {}}};
    const stage = createElement({
        clientWidth: 900,
        closest() {
            return workspace;
        },
    });
    const edgeLayer = createElement();
    const nodeLayer = createElement();
    app.elements.set('topology-stage', stage);
    app.elements.set('topology-edges', edgeLayer);
    app.elements.set('topology-nodes', nodeLayer);
    app.elements.set('topology-layer-guides', createElement());
    app.elements.set('topology-empty', createElement());

    app.renderTopologyGraph();

    const edgeClasses = [...edgeLayer.innerHTML.matchAll(/<g class="([^"]*topology-edge[^"]*)">/g)]
        .map((match) => match[1]);
    const activeIndexes = edgeClasses
        .map((className, index) => className.includes('active-path') ? index : -1)
        .filter((index) => index >= 0);
    const inactiveIndexes = edgeClasses
        .map((className, index) => className.includes('active-path') ? -1 : index)
        .filter((index) => index >= 0);
    assert.equal(stage.classList.contains('has-active-path'), true);
    assert.equal(inactiveIndexes.length, 1, `expected one inactive edge, got ${edgeClasses.join(' | ')}`);
    assert.equal(activeIndexes.length, 2, `expected two active edges, got ${edgeClasses.join(' | ')}`);
    assert.ok(
        activeIndexes[0] > inactiveIndexes.at(-1),
        `edge order was ${edgeClasses.join(' | ')}`,
    );
});

// TC-006
test('clear resets trace, selection, picker, controls, and active edges', () => {
    const input = createElement({value: '测试终端'});
    const clearButton = createElement({disabled: false});
    const badge = createElement();
    const summary = createElement();
    app.elements.set('topology-search-input', input);
    app.elements.set('topology-picker-toggle', createElement());
    app.elements.set('topology-device-picker', createElement());
    app.elements.set('topology-clear-path', clearButton);
    app.elements.set('topology-path-status', badge);
    app.elements.set('topology-trace-summary', summary);
    app.topologyState.selectedNodeId = 'access';
    app.topologyState.pickerSelection = {label: '测试终端', target: '172.16.70.17'};

    app.clearTopologyPath();

    assert.equal(app.topologyState.trace, null);
    assert.equal(app.topologyState.traceMessage, '');
    assert.equal(app.topologyState.traceCode, 0);
    assert.equal(app.topologyState.selectedNodeId, '');
    assert.equal(app.topologyState.pickerSelection, null);
    assert.equal(input.value, '');
    assert.equal(clearButton.disabled, true);
    assert.equal(badge.textContent, '未检测');
    assert.equal(summary.textContent, '选择终端后显示实时路径与分层检测结果');
    assert.equal(app.buildTopologyGraph().edges.some((edge) => edge.active), false);
});

// TC-007
test('workspace CSS defines dimming, flow animation, status colors, and reduced motion fallback', () => {
    const css = fs.readFileSync(WORKSPACE_CSS_PATH, 'utf8');
    const reducedMotionHeader = /@media\s*\(prefers-reduced-motion:\s*reduce\)/;
    const reducedMotionBlock = extractCssBlock(
        css,
        reducedMotionHeader,
    );
    const invalidReducedMotionBlock = extractCssBlock(`
        @media (prefers-reduced-motion: reduce) {}
        .app-body .topology-edge.active-path .topology-edge-flow {
            display: none;
            animation: none;
        }
    `, reducedMotionHeader);

    assert.match(css, /\.topology-stage\.has-active-path\s+\.topology-edge:not\(\.active-path\) path\s*{[^}]*opacity:\s*0\.18/s);
    assert.match(css, /\.topology-edge\.active-path\.offline\s*{[^}]*--topology-path-color:\s*#ef6074/s);
    assert.match(css, /\.topology-edge\.active-path\.unknown\s*{[^}]*--topology-path-color:\s*#e6aa3b/s);
    assert.match(css, /\.topology-edge\.active-path \.topology-edge-flow\s*{[^}]*animation:\s*topology-edge-flow\s+0\.85s\s+linear\s+infinite/s);
    assert.match(css, /@keyframes\s+topology-edge-flow\s*{[^}]*stroke-dashoffset:\s*-18/s);
    assert.match(
        reducedMotionBlock,
        /\.topology-edge\.active-path \.topology-edge-flow\s*{[^{}]*display:\s*none;[^{}]*animation:\s*none;?[^{}]*}/s,
    );
    assert.doesNotMatch(invalidReducedMotionBlock, /\.topology-edge-flow/);
});
