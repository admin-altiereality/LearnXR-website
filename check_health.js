const http = require('http');
http.get('http://127.0.0.1:3100/api/health', (res) => {
  console.log('UP: ' + res.statusCode);
}).on('error', (e) => {
  console.log('DOWN: ' + e.message);
});
