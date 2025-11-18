$ErrorActionPreference = 'Stop'

# 启动 MySQL 服务（如果未启动）
try {
    $svc = Get-Service -Name "mysql80" -ErrorAction SilentlyContinue
    if ($null -eq $svc) {
        Write-Host "未找到名为 mysql80 的服务，请确认服务名称。" -ForegroundColor Yellow
    } elseif ($svc.Status -ne 'Running') {
        Write-Host "正在启动 MySQL 服务 mysql80 ..."
        Start-Service mysql80
    } else {
        Write-Host "MySQL 服务 mysql80 已在运行。"
    }
} catch {
    Write-Host "启动 MySQL 服务失败：$($_.Exception.Message)" -ForegroundColor Red
}

# 启动后端
try {
    $backendPath = Join-Path $PSScriptRoot "..\backend"
    Write-Host "启动后端 (npm run dev) ..."
    Start-Process powershell -ArgumentList "-NoLogo -NoExit", "cd /d `"$backendPath`"; npm run dev"
} catch {
    Write-Host "启动后端失败：$($_.Exception.Message)" -ForegroundColor Red
}

# 启动前端静态服务（端口 8000）
try {
    $frontendPath = Join-Path $PSScriptRoot ".."
    Write-Host "启动前端静态服务 http://localhost:8000 ..."
    Start-Process powershell -ArgumentList "-NoLogo -NoExit", "cd /d `"$frontendPath`"; npx http-server -p 8000"
} catch {
    Write-Host "启动前端失败：$($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "全部启动命令已发出。如遇端口占用/权限问题，请查看各窗口输出。" -ForegroundColor Green
