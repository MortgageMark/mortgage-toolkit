/**
 * build.js — Pre-compile all JSX modules for Netlify deployment
 *
 * What it does:
 *   1.  Removes Babel CDN <script> (983 KB — no longer needed)
 *   2.  Removes the Babel compile-cache block
 *   3.  Compiles every type="text/babel" src="..." file with @babel/preset-react
 *   4.  Writes each compiled file to dist/ (same path, no query strings)
 *   5.  Changes all type="text/babel" → type="text/javascript" in HTML
 *   6.  Compiles the inline ReactDOM render block
 *   7.  Copies static assets (stateConfig, _redirects, images, etc.)
 *
 * Result: browser never touches Babel again — ~1-3 s load vs 10-20 s before.
 */

'use strict';

const fs    = require('fs');
const path  = require('path');
const babel = require('@babel/core');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

const BABEL_OPTS = {
  presets: [['@babel/preset-react', { runtime: 'classic' }]],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function compileFile(srcPath) {
  const source = fs.readFileSync(srcPath, 'utf8');
  try {
    return babel.transformSync(source, {
      ...BABEL_OPTS,
      filename: path.basename(srcPath),
    }).code;
  } catch (err) {
    console.error('\n❌  Babel error in ' + srcPath + '\n    ' + err.message);
    throw err;
  }
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

// Find the start position of an HTML comment block.
function findComment(html, exactText, keyword) {
  const i = html.indexOf(exactText);
  if (i !== -1) return i;
  const ki = html.indexOf(keyword);
  if (ki !== -1) return html.lastIndexOf('<!--', ki);
  return -1;
}

// ── Main build ────────────────────────────────────────────────────────────────

function build() {
  console.log('🔨  Mortgage Toolkit — pre-compile build\n');
  const t0 = Date.now();

  // Clean + create dist/
  if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true, force: true });
  ensureDir(DIST);

  let html = fs.readFileSync(path.join(ROOT, 'mortgage-toolkit.html'), 'utf8');

  // ── 1. Remove Babel CDN script ────────────────────────────────────────────
  html = html.replace(/<script\b[^>]*babel-standalone[^>]*><\/script>[ \t]*\n?/g, '');
  console.log('✓  Removed Babel CDN <script> (−983 KB)');

  // ── 2. Remove Babel compile-cache block ──────────────────────────────────
  const cachePos = findComment(html, '<!-- ─── Babel compile cache', 'Babel compile cache');
  if (cachePos !== -1) {
    const closeTag = '</script>';
    const endPos   = html.indexOf(closeTag, cachePos) + closeTag.length;
    html = html.slice(0, cachePos) + html.slice(html[endPos] === '\n' ? endPos + 1 : endPos);
    console.log('✓  Removed Babel compile-cache block');
  }

  // ── 3. Compile every type="text/babel" src="..." file ────────────────────
  const SRC_TAG_RE = /<script\b[^>]*\btype="text\/babel"[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g;
  const seen = new Set();
  let m;
  let fileCount = 0;

  console.log('\nCompiling module files…');
  while ((m = SRC_TAG_RE.exec(html)) !== null) {
    const srcAttr = m[1];
    const srcFile = srcAttr.replace(/\?.*$/, ''); // strip ?v=X
    if (seen.has(srcFile)) continue;
    seen.add(srcFile);

    const srcPath  = path.join(ROOT,  srcFile);
    const destPath = path.join(DIST, srcFile);
    ensureDir(path.dirname(destPath));

    if (fs.existsSync(srcPath)) {
      fs.writeFileSync(destPath, compileFile(srcPath), 'utf8');
      process.stdout.write('  ✓  ' + srcFile + '\n');
      fileCount++;
    } else {
      process.stdout.write('  ⚠  missing: ' + srcFile + '\n');
    }
  }
  console.log('\n✓  Compiled ' + fileCount + ' files');

  // ── 4. Compile inline <script type="text/babel"> (ReactDOM render call) ───
  html = html.replace(
    /<script(\s+)type="text\/babel"(\s*)>([\s\S]*?)<\/script>/g,
    function (whole, sp1, sp2, content) {
      if (/<script[^>]+\bsrc=/.test(whole.slice(0, whole.indexOf('>')))) return whole;
      const compiled = babel.transformSync(content, {
        ...BABEL_OPTS,
        filename: 'inline.jsx',
      }).code;
      return '<script' + sp1 + 'type="text/javascript"' + sp2 + '>\n' + compiled + '\n</script>';
    }
  );
  console.log('✓  Compiled inline Babel block');

  // ── 5. Convert all remaining type="text/babel" → type="text/javascript" ──
  html = html.replace(/\btype="text\/babel"/g, 'type="text/javascript"');
  console.log('✓  Converted script type attributes');

  // ── 6. Write modified HTML ────────────────────────────────────────────────
  fs.writeFileSync(path.join(DIST, 'mortgage-toolkit.html'), html, 'utf8');
  console.log('✓  Wrote dist/mortgage-toolkit.html');

  // ── 7. Copy static assets ─────────────────────────────────────────────────
  console.log('\nCopying static assets…');
  for (const f of [
    '_redirects',
    'view.html',
    'stateConfig.js',
    'stateOverrides.js',
    'altaEndorsements.js',
    'texasTitleEndorsements.js',
    'modules/images/mortgage-mark-logo.png',
  ]) {
    const src = path.join(ROOT, f);
    if (fs.existsSync(src)) {
      copyFile(src, path.join(DIST, f));
      process.stdout.write('  ✓  ' + f + '\n');
    } else {
      process.stdout.write('  ⚠  missing: ' + f + '\n');
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('\n✅  Build complete in ' + elapsed + 's → dist/\n');
}

build();
