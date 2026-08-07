const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, 'public');
const SRC_DIR = path.join(__dirname, 'src');
const STANDALONE_OUTPUT = path.join(__dirname, 'standalone.html');

function compileStyles() {
  const cssFiles = [
    path.join(PUBLIC_DIR, 'css', 'variables.css'),
    path.join(PUBLIC_DIR, 'css', 'base.css'),
    path.join(PUBLIC_DIR, 'css', 'components.css'),
    path.join(PUBLIC_DIR, 'css', 'views.css')
  ];

  let combinedCss = '<style>\n';
  cssFiles.forEach(file => {
    if (fs.existsSync(file)) {
      combinedCss += `/* --- ${path.basename(file)} --- */\n` + fs.readFileSync(file, 'utf8') + '\n\n';
    }
  });
  combinedCss += '</style>';

  const targetFile = path.join(SRC_DIR, 'Styles.html');
  fs.writeFileSync(targetFile, combinedCss, 'utf8');
  console.log(`✅ Styles compiled to ${targetFile}`);
}

function buildHtml() {
  compileStyles();

  let indexContent = fs.readFileSync(path.join(SRC_DIR, 'Index.html'), 'utf8');

  // Replace <?!= include('FileName'); ?> recursively
  indexContent = indexContent.replace(/<\?!=\s*include\('([^']+)'\);\s*\?>/g, (match, filename) => {
    let filePath = path.join(SRC_DIR, filename + '.html');
    if (fs.existsSync(filePath)) {
      let subContent = fs.readFileSync(filePath, 'utf8');
      return subContent.replace(/<\?!=\s*include\('([^']+)'\);\s*\?>/g, (m, fn) => {
        let fp = path.join(SRC_DIR, fn + '.html');
        return fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8') : '';
      });
    }
    return '';
  });

  const INDEX_OUTPUT = path.join(__dirname, 'index.html');
  fs.writeFileSync(STANDALONE_OUTPUT, indexContent, 'utf8');
  fs.writeFileSync(INDEX_OUTPUT, indexContent, 'utf8');
  console.log(`✅ standalone.html and index.html compiled successfully`);
}

buildHtml();
