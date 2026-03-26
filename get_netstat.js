const txt = require('child_process').execSync('netstat -ano').toString();
require('fs').writeFileSync('netstat.txt', txt);
