const https = require('https');
const fs = require('fs');
const unzipper = require('unzipper');
const path = require('path');

const targetPath = 'C:\\Users\\kholifah\\AppData\\Roaming\\npm\\node_modules\\@expo\\ngrok\\bin';

console.log('Downloading ngrok v3...');
https.get('https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip', (res) => {
  res.pipe(unzipper.Extract({ path: targetPath }))
    .on('close', () => {
      console.log('Extraction complete! Overwrote ngrok.exe');
    })
    .on('error', (err) => {
      console.error('Extraction error:', err);
    });
}).on('error', (err) => {
  console.error('Download error:', err);
});
