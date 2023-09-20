const fs = require('fs');
const [outLog, errLog] = process.argv.slice(2);

const [outLogPath, outStartInd, outStopInd] = outLog.split(':').map((v, ind) => (ind > 0 ? parseInt(v) : v));
const [errLogPath, errStartInd, errStopInd] = errLog.split(':').map((v, ind) => (ind > 0 ? parseInt(v) : v));

const outBuf = Buffer.allocUnsafe(outStopInd - outStartInd);
const errBuf = Buffer.allocUnsafe(errStopInd - errStartInd);

const outFd = fs.openSync(outLogPath, 'r');
const errFd = fs.openSync(errLogPath, 'r');

fs.readSync(outFd, outBuf, 0, outBuf.length, outStartInd);
fs.readSync(errFd, errBuf, 0, errBuf.length, errStartInd);

console.log(outBuf.toString() + ':' + errBuf.toString());

// if ok return 0 otherwise return code
process.exit(0);
