param(
    [string]$RemoteUser = "picoli",
    [string]$RemoteHost = "debian01",
    [int]$Port = 4174,
    [Security.SecureString]$RemotePassword
)

$ErrorActionPreference = "Stop"

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Command,

        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "O comando '$Command' falhou com o codigo de saida $LASTEXITCODE."
    }
}

function New-SshAskPassHelper {
    $helperPath = Join-Path ([IO.Path]::GetTempPath()) "worlddb-ssh-askpass-$([guid]::NewGuid().ToString('N')).exe"
    $typeName = "WorldDbSshAskPass$([guid]::NewGuid().ToString('N'))"
    $source = @"
using System;

public static class $typeName
{
    [STAThread]
    public static int Main()
    {
        Console.Write(Environment.GetEnvironmentVariable("WORLDDB_SSH_PASSWORD"));
        return 0;
    }
}
"@

    Add-Type -TypeDefinition $source -Language CSharp -OutputAssembly $helperPath -OutputType ConsoleApplication
    return $helperPath
}

$projectRoot = $PSScriptRoot
$localDist = Join-Path $projectRoot "dist"
$remote = "$RemoteUser@$RemoteHost"
$deploymentId = [guid]::NewGuid().ToString("N")
$remoteProject = "/home/$RemoteUser/projetos/worlddb"
$remoteTempRoot = "$remoteProject/temp"
$remoteTemp = "$remoteTempRoot/$deploymentId"
$remoteBackup = "$remoteProject/backup"
$remotePrevious = "$remoteTemp/dist.previous"
$pm2ProcessName = "worlddb"
$sshOptions = @(
    "-o", "BatchMode=no",
    "-o", "NumberOfPasswordPrompts=1",
    "-o", "StrictHostKeyChecking=accept-new"
)
$askPassPath = $null
$plainPassword = $null
$passwordPointer = [IntPtr]::Zero
$previousAskPass = $env:SSH_ASKPASS
$previousAskPassRequirement = $env:SSH_ASKPASS_REQUIRE
$previousDeployPassword = $env:WORLDDB_SSH_PASSWORD

Push-Location $projectRoot

try {
    if (-not $RemotePassword) {
        $RemotePassword = Read-Host "Senha SSH de $remote" -AsSecureString
    }

    $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($RemotePassword)
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    $env:WORLDDB_SSH_PASSWORD = $plainPassword
    $plainPassword = $null
    $askPassPath = New-SshAskPassHelper
    $env:SSH_ASKPASS = $askPassPath
    $env:SSH_ASKPASS_REQUIRE = "force"

    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot "node_modules") -PathType Container)) {
        Write-Host "1/8 Instalando dependencias locais..."
        Invoke-CheckedCommand -Command "npm" -Arguments @("ci")
    }
    else {
        Write-Host "1/8 Dependencias locais ja instaladas."
    }

    Write-Host "2/8 Gerando a dist..."
    Invoke-CheckedCommand -Command "npm" -Arguments @("run", "build")

    if (-not (Test-Path -LiteralPath $localDist -PathType Container)) {
        throw "A pasta de build nao foi encontrada: $localDist"
    }

    Write-Host "3/8 Validando o servidor e preparando diretorios..."
    $prepareCommand = "set -e; command -v pm2 >/dev/null 2>&1 || { echo 'PM2 nao esta instalado.' >&2; exit 1; }; command -v curl >/dev/null 2>&1 || { echo 'curl nao esta instalado.' >&2; exit 1; }; if ! pm2 describe '$pm2ProcessName' >/dev/null 2>&1 && ss -ltn | grep -q ':$Port '; then echo 'A porta $Port ja esta em uso.' >&2; exit 1; fi; mkdir -p '$remoteProject' '$remoteTempRoot' '$remoteBackup' '$remoteTemp'"
    Invoke-CheckedCommand -Command "ssh" -Arguments ($sshOptions + @($remote, $prepareCommand))

    Write-Host "4/8 Enviando a dist para $remote..."
    $remoteDestination = "${remote}:$remoteTemp/"
    Invoke-CheckedCommand -Command "scp" -Arguments ($sshOptions + @("-r", $localDist, $remoteDestination))

    Write-Host "5/8 Criando backup da versao atual..."
    $backupCommand = "set -e; if [ -d '$remoteProject/dist' ]; then cp -a '$remoteProject/dist' '$remoteBackup/dist_`$(date +%Y-%m-%d_%H-%M-%S)'; fi"
    Invoke-CheckedCommand -Command "ssh" -Arguments ($sshOptions + @($remote, $backupCommand))

    Write-Host "6/8 Publicando a nova dist..."
    $publishCommand = "set -e; rm -rf '$remotePrevious'; if [ -d '$remoteProject/dist' ]; then mv '$remoteProject/dist' '$remotePrevious'; fi; if ! mv '$remoteTemp/dist' '$remoteProject/dist'; then if [ -d '$remotePrevious' ]; then mv '$remotePrevious' '$remoteProject/dist'; fi; exit 1; fi"
    Invoke-CheckedCommand -Command "ssh" -Arguments ($sshOptions + @($remote, $publishCommand))

    Write-Host "7/8 Criando ou reiniciando o processo PM2..."
    $pm2Command = "set -e; if pm2 describe '$pm2ProcessName' >/dev/null 2>&1; then touch '$remoteTemp/had-process'; if ! pm2 restart '$pm2ProcessName' --update-env; then rm -rf '$remoteProject/dist'; if [ -d '$remotePrevious' ]; then mv '$remotePrevious' '$remoteProject/dist'; fi; pm2 restart '$pm2ProcessName' --update-env >/dev/null 2>&1 || true; exit 1; fi; else touch '$remoteTemp/new-process'; if ! pm2 serve '$remoteProject/dist' '$Port' --name '$pm2ProcessName' --spa; then rm -rf '$remoteProject/dist'; if [ -d '$remotePrevious' ]; then mv '$remotePrevious' '$remoteProject/dist'; fi; exit 1; fi; fi"
    Invoke-CheckedCommand -Command "ssh" -Arguments ($sshOptions + @($remote, $pm2Command))

    Write-Host "8/8 Validando a publicacao..."
    $healthCommand = "set -e; if curl -fsS 'http://127.0.0.1:$Port/' >/dev/null && curl -fsS 'http://127.0.0.1:$Port/jogar' >/dev/null && curl -fsS 'http://127.0.0.1:$Port/explorar' >/dev/null && curl -fsS 'http://127.0.0.1:$Port/aprender/01' >/dev/null; then rm -rf '$remoteTemp'; pm2 save; else rm -rf '$remoteProject/dist'; if [ -d '$remotePrevious' ]; then mv '$remotePrevious' '$remoteProject/dist'; fi; if [ -f '$remoteTemp/new-process' ]; then pm2 delete '$pm2ProcessName' >/dev/null 2>&1 || true; else pm2 restart '$pm2ProcessName' --update-env >/dev/null 2>&1 || true; fi; exit 1; fi"
    Invoke-CheckedCommand -Command "ssh" -Arguments ($sshOptions + @($remote, $healthCommand))

    Write-Host "Deploy concluido com sucesso em http://${RemoteHost}:$Port"
}
finally {
    if ($passwordPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    }
    if ($askPassPath -and (Test-Path -LiteralPath $askPassPath)) {
        Remove-Item -LiteralPath $askPassPath -Force
    }

    $env:SSH_ASKPASS = $previousAskPass
    $env:SSH_ASKPASS_REQUIRE = $previousAskPassRequirement
    $env:WORLDDB_SSH_PASSWORD = $previousDeployPassword
    Pop-Location
}
