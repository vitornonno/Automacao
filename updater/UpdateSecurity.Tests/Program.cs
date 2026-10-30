using System.Security.Cryptography;
using System.Text;
using CleaningUpdater;
using System.IO.Compression;

using var key = RSA.Create(2048);
var bytes = Encoding.UTF8.GetBytes("test package");
var hash = Convert.ToHexString(SHA256.HashData(bytes));
var manifest = Encoding.UTF8.GetBytes($"{{\"version\":\"1.2.3\",\"sha256\":\"{hash}\",\"packageUrl\":\"https://example.com/update.zip\"}}");
var signature = key.SignData(manifest, HashAlgorithmName.SHA256, RSASignaturePadding.Pss);
var parsed = PackageVerifier.VerifyManifest(manifest, signature, key.ExportSubjectPublicKeyInfoPem());
PackageVerifier.VerifyPackage(new MemoryStream(bytes), parsed.Sha256);
try
{
    PackageVerifier.VerifyPackage(new MemoryStream(Encoding.UTF8.GetBytes("altered")), parsed.Sha256);
    throw new Exception("Altered package was accepted.");
}
catch (CryptographicException) { }
try
{
    manifest[0] ^= 1;
    PackageVerifier.VerifyManifest(manifest, signature, key.ExportSubjectPublicKeyInfoPem());
    throw new Exception("Altered manifest was accepted.");
}
catch (CryptographicException) { }
var target = Path.Combine(Path.GetTempPath(), "cleaning-updater-test-" + Guid.NewGuid().ToString("N"));
Directory.CreateDirectory(target);
File.WriteAllText(Path.Combine(target, "manifest.json"), "{\"name\":\"Cleaning Lead Quote Assistant\",\"manifest_version\":3,\"version\":\"1.0\"}");
File.WriteAllText(Path.Combine(target, "user-data.txt"), "preserve");
using (var invalidPackage = new MemoryStream())
{
    using (var zip = new ZipArchive(invalidPackage, ZipArchiveMode.Create, true))
    using (var writer = new StreamWriter(zip.CreateEntry("chrome_extension/../user-data.txt").Open())) writer.Write("changed");
    invalidPackage.Position = 0;
    try
    {
        PackageInstaller.Install(invalidPackage, target, "1.1");
        throw new Exception("Unsafe package path was accepted.");
    }
    catch (InvalidDataException) { }
    if (File.ReadAllText(Path.Combine(target, "user-data.txt")) != "preserve") throw new Exception("User data changed.");
}
var expectedFiles = new[] { "manifest.json", "background.js", "cleaner-availability.js", "content.js", "extractors.js", "panel.css", "popup.css", "popup.html", "popup.js", "presto-content.js", "pricing.js", "quote-messages.js", "service-picker.css", "service-picker.html", "service-picker.js", "xlsx-import.js", "presto-logo.png" };
using (var validPackage = new MemoryStream())
{
    using (var zip = new ZipArchive(validPackage, ZipArchiveMode.Create, true))
    {
        foreach (var name in expectedFiles)
        {
            using var writer = new StreamWriter(zip.CreateEntry("chrome_extension/" + name).Open());
            writer.Write(name == "manifest.json" ? "{\"name\":\"Presto VA Assistant\",\"manifest_version\":3,\"version\":\"1.1\"}" : "new file");
        }
    }
    validPackage.Position = 0;
    PackageInstaller.Install(validPackage, target, "1.1");
    if (!File.ReadAllText(Path.Combine(target, "manifest.json")).Contains("1.1") || File.ReadAllText(Path.Combine(target, "user-data.txt")) != "preserve") throw new Exception("Valid installation failed or changed user data.");
    var backups = Directory.GetDirectories(target, ".cleaning-updater-backup-*");
    if (backups.Length != 1 || !File.ReadAllText(Path.Combine(backups[0], "manifest.json")).Contains("1.0")) throw new Exception("Previous version was not backed up.");
}
Console.WriteLine("Signed update verification checks passed.");
