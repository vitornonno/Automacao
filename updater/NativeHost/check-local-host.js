// Read-only diagnostic: asks the installed host to check the signed channel.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const directory = path.join(process.env.LOCALAPPDATA, 'CleaningLeadUpdater');
const config = JSON.parse(fs.readFileSync(path.join(directory, 'config.json'), 'utf8'));
const payload = Buffer.from(JSON.stringify({ action: 'check' }));
const header = Buffer.alloc(4); header.writeUInt32LE(payload.length);
const executable = process.argv[2] ? path.resolve(process.argv[2]) : path.join(directory, 'CleaningUpdaterHost.exe');
const result = spawnSync(executable, [`chrome-extension://${config.extensionId}/`], { input: Buffer.concat([header, payload]), timeout: 60000 });
if (result.error) throw result.error;
if (!result.stdout || result.stdout.length < 4 || result.stdout.length !== result.stdout.readUInt32LE(0) + 4) throw new Error('Invalid native host response.');
const response = JSON.parse(result.stdout.subarray(4).toString('utf8'));
console.log(JSON.stringify(response));
if (!response.ok) process.exitCode = 1;
