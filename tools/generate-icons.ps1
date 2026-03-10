$ErrorActionPreference = 'Stop'

Set-Location 'C:\Users\GvTechFix\Desktop\TakeSnap'

$src = 'assets/icons/TakeSnap Ext logo.png'
if (-not (Test-Path $src)) {
  throw "Source image not found: $src"
}

$out = 'assets/icons'
$sizes = 16, 32, 48, 128, 256

Add-Type -AssemblyName System.Drawing

foreach ($s in $sizes) {
  $bmp = New-Object System.Drawing.Bitmap $src
  $square = New-Object System.Drawing.Bitmap $s, $s
  $g = [System.Drawing.Graphics]::FromImage($square)
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.SmoothingMode = 'AntiAlias'
  $g.PixelOffsetMode = 'HighQuality'
  $g.CompositingQuality = 'HighQuality'
  $g.Clear([System.Drawing.Color]::Transparent)

  $min = [Math]::Min($bmp.Width, $bmp.Height)
  $offsetX = [int](($bmp.Width - $min) / 2)
  $offsetY = [int](($bmp.Height - $min) / 2)
  $srcRect = New-Object System.Drawing.Rectangle($offsetX, $offsetY, $min, $min)
  $destRect = New-Object System.Drawing.Rectangle(0, 0, $s, $s)

  $g.DrawImage($bmp, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()

  $outPath = Join-Path $out ("icon{0}.png" -f $s)
  $square.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $square.Dispose()
  $bmp.Dispose()
}

