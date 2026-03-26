const http = require('http');
http.get('http://127.0.0.1:3100/api/health', (res) => {
  let d = '';
  res.on('data', c => d+=c);
  res.on('end', () => console.log('STATUS:', res.statusCode, 'DATA:', d));
}).on('error', e => console.log('ERROR:', e.message));
