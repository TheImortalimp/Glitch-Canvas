[CmdletBinding(SupportsShouldProcess=$true)]
param(
    [ValidateSet('install', 'enable', 'disable', 'uninstall')]
    [string]$Mode = 'install',
    [string]$VlcDir = 'C:\Program Files\VideoLAN\VLC',
    [string]$PluginDllPath,
    [switch]$SkipCacheRebuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-PluginPath {
    param([string]$ExplicitPath)

    if ($ExplicitPath) {
        if (-not (Test-Path -LiteralPath $ExplicitPath)) {
            throw "Plugin DLL not found: $ExplicitPath"
        }
        return (Resolve-Path -LiteralPath $ExplicitPath).Path
    }

    $candidates = @(
        (Join-Path $PSScriptRoot '..\..\glitch-canvas-vlc-plugin-windows\glitch_canvas.dll'),
        (Join-Path $PSScriptRoot '..\build\vlc-plugin\Release\glitch_canvas.dll'),
        (Join-Path $PSScriptRoot '..\glitch_canvas.dll')
    )

    foreach ($candidate in $candidates) {
        $resolved = [System.IO.Path]::GetFullPath($candidate)
        if (Test-Path -LiteralPath $resolved) {
            return $resolved
        }
    }

    throw "Could not locate glitch_canvas.dll. Pass -PluginDllPath explicitly."
}

function Update-VideoFilterSetting {
    param(
        [bool]$Enable
    )

    $vlcConfigDir = Join-Path $env:APPDATA 'vlc'
    $vlcConfigPath = Join-Path $vlcConfigDir 'vlcrc'

    if (-not (Test-Path -LiteralPath $vlcConfigDir)) {
        New-Item -ItemType Directory -Path $vlcConfigDir | Out-Null
    }

    if (-not (Test-Path -LiteralPath $vlcConfigPath)) {
        New-Item -ItemType File -Path $vlcConfigPath | Out-Null
    }

    $lines = Get-Content -LiteralPath $vlcConfigPath
    $idx = -1
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^\s*#?\s*video-filter=') {
            $idx = $i
            break
        }
    }

    $rawValue = ''
    if ($idx -ge 0) {
        $rawValue = ($lines[$idx] -replace '^\s*#?\s*video-filter=', '')
    }

    $filters = @()
    if ($rawValue) {
        $filters = $rawValue.Split(':', [System.StringSplitOptions]::RemoveEmptyEntries)
    }

    $target = 'glitch_canvas'
    $hasTarget = $filters -contains $target

    if ($Enable -and -not $hasTarget) {
        $filters += $target
    }
    if (-not $Enable -and $hasTarget) {
        $filters = $filters | Where-Object { $_ -ne $target }
    }

    if ($filters.Count -gt 0) {
        $newLine = 'video-filter=' + ($filters -join ':')
    } else {
        $newLine = '#video-filter='
    }

    if ($idx -ge 0) {
        $lines[$idx] = $newLine
    } else {
        $lines += $newLine
    }

    Set-Content -LiteralPath $vlcConfigPath -Value $lines -Encoding UTF8
}

function Rebuild-PluginCache {
    param([string]$VlcRoot)

    if ($SkipCacheRebuild) {
        return
    }

    $cacheGen = Join-Path $VlcRoot 'vlc-cache-gen.exe'
    $pluginsDir = Join-Path $VlcRoot 'plugins'

    if (-not (Test-Path -LiteralPath $cacheGen)) {
        throw "vlc-cache-gen.exe not found under $VlcRoot"
    }

    Start-Process -FilePath $cacheGen -ArgumentList $pluginsDir -Wait -NoNewWindow
}

$pluginDest = Join-Path $VlcDir 'plugins\video_filter\libglitch_canvas_plugin.dll'

if (Get-Process -Name vlc -ErrorAction SilentlyContinue) {
    throw 'Close VLC before running this installer script.'
}

switch ($Mode) {
    'install' {
        $pluginSource = Resolve-PluginPath -ExplicitPath $PluginDllPath
        if ($PSCmdlet.ShouldProcess($pluginDest, 'Install glitch_canvas plugin')) {
            Copy-Item -LiteralPath $pluginSource -Destination $pluginDest -Force
            Rebuild-PluginCache -VlcRoot $VlcDir
            Update-VideoFilterSetting -Enable $true
        }
        Write-Host 'Installed and enabled Glitch Canvas filter.'
    }
    'enable' {
        if ($PSCmdlet.ShouldProcess('vlcrc', 'Enable glitch_canvas in video-filter list')) {
            Update-VideoFilterSetting -Enable $true
        }
        Write-Host 'Enabled Glitch Canvas in VLC configuration.'
    }
    'disable' {
        if ($PSCmdlet.ShouldProcess('vlcrc', 'Disable glitch_canvas in video-filter list')) {
            Update-VideoFilterSetting -Enable $false
        }
        Write-Host 'Disabled Glitch Canvas in VLC configuration.'
    }
    'uninstall' {
        if ($PSCmdlet.ShouldProcess($pluginDest, 'Uninstall glitch_canvas plugin')) {
            Update-VideoFilterSetting -Enable $false
            if (Test-Path -LiteralPath $pluginDest) {
                Remove-Item -LiteralPath $pluginDest -Force
            }
            Rebuild-PluginCache -VlcRoot $VlcDir
        }
        Write-Host 'Uninstalled Glitch Canvas filter.'
    }
}
