# Serves the site at http://localhost:8765/ for local testing (offline mode and Share links need a real web address).
# Run from anywhere:  powershell -ExecutionPolicy Bypass -File tools\serve.ps1
# Stop with Ctrl+C. Needs nothing installed; uses Windows' built-in web listener.
param([string]$Root = (Split-Path $PSScriptRoot -Parent), [int]$Port = 8765)
$Root = [IO.Path]::GetFullPath($Root)
$types = @{ '.html'='text/html; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.js'='text/javascript; charset=utf-8';
  '.svg'='image/svg+xml'; '.png'='image/png'; '.webmanifest'='application/manifest+json'; '.json'='application/json'; '.md'='text/plain; charset=utf-8' }
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$Port/")
$l.Start()
Write-Host "Serving $Root at http://localhost:$Port/  (Ctrl+C to stop)"
try {
  while ($l.IsListening) {
    $ctx = $l.GetContext()
    $res = $ctx.Response
    # one bad request (or a browser hanging up early) shouldn't stop the server
    try {
      $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
      if ($path -eq '' -or $path.EndsWith('/')) { $path += 'index.html' }
      $file = [IO.Path]::GetFullPath((Join-Path $Root $path))
      # only serve files inside the site folder
      if ($file.StartsWith($Root, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path $file -PathType Leaf)) {
        $bytes = [IO.File]::ReadAllBytes($file)
        $ext = [IO.Path]::GetExtension($file).ToLower()
        $res.ContentType = $(if ($types[$ext]) { $types[$ext] } else { 'application/octet-stream' })
        $res.Headers.Add('Cache-Control', 'no-cache')
        $res.ContentLength64 = $bytes.Length
        if ($ctx.Request.HttpMethod -ne 'HEAD') { $res.OutputStream.Write($bytes, 0, $bytes.Length) }
      } else { $res.StatusCode = 404 }
    } catch { Write-Host "  $($ctx.Request.Url.AbsolutePath): $($_.Exception.Message)" }
    finally { try { $res.Close() } catch {} }
  }
} finally { $l.Stop() }
