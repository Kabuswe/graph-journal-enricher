param([int]$Port = 2031, [switch]$KeepServer)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$REPO  = "C:\Users\ULTRAPC\Documents\GitHub\graph-journal-enricher"
$BASE  = "http://localhost:$Port"
$GRAPH = "journalEnricher"
$PASS  = 0
$FAIL  = 0

function Write-Pass { param([string]$n) Write-Host "  [PASS] $n" -ForegroundColor Green; $script:PASS++ }
function Write-Fail { param([string]$n,[string]$d) Write-Host "  [FAIL] $n -- $d" -ForegroundColor Red; $script:FAIL++ }

function Wait-ServerReady {
  param([string]$url,[int]$max=60)
  $dl = (Get-Date).AddSeconds($max)
  while ((Get-Date) -lt $dl) {
    try { $r = Invoke-RestMethod "$url/ok" -TimeoutSec 2 -ErrorAction Stop; if ($r.ok -eq $true) { return $true } } catch {}
    Start-Sleep -Milliseconds 500
  }
  return $false
}

function Invoke-GraphRun {
  param([hashtable]$graphInput,[int]$timeout=120)
  $t = Invoke-RestMethod "$BASE/threads" -Method POST -ContentType "application/json" -Body "{}" -TimeoutSec 10
  $b = @{ assistant_id=$GRAPH; input=$graphInput } | ConvertTo-Json -Depth 8
  return Invoke-RestMethod "$BASE/threads/$($t.thread_id)/runs/wait" -Method POST -ContentType "application/json" -Body $b -TimeoutSec $timeout
}

Write-Host ""
Write-Host "-----------------------------------------------------------" -ForegroundColor Cyan
Write-Host "  graph-journal-enricher -- LangGraph API Integration Tests" -ForegroundColor Cyan
Write-Host "-----------------------------------------------------------" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Starting langgraph dev on port $Port..." -ForegroundColor DarkGray

$serverJob = Start-Job -ScriptBlock {
  param($repo,$port)
  Set-Location $repo
  npx @langchain/langgraph-cli dev --port $port --no-browser 2>&1
} -ArgumentList $REPO,$Port

if (-not (Wait-ServerReady $BASE)) {
  Write-Host "  [ERROR] Server failed to start" -ForegroundColor Red
  Stop-Job $serverJob -PassThru | Remove-Job -Force
  exit 1
}
Write-Host "  Server ready" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Running tests..." -ForegroundColor DarkGray
Write-Host ""

# Test 1: Reflective entry -- full pipeline with embed+store
$entry1 = @"
---
date: 2026-04-20
mood: 7
tags: [reflection, growth, learning]
---

# A Day of Deep Work

Today I spent six uninterrupted hours working through a complex distributed systems problem.
The focus was profound -- I noticed how much clearer my thinking becomes when I eliminate distractions.

There is something deeply satisfying about understanding a system end-to-end.
I kept asking myself: what would it take for this to fail? That adversarial mindset led to three key insights.

I realise I have been avoiding the hardest problems, not because I cannot solve them,
but because I fear how much time they will consume. That fear is worth examining.

Tomorrow: tackle the concurrency issue head-on. No avoidance.
"@

try {
  $r = Invoke-GraphRun -graphInput @{ rawContent=$entry1; clientId="api-test" }
  $themes = @($r.dominantThemes)
  if ($r.phase -eq "embed-store" -and $themes.Count -gt 0 -and $r.insightSummary.Length -gt 20 -and $r.publicRewrite.Length -gt 20 -and $r.vectorId.Length -gt 0) {
    Write-Pass "1. Reflective entry -- phase=$($r.phase) themes=$($themes.Count) vectorId=$($r.vectorId)"
  } else {
    Write-Fail "1. Reflective entry" "phase=$($r.phase) themes=$($themes.Count) insight.len=$($r.insightSummary.Length) rewrite.len=$($r.publicRewrite.Length)"
  }
} catch { Write-Fail "1. Reflective entry" $_.Exception.Message }

# Test 2: High-energy entry -- energyLevel=high
$entry2 = @"
---
date: 2026-04-20
energy: high
---

# Breakthrough Day

Everything clicked today. Shipped three features, pair-programmed with an amazing engineer,
and got positive feedback from the entire team.

I feel unstoppable. The architecture we designed is elegant and performant.
Benchmarks show a 40% latency reduction over the previous approach.

I want to keep this momentum. Tomorrow I will start on the authentication layer.
The enthusiasm I feel right now is the fuel I need to tackle the hard parts.
"@

try {
  $r = Invoke-GraphRun -graphInput @{ rawContent=$entry2; clientId="api-test" }
  $themes = @($r.dominantThemes)
  $keywords = @($r.keywords)
  if ($r.phase -eq "embed-store" -and $r.energyLevel -eq "high" -and $keywords.Count -gt 0) {
    Write-Pass "2. High-energy entry -- phase=$($r.phase) energy=$($r.energyLevel) keywords=$($keywords.Count)"
  } else {
    Write-Fail "2. High-energy entry" "phase=$($r.phase) energy=$($r.energyLevel) keywords=$($keywords.Count)"
  }
} catch { Write-Fail "2. High-energy entry" $_.Exception.Message }

# Test 3: Conflicted entry -- coreQuestions populated
$entry3 = @"
---
date: 2026-04-20
---

# Doubts

Am I working on the right things? I spent the whole day in meetings that could have been emails.
I did not write a single line of code. I feel like I am drifting from what I actually care about.

My manager says leadership is the next step. But is that what I want?
The tension between impact and craft is real. I do not have answers yet.
"@

try {
  $r = Invoke-GraphRun -graphInput @{ rawContent=$entry3; clientId="api-test" }
  $coreQ = @($r.coreQuestions)
  if ($r.phase -eq "embed-store" -and $coreQ.Count -gt 0 -and $r.publicRewrite.Length -gt 10) {
    Write-Pass "3. Conflicted entry -- phase=$($r.phase) coreQuestions=$($coreQ.Count)"
  } else {
    Write-Fail "3. Conflicted entry" "phase=$($r.phase) coreQuestions=$($coreQ.Count) rewrite.len=$($r.publicRewrite.Length)"
  }
} catch { Write-Fail "3. Conflicted entry" $_.Exception.Message }

Write-Host ""
Write-Host "-----------------------------------------------------------" -ForegroundColor Cyan
$color = if ($FAIL -eq 0) { "Green" } else { "Red" }
Write-Host ("  Results: {0}/{1} passed" -f $PASS,($PASS+$FAIL)) -ForegroundColor $color
Write-Host "-----------------------------------------------------------" -ForegroundColor Cyan
Write-Host ""

if (-not $KeepServer) {
  Stop-Job $serverJob -PassThru | Remove-Job -Force 2>$null
  Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
}
exit $(if ($FAIL -eq 0) { 0 } else { 1 })