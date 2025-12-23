# Script PowerShell pour ajouter Node.js au PATH système Windows

$nodePath = "C:\Program Files\nodejs"

# Vérifier si Node.js existe
if (-Not (Test-Path $nodePath)) {
    Write-Host "❌ Node.js n'est pas installé dans $nodePath" -ForegroundColor Red
    exit 1
}

# Récupérer le PATH utilisateur actuel
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")

# Vérifier si Node.js est déjà dans le PATH
if ($currentPath -like "*nodejs*") {
    Write-Host "✅ Node.js est déjà dans le PATH utilisateur" -ForegroundColor Green
    Write-Host "Chemin actuel: $currentPath"
} else {
    # Ajouter Node.js au PATH utilisateur
    $newPath = $currentPath + ";" + $nodePath
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    
    Write-Host "✅ Node.js a été ajouté au PATH utilisateur !" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠️  IMPORTANT : Redémarrez votre terminal pour que les changements prennent effet" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Après redémarrage, vous pourrez utiliser 'npm' et 'node' dans :" -ForegroundColor Cyan
    Write-Host "  - PowerShell"
    Write-Host "  - Invite de commandes (CMD)"
    Write-Host "  - Git Bash"
    Write-Host "  - N'importe quel terminal"
}

# Afficher le PATH mis à jour
Write-Host ""
Write-Host "PATH utilisateur actuel:" -ForegroundColor Cyan
[Environment]::GetEnvironmentVariable("Path", "User") -split ";" | Where-Object { $_ -like "*nodejs*" -or $_ -ne "" } | ForEach-Object { Write-Host "  $_" }







