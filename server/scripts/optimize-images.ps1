# Nen anh JPG cho store — task 2026-09-22 "Toi uu toan bo du an" (docs/tasks/2026-09-22-toi-uu-toan-bo-du-an.md, muc 3.2 A1..A8).
# Dung System.Drawing (built-in Windows) — 0 dependency. Chay tu goc repo:
#   powershell -ExecutionPolicy Bypass -File server\scripts\optimize-images.ps1 [-MaxWidth 800] [-Quality 75]
#
# Luat hanh vi (doi chieu task file):
#   A1  Chi xu ly *.jpg co Width > MaxWidth (duyet de quy server/public/images/). Anh da <= MaxWidth
#       (va .svg) bi bo qua, KHONG re-encode -> script idempotent: chay lai khong giam chat luong them.
#   A2  Resize Width -> MaxWidth, Height giu dung ti le khung (lam tron); khong bao gio phong to.
#   A3  Re-encode JPEG quality 75 (mac dinh). Neu tong giam < 40% -> duoc phep chay lai voi -Quality 70
#       (toi thieu 70) sau khi phuc hoi anh goc tu server/scripts/backup-images/.
#   A4  Backup ban goc vao server/scripts/backup-images/ (giu cau truc catalog/, products/) TRUOC khi
#       ghi de. Backup goc dau tien khong bao gio bi de; neu backup da co ma khac noi dung -> luu them
#       ban co hau to thoi gian.
#   A5  Chi ghi de khi file nen NHO HON ban goc; nen ra to hon (hiem) -> giu nguyen + bao "skip".
#   A6  EXIF Orientation <> 1 -> ap dung RotateFlip tuong ung truoc khi resize; bitmap moi khong con
#       EXIF nen orientation coi nhu da reset ve 1.
#   A7  Mo anh qua ban sao MemoryStream (khong khoa file nguon khi ghi de). File hong -> canh bao +
#       bo qua, khong crash ca script; exit code = 1 neu co bat ky file nao loi.
#   A8  In bao cao: tung file (ten, px cu->moi, KB cu->moi) + tong before/after.
param(
  [int]$MaxWidth = 800,
  [int]$Quality = 75
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

if ($MaxWidth -lt 1) { Write-Host 'LOI: MaxWidth phai >= 1.' -ForegroundColor Red; exit 1 }
if ($Quality -lt 1 -or $Quality -gt 100) { Write-Host 'LOI: Quality phai trong 1..100.' -ForegroundColor Red; exit 1 }

$ImagesRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\public\images')).Path
$BackupRoot = Join-Path $PSScriptRoot 'backup-images'

$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.MimeType -eq 'image/jpeg' }
if (-not $jpegCodec) { Write-Host 'LOI: khong tim thay encoder JPEG (image/jpeg).' -ForegroundColor Red; exit 1 }

# EXIF Orientation (PropertyItem 0x0112) -> RotateFlipType (GDI+ quay truoc roi moi lat).
$RotationFor = @{
  2 = [System.Drawing.RotateFlipType]::RotateNoneFlipX
  3 = [System.Drawing.RotateFlipType]::Rotate180FlipNone
  4 = [System.Drawing.RotateFlipType]::RotateNoneFlipY
  5 = [System.Drawing.RotateFlipType]::Rotate90FlipX
  6 = [System.Drawing.RotateFlipType]::Rotate90FlipNone
  7 = [System.Drawing.RotateFlipType]::Rotate270FlipX
  8 = [System.Drawing.RotateFlipType]::Rotate270FlipNone
}

function New-ThumbBytes {
  # Resize + re-encode JPEG hoan toan trong RAM -> tra ve byte[] (khong dung file).
  param([System.Drawing.Image]$Image, [int]$W, [int]$H, [int]$JpegQuality)
  $bmp = New-Object System.Drawing.Bitmap -ArgumentList $W, $H
  $g = $null; $ep = $null; $ms = $null
  try {
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.DrawImage($Image, 0, 0, $W, $H)
    $ep = New-Object System.Drawing.Imaging.EncoderParameters 1
    $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter -ArgumentList ([System.Drawing.Imaging.Encoder]::Quality), ([Int64]$JpegQuality)
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, $jpegCodec, $ep)
    return , $ms.ToArray()
  } finally {
    if ($g)  { $g.Dispose() }
    if ($ep) { $ep.Dispose() }
    if ($ms) { $ms.Dispose() }
    $bmp.Dispose()
  }
}

