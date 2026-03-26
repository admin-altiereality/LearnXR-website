const http = require('http');
function checkPort() {
  http.get('http://127.0.0.1:3100/api/health', (res) => {
    if (res.statusCode === 200 || res.statusCode === 304) {
      console.log('UP');
    } else {
      setTimeout(checkPort, 1000);
    }
  }).on('error', () => {
    setTimeout(checkPort, 1000);
  });
}
checkPort();
