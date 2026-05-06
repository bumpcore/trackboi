$ErrorActionPreference = "Stop"

$Repo = "bumpcore/trackboi"
Write-Host "trackboi: Starting installer"
Write-Host "trackboi: Resolving latest release"
$Release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest"
$Tag = $Release.tag_name

if (-not $Tag.StartsWith("v")) {
	throw "Could not resolve the latest trackboi release version."
}

$Version = $Tag.TrimStart("v")
$Asset = "trackboi-$Version-x64.exe"
$DownloadUrl = "https://github.com/$Repo/releases/download/$Tag/$Asset"
$Installer = Join-Path $env:TEMP $Asset

Write-Host "trackboi: Latest release is $Tag"
Write-Host "trackboi: Downloading $Asset"
Invoke-WebRequest -Uri $DownloadUrl -OutFile $Installer
Write-Host "trackboi: Launching installer"
Start-Process -FilePath $Installer -Wait
Write-Host "trackboi: Done"
