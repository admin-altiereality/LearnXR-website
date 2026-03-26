const http = require('http');
const req = http.get('http://127.0.0.1:3100/api/companies', (res) => {
  let data = '';
  res.on('data', c => data+=c);
  res.on('end', () => require('fs').writeFileSync('C:/Users/home/Desktop/companies.json', data));
});
req.on('error', e => require('fs').writeFileSync('C:/Users/home/Desktop/companies.json', 'ERROR: ' + e.message));
req.setTimeout(2000, () => { req.destroy(); require('fs').writeFileSync('C:/Users/home/Desktop/companies.json', 'TIMEOUT'); });
