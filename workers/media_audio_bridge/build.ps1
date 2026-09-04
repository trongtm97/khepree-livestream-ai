# Build media_audio_bridge.exe (requires .NET SDK 8+)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
dotnet publish -c Release -r win-x64 --self-contained false -o bin
Write-Host "Built: $PSScriptRoot\bin\media_audio_bridge.exe"
