[System.Reflection.Assembly]::LoadWithPartialName("System.Drawing") | Out-Null

$inputPath = "c:\Users\YAEL\Desktop\CRM PRESTMOS NUEVO\public\logo.png"
$transparentPath = "c:\Users\YAEL\Desktop\CRM PRESTMOS NUEVO\public\logo_trans.png"
$lightPath = "c:\Users\YAEL\Desktop\CRM PRESTMOS NUEVO\public\logo_light_trans.png"

$bmp = [System.Drawing.Bitmap]::FromFile($inputPath)
$width = $bmp.Width
$height = $bmp.Height

# -----------------
# 1. CREATE DARK LOGO WITH TRANSPARENT BACKGROUND
# -----------------
$bmpDark = New-Object System.Drawing.Bitmap($width, $height)
for ($x = 0; $x -lt $width; $x++) {
    for ($y = 0; $y -lt $height; $y++) {
        $bmpDark.SetPixel($x, $y, $bmp.GetPixel($x, $y))
    }
}

# Flood fill from corners
$queue = New-Object System.Collections.Generic.Queue[System.Drawing.Point]
$visited = New-Object 'Boolean[,]' $width, $height

function IsNearWhite($color) {
    # If RGB are all above 230, we consider it white background
    return ($color.R -gt 230 -and $color.G -gt 230 -and $color.B -gt 230)
}

# Add corners
$corners = @(
    [System.Drawing.Point]::new(0, 0),
    [System.Drawing.Point]::new($width - 1, 0),
    [System.Drawing.Point]::new(0, $height - 1),
    [System.Drawing.Point]::new($width - 1, $height - 1)
)

foreach ($corner in $corners) {
    if (IsNearWhite($bmpDark.GetPixel($corner.X, $corner.Y))) {
        $queue.Enqueue($corner)
        $visited[$corner.X, $corner.Y] = $true
    }
}

$dx = @(0, 0, 1, -1)
$dy = @(1, -1, 0, 0)

while ($queue.Count -gt 0) {
    $curr = $queue.Dequeue()
    $bmpDark.SetPixel($curr.X, $curr.Y, [System.Drawing.Color]::Transparent)
    
    for ($i = 0; $i -lt 4; $i++) {
        $nx = $curr.X + $dx[$i]
        $ny = $curr.Y + $dy[$i]
        if ($nx -ge 0 -and $nx -lt $width -and $ny -ge 0 -and $ny -lt $height) {
            if (-not $visited[$nx, $ny]) {
                $color = $bmpDark.GetPixel($nx, $ny)
                if (IsNearWhite($color)) {
                    $visited[$nx, $ny] = $true
                    $queue.Enqueue([System.Drawing.Point]::new($nx, $ny))
                }
            }
        }
    }
}

# Make also all inner loops of letters transparent if they are near white
# Wait, for letters like 'a', 'o', 'B', etc. we can do a secondary pass:
# Any pixel in the bottom 45% that is near-white can be made transparent, 
# because there are no white elements in the text itself.
$textBoundaryY = [int]($height * 0.55)
for ($y = $textBoundaryY; $y -lt $height; $y++) {
    for ($x = 0; $x -lt $width; $x++) {
        if (IsNearWhite($bmpDark.GetPixel($x, $y))) {
            $bmpDark.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
        }
    }
}

$bmpDark.Save($transparentPath, [System.Drawing.Imaging.ImageFormat]::Png)

# -----------------
# 2. CREATE LIGHT LOGO FOR DARK SIDEBAR (TRANSPARENT BG, WHITE TEXT)
# -----------------
$bmpLight = New-Object System.Drawing.Bitmap($width, $height)
for ($x = 0; $x -lt $width; $x++) {
    for ($y = 0; $y -lt $height; $y++) {
        # Copy pixel from the dark transparent bitmap
        $color = $bmpDark.GetPixel($x, $y)
        
        # If it's transparent, keep it transparent
        if ($color.A -eq 0) {
            $bmpLight.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
        } else {
            # If it's in the text area (bottom 45%), change dark text to white
            if ($y -ge $textBoundaryY) {
                # If the text is dark (R < 150), make it white. 
                # If it's the light blue subtitle, we can also make it a very light cyan/white
                if ($color.R -lt 150 -and $color.G -lt 180) {
                    # Change to white
                    $bmpLight.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($color.A, 255, 255, 255))
                } else {
                    $bmpLight.SetPixel($x, $y, $color)
                }
            } else {
                # In the icon area, we keep it as is
                $bmpLight.SetPixel($x, $y, $color)
            }
        }
    }
}

$bmpLight.Save($lightPath, [System.Drawing.Imaging.ImageFormat]::Png)

$bmp.Dispose()
$bmpDark.Dispose()
$bmpLight.Dispose()
Write-Host "Success processing logos!"
