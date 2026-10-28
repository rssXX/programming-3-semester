# Курсовая: схемы из JSON, без браузера и скриншотов; PNG для Word и SVG для редактирования.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path -Parent $PSScriptRoot
$figureRoot = Join-Path $projectRoot 'otchet\coursework\figures'
New-Item -ItemType Directory -Force -Path $figureRoot | Out-Null
$specification = Get-Content -LiteralPath (Join-Path $projectRoot 'otchet\coursework\diagrams.json') -Encoding UTF8 -Raw | ConvertFrom-Json
foreach ($diagram in $specification) {
    $bitmap = [System.Drawing.Bitmap]::new([int]$diagram.width, [int]$diagram.height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([System.Drawing.Color]::White)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $font = [System.Drawing.Font]::new('Times New Roman', 23, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $bold = [System.Drawing.Font]::new('Times New Roman', 27, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(60, 83, 116), 2)
    $arrow = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(90, 109, 136), 3)
    $arrow.CustomEndCap = [System.Drawing.Drawing2D.AdjustableArrowCap]::new(5, 6)
    $fill = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(246, 248, 252))
    $svg = [System.Text.StringBuilder]::new()
    [void]$svg.AppendLine("<svg xmlns='http://www.w3.org/2000/svg' width='$($diagram.width)' height='$($diagram.height)' viewBox='0 0 $($diagram.width) $($diagram.height)'><rect width='100%' height='100%' fill='white'/><defs><marker id='arrow' markerWidth='10' markerHeight='10' refX='9' refY='3' orient='auto'><path d='M0,0 L0,6 L9,3 z' fill='#5a6d88'/></marker></defs>")
    $boxes = @{}
    foreach ($box in $diagram.boxes) { $boxes[$box.id] = $box }
    foreach ($edge in $diagram.edges) {
        $source = $boxes[$edge.from]; $target = $boxes[$edge.to]
        $startX = $source.x + $source.w / 2; $startY = $source.y + $source.h / 2
        $endX = $target.x + $target.w / 2; $endY = $target.y + $target.h / 2
        if ([Math]::Abs($endX - $startX) -gt [Math]::Abs($endY - $startY)) {
            $direction = [Math]::Sign($endX - $startX)
            $startX += $direction * $source.w / 2; $endX -= $direction * $target.w / 2
        } else {
            $direction = [Math]::Sign($endY - $startY)
            $startY += $direction * $source.h / 2; $endY -= $direction * $target.h / 2
        }
        $points = if ($edge.points) { @($edge.points | ForEach-Object { [System.Drawing.PointF]::new([single]$_[0], [single]$_[1]) }) } else { @([System.Drawing.PointF]::new([single]$startX, [single]$startY), [System.Drawing.PointF]::new([single]$endX, [single]$endY)) }
        $graphics.DrawLines($arrow, [System.Drawing.PointF[]]$points)
        $svgPoints = ($points | ForEach-Object { "$($_.X),$($_.Y)" }) -join ' '
        [void]$svg.AppendLine("<polyline points='$svgPoints' fill='none' stroke='#5a6d88' stroke-width='3' marker-end='url(#arrow)'/>")
    }
    foreach ($box in $diagram.boxes) {
        $graphics.FillRectangle($fill, [single]$box.x, [single]$box.y, [single]$box.w, [single]$box.h)
        $graphics.DrawRectangle($pen, [single]$box.x, [single]$box.y, [single]$box.w, [single]$box.h)
        $graphics.DrawString([string]$box.title, $bold, [System.Drawing.Brushes]::Black, [single]($box.x + 16), [single]($box.y + 14))
        [void]$svg.AppendLine("<rect x='$($box.x)' y='$($box.y)' width='$($box.w)' height='$($box.h)' fill='#f6f8fc' stroke='#3c5374' stroke-width='2'/>")
        $title = [System.Security.SecurityElement]::Escape([string]$box.title)
        [void]$svg.AppendLine("<text x='$($box.x + 16)' y='$($box.y + 38)' font-family='Times New Roman' font-size='27' font-weight='bold'>$title</text>")
        $lineY = $box.y + 60
        foreach ($line in $box.lines) {
            $graphics.DrawString([string]$line, $font, [System.Drawing.Brushes]::Black, [single]($box.x + 16), [single]$lineY)
            $escapedLine = [System.Security.SecurityElement]::Escape([string]$line)
            [void]$svg.AppendLine("<text x='$($box.x + 16)' y='$($lineY + 22)' font-family='Times New Roman' font-size='23'>$escapedLine</text>")
            $lineY += 34
        }
    }
    [void]$svg.AppendLine('</svg>')
    $bitmap.Save((Join-Path $figureRoot "$($diagram.name).png"), [System.Drawing.Imaging.ImageFormat]::Png)
    [System.IO.File]::WriteAllText((Join-Path $figureRoot "$($diagram.name).svg"), $svg.ToString(), [System.Text.UTF8Encoding]::new($false))
    $graphics.Dispose(); $bitmap.Dispose(); $font.Dispose(); $bold.Dispose(); $pen.Dispose(); $arrow.Dispose(); $fill.Dispose()
    Write-Output $diagram.name
}
