[CmdletBinding()]
param(
    [string]$MySqlServiceName = 'MySQL80',
    [switch]$SkipDatabase,
    [switch]$SkipBackend,
    [switch]$SkipFrontend,
    [int]$FrontendPort = 8000
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$backendPath = Join-Path $repoRoot 'backend'
$frontendPath = $repoRoot

function Write-Heading {
    param([string]$Message)
    Write-Host ''
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Test-IsAdministrator {
    $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Build-RelaunchArguments {
    param(
        [hashtable]$BoundParameters,
        [string[]]$UnboundArguments
    )

    $args = @()
    foreach ($key in $BoundParameters.Keys) {
        $value = $BoundParameters[$key]
        $parameterName = "-$key"

        if ($value -is [System.Management.Automation.SwitchParameter]) {
            if ($value.IsPresent) {
                $args += $parameterName
            }
            continue
        }

        if ($null -ne $value) {
            $escaped = $value.ToString().Replace('"','`"')
            $args += $parameterName
            $args += "`"$escaped`""
        }
    }

    if ($UnboundArguments) {
        $args += $UnboundArguments
    }

    return $args
}

function Ensure-Elevation {
    if ($SkipDatabase) {
        return
    }

    if (Test-IsAdministrator) {
        return
    }

    Write-Host "Starting the MySQL service requires Administrator privileges. Requesting elevation..." -ForegroundColor Yellow
    $scriptPath = $PSCommandPath
    $argumentList = @('-NoProfile','-ExecutionPolicy','Bypass','-File',"`"$scriptPath`"")
    $argumentList += Build-RelaunchArguments -BoundParameters $PSBoundParameters -UnboundArguments $PSCmdlet.MyInvocation.UnboundArguments
    Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $argumentList | Out-Null
    Write-Host "Elevated window launched. Exiting current session..." -ForegroundColor Yellow
    exit
}

Ensure-Elevation

function Start-PowerShellWindow {
    param(
        [string]$Title,
        [string]$WorkingDirectory,
        [string]$Command
    )

    $scriptCommand = "Set-Location `"$WorkingDirectory`"; $Command"
    Start-Process -FilePath 'powershell.exe' -ArgumentList '-NoLogo','-NoExit','-Command',$scriptCommand -WorkingDirectory $WorkingDirectory | Out-Null
    Write-Host "[$Title] started in a new PowerShell window." -ForegroundColor Green
}

function Start-MySqlService {
    param([string[]]$Candidates)

    foreach ($name in $Candidates) {
        $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
        if ($null -eq $svc) {
            continue
        }

        if ($svc.Status -eq 'Running') {
            Write-Host "MySQL service '$name' is already running." -ForegroundColor Green
            return
        }

        Write-Host "Starting MySQL service '$name' ..." -ForegroundColor Yellow
        try {
            Start-Service -Name $name -ErrorAction Stop
            $svc.WaitForStatus([System.ServiceProcess.ServiceControllerStatus]::Running, (New-TimeSpan -Seconds 15)) | Out-Null
            Write-Host "MySQL service '$name' started successfully." -ForegroundColor Green
            return
        } catch {
            Write-Host "Failed to start MySQL service '$name': $($_.Exception.Message)" -ForegroundColor Red
            break
        }
    }

    Write-Host "Could not find a running MySQL service. Tried names: $($Candidates -join ', ')." -ForegroundColor Yellow
}

function Get-FrontendCommand {
    param([int]$Port)

    if (Get-Command npx -ErrorAction SilentlyContinue) {
        return "npx http-server -p $Port -c-1"
    }

    if (Get-Command python -ErrorAction SilentlyContinue) {
        return "python -m http.server $Port"
    }

    throw "No static server command available. Install Node.js (for npx http-server) or Python."
}

Write-Host "Project root: $repoRoot"

if (-not $SkipDatabase) {
    Write-Heading "MySQL service"
    $serviceNames = @()
    foreach ($candidate in @($MySqlServiceName,'mysql80','MySQL80','sql80','SQL80')) {
        if (-not [string]::IsNullOrWhiteSpace($candidate) -and $serviceNames -notcontains $candidate) {
            $serviceNames += $candidate
        }
    }
    Start-MySqlService -Candidates $serviceNames
} else {
    Write-Host "Skipping MySQL service start." -ForegroundColor Yellow
}

if (-not $SkipBackend) {
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Host "npm was not found. Install Node.js 18+ before starting the backend." -ForegroundColor Red
    } elseif (-not (Test-Path $backendPath)) {
        Write-Host "Backend directory not found: $backendPath" -ForegroundColor Red
    } else {
        Write-Heading "Backend API (npm run dev)"
        Start-PowerShellWindow -Title 'Backend API (npm run dev)' -WorkingDirectory $backendPath -Command 'npm run dev'
    }
} else {
    Write-Host "Skipping backend start." -ForegroundColor Yellow
}

if (-not $SkipFrontend) {
    try {
        $frontendCommand = Get-FrontendCommand -Port $FrontendPort
        Write-Heading "Frontend static server (http://localhost:$FrontendPort)"
        Start-PowerShellWindow -Title "Frontend (port $FrontendPort)" -WorkingDirectory $frontendPath -Command $frontendCommand
    } catch {
        Write-Host "Failed to start frontend server: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "Skipping frontend start." -ForegroundColor Yellow
}

Write-Host ''
Write-Host "All start commands have been issued. Check the new PowerShell windows for logs." -ForegroundColor Green
Write-Host "Flags: -SkipDatabase -SkipBackend -SkipFrontend -MySqlServiceName <name> -FrontendPort <port>" -ForegroundColor DarkGray
