# Generate static Open Graph landers for shops + profiles (same output as generate-og-pages.mjs).
#   powershell -File scripts/generate-og-pages.ps1

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Site = "https://civshops.pengworld.net"
$Theme = "#7fb35a"

$config = Get-Content (Join-Path $Root "config.js") -Raw
if ($config -notmatch 'const SUPABASE_URL = "([^"]+)"') { throw "SUPABASE_URL missing" }
$SupabaseUrl = $Matches[1].TrimEnd("/")
if ($config -notmatch 'const SUPABASE_ANON_KEY = "([^"]+)"') { throw "SUPABASE_ANON_KEY missing" }
$Anon = $Matches[1]

function Esc([string]$s) {
  if ($null -eq $s) { return "" }
  return ($s -replace "&", "&amp;" -replace "<", "&lt;" -replace ">", "&gt;" -replace '"', "&quot;")
}
function StripMc([string]$s) {
  if ($null -eq $s) { return "" }
  return ([regex]::Replace($s, "[&\u00a7][0-9a-fk-or]", "", "IgnoreCase")).Trim()
}
function ItemImg([string]$name) {
  $key = if ($name) { $name.Trim().ToLower() -replace "\s+", " " } else { "chest" }
  if ($key -eq "essence") { $key = "ender eye" }
  $file = ($key -replace " ", "_")
  return "$Site/Minecraft_Items/$([uri]::EscapeDataString($file)).png"
}
function StorageUrl([string]$path) {
  return "$SupabaseUrl/storage/v1/object/public/uploads/$($path.TrimStart('/'))"
}
function PlaceLine($city, $nation) {
  $c = ("$city").Trim(); $n = ("$nation").Trim()
  if ($c -and $n -and $c.ToLower() -ne $n.ToLower()) { return "$c / $n" }
  if ($c) { return $c }
  return $n
}
function ShopSlugBase([string]$name) {
  $s = (StripMc $name).ToLower() -replace "[''""`]", "" -replace "[^a-z0-9]+", "-" -replace "^-+|-+$", ""
  if (-not $s -or $s -eq "index" -or $s -match '^\d+$') { return "" }
  if ($s.Length -gt 48) { $s = $s.Substring(0, 48) }
  return $s
}

function PageHtml($title, $description, $url, $image, $authorName, $redirectUrl) {
  if (-not $redirectUrl) { $redirectUrl = $url }
  $oembed = "$SupabaseUrl/functions/v1/embed?format=oembed&url=$([uri]::EscapeDataString($url))"
  $authorBit = if ($authorName) { " · $(Esc $authorName)" } else { "" }
  $redirJson = ($redirectUrl | ConvertTo-Json -Compress)
  return @"
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>$(Esc $title) · CivShops</title>
<meta name="description" content="$(Esc $description)">
<meta name="theme-color" content="$Theme">
<meta property="og:type" content="website">
<meta property="og:site_name" content="CivShops">
<meta property="og:title" content="$(Esc $title)">
<meta property="og:description" content="$(Esc $description)">
<meta property="og:url" content="$(Esc $url)">
<meta property="og:image" content="$(Esc $image)">
<meta property="og:image:alt" content="$(Esc $title)">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="$(Esc $title)">
<meta name="twitter:description" content="$(Esc $description)">
<meta name="twitter:image" content="$(Esc $image)">
<link rel="canonical" href="$(Esc $url)">
<link type="application/json+oembed" href="$(Esc $oembed)">
<meta http-equiv="refresh" content="0;url=$(Esc $redirectUrl)">
<script>
(function () {
  var base = $redirJson;
  var extra = location.search ? location.search.slice(1) : "";
  if (extra) base += (base.indexOf("?") >= 0 ? "&" : "?") + extra;
  location.replace(base);
})();
</script>
</head>
<body style="font-family:system-ui,sans-serif;background:#1a1c18;color:#e8eadf;padding:24px">
<p><a href="$(Esc $redirectUrl)" style="color:$Theme">Open $(Esc $title)$authorBit</a></p>
</body>
</html>
"@
}

function SbGet([string]$path) {
  $headers = @{ apikey = $Anon; Authorization = "Bearer $Anon" }
  return Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/$path" -Headers $headers
}

function Clean-Landers([string]$dir, [string]$mode) {
  if (-not (Test-Path $dir)) { return }
  Get-ChildItem $dir -Directory | ForEach-Object {
    $n = $_.Name
    $drop = $false
    if ($mode -eq "shops") { $drop = $true }
    if ($mode -eq "profile" -and ($n -match '^[0-9a-f-]{36}$' -or $n -match '^[a-z0-9_]{3,20}$')) { $drop = $true }
    if ($drop) { Remove-Item $_.FullName -Recurse -Force }
  }
}

Clean-Landers (Join-Path $Root "shops") "shops"
Clean-Landers (Join-Path $Root "profile") "profile"

