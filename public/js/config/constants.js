/**
 * Application Constants & Helper Functions
 */
function parseFeelAbc(val) {
  if (!val) return '';
  const s = String(val).toUpperCase().trim();
  if (s === 'A' || s === 'B' || s === 'C') return s;
  if (s.includes('A')) return 'A';
  if (s.includes('B')) return 'B';
  if (s.includes('C')) return 'C';
  return '';
}

const APP_CONFIG = {
  VERSION: '2.0.0',
  TITLE: 'REvo 定例会ビジター管理'
};
