// Adds JSDoc stubs above functions, classes, and class members across the app.
// Targets: app/**/*.ts(x), components/**/*.ts(x), lib/**/*.ts(x), hooks/**/*.ts(x)
// Skips: __tests__, __mocks__, node_modules, .expo
// Coverage: Top-level and nested named functions, const arrow/function expressions, classes, class methods/ctors/accessors.
const { Project, SyntaxKind } = require('ts-morph');
const path = require('node:path');

function isUpperCaseName(name) { return !!name && /^[A-Z]/.test(name); }
function hasJsDoc(node) {
  try { return (node.getJsDocs?.() || []).length > 0; } catch { return false; }
}
function typeTextSafe(t) {
  try {
    const txt = t.getText();
    return txt && txt.length <= 80 ? txt : 'any';
  } catch { return 'any'; }
}

function addDocForFunction(fn, nameHint) {
  const name = fn.getName?.() || nameHint || 'anonymous';
  const isComponent = isUpperCaseName(name) || fn.getSourceFile().getBaseName().endsWith('.tsx');
  const params = fn.getParameters?.() || [];
  const tags = [];
  for (const p of params) {
    const pn = p.getName?.() || 'param';
    let ty = 'any';
    try { const t = p.getType?.(); ty = typeTextSafe(t); } catch {}
    tags.push({ tagName: 'param', text: `{${ty}} ${pn} - TODO: describe` });
  }
  try {
    const rt = fn.getReturnType?.();
    const rtxt = rt ? typeTextSafe(rt) : 'any';
    tags.push({ tagName: 'returns', text: `{${rtxt}} TODO: describe` });
  } catch { tags.push({ tagName: 'returns', text: '{any} TODO: describe' }); }
  const desc = isComponent
    ? `React component ${name}: TODO describe purpose and where it’s used.`
    : `Function ${name}: TODO describe purpose and usage.`;
  try { fn.addJsDoc?.({ description: desc, tags }); } catch {}
}
function addDocForClass(cls) {
  const name = cls.getName?.() || 'AnonymousClass';
  const desc = `Class ${name}: TODO describe responsibility, props/state (if React), and main collaborators.`;
  try { cls.addJsDoc?.({ description: desc }); } catch {}
}
function addDocForMethod(cls, m) {
  const clsName = cls.getName?.() || 'Class';
  const mName = m.getName?.() || 'method';
  const params = m.getParameters?.() || [];
  const tags = [];
  for (const p of params) {
    const pn = p.getName?.() || 'param';
    let ty = 'any';
    try { ty = typeTextSafe(p.getType?.()); } catch {}
    tags.push({ tagName: 'param', text: `{${ty}} ${pn} - TODO: describe` });
  }
  try { const rt = m.getReturnType?.(); const rtxt = rt ? typeTextSafe(rt) : 'void'; tags.push({ tagName: 'returns', text: `{${rtxt}} TODO: describe` }); } catch {}
  const desc = `Method ${clsName}.${mName}: TODO describe behavior and when it's called.`;
  try { m.addJsDoc?.({ description: desc, tags }); } catch {}
}
function shouldSkipFile(fp) {
  if (/node_modules|__tests__|__mocks__|\.expo/.test(fp)) return true;
  if (!(/\.(ts|tsx)$/.test(fp))) return true;
  return false;
}
async function main() {
  const project = new Project({ tsConfigFilePath: path.resolve('tsconfig.json') });
  const globs = [
    'app/**/*.ts', 'app/**/*.tsx',
    'components/**/*.ts', 'components/**/*.tsx',
    'lib/**/*.ts', 'lib/**/*.tsx',
    'hooks/**/*.ts', 'hooks/**/*.tsx',
  ];
  const files = project.getSourceFiles(globs).filter(sf => !shouldSkipFile(sf.getFilePath()));
  let changed = 0;
  for (const sf of files) {
    let mutated = false;
    // All function declarations (top-level and nested)
    for (const fn of sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)) {
      if (!hasJsDoc(fn)) { addDocForFunction(fn, fn.getName?.()); mutated = true; }
    }
    // Classes and their members
    for (const cls of sf.getDescendantsOfKind(SyntaxKind.ClassDeclaration)) {
      if (!hasJsDoc(cls)) { addDocForClass(cls); mutated = true; }
      for (const ctor of cls.getConstructors()) {
        if (!hasJsDoc(ctor)) {
          const desc = `Constructor for ${cls.getName?.() || 'Class'}: TODO describe initialization.`;
          try { ctor.addJsDoc?.({ description: desc }); mutated = true; } catch {}
        }
      }
      for (const m of cls.getMethods()) { if (!hasJsDoc(m)) { addDocForMethod(cls, m); mutated = true; } }
      for (const acc of cls.getGetAccessors()) {
        if (!hasJsDoc(acc)) { try { acc.addJsDoc?.({ description: `Getter ${cls.getName?.() || 'Class'}.${acc.getName?.()}: TODO describe.` }); mutated = true; } catch {} }
      }
      for (const acc of cls.getSetAccessors()) {
        if (!hasJsDoc(acc)) { try { acc.addJsDoc?.({ description: `Setter ${cls.getName?.() || 'Class'}.${acc.getName?.()}: TODO describe.` }); mutated = true; } catch {} }
      }
    }
    // Variable declarations with function initializers (any scope)
    for (const decl of sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
      const init = decl.getInitializer();
      if (!init) continue;
      const kind = init.getKind();
      if (kind === SyntaxKind.ArrowFunction || kind === SyntaxKind.FunctionExpression) {
        const fn = init;
        if (!hasJsDoc(decl)) { try { decl.addJsDoc?.({ description: `Function ${decl.getName()}: TODO describe purpose and usage.`, tags: [] }); mutated = true; } catch {} }
        if (!hasJsDoc(fn)) { addDocForFunction(fn, decl.getName()); mutated = true; }
      }
    }
    if (mutated) { await sf.save(); changed++; }
  }
  console.log(`[add-jsdoc] Updated ${changed} file(s).`);
}
main().catch(e => { console.error(e); process.exit(1); });
