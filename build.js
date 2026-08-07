const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'src');
const OUTPUT_FILE = path.join(__dirname, 'standalone.html');

function buildHtml() {
  let indexContent = fs.readFileSync(path.join(SRC_DIR, 'Index.html'), 'utf8');

  // Replace <?!= include('FileName'); ?> with actual sub-template file contents recursively
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

  fs.writeFileSync(OUTPUT_FILE, indexContent, 'utf8');
  console.log(`✅ standalone.html was successfully built at ${OUTPUT_FILE}`);
}

buildHtml();
