# Simple static file server for Mortgage Calculators
# Run: powershell -ExecutionPolicy Bypass -File serve.ps1

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8080
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host "Serving: $root"
Write-Host "URL: http://localhost:$port/mortgage-toolkit-NEW.html"
Write-Host "Press Ctrl+C to stop."

$mimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".svg"  = "image/svg+xml"
  ".ico"  = "image/x-icon"
  ".woff2"= "font/woff2"
  ".woff" = "font/woff"
}

while ($listener.IsListening) {
  try {
    $context = $listener.GetContext()
    $req     = $context.Request
    $res     = $context.Response

    $urlPath = $req.Url.AbsolutePath
    if ($urlPath -eq "/" -or $urlPath -eq "") { $urlPath = "/mortgage-toolkit-NEW.html" }

    $localPath = Join-Path $root ($urlPath.TrimStart("/").Replace("/", "\"))

    if (Test-Path $localPath -PathType Leaf) {
      $ext  = [IO.Path]::GetExtension($localPath).ToLower()
      $mime = if ($mimeTypes[$ext]) { $mimeTypes[$ext] } else { "application/octet-stream" }
      $bytes = [IO.File]::ReadAllBytes($localPath)
      $res.ContentType   = $mime
      $res.ContentLength64 = $bytes.Length
      $res.StatusCode    = 200
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
      $msg = [Text.Encoding]::UTF8.GetBytes("Not found: $urlPath")
      $res.OutputStream.Write($msg, 0, $msg.Length)
    }
    $res.OutputStream.Close()
  } catch {
    # Ctrl+C will land here
    break
  }
}
$listener.Stop()
