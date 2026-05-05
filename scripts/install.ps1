$ErrorActionPreference = "Stop"

$Repo = "bumpcore/trackboi"
$Release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest"
$Tag = $Release.tag_name

if (-not $Tag.StartsWith("v")) {
	throw "Could not resolve the latest trackboi release version."
}

$Version = $Tag.TrimStart("v")
$Asset = "trackboi-$Version-x64.exe"
$DownloadUrl = "https://github.com/$Repo/releases/download/$Tag/$Asset"
$Installer = Join-Path $env:TEMP $Asset

Invoke-WebRequest -Uri $DownloadUrl -OutFile $Installer
Start-Process -FilePath $Installer -Wait
