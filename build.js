/**
 * build.js — Pre-compile + bundle all JSX modules for Netlify deployment
 *
 * What it does:
 *   1.  Removes Babel CDN <script> (983 KB saved on every load)
 *   2.  Removes the Babel compile-cache block (no longer needed)
 *   3.  Compiles all 50+ type="text/babel" src="..." files with @babel/preset-react
 *   4.  Concatenates them in dependency order into ONE modules-bundle.js
 *   5.  Minifies the bundle with terser (~35% smaller)
 *   6.  Replaces 50 individual script tags with a single <script src="modules-bundle.js">
 *   7.  Adds a <link rel="preload"> hint so the bundle starts downloading early
 *   8.  Compiles the inline ReactDOM render block
 *   9.  Copies static assets (stateConfig, _redirects, images, etc.)
 *   10. Writes everything to dist/
 *
 * Result: ~1-2 s load time (was 10-20 s with browser-side Babel)
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
// Tries the exact Unicode text first; falls back to finding the keyword
// and walking left to the nearest <!-- delimiter.
function findComment(html, exactText, keyword) {
  const i = html.indexOf(exactText);
  if (i !== -1) return i;
  const ki = html.indexOf(keyword);
  if (ki !== -1) return html.lastIndexOf('<!--', ki);
  return -1;
}

// ── Main build ────────────────────────────────────────────────────────────────

async function build() {
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
  } else {
    console.warn('⚠   Babel compile-cache block not found — skipping');
  }

  // ── 3. Collect module src files in dependency order ───────────────────────
  const SRC_TAG_RE = /<script\b[^>]*\btype="text\/babel"[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g;
  const moduleFiles = [];
  let m;
  while ((m = SRC_TAG_RE.exec(html)) !== null) {
    moduleFiles.push(m[1].replace(/\?.*$/, '')); // strip ?v=X query strings
  }
  console.log('\nCompiling ' + moduleFiles.length + ' module files…');

  // ── 4. Compile every module file + concatenate into bundle ────────────────
  const parts = [];
  for (const srcFile of moduleFiles) {
    const srcPath = path.join(ROOT, srcFile);
    if (!fs.existsSync(srcPath)) {
      process.stdout.write('  ⚠  missing: ' + srcFile + '\n');
      continue;
    }
    // Wrap each module in an IIFE so const/let declarations don't collide
    // across files when concatenated. window.X exports still work fine.
    parts.push('(function(){\n' + compileFile(srcPath) + '\n})();');
    process.stdout.write('  ✓  ' + srcFile + '\n');
  }
  let bundle     = parts.join('\n');
  const rawKB    = (bundle.length / 1024).toFixed(0);

  // ── 5. Minify with terser ─────────────────────────────────────────────────
  try {
    const { minify } = require('terser');
    const result = await minify(bundle, {
      compress : { passes: 2 },
      mangle   : true,
      format   : { comments: false },
    });
    const minKB = (result.code.length / 1024).toFixed(0);
    bundle = result.code;
    console.log('\n✓  Minified bundle: ' + rawKB + ' KB → ' + minKB + ' KB');
  } catch (err) {
    console.warn('\n⚠   Minification failed (' + err.message + ') — using unminified bundle');
    console.warn('    Bundle size: ' + rawKB + ' KB');
  }

  // Write bundle to dist/
  fs.writeFileSync(path.join(DIST, 'modules-bundle.js'), bundle, 'utf8');
  console.log('✓  Wrote dist/modules-bundle.js');

  // ── 6. Compile inline <script type="text/babel"> (ReactDOM render call) ───
  //    Do this BEFORE swapping the module script block so the inline block
  //    is already type="text/javascript" if the fallback path fires.
  html = html.replace(
    /<script(\s+)type="text\/babel"(\s*)>([\s\S]*?)<\/script>/g,
    function (whole, sp1, sp2, content) {
      // Skip tags that have a src attribute (those are module files, handled above)
      if (/<script[^>]+\bsrc=/.test(whole.slice(0, whole.indexOf('>')))) return whole;
      const compiled = babel.transformSync(content, {
        ...BABEL_OPTS,
        filename: 'inline.jsx',
      }).code;
      return '<script' + sp1 + 'type="text/javascript"' + sp2 + '>\n' + compiled + '\n</script>';
    }
  );
  console.log('✓  Compiled inline Babel block');

  // ── 7. Swap 50 individual script tags → single bundle tag ─────────────────
  const msPos = findComment(html, '<!-- ─── Module scripts', 'Module scripts');
  const frPos = findComment(html, '<!-- ─── Final render',   'Final render');

  if (msPos !== -1 && frPos !== -1) {
    html =
      html.slice(0, msPos) +
      '<!-- ─── Module bundle (pre-compiled) ──────────────────────────────── -->\n' +
      '  <script type="text/javascript" src="modules-bundle.js"></script>\n\n  ' +
      html.slice(frPos);
    console.log('✓  Replaced ' + moduleFiles.length + ' <script> tags with 1 bundle tag');
  } else {
    // Fallback: keep individual tags but convert type attribute
    console.warn('⚠   Module scripts block not found — keeping individual tags');
    html = html.replace(/\btype="text\/babel"\b/g, 'type="text/javascript"');
  }

  // ── 8. Add <link rel="preload"> in <head> ─────────────────────────────────
  //    Tells the browser to start fetching the bundle while still parsing HTML,
  //    not after it hits the <script> tag near the bottom of <body>.
  html = html.replace(
    '</head>',
    '  <link rel="preload" href="modules-bundle.js" as="script">\n</head>'
  );
  console.log('✓  Added preload hint for modules-bundle.js');

  // ── 9. Write modified HTML ────────────────────────────────────────────────
  fs.writeFileSync(path.join(DIST, 'mortgage-toolkit.html'), html, 'utf8');
  console.log('✓  Wrote dist/mortgage-toolkit.html');

  // ── 10. Copy static assets ────────────────────────────────────────────────
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

build().catch(function (err) {
  console.error('\n💥  Build failed:', err.message || err);
  process.exit(1);
});
