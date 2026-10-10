# Tiny static file server for local preview (no Node/Python needed).
# powershell -ExecutionPolicy Bypass -File scripts/serve.ps1 [-Port 8080]
param([int]$Port = 8080)
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$types = @{
  ".html" = "text/html; charset=utf-8"; ".js" = "text/javascript; charset=utf-8"; ".mjs" = "text/javascript; charset=utf-8"
  ".css" = "text/css; charset=utf-8"; ".json" = "application/json; charset=utf-8"; ".webmanifest" = "application/manifest+json"
  ".svg" = "image/svg+xml"; ".png" = "image/png"; ".ico" = "image/x-icon"; ".md" = "text/plain; charset=utf-8"
}
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $root at http://localhost:$Port/"
try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $res = $ctx.Response
    try {
      $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart("/")
      if ($path -eq "" -or $path.EndsWith("/")) { $path += "index.html" }
      $file = [IO.Path]::GetFullPath((Join-Path $root $path))
      $res.Headers.Add("Cache-Control", "no-store")
      if ($file.StartsWith($root + [IO.Path]::DirectorySeparatorChar) -and (Test-Path $file -PathType Leaf)) {
        $ext = [IO.Path]::GetExtension($file).ToLower()
        $res.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { "application/octet-stream" }
        $bytes = [IO.File]::ReadAllBytes($file)
        $res.ContentLength64 = $bytes.Length
        if ($ctx.Request.HttpMethod -ne "HEAD") { $res.OutputStream.Write($bytes, 0, $bytes.Length) }
      } else {
        $res.StatusCode = 404
      }
    } catch {
      Write-Host "Request error: $_"
    } finally {
      try { $res.Close() } catch {}
    }
  }
} finally { $listener.Stop() }
