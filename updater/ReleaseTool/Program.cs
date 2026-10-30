using System.IO.Compression;
using System.Security.Cryptography;
using System.Text.Json;
using CleaningUpdater;

try
{
    if (args.Length == 3 && args[0] == "keygen")
    {
        ReleaseBuilder.CreateKey(args[1], args[2]);
        Console.WriteLine("Key pair created. Keep the private key offline and back it up securely.");
    }
    else if (args.Length == 4 && args[0] == "build")
    {
        var version = ReleaseBuilder.Build(args[1], args[2], args[3]);
        Console.WriteLine($"Verified signed package prepared for v{version}.");
    }
    else
    {
        Console.Error.WriteLine("Usage: ReleaseTool keygen <private-key.pem> <public-key.pem> | build <extension-directory> <private-key.pem> <new-output-directory>");
        Environment.ExitCode = 2;
    }
}
catch (Exception ex)
{
    Console.Error.WriteLine($"Release preparation failed: {ex.Message}");
    Environment.ExitCode = 1;
}

public static class ReleaseBuilder
{
    private static readonly string[] Files = [
        "manifest.json", "background.js", "cleaner-availability.js", "content.js", "extractors.js",
        "panel.css", "popup.css", "popup.html", "popup.js", "presto-content.js", "pricing.js",
        "quote-messages.js", "service-picker.css", "service-picker.html", "service-picker.js", "xlsx-import.js", "presto-logo.png"
    ];

    public static void CreateKey(string privatePath, string publicPath)
    {
        privatePath = Path.GetFullPath(privatePath);
        publicPath = Path.GetFullPath(publicPath);
        if (File.Exists(privatePath) || File.Exists(publicPath) || Directory.Exists(privatePath) || Directory.Exists(publicPath))
            throw new IOException("Key paths must not already exist; existing keys are never overwritten.");
        if (string.Equals(privatePath, publicPath, StringComparison.OrdinalIgnoreCase))
            throw new IOException("Private and public key paths must be different.");
        // The private signing key must never be placed inside this repository,
        // including ignored directories: a later ignore change must not expose it.
        var repository = FindRepositoryRoot(Environment.CurrentDirectory) ?? FindRepositoryRoot(AppContext.BaseDirectory);
        if (repository is not null && privatePath.StartsWith(repository + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
            throw new IOException("Store the private key outside the repository.");
        if (!Directory.Exists(Path.GetDirectoryName(privatePath)) || !Directory.Exists(Path.GetDirectoryName(publicPath)))
            throw new DirectoryNotFoundException("Create the key directories first.");
        using var key = RSA.Create(3072);
        using (var stream = new FileStream(privatePath, FileMode.CreateNew, FileAccess.Write, FileShare.None))
        using (var writer = new StreamWriter(stream)) writer.Write(key.ExportPkcs8PrivateKeyPem());
        using (var stream = new FileStream(publicPath, FileMode.CreateNew, FileAccess.Write, FileShare.None))
        using (var writer = new StreamWriter(stream)) writer.Write(key.ExportSubjectPublicKeyInfoPem());
    }

    private static string? FindRepositoryRoot(string start)
    {
        for (var directory = new DirectoryInfo(start); directory is not null; directory = directory.Parent)
            if (Directory.Exists(Path.Combine(directory.FullName, ".git")) || File.Exists(Path.Combine(directory.FullName, ".git")))
                return directory.FullName.TrimEnd(Path.DirectorySeparatorChar);
        return null;
    }

    public static string Build(string extensionDirectory, string privatePath, string outputDirectory)
    {
        var source = Path.GetFullPath(extensionDirectory);
        var output = Path.GetFullPath(outputDirectory);
        if (!Directory.Exists(source)) throw new DirectoryNotFoundException("Extension directory not found.");
        if (Directory.Exists(output) || File.Exists(output)) throw new IOException("Output directory already exists; choose a new directory.");
        var manifestBytes = File.ReadAllBytes(Path.Combine(source, "manifest.json"));
        using var doc = JsonDocument.Parse(manifestBytes);
        var manifest = doc.RootElement;
        var version = manifest.GetProperty("version").GetString();
        if (manifest.GetProperty("name").GetString() is not ("Cleaning Lead Quote Assistant" or "Presto VA Assistant") || manifest.GetProperty("manifest_version").GetInt32() != 3 ||
            version is null || !System.Text.RegularExpressions.Regex.IsMatch(version, @"^\d+(\.\d+){1,3}$") || !Version.TryParse(version, out _))
            throw new InvalidDataException("Invalid extension manifest.");
        long total = 0;
        foreach (var file in Files)
        {
            var path = Path.Combine(source, file);
            if (!File.Exists(path) || (File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0)
                throw new InvalidDataException($"Missing or unsafe extension file: {file}");
            var size = new FileInfo(path).Length;
            total += size;
            if (size > 8 * 1024 * 1024 || total > 32 * 1024 * 1024)
                throw new InvalidDataException("Extension files exceed the updater's package size limits.");
        }
        using var key = RSA.Create();
        key.ImportFromPem(File.ReadAllText(privatePath));
        if (key.KeySize < 2048) throw new CryptographicException("Signing key must be at least 2048 bits.");

        using var packageStream = new MemoryStream();
        using (var zip = new ZipArchive(packageStream, ZipArchiveMode.Create, leaveOpen: true))
        {
            foreach (var file in Files.Order(StringComparer.Ordinal))
            {
                var entry = zip.CreateEntry($"chrome_extension/{file}", CompressionLevel.Optimal);
                entry.LastWriteTime = new DateTimeOffset(1980, 1, 1, 0, 0, 0, TimeSpan.Zero);
                using var sourceStream = File.OpenRead(Path.Combine(source, file));
                using var entryStream = entry.Open();
                sourceStream.CopyTo(entryStream);
            }
        }
        var package = packageStream.ToArray();
        var packageName = $"Presto-VA-Assistant-v{version}.zip";
        var url = $"https://github.com/vitornonno/Automacao/releases/download/v{version}/{packageName}";
        var signedManifest = JsonSerializer.SerializeToUtf8Bytes(new { version, sha256 = Convert.ToHexString(SHA256.HashData(package)).ToLowerInvariant(), packageUrl = url });
        var signature = key.SignData(signedManifest, HashAlgorithmName.SHA256, RSASignaturePadding.Pss);
        var verified = PackageVerifier.VerifyManifest(signedManifest, signature, key.ExportSubjectPublicKeyInfoPem());
        PackageVerifier.VerifyPackage(new MemoryStream(package, false), verified.Sha256);
        Directory.CreateDirectory(output);
        WriteNew(Path.Combine(output, packageName), package);
        WriteNew(Path.Combine(output, "update.json"), signedManifest);
        WriteNew(Path.Combine(output, "update.sig"), signature);
        return version;
    }

    private static void WriteNew(string path, byte[] bytes)
    {
        using var stream = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None);
        stream.Write(bytes);
    }
}
