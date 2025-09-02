// Adds JSDoc stubs above functions and classes across the app.
// Targets: app/**/*.ts(x), components/**/*.ts(x), lib/**/*.ts(x), hooks/**/*.ts(x)
// Skips: __tests__, __mocks__, node_modules, .expo
// Notes: Only top-level functions/classes/const arrow components; does not traverse class methods.
import { Project, SyntaxKind, FunctionDeclaration, ClassDeclaration, VariableDeclaration, ArrowFunction, FunctionExpression } from 'ts-morph';
import path from 'node:path';

function isTSX(filePath: string) { return filePath.endsWith('.tsx'); }
function isUpperCaseName(name?: string) { return !!name && /^[A-Z]/.test(name); }

function hasJsDoc(node: any) {
  try { return (node.getJsDocs?.() || []).length > 0; } catch { return false; }
}

function addDocForFunction(fn: FunctionDeclaration | ArrowFunction | FunctionExpression, nameHint: string | undefined) {
  const name = (fn as any).getName?.() || nameHint || 'anonymous';
  const isComponent = isUpperCaseName(name) || (fn.getSourceFile().getBaseName().endsWith('.tsx'));
  const params = (fn as any).getParameters?.() || [];
  const tags: { tagName: string; text: string }[] = [];
  for (const p of params) {
    const pn = p.getName?.() || 'param';
    tags.push({ tagName: 'param', text: `{any} ${pn} - TODO: describe` });
  }
  tags.push({ tagName: 'returns', text: '{any} TODO: describe' });
  const desc = isComponent
    ? `React component ${name}: TODO describe purpose and where it’s used.`
    : `Function ${name}: TODO describe purpose and usage.`;
  try {
    (fn as any).addJsDoc?.({ description: desc, tags });
  } catch {}
}

function addDocForClass(cls: ClassDeclaration) {
  const name = cls.getName() || 'AnonymousClass';
  const desc = `Class ${name}: TODO describe responsibility, props/state (if React), and main collaborators.`;
  try { cls.addJsDoc({ description: desc }); } catch {}
}

function shouldSkipFile(fp: string) {
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
    // Top-level function declarations
    for (const fn of sf.getFunctions()) {
      if (!hasJsDoc(fn)) { addDocForFunction(fn, fn.getName()); mutated = true; }
    }
    // Top-level classes
    for (const cls of sf.getClasses()) {
      if (!hasJsDoc(cls)) { addDocForClass(cls); mutated = true; }
    }
    // const Foo = (...) => { ... } (top-level only)
    for (const stmt of sf.getVariableStatements()) {
      const isTopLevel = stmt.getParent() === sf;
      if (!isTopLevel) continue;
      for (const decl of stmt.getDeclarations()) {
        const init = decl.getInitializer();
        if (!init) continue;
        if (init.getKind() === SyntaxKind.ArrowFunction || init.getKind() === SyntaxKind.FunctionExpression) {
          const fn = init as ArrowFunction | FunctionExpression;
          // Attempt to add JSDoc to the variable declaration (ts-morph supports it on declarations)
          if (!hasJsDoc(decl)) { try { (decl as any).addJsDoc?.({ description: `Function ${decl.getName()}: TODO describe purpose and usage.`, tags: [] }); mutated = true; } catch {} }
          // Also add param/returns tags on the function node itself for richer hints
          if (!hasJsDoc(fn)) { addDocForFunction(fn, decl.getName()); mutated = true; }
        }
      }
    }
    if (mutated) { await sf.save(); changed++; }
  }
  console.log(`[add-jsdoc] Updated ${changed} file(s).`);
}

main().catch(err => { console.error(err); process.exit(1); });