function Backup-Original {
  # A4: backup ban goc truoc khi ghi de; ban backup dau tien la bat bien.
  # Tra ve duong dan backup moi tao ($null neu khong can tao them).
  param([System.IO.FileInfo]$File)
  $rel = $File.FullName.Substring($ImagesRoot.Length).TrimStart('\', '/')
  $dest = Join-Path $BackupRoot $rel
  $destDir = Split-Path -Parent $dest
  if (-not (Test-Path -LiteralPath $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }

  if (-not (Test-Path -LiteralPath $dest)) {
    Copy-Item -LiteralPath $File.FullName -Destination $dest
    return $dest
  }
  # Backup da ton tai: neu dung noi dung (goc nay da duoc backup lan dau) -> khong lam gi them (idempotent);
  # neu khac noi dung -> luu them ban hau to thoi gian, tuyet doi khong de mat backup goc dau tien.
  $same = ((Get-Item -LiteralPath $dest).Length -eq $File.Length) -and
    ((Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash -eq (Get-FileHash -LiteralPath $File.FullName -Algorithm SHA256).Hash)
  if ($same) { return $null }
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $stamped = Join-Path $destDir ('{0}_{1}{2}' -f [IO.Path]::GetFileNameWithoutExtension($dest), $stamp, [IO.Path]::GetExtension($dest))
  Copy-Item -LiteralPath $File.FullName -Destination $stamped
  return $stamped
}

$files = @(Get-ChildItem -LiteralPath $ImagesRoot -Recurse -Filter *.jpg -File)
if (-not $files.Count) { Write-Warning "Khong tim thay file *.jpg nao trong $ImagesRoot"; exit 0 }

$rows = @()
$processed = 0; $skipped = 0; $failed = 0
$totalBefore = 0L; $totalAfter = 0L

foreach ($f in $files) {
  $sizeBefore = $f.Length
  $totalBefore += $sizeBefore
  $rel = $f.FullName.Substring($ImagesRoot.Length).TrimStart('\', '/')
  $row = [ordered]@{ 'File' = $rel; 'Px (cu -> moi)' = ''; 'KB (cu -> moi)' = ''; 'Hanh dong' = '' }
  $img = $null; $inMs = $null
  try {
    # A7: doc qua ban sao MemoryStream -> khong khoa file nguon khi ghi de.
    $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
    $inMs = New-Object System.IO.MemoryStream -ArgumentList (,$bytes)
    $img = [System.Drawing.Image]::FromStream($inMs)
    $w0 = $img.Width; $h0 = $img.Height

    if ($w0 -le $MaxWidth) {
      # A1: da nho/du nguong -> bo qua, khong re-encode.
      $skipped++
      $totalAfter += $sizeBefore
      $row['Px (cu -> moi)'] = '{0}x{1} (giu nguyen)' -f $w0, $h0
      $row['KB (cu -> moi)'] = '{0:N1} (khong doi)' -f ($sizeBefore / 1KB)
      $row['Hanh dong'] = 'Bo qua (da <= {0}px)' -f $MaxWidth
      $rows += [pscustomobject]$row
      continue
    }

    # A6: EXIF Orientation <> 1 -> quay/lat dung chieu hien thi truoc khi resize.
    $orientation = 1
    $prop = @($img.PropertyItems | Where-Object { $_.Id -eq 0x0112 })[0]
    if ($prop) { $orientation = [int]$prop.Value[0] }
    if ($orientation -ne 1 -and $RotationFor.ContainsKey($orientation)) {
      $img.RotateFlip($RotationFor[$orientation])
    }

    # A2: Width -> MaxWidth, Height giu ti le khung; khong phong to (w0 > MaxWidth da chac chan).
    $newW = $MaxWidth
    $newH = [Math]::Max(1, [int][Math]::Round([double]$img.Height * $newW / $img.Width))

    $null = Backup-Original $f   # A4: backup truoc khi ghi de.

    $newBytes = New-ThumbBytes -Image $img -W $newW -H $newH -JpegQuality $Quality
    $img.Dispose(); $img = $null
    $inMs.Dispose(); $inMs = $null

    if ($newBytes.Length -lt $sizeBefore) {
      # A5: nho hon ban goc moi ghi de.
      [System.IO.File]::WriteAllBytes($f.FullName, $newBytes)
      $processed++
      $totalAfter += $newBytes.Length
      $row['Px (cu -> moi)'] = '{0}x{1} -> {2}x{3}' -f $w0, $h0, $newW, $newH
      $row['KB (cu -> moi)'] = '{0:N1} -> {1:N1}' -f ($sizeBefore / 1KB), ($newBytes.Length / 1KB)
      $row['Hanh dong'] = 'Nen (q{0})' -f $Quality
    } else {
      $skipped++
      $totalAfter += $sizeBefore
      $row['Px (cu -> moi)'] = '{0}x{1} -> {2}x{3}' -f $w0, $h0, $newW, $newH
      $row['KB (cu -> moi)'] = '{0:N1} -> {1:N1}' -f ($sizeBefore / 1KB), ($sizeBefore / 1KB)
      $row['Hanh dong'] = 'Skip (nen ra to hon goc, giu nguyen)'
    }
    $rows += [pscustomobject]$row
  } catch {
    # A7: file hong -> canh bao + bo qua, khong chet ca script.
    $failed++
    $totalAfter += $sizeBefore
    Write-Warning ('[anh] {0}: bo qua — {1}' -f $rel, $_.Exception.Message)
    $row['Hanh dong'] = 'Loi (bo qua)'
    $rows += [pscustomobject]$row
  } finally {
    if ($img)  { $img.Dispose() }
    if ($inMs) { $inMs.Dispose() }
  }
}

# A8: bao cao cuoi.
''
'==== BAO CAO NEN ANH (MaxWidth={0}px, Quality={1}) ====' -f $MaxWidth, $Quality
'Anh     : {0}' -f $ImagesRoot
'Backup  : {0}' -f $BackupRoot
''
$rows | Format-Table -AutoSize | Out-String -Width 220
$beforeKB = $totalBefore / 1KB
$afterKB = $totalAfter / 1KB
$reducePct = 0
if ($totalBefore -gt 0) { $reducePct = 100 * ($totalBefore - $totalAfter) / $totalBefore }
'Tong before : {0:N1} KB ({1} file)' -f $beforeKB, $files.Count
'Tong after  : {0:N1} KB — giam {1:N1}%' -f $afterKB, $reducePct
'Tong ket: {0} file duoc xu ly, {1} file bo qua, {2} loi.' -f $processed, $skipped, $failed
if ($reducePct -lt 40 -and $processed -gt 0) {
  'CANH BAO: giam < 40% chi tieu — duoc phep phuc hoi anh goc tu server/scripts/backup-images/ roi chay lai voi -Quality 70 (toi thieu 70).'
}
if ($failed -gt 0) { exit 1 } else { exit 0 }