try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:3100/api/companies" -ErrorAction Stop
    $response | ConvertTo-Json -Depth 5 | Out-File "C:\Users\home\Desktop\LearnXRLMS\LearnXR-website\companies.json"
} catch {
    $_.Exception.Message | Out-File "C:\Users\home\Desktop\LearnXRLMS\LearnXR-website\companies.json"
}
