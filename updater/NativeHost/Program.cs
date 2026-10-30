using System.Buffers.Binary;
using System.Reflection;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using CleaningUpdater;
using Microsoft.Win32;
using System.Diagnostics;

internal sealed record HostConfiguration(string ExtensionId, string ExtensionPath);
internal sealed record HostRequest(string? Action);
internal sealed record HostStep(string Step, long DurationMs, bool Ok);
internal sealed record HostResponse(bool Ok, string Status, string? CurrentVersion, string? AvailableVersion, string Message, List<HostStep>? Steps = null);

internal static class Program
{
    private const string HostName = "com.prestova.cleaning_updater";
    private const string ManifestUrl = "https://github.com/vitornonno/Automacao/releases/download/update-channel/update.json";
    private const string SignatureUrl = "https://github.com/vitornonno/Automacao/releases/download/update-channel/update.sig";
    private const string PackagePrefix = "https://github.com/vitornonno/Automacao/releases/download/";
    private static readonly string InstallDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "CleaningLeadUpdater");
    private static readonly string ConfigPath = Path.Combine(InstallDir, "config.json");
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true, PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    private static async Task<int> Main(string[] args)
    {
        if (args.Length == 1 && args[0] == "--setup") return Setup();
        var output = Console.OpenStandardOutput();
        var steps = new List<HostStep>();
        try
        {
            var config = ReadConfiguration();
            var origin = $"chrome-extension://{config.ExtensionId}/";
            if (args.Length == 0 || !string.Equals(args[0], origin, StringComparison.Ordinal))
                throw new InvalidOperationException("Extension origin does not match the installed configuration.");
            var request = await ReadMessage(Console.OpenStandardInput());
            if (request.Action is not ("check" or "install")) throw new InvalidOperationException("Unsupported updater action.");
            var response = await RunUpdate(config, request.Action, steps);
            await WriteMessage(output, response);
            return 0;
        }
        catch (Exception error)
        {
            await WriteMessage(output, new HostResponse(false, "error", null, null, SafeError(error), steps));
            return 1;
        }
    }

    private static async Task<HostResponse> RunUpdate(HostConfiguration config, string action, List<HostStep> steps)
    {
        if (action == "install")
        {
            FileStream gate;
            try
            {
                gate = new FileStream(Path.Combine(InstallDir, "installation.lock"), FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
            }
            catch (IOException) { throw new InvalidOperationException("Uma atualização já está em andamento."); }
            await using (gate) return await RunUpdateCore(config, action, steps);
        }
        return await RunUpdateCore(config, action, steps);
    }

    private static async Task<HostResponse> RunUpdateCore(HostConfiguration config, string action, List<HostStep> steps)
    {
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(45) };
        http.DefaultRequestHeaders.UserAgent.ParseAdd("CleaningLeadUpdater/1.0");
        return await RunUpdateCore(config, action, http, ReadEmbeddedPublicKey(), steps);
    }

    // Dependency injection is internal and used by the local integration test;
    // Native Messaging requests never supply an HTTP client or a trusted key.
    internal static async Task<HostResponse> RunUpdateCore(HostConfiguration config, string action, HttpClient http, string publicKey, List<HostStep>? steps = null)
    {
        steps ??= new List<HostStep>();
        T Measure<T>(string label, Func<T> run) { var watch = Stopwatch.StartNew(); var ok = false; try { var result = run(); ok = true; return result; } finally { steps.Add(new HostStep(label, watch.ElapsedMilliseconds, ok)); } }
        async Task<T> MeasureAsync<T>(string label, Func<Task<T>> run) { var watch = Stopwatch.StartNew(); var ok = false; try { var result = await run(); ok = true; return result; } finally { steps.Add(new HostStep(label, watch.ElapsedMilliseconds, ok)); } }
        var current = Measure("read_installed_version", () => ReadExtensionVersion(config.ExtensionPath));
        // GitHub may cache release asset redirects after the assets are replaced.
        // A fresh query parameter avoids receiving a stale signed channel.
        var cacheKey = Guid.NewGuid().ToString("N");
        var manifestBytes = await MeasureAsync("download_manifest", () => Download(http, $"{ManifestUrl}?check={cacheKey}", 16384));
        var signatureBytes = await MeasureAsync("download_signature", () => Download(http, $"{SignatureUrl}?check={cacheKey}", 2048));
        var signed = Measure("verify_manifest_signature", () => PackageVerifier.VerifyManifest(manifestBytes, signatureBytes, publicKey));
        if (!signed.PackageUrl.StartsWith(PackagePrefix, StringComparison.Ordinal) || signed.PackageUrl.Contains('?') || signed.PackageUrl.Contains('#'))
            throw new InvalidDataException("Signed package URL is not an official GitHub release URL.");
        if (CompareVersions(signed.Version, current) <= 0)
            return new HostResponse(true, "up_to_date", current, signed.Version, "A extensão já está atualizada.", steps);
        if (action == "check")
            return new HostResponse(true, "available", current, signed.Version, "Nova versão assinada disponível.", steps);
        var package = await MeasureAsync("download_package", () => Download(http, signed.PackageUrl, 40 * 1024 * 1024));
        using var stream = new MemoryStream(package, writable: false);
        Measure("verify_package_hash", () => { PackageVerifier.VerifyPackage(stream, signed.Sha256); return true; });
        stream.Position = 0;
        Measure("install_and_backup", () => { PackageInstaller.Install(stream, config.ExtensionPath, signed.Version); return true; });
        return new HostResponse(true, "installed", current, signed.Version, "Atualização instalada. Recarregue a página do Yelp.", steps);
    }

    private static int CompareVersions(string left, string right)
    {
        static int[] Parts(string text) => text.Split('.').Select(int.Parse).Concat(new[] { 0, 0, 0, 0 }).Take(4).ToArray();
        var a = Parts(left); var b = Parts(right);
        for (var i = 0; i < 4; i++) { var comparison = a[i].CompareTo(b[i]); if (comparison != 0) return comparison; }
        return 0;
    }

    private static async Task<byte[]> Download(HttpClient client, string url, int limit)
    {
        using var response = await client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead);
        response.EnsureSuccessStatusCode();
        if (response.Content.Headers.ContentLength > limit) throw new InvalidDataException("Update download exceeds the permitted size.");
        await using var source = await response.Content.ReadAsStreamAsync();
        using var destination = new MemoryStream();
        var buffer = new byte[81920]; int read;
        while ((read = await source.ReadAsync(buffer)) != 0)
        {
            if (destination.Length + read > limit) throw new InvalidDataException("Update download exceeds the permitted size.");
            destination.Write(buffer, 0, read);
        }
        return destination.ToArray();
    }

    private static string ReadEmbeddedPublicKey()
    {
        var assembly = Assembly.GetExecutingAssembly();
        var resource = assembly.GetManifestResourceNames().SingleOrDefault(name => name.EndsWith("TrustedUpdateKey.pem", StringComparison.Ordinal));
        if (resource is null) throw new InvalidOperationException("Updater was not built with a trusted signing key.");
        using var reader = new StreamReader(assembly.GetManifestResourceStream(resource)!);
        return reader.ReadToEnd();
    }

    private static HostConfiguration ReadConfiguration()
    {
        var config = JsonSerializer.Deserialize<HostConfiguration>(File.ReadAllBytes(ConfigPath), JsonOptions)
            ?? throw new InvalidDataException("Updater configuration is missing.");
        ValidateConfiguration(config);
        return config;
    }

    private static void ValidateConfiguration(HostConfiguration config)
    {
        if (!Regex.IsMatch(config.ExtensionId ?? "", "^[a-p]{32}$") || string.IsNullOrWhiteSpace(config.ExtensionPath) || !Path.IsPathFullyQualified(config.ExtensionPath))
            throw new InvalidDataException("Updater extension ID or directory is invalid.");
        var dir = new DirectoryInfo(config.ExtensionPath);
        if (!dir.Exists || dir.Parent is null) throw new InvalidDataException("Extension directory was not found.");
        for (DirectoryInfo? parent = dir; parent is not null; parent = parent.Parent)
            if ((parent.Attributes & FileAttributes.ReparsePoint) != 0) throw new InvalidDataException("Extension directory cannot contain a symbolic link or junction.");
        ReadExtensionVersion(dir.FullName);
    }

    private static string ReadExtensionVersion(string directory)
    {
        using var document = JsonDocument.Parse(File.ReadAllBytes(Path.Combine(directory, "manifest.json")));
        var root = document.RootElement;
        if (root.GetProperty("name").GetString() is not ("Cleaning Lead Quote Assistant" or "Presto VA Assistant") || root.GetProperty("manifest_version").GetInt32() != 3)
            throw new InvalidDataException("Selected folder is not the expected extension.");
        var value = root.GetProperty("version").GetString();
        if (!Version.TryParse(value, out _)) throw new InvalidDataException("Installed extension version is invalid.");
        return value!;
    }

    private static int Setup()
    {
        try
        {
            if (!OperatingSystem.IsWindows()) throw new PlatformNotSupportedException("Setup requires Windows.");
            _ = ReadEmbeddedPublicKey();
            Console.WriteLine("Presto VA Assistant auto updater");
            Console.WriteLine("Selecione na janela a pasta exibida em chrome://extensions → detalhes → Carregado de.");
            var path = SelectExtensionFolder();
            if (string.IsNullOrWhiteSpace(path)) throw new InvalidOperationException("Seleção cancelada; nenhuma configuração foi alterada.");
            Console.Write("ID da extensão (32 letras exibidas em chrome://extensions): ");
            var id = Console.ReadLine()?.Trim() ?? "";
            var config = new HostConfiguration(id, path);
            ValidateConfiguration(config);
            Console.WriteLine($"Pasta: {Path.GetFullPath(path)}\nID: {id}\nVersão instalada: {ReadExtensionVersion(path)}");
            Console.Write("Confirme que a pasta e o ID são da mesma extensão em chrome://extensions (S/N): ");
            if (!string.Equals(Console.ReadLine()?.Trim(), "s", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Instalação cancelada; nenhuma configuração foi alterada.");
            if (File.Exists(ConfigPath))
            {
                var existing = ReadConfiguration();
                if (!string.Equals(existing.ExtensionId, id, StringComparison.Ordinal) || !string.Equals(Path.GetFullPath(existing.ExtensionPath), Path.GetFullPath(path), StringComparison.OrdinalIgnoreCase))
                    throw new InvalidOperationException("O auxiliar já está configurado para outra instalação. Não foi substituído.");
            }
            var executable = Environment.ProcessPath ?? throw new InvalidOperationException("Updater executable is unavailable.");
            if (!string.Equals(Path.GetFileName(executable), "CleaningUpdaterHost.exe", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Execute o arquivo publicado CleaningUpdaterHost.exe, não dotnet run.");
            var installedExe = Path.Combine(InstallDir, "CleaningUpdaterHost.exe");
            using (var existingRegistry = Registry.CurrentUser.OpenSubKey($@"Software\Google\Chrome\NativeMessagingHosts\{HostName}"))
            {
                var existingManifest = existingRegistry?.GetValue("") as string;
                if (!string.IsNullOrEmpty(existingManifest) && !string.Equals(Path.GetFullPath(existingManifest), Path.GetFullPath(Path.Combine(InstallDir, "native-host.json")), StringComparison.OrdinalIgnoreCase))
                    throw new InvalidOperationException("O nome do auxiliar já está registrado em outro local. A configuração existente não foi alterada.");
            }
            Directory.CreateDirectory(InstallDir);
            if (!string.Equals(Path.GetFullPath(executable), Path.GetFullPath(installedExe), StringComparison.OrdinalIgnoreCase))
                File.Copy(executable, installedExe, overwrite: true);
            File.WriteAllText(ConfigPath, JsonSerializer.Serialize(config, JsonOptions));
            var nativeManifest = Path.Combine(InstallDir, "native-host.json");
            File.WriteAllText(nativeManifest, JsonSerializer.Serialize(new { name = HostName, description = "Presto VA Assistant auto updater", path = installedExe, type = "stdio", allowed_origins = new[] { $"chrome-extension://{id}/" } }));
            using var registry = Registry.CurrentUser.CreateSubKey($@"Software\Google\Chrome\NativeMessagingHosts\{HostName}") ?? throw new IOException("Não foi possível registrar o auxiliar.");
            registry.SetValue("", nativeManifest, RegistryValueKind.String);
            Console.WriteLine("Auxiliar configurado para esta conta do Windows. Reinicie o Chrome e use Verificar atualizações na extensão.");
            return 0;
        }
        catch (Exception error) { Console.Error.WriteLine(SafeError(error)); return 1; }
    }

    private static string? SelectExtensionFolder()
    {
        string? selected = null;
        Exception? failure = null;
        var thread = new Thread(() =>
        {
            try
            {
                var type = Type.GetTypeFromProgID("Shell.Application") ?? throw new InvalidOperationException("Seletor de pastas do Windows indisponível.");
                dynamic shell = Activator.CreateInstance(type) ?? throw new InvalidOperationException("Seletor de pastas do Windows indisponível.");
                // BIF_RETURNONLYFSDIRS | BIF_NEWDIALOGSTYLE: return a real
                // filesystem directory and allow normal folder navigation.
                dynamic? folder = shell.BrowseForFolder(0, "Selecione a pasta atual da extensão no Chrome", 0x0001 | 0x0040, 0);
                if (folder is not null) selected = (string?)folder.Self.Path;
            }
            catch (Exception error) { failure = error; }
        });
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        thread.Join();
        if (failure is not null) throw new InvalidOperationException("Não foi possível abrir o seletor de pastas do Windows.", failure);
        return selected;
    }

    private static async Task<HostRequest> ReadMessage(Stream input)
    {
        var header = new byte[4]; await input.ReadExactlyAsync(header);
        var length = BinaryPrimitives.ReadUInt32LittleEndian(header);
        if (length == 0 || length > 65536) throw new InvalidDataException("Native message length is invalid.");
        var payload = new byte[length]; await input.ReadExactlyAsync(payload);
        return JsonSerializer.Deserialize<HostRequest>(payload, JsonOptions) ?? throw new InvalidDataException("Native message is empty.");
    }

    private static async Task WriteMessage(Stream output, HostResponse response)
    {
        var bytes = JsonSerializer.SerializeToUtf8Bytes(response, JsonOptions);
        var header = new byte[4]; BinaryPrimitives.WriteUInt32LittleEndian(header, (uint)bytes.Length);
        await output.WriteAsync(header); await output.WriteAsync(bytes); await output.FlushAsync();
    }

    private static string SafeError(Exception error) => error switch
    {
        HttpRequestException => "Não foi possível acessar o canal de atualização. Tente novamente mais tarde.",
        TaskCanceledException => "A consulta de atualização demorou demais. Tente novamente.",
        System.Security.Cryptography.CryptographicException => "A assinatura ou o hash da atualização é inválido. Nenhum arquivo foi instalado.",
        FileNotFoundException => "A configuração ou um arquivo da extensão não foi encontrado.",
        IOException => "Falha de leitura ou gravação durante a atualização. Verifique as permissões e o backup.",
        InvalidDataException or InvalidOperationException or PlatformNotSupportedException => error.Message,
        _ => "O auxiliar não conseguiu concluir a operação. Nenhum pacote não verificado foi instalado."
    };
}
