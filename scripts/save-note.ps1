<#
.SYNOPSIS
  save-note: guarda notas Markdown locales sin Obsidian.

.DESCRIPTION
  Version local del skill save-note. Crea notas autocontenidas con
  frontmatter en ./notes/<Carpeta>/ (o la ruta indicada en -NotesDir).
  Si la nota ya existe, agrega una seccion fechada en vez de duplicarla.

.EXAMPLE
  save-note "Mi titulo" "Contenido de la nota"
  .\scripts\save-note.ps1 -Title "Mi titulo" -Content "Contenido" -Folder Coding
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Title,

  [Parameter(Mandatory = $false, Position = 1)]
  [string]$Content = "",

  [Parameter(Mandatory = $false)]
  [ValidateSet("Coding", "Reflections", "Concepts", "Communication")]
  [string]$Folder = "Concepts",

  [Parameter(Mandatory = $false)]
  [string]$NotesDir = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($NotesDir)) {
  $NotesDir = Join-Path (Get-Location).Path "notes"
}

$safe = ($Title -replace '[\\/:*?"<>|]', "").Trim()
if ([string]::IsNullOrWhiteSpace($safe)) { $safe = "sin-titulo" }

$dir = Join-Path $NotesDir $Folder
New-Item -ItemType Directory -Path $dir -Force | Out-Null

$path = Join-Path $dir "$safe.md"
$today = Get-Date -Format "yyyy-MM-dd"

if (Test-Path -LiteralPath $path) {
  $append = "`n## Update - $today`n`n$Content`n"
  Add-Content -LiteralPath $path -Value $append -Encoding UTF8
  Write-Output "Appended: $path"
}
else {
  $header = @(
    "---",
    "source: terminal-save-note",
    "created: $today",
    "aliases: [$safe]",
    "tags: [terminal, $($Folder.ToLowerInvariant())]",
    "---",
    "",
    "# $Title",
    "",
    $Content,
    ""
  ) -join [Environment]::NewLine
  Set-Content -LiteralPath $path -Value $header -Encoding UTF8
  Write-Output "Created: $path"
}
