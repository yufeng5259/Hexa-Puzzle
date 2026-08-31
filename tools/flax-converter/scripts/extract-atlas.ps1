param(
    [Parameter(Mandatory = $true)][string]$Manifest,
    [Parameter(Mandatory = $true)][string]$Atlas,
    [Parameter(Mandatory = $true)][string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$manifestPath = (Resolve-Path -LiteralPath $Manifest).Path
$atlasPath = (Resolve-Path -LiteralPath $Atlas).Path
$outputRoot = [System.IO.Path]::GetFullPath($OutputDirectory)
[System.IO.Directory]::CreateDirectory($outputRoot) | Out-Null

$data = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
$source = [System.Drawing.Bitmap]::new($atlasPath)
try {
    if ($source.Width -ne $data.atlasSize.width -or $source.Height -ne $data.atlasSize.height) {
        throw "Atlas dimensions $($source.Width)x$($source.Height) do not match manifest $($data.atlasSize.width)x$($data.atlasSize.height)"
    }

    foreach ($frame in $data.frames) {
        if ($frame.id -notmatch '^[A-Za-z0-9_.-]+$') { throw "Unsafe frame id: $($frame.id)" }
        $target = [System.IO.Path]::GetFullPath((Join-Path $outputRoot "$($frame.id).png"))
        if (-not $target.StartsWith($outputRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Output escapes target directory: $target"
        }

        $region = [System.Drawing.Rectangle]::new(
            [int]$frame.region.x,
            [int]$frame.region.y,
            [int]$frame.region.width,
            [int]$frame.region.height
        )
        if ($region.X -lt 0 -or $region.Y -lt 0 -or $region.Right -gt $source.Width -or $region.Bottom -gt $source.Height) {
            throw "Frame $($frame.id) is outside the atlas"
        }

        $cropped = $source.Clone($region, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        try {
            $cropped.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
        } finally {
            $cropped.Dispose()
        }
    }
} finally {
    $source.Dispose()
}

Write-Output "Extracted $($data.frames.Count) frames to $outputRoot"
