const fs = require('fs');
const path = require('path');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

global.describe = function(suiteName, fn) {
  console.log(`\n🧪 \x1b[36m${suiteName}\x1b[0m`);
  fn();
};

global.it = function(testName, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  \x1b[32m✓\x1b[0m ${testName}`);
  } catch (err) {
    failedTests++;
    console.log(`  \x1b[31m✗\x1b[0m ${testName}`);
    console.error(`    \x1b[31mError: ${err.message}\x1b[0m`);
  }
};

const testDir = path.join(__dirname, 'unit');
const files = fs.readdirSync(testDir).filter(f => f.endsWith('.test.js'));

console.log('🚀 Running Visitor Host Revolution Unit Tests...\n');

files.forEach(file => {
  require(path.join(testDir, file));
});

console.log('\n----------------------------------------');
console.log(`📊 Summary: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
console.log('----------------------------------------\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
