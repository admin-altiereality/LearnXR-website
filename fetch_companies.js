const http = require('http');

http.get('http://127.0.0.1:3100/api/companies', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      console.log(JSON.parse(data));
    } catch (e) {
      console.log(data);
    }
  });
}).on('error', (err) => {
  console.error("Error fetching companies:", err.message);
});
