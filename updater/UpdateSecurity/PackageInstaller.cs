using System.IO.Compression;
using System.Text.Json;

namespace CleaningUpdater;

public static class PackageInstaller
{
    private const long MaxFileSize = 8 * 1024 * 1024;
    private const long MaxTotalSize = 32 * 1024 * 1024;
    private static readonly HashSet<string> AllowedFiles = new(StringComparer.OrdinalIgnoreCase)
    {
        "manifest.json", "background.js", "cleaner-availability.js", "content.js", "extractors.js",
        "panel.css", "popup.css", "popup.html", "popup.js", "presto-content.js", "pricing.js",
        "quote-messages.js", "service-picker.css", "service-picker.html", "service-picker.js", "xlsx-import.js", "presto-logo.png"
    };

    public static void Install(Stream package, string targetDirectory, string expectedVersion)
    {
        var target = Path.GetFullPath(targetDirectory);
        if (!Directory.Exists(target) || Path.GetPathRoot(target) == target || (File.GetAttributes(target) & FileAttributes.ReparsePoint) != 0)
            throw new InvalidDataException("Extension directory is invalid.");
        ValidateManifest(File.ReadAllBytes(Path.Combine(target, "manifest.json")), null);
        using var archive = new ZipArchive(package, ZipArchiveMode.Read, leaveOpen: true);
        var files = new Dictionary<string, byte[]>(StringComparer.OrdinalIgnoreCase);
        long total = 0;
        foreach (var entry in archive.Entries)
        {
            var entryName = entry.FullName.Replace('\\', '/');
            if (entryName == "chrome_extension/") continue;
            const string prefix = "chrome_extension/";
            if (!entryName.StartsWith(prefix, StringComparison.Ordinal) || entryName[prefix.Length..].Contains('/'))
                throw new InvalidDataException("Unexpected path in package.");
            var name = entryName[prefix.Length..];
            var unixType = (entry.ExternalAttributes >> 16) & 0xF000;
            if (!AllowedFiles.Contains(name) || files.ContainsKey(name) || entry.Length < 0 || entry.Length > MaxFileSize || unixType == 0xA000)
                throw new InvalidDataException("Unexpected, duplicate, or oversized package file.");
            total += entry.Length;
            if (total > MaxTotalSize) throw new InvalidDataException("Package is too large.");
            using var source = entry.Open();
            using var destination = new MemoryStream();
            var buffer = new byte[81920];
            int read;
            while ((read = source.Read(buffer, 0, buffer.Length)) != 0)
            {
                if (destination.Length + read > entry.Length) throw new InvalidDataException("Package entry exceeds its declared size.");
                destination.Write(buffer, 0, read);
            }
            if (destination.Length != entry.Length) throw new InvalidDataException("Invalid package entry length.");
            files.Add(name, destination.ToArray());
        }
        if (!AllowedFiles.SetEquals(files.Keys)) throw new InvalidDataException("Package does not contain the complete extension.");
        ValidateManifest(files["manifest.json"], expectedVersion);

        // Persist the backup before modifying any extension file. The backup is
        // kept even on success, so an interrupted process can be recovered.
        var backupDirectory = Path.Combine(target, ".cleaning-updater-backup-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(backupDirectory);
        var oldFiles = new Dictionary<string, byte[]?>(StringComparer.OrdinalIgnoreCase);
        foreach (var name in files.Keys)
        {
            var path = Path.Combine(target, name);
            if (File.Exists(path) && (File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0)
                throw new IOException("Extension files must not be symbolic links.");
            var old = File.Exists(path) ? File.ReadAllBytes(path) : null;
            oldFiles[name] = old;
            if (old is not null) File.WriteAllBytes(Path.Combine(backupDirectory, name), old);
        }
        try
        {
            foreach (var (name, data) in files)
            {
                var path = Path.Combine(target, name);
                File.WriteAllBytes(path, data);
            }
        }
        catch
        {
            foreach (var (name, data) in oldFiles)
            {
                var path = Path.Combine(target, name);
                if (data is null) File.Delete(path); else File.WriteAllBytes(path, data);
            }
            throw;
        }
    }

    private static void ValidateManifest(byte[] bytes, string? expectedVersion)
    {
        using var json = JsonDocument.Parse(bytes);
        var root = json.RootElement;
        if (!root.TryGetProperty("name", out var name) || name.GetString() is not ("Cleaning Lead Quote Assistant" or "Presto VA Assistant") ||
            !root.TryGetProperty("manifest_version", out var schema) || schema.GetInt32() != 3 ||
            !root.TryGetProperty("version", out var version) || !Version.TryParse(version.GetString(), out _) ||
            (expectedVersion is not null && version.GetString() != expectedVersion))
            throw new InvalidDataException("Extension manifest does not match this updater.");
    }
}
