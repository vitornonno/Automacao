using System.IO.Compression;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

internal static class TestHarness
{
    private static readonly string[] Files = {
        "manifest.json", "background.js", "cleaner-availability.js", "content.js", "extractors.js", "panel.css",
        "popup.css", "popup.html", "popup.js", "presto-content.js", "pricing.js", "quote-messages.js",
        "service-picker.css", "service-picker.html", "service-picker.js", "xlsx-import.js"
    };
    private const string PackageUrl = "https://github.com/vitornonno/Automacao/releases/download/v2.0/extension.zip";

    private static async Task Main()
    {
        var baseDir = Path.Combine(Path.GetTempPath(), "cleaning-host-e2e-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(baseDir);
        using var key = RSA.Create(2048);
        var publicKey = key.ExportSubjectPublicKeyInfoPem();
        var package = BuildPackage();
        var metadata = JsonSerializer.SerializeToUtf8Bytes(new { version = "2.0", sha256 = Convert.ToHexString(SHA256.HashData(package)), packageUrl = PackageUrl });
        var signature = key.SignData(metadata, HashAlgorithmName.SHA256, RSASignaturePadding.Pss);
        var handler = new FakeChannel(metadata, signature, package);
        using var client = new HttpClient(handler);

        var target = MakeInstallation(Path.Combine(baseDir, "valid"));
        var config = new HostConfiguration(new string('a', 32), target);
        var check = await Program.RunUpdateCore(config, "check", client, publicKey);
        Assert(check.Ok && check.Status == "available" && check.CurrentVersion == "1.0" && check.AvailableVersion == "2.0", "A signed update must be offered");
        Assert(ReadVersion(target) == "1.0" && handler.PackageReads == 0, "Checking must not download or replace the package");
        var install = await Program.RunUpdateCore(config, "install", client, publicKey);
        Assert(install.Ok && install.Status == "installed" && install.CurrentVersion == "1.0" && install.AvailableVersion == "2.0", "The signed update must install");
        Assert(ReadVersion(target) == "2.0" && File.ReadAllText(Path.Combine(target, "content.js")) == "new-content.js", "New extension files must be installed");
        Assert(File.ReadAllText(Path.Combine(target, "personal.txt")) == "preserve", "Unrelated files must be preserved");
        var backups = Directory.GetDirectories(target, ".cleaning-updater-backup-*");
        Assert(backups.Length == 1 && ReadVersion(backups[0]) == "1.0" && File.ReadAllText(Path.Combine(backups[0], "content.js")) == "old-content.js", "The previous version must remain in the backup");
        var upToDate = await Program.RunUpdateCore(config, "check", client, publicKey);
        Assert(upToDate.Status == "up_to_date" && upToDate.CurrentVersion == "2.0", "The installed version must be reported as current");

        var wrongSignatureTarget = MakeInstallation(Path.Combine(baseDir, "bad-signature"));
        handler.Signature = signature.ToArray(); handler.Signature[0] ^= 1;
        await ExpectCryptographicFailure(() => Program.RunUpdateCore(new HostConfiguration(new string('a', 32), wrongSignatureTarget), "install", client, publicKey));
        Assert(ReadVersion(wrongSignatureTarget) == "1.0" && Directory.GetDirectories(wrongSignatureTarget, ".cleaning-updater-backup-*").Length == 0, "Invalid signatures must not change or back up the installation");

        var tamperedTarget = MakeInstallation(Path.Combine(baseDir, "bad-package"));
        handler.Signature = signature; handler.Package = package.ToArray(); handler.Package[^1] ^= 1;
        await ExpectCryptographicFailure(() => Program.RunUpdateCore(new HostConfiguration(new string('a', 32), tamperedTarget), "install", client, publicKey));
        Assert(ReadVersion(tamperedTarget) == "1.0" && Directory.GetDirectories(tamperedTarget, ".cleaning-updater-backup-*").Length == 0, "Altered packages must not change or back up the installation");
        Console.WriteLine("Native host signed check/install, backup and tamper integration checks passed.");
    }

    private static string MakeInstallation(string path)
    {
        Directory.CreateDirectory(path);
        foreach (var file in Files) File.WriteAllText(Path.Combine(path, file), file == "manifest.json" ? Manifest("1.0") : "old-" + file);
        File.WriteAllText(Path.Combine(path, "personal.txt"), "preserve");
        return path;
    }
    private static string Manifest(string version) => $"{{\"name\":\"Cleaning Lead Quote Assistant\",\"manifest_version\":3,\"version\":\"{version}\"}}";
    private static string? ReadVersion(string path) { using var document = JsonDocument.Parse(File.ReadAllBytes(Path.Combine(path, "manifest.json"))); return document.RootElement.GetProperty("version").GetString(); }
    private static byte[] BuildPackage()
    {
        using var stream = new MemoryStream();
        using (var zip = new ZipArchive(stream, ZipArchiveMode.Create, true))
            foreach (var file in Files)
            {
                using var writer = new StreamWriter(zip.CreateEntry("chrome_extension/" + file).Open(), new UTF8Encoding(false));
                writer.Write(file == "manifest.json" ? Manifest("2.0").Replace("Cleaning Lead Quote Assistant", "Presto VA Assistant") : "new-" + file);
            }
        return stream.ToArray();
    }
    private static void Assert(bool condition, string message) { if (!condition) throw new Exception(message); }
    private static async Task ExpectCryptographicFailure(Func<Task<HostResponse>> operation)
    {
        try { await operation(); } catch (CryptographicException) { return; }
        throw new Exception("An altered signed update was accepted");
    }
    private sealed class FakeChannel(byte[] metadata, byte[] signature, byte[] package) : HttpMessageHandler
    {
        public byte[] Signature { get; set; } = signature;
        public byte[] Package { get; set; } = package;
        public int PackageReads { get; private set; }
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var url = request.RequestUri?.AbsoluteUri;
            byte[] content;
            if (request.RequestUri?.AbsolutePath.EndsWith("/update.json", StringComparison.Ordinal) == true) content = metadata;
            else if (request.RequestUri?.AbsolutePath.EndsWith("/update.sig", StringComparison.Ordinal) == true) content = Signature;
            else if (url == PackageUrl) { PackageReads++; content = Package; }
            else return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound));
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent(content) });
        }
    }
}
