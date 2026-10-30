// Accessibility-tree-only demo. No DOM selectors, page evaluation, markup inspection,
// text-content matching, or data attributes are used.
const path = require('path');
const { chromium } = require(require.resolve('playwright-core', {
  paths: [path.join(__dirname, '../Q1'), __dirname],
}));

function valueOf(property) {
  if (!property || property.value === undefined) return undefined;
  return property.value && typeof property.value === 'object'
    ? property.value.value
    : property.value;
}

function stateSet(node) {
  const states = new Set();
  for (const property of node.properties || []) {
    const value = valueOf(property);
    if (value === true) states.add(property.name);
  }
  return states;
}

function buildPath(nodes, nodeId) {
  const byId = new Map(nodes.map((node) => [node.nodeId, node]));
  const path = [];
  let current = byId.get(nodeId);

  while (current) {
    const role = valueOf(current.role) || '';
    const parent = current.parentId ? byId.get(current.parentId) : undefined;
    const sameRole = parent
      ? (parent.childIds || [])
          .map((id) => byId.get(id))
          .filter((child) => child && valueOf(child.role) === role)
      : [current];
    const index = Math.max(0, sameRole.findIndex((child) => child.nodeId === current.nodeId));
    path.unshift({ role, index });
    current = parent;
  }

  return path;
}

function candidateSummary(node) {
  const states = stateSet(node);
  return {
    role: valueOf(node.role) || '',
    name: valueOf(node.name) || '',
    enabled: !states.has('disabled'),
    focusable: states.has('focusable'),
  };
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.goto('file://' + path.join(__dirname, 'demo.html'));

    const client = await page.context().newCDPSession(page);
    await client.send('Accessibility.enable');
    await page.waitForTimeout(50);
    const { nodes } = await client.send('Accessibility.getFullAXTree');
    const buttons = nodes.filter((node) => valueOf(node.role) === 'button');
    const enabledFocusable = buttons.filter((node) => {
      const states = stateSet(node);
      return !states.has('disabled') && states.has('focusable');
    });

    const result = {
      path: [],
      anchors: [],
      confidence: 0,
      alternatives: [],
      reasoning: [],
    };

    if (enabledFocusable.length !== 1) {
      result.reasoning = [
        'step 1 role=button; expected states=enabled, focusable',
        'step 2 shadow boundaries are represented by the flattened AX tree',
        `step 3 found ${enabledFocusable.length} enabled, focusable button candidates`,
        'step 4-6 uniqueness and stability could not be established',
        'step 7 request a fresh tree snapshot instead of guessing',
      ];
      result.alternatives = buttons.map(candidateSummary);
      process.stdout.write(JSON.stringify(result));
      return;
    }

    const target = enabledFocusable[0];
    result.path = buildPath(nodes, target.nodeId);
    result.anchors = ['role=button', 'state=enabled', 'state=focusable'];
    result.confidence = 1;
    result.reasoning = [
      'step 1 translated the goal to role=button with enabled and focusable states',
      'step 2 used the flattened accessibility tree across shadow boundaries',
      'step 3 retained the unique enabled, focusable button candidate',
      'step 4 found no competing button requiring structural disambiguation',
      'step 5 did not use accessible-name matching as the primary selector',
      'step 6 the path is anchored by role and state rather than sibling index alone',
      'step 7 confirmed exactly one candidate and its enabled state',
    ];
    process.stdout.write(JSON.stringify(result));
  } finally {
    await browser.close();
  }
})();
