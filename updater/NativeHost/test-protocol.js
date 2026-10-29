// Run after `dotnet build updater/NativeHost/NativeHost.csproj` on Windows.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'cleaning-native-test-'));
const installed = path.join(scratch, 'extension');
const configuration = path.join(scratch, 'CleaningLeadUpdater');
fs.mkdirSync(installed);
fs.mkdirSync(configuration);
fs.writeFileSync(path.join(installed, 'manifest.json'), JSON.stringify({ name: 'Cleaning Lead Quote Assistant', manifest_version: 3, version: '1.0' }));
const id = 'a'.repeat(32);
fs.writeFileSync(path.join(configuration, 'config.json'), JSON.stringify({ extensionId: id, extensionPath: installed }));
const executable = path.join(__dirname, 'bin', 'Debug', 'net8.0', 'CleaningUpdaterHost.exe');
function invoke(origin, payload, declaredLength = payload.length) {
  const header = Buffer.alloc(4); header.writeUInt32LE(declaredLength);
  const result = spawnSync(executable, [origin], { env: { ...process.env, LOCALAPPDATA: scratch }, input: Buffer.concat([header, payload]), timeout: 10000 });
  if (result.error) throw result.error;
  if (result.stdout.length < 4) throw new Error('Native host returned no framed response');
  const length = result.stdout.readUInt32LE();
  if (result.stdout.length !== length + 4) throw new Error('Native host returned invalid framing');
  return JSON.parse(result.stdout.subarray(4).toString('utf8'));
}
const invalidOrigin = invoke(`chrome-extension://${'b'.repeat(32)}/`, Buffer.from('{"action":"check"}'));
if (invalidOrigin.ok || invalidOrigin.status !== 'error') throw new Error('Invalid origin was accepted');
const unsupported = invoke(`chrome-extension://${id}/`, Buffer.from('{"action":"other"}'));
if (unsupported.ok || unsupported.status !== 'error') throw new Error('Unsupported action was accepted');
const oversized = invoke(`chrome-extension://${id}/`, Buffer.alloc(0), 65537);
if (oversized.ok || oversized.status !== 'error') throw new Error('Oversized message was accepted');
console.log('Native host origin, framing and action checks passed.');
