# PowerShell script to create and push a release tag

param(
    [string]$Version = "v1.1.0",
    [string]$Message = "Release version $Version - Security and quality improvements"
)

Write-Host "Creating release tag: $Version" -ForegroundColor Green

# Ensure we're on the main branch
$currentBranch = git branch --show-current
if ($currentBranch -ne "main") {
    Write-Host "Warning: Not on main branch (current: $currentBranch)" -ForegroundColor Yellow
    $confirm = Read-Host "Continue anyway? (y/n)"
    if ($confirm -ne "y") {
        exit 1
    }
}

# Check if tag already exists
$existingTag = git tag -l $Version
if ($existingTag) {
    Write-Host "Tag $Version already exists. Deleting old tag..." -ForegroundColor Yellow
    git tag -d $Version
    git push origin --delete $Version 2>$null
}

# Create annotated tag
Write-Host "Creating annotated tag..." -ForegroundColor Cyan
git tag -a $Version -m $Message

if ($LASTEXITCODE -eq 0) {
    Write-Host "Tag created successfully!" -ForegroundColor Green
    
    # Push the tag
    Write-Host "Pushing tag to origin..." -ForegroundColor Cyan
    git push origin $Version
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "" -ForegroundColor Green
        Write-Host "✅ Release tag $Version pushed successfully!" -ForegroundColor Green
        Write-Host "" -ForegroundColor Green
        Write-Host "GitHub Actions will now create the release automatically." -ForegroundColor Cyan
        Write-Host "Check: https://github.com/IIXINGCHEN/claude-relay-service/releases" -ForegroundColor Cyan
    } else {
        Write-Host "Failed to push tag. Please push manually:" -ForegroundColor Red
        Write-Host "git push origin $Version" -ForegroundColor Yellow
    }
} else {
    Write-Host "Failed to create tag" -ForegroundColor Red
}
