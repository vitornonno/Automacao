using System.Security.Cryptography;
using System.Text.Json;

namespace CleaningUpdater;

public sealed record SignedPackage(string Version, string Sha256, string PackageUrl);

public static class PackageVerifier
{
    // Verify the exact bytes before parsing: JSON reserialization can change
    // whitespace and property order and must not affect signature verification.
    public static SignedPackage VerifyManifest(byte[] manifestBytes, byte[] signature, string publicKeyPem)
    {
        using var key = RSA.Create();
        key.ImportFromPem(publicKeyPem);
        if (key.KeySize < 2048 || !key.VerifyData(manifestBytes, signature, HashAlgorithmName.SHA256, RSASignaturePadding.Pss))
            throw new CryptographicException("Update signature is invalid.");

        var manifest = JsonSerializer.Deserialize<SignedPackage>(manifestBytes, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        }) ?? throw new InvalidDataException("Update manifest is empty.");
        if (!Version.TryParse(manifest.Version, out _) || manifest.Sha256 is null || manifest.Sha256.Length != 64 || !manifest.Sha256.All(Uri.IsHexDigit))
            throw new InvalidDataException("Update version or hash is invalid.");
        if (!Uri.TryCreate(manifest.PackageUrl, UriKind.Absolute, out var url) || url.Scheme != Uri.UriSchemeHttps || url.UserInfo.Length != 0)
            throw new InvalidDataException("Update package must use HTTPS.");
        return manifest;
    }

    public static void VerifyPackage(Stream package, string expectedSha256)
    {
        var expected = Convert.FromHexString(expectedSha256);
        var actual = SHA256.HashData(package);
        if (!CryptographicOperations.FixedTimeEquals(actual, expected))
            throw new CryptographicException("Update package hash does not match the signed manifest.");
    }
}
