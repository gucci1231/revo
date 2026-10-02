const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('Database Query & PDO Proxy Methods Tests', () => {
  const dbPhpPath = path.resolve(__dirname, '../../api/Core/Database.php');
  const matcherPhpPath = path.resolve(__dirname, '../../api/Services/PowerTeamMatcher.php');

  it('verifies Database.php defines query, prepare, and PDO proxy methods', () => {
    const code = fs.readFileSync(dbPhpPath, 'utf8');
    assert.ok(code.includes('public function query('), 'Database must define query()');
    assert.ok(code.includes('public function prepare('), 'Database must define prepare()');
    assert.ok(code.includes('public function lastInsertId('), 'Database must define lastInsertId()');
    assert.ok(code.includes('public function beginTransaction('), 'Database must define beginTransaction()');
    assert.ok(code.includes('public function commit('), 'Database must define commit()');
    assert.ok(code.includes('public function rollBack('), 'Database must define rollBack()');
    assert.ok(code.includes('public function inTransaction('), 'Database must define inTransaction()');
    assert.ok(code.includes('public function __call('), 'Database must define __call() magic method');
  });

  it('verifies PowerTeamMatcher uses db fetchAll safely', () => {
    const code = fs.readFileSync(matcherPhpPath, 'utf8');
    assert.ok(code.includes('$this->db->fetchAll('), 'PowerTeamMatcher should use fetchAll');
  });
});
