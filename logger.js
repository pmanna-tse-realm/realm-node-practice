const packageDetails = require('./package');
const fs = require("fs");

let logFile;
let logCache = '';
let stream;

function fileExistsSync(file) {
  try {
    fs.accessSync(file, fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch (err) {
    return false;
  }
}

function writeCallback(err) {
  if (err) {
    console.error(err);
  }
}

function flushCache() {
  if (logCache.length === 0) {
    return;
  }

  let oldCache = logCache;

  logCache = '';

  stream.write(oldCache, writeCallback);
}

function createLogName() {
  let applicationName = process.env.npm_package_name ?? (packageDetails.name ?? "NodeApp");
  let progressive = 0;
  let date = new Date().toISOString().substring(0, 10);

  do {
    progressive += 1;
    logFile = `./${applicationName}.${date}_${progressive}.log`
  } while (fileExistsSync(logFile));

  stream = fs.createWriteStream(logFile, { flags: 'a' });

  flushCache();

  setInterval(() => {
    flushCache();
  }, 1000);
}

exports.logToFile = function logToFile(message) {
  if (!stream) {
    createLogName();
  }

  let date = new Date();

  logCache += `[${date.toISOString()}] - ${message}\n`;
}

exports.closeLog = function closeLog() {
  flushCache();

  stream.close((err) => console.error(err));
}