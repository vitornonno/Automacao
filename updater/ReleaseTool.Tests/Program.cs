using System.Security.Cryptography;
using System.Text.Json;
using CleaningUpdater;

var root = Path.Combine(Path.GetTempPath(), "cleaning-release-tests-" + Guid.NewGuid().ToString("N"));
Directory.CreateDirectory(root);
var privateKey = Path.Combine(root, "private.pem");
var publicKey = Path.Combine(root, "public.pem");
ReleaseBuilder.CreateKey(privateKey, publicKey);
try { ReleaseBuilder.CreateKey(privateKey, publicKey); throw new Exception("Key overwrite was accepted."); }
catch (IOException) { }
var extension = Path.Combine(root, "source");
var installed = Path.Combine(root, "installed");
var output = Path.Combine(root, "output");
Directory.CreateDirectory(extension);
Directory.CreateDirectory(installed);
var names = new[] { "manifest.json", "background.js", "cleaner-availability.js", "content.js", "extractors.js", "panel.css", "popup.css", "popup.html", "popup.js", "presto-content.js", "pricing.js", "quote-messages.js", "service-picker.css", "service-picker.html", "service-picker.js", "xlsx-import.js" };
foreach (var name in names) File.WriteAllText(Path.Combine(extension, name), name);
File.WriteAllText(Path.Combine(extension, "manifest.json"), "{\"manifest_version\":3,\"name\":\"Cleaning Lead Quote Assistant\",\"version\":\"1.2.3\"}");
File.WriteAllText(Path.Combine(installed, "manifest.json"), "{\"manifest_version\":3,\"name\":\"Cleaning Lead Quote Assistant\",\"version\":\"1.2.2\"}");
File.WriteAllText(Path.Combine(installed, "user-data.txt"), "keep");
var version = ReleaseBuilder.Build(extension, privateKey, output);
if (version != "1.2.3") throw new Exception("Unexpected version.");
var manifestBytes = File.ReadAllBytes(Path.Combine(output, "update.json"));
var signature = File.ReadAllBytes(Path.Combine(output, "update.sig"));
var info = PackageVerifier.VerifyManifest(manifestBytes, signature, File.ReadAllText(publicKey));
var packagePath = Path.Combine(output, "Presto-VA-Assistant-v1.2.3.zip");
using (var package = File.OpenRead(packagePath)) PackageVerifier.VerifyPackage(package, info.Sha256);
using (var package = File.OpenRead(packagePath)) PackageInstaller.Install(package, installed, info.Version);
if (File.ReadAllText(Path.Combine(installed, "user-data.txt")) != "keep") throw new Exception("User data was overwritten.");
using (var installedManifest = JsonDocument.Parse(File.ReadAllBytes(Path.Combine(installed, "manifest.json"))))
    if (installedManifest.RootElement.GetProperty("version").GetString() != "1.2.3") throw new Exception("New version not installed.");
try { ReleaseBuilder.Build(extension, privateKey, output); throw new Exception("Output overwrite was accepted."); }
catch (IOException) { }
manifestBytes[0] ^= 1;
try { PackageVerifier.VerifyManifest(manifestBytes, signature, File.ReadAllText(publicKey)); throw new Exception("Tampered manifest was accepted."); }
catch (CryptographicException) { }
Console.WriteLine("Release signing and installation checks passed.");
