const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/Registers.jsx');
let content = fs.readFileSync(filePath, 'utf8');
const backupPath = filePath + '.backup2';
fs.writeFileSync(backupPath, content);

const start = content.indexOf('{showPay && (');
const end = content.indexOf('{showAddClient && (', start);

if (start === -1 || end === -1) {
  console.error('ERROR: boundaries not found');
  process.exit(1);
}

const old = content.slice(start, end);
console.log('Old modal length:', old.length);
console.log('First 100:', JSON.stringify(old.slice(0, 100)));
console.log('Last 100:', JSON.stringify(old.slice(-100)));