$shops = SbGet "shops?select=id,name,styled_name,description,city,nation,icon_item,icon_path,x,z,owner_id,archived,is_open,timed_out,profiles!shops_owner_id_fkey(username,mc_username,timed_out)&archived=eq.false&is_open=eq.true&timed_out=eq.false&order=id"
$visible = @()
foreach ($s in $shops) {
  $owner = $s.profiles
  if ($owner -is [array]) { $owner = $owner[0] }
  if ($owner -and $owner.timed_out) { continue }
  $visible += $s
}

$baseCounts = @{}
foreach ($s in $visible) {
  $base = ShopSlugBase $s.name
  if (-not $base) { $base = "shop-$($s.id)" }
  if (-not $baseCounts.ContainsKey($base)) { $baseCounts[$base] = 0 }
  $baseCounts[$base]++
}

$shopN = 0
foreach ($s in $visible) {
  $owner = $s.profiles
  if ($owner -is [array]) { $owner = $owner[0] }
  $name = StripMc ($(if ($s.styled_name) { $s.styled_name } else { $s.name }))
  if (-not $name) { $name = "Shop" }
  $ownerName = ""
  if ($owner) { $ownerName = $(if ($owner.username) { $owner.username } else { $owner.mc_username }) }
  $bits = @()
  if ($ownerName) { $bits += "Owner: $ownerName" }
  $place = PlaceLine $s.city $s.nation
  if ($place) { $bits += $place }
  if ($null -ne $s.x -and $null -ne $s.z) { $bits += "$($s.x), $($s.z)" }
  $desc = (StripMc $s.description) -replace "\s+", " "
  if ($desc.Length -gt 180) { $desc = $desc.Substring(0, 180) }
  if (-not $desc) { $desc = if ($bits.Count) { $bits -join " | " } else { "Shop listing on CivShops." } }
  elseif ($bits.Count) { $desc = "$desc | $($bits -join ' | ')" }
  $image = if ($s.icon_path) { StorageUrl $s.icon_path } else { ItemImg $(if ($s.icon_item) { $s.icon_item } else { "chest" }) }
  $base = ShopSlugBase $s.name
  if (-not $base) { $base = "shop-$($s.id)" }
  $slug = if ($baseCounts[$base] -gt 1) { "$base-$($s.id)" } else { $base }
  $landerUrl = "$Site/shops/$([uri]::EscapeDataString($slug))/"
  $spaUrl = "$Site/shops/?id=$($s.id)"
  $dir = Join-Path $Root "shops\$slug"
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $html = PageHtml $name $desc.Substring(0, [Math]::Min(300, $desc.Length)) $landerUrl $image $ownerName $spaUrl
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText((Join-Path $dir "index.html"), $html, $utf8)
  $shopN++
}

$profiles = SbGet "profiles?select=id,username,mc_username,discord_username,bio,avatar_path,is_business,place_city,place_nation,verified_at,timed_out&timed_out=eq.false&order=username"
$profN = 0
foreach ($p in $profiles) {
  $login = "$($p.username)"
  $mc = "$($p.mc_username)"
  if ($mc -and $login -and $mc.ToLower() -eq $login.ToLower()) { $primary = $mc }
  elseif ($login) { $primary = $login.Substring(0,1).ToUpper() + $login.Substring(1) }
  elseif ($mc) { $primary = $mc }
  else { $primary = "Trader" }
  $bits = @()
  if ($mc -and $mc.ToLower() -ne $primary.ToLower()) { $bits += "MC: $mc" }
  if ($p.discord_username) { $bits += "Discord: $($p.discord_username)" }
  if ($p.is_business) {
    $place = PlaceLine $p.place_city $p.place_nation
    if ($place) { $bits += $place }
    $bits += "business"
  }
  if ($p.verified_at) { $bits += "verified" }
  $desc = (StripMc $p.bio) -replace "\s+", " "
  if ($desc.Length -gt 180) { $desc = $desc.Substring(0, 180) }
  if (-not $desc) { $desc = if ($bits.Count) { $bits -join " | " } else { "CivMC trader on CivShops." } }
  elseif ($bits.Count) { $desc = "$desc | $(($bits | Select-Object -First 3) -join ' | ')" }
  $image = if ($p.avatar_path) { StorageUrl $p.avatar_path } else { "https://minotar.net/avatar/$([uri]::EscapeDataString($(if ($mc) { $mc } else { 'steve' })))/128" }
  $loginKey = $login.Trim().ToLower()
  if ($loginKey -notmatch '^[a-z0-9_]{3,20}$') { continue }
  $landerUrl = "$Site/profile/$loginKey/"
  $spaUrl = "$Site/profile/?name=$([uri]::EscapeDataString($loginKey))"
  $dir = Join-Path $Root "profile\$loginKey"
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $html = PageHtml $primary $desc.Substring(0, [Math]::Min(300, $desc.Length)) $landerUrl $image $primary $spaUrl
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText((Join-Path $dir "index.html"), $html, $utf8)
  $profN++
}

Write-Host "Generated OG landers: $shopN shops → shops/{slug}/, $profN profiles → profile/{username}/"
