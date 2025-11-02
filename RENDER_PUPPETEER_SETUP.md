# Puppeteer Setup for Render Deployment

## Issue
PDF generation fails on Render with error:
```
Could not find Chrome (ver. 131.0.6778.204)
```

## Solution

Render needs system Chrome installed since Puppeteer's bundled Chrome doesn't work in the deployment environment.

### Files Added

#### 1. `Aptfile`
Tells Render to install system packages:
```
chromium-browser
chromium-codecs-ffmpeg
```

#### 2. `render.yaml` (Optional)
Configuration file for Render service:
```yaml
services:
  - type: web
    env: node
    envVars:
      - key: PUPPETEER_SKIP_CHROMIUM_DOWNLOAD
        value: true
      - key: PUPPETEER_EXECUTABLE_PATH
        value: /usr/bin/chromium-browser
```

### Changes Made

#### 3. `services/placementSummaryService.js`
Updated `renderHtmlToPdf()` to:
- Try multiple Chrome paths for different environments
- Add production-specific args (`--disable-dev-shm-usage`, etc.)
- Support `PUPPETEER_EXECUTABLE_PATH` env var
- Log which Chrome binary is being used

## Deployment Steps

### Option A: Automatic Setup (Using render.yaml)

1. **Commit files**:
   ```bash
   git add Aptfile render.yaml
   git commit -m "Add Puppeteer/Chrome support for Render"
   git push
   ```

2. **Render will automatically**:
   - Detect `Aptfile` and install Chromium
   - Apply `render.yaml` configuration
   - Set environment variables

### Option B: Manual Setup (Render Dashboard)

1. **Commit Aptfile**:
   ```bash
   git add Aptfile
   git commit -m "Add Aptfile for Chromium"
   git push
   ```

2. **In Render Dashboard**:
   - Go to your service → Environment
   - Add these environment variables:
     ```
     PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
     PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
     ```

3. **Redeploy** (Render will install Chromium via Aptfile)

## Verification

After deployment, check logs for:
```
[Puppeteer] Using Chrome at: /usr/bin/chromium-browser
[Puppeteer] Browser launched successfully
[Puppeteer] PDF generated, buffer size: XXXXX bytes
```

## Troubleshooting

### If Chrome still not found:

1. **Check Aptfile is in root**:
   ```
   server/
     Aptfile          ← Must be here
     package.json
     server.js
   ```

2. **Verify environment variables** in Render dashboard

3. **Check available Chrome paths** by adding to your code:
   ```javascript
   console.log('Available Chrome:', fs.existsSync('/usr/bin/chromium-browser'));
   ```

4. **Alternative Chrome paths** (already in code):
   - `/usr/bin/chromium-browser`
   - `/usr/bin/chromium`
   - `/usr/bin/google-chrome-stable`
   - `/usr/bin/google-chrome`

### If PDF generation is slow:

This is normal - first PDF generation on Render can take 5-10 seconds. Subsequent generations are faster.

### Memory issues:

Add to Puppeteer args (already included):
```javascript
'--disable-dev-shm-usage'  // Uses /tmp instead of /dev/shm
```

## Alternative: Docker Deployment

If Aptfile doesn't work, consider Docker with a Puppeteer base image:

```dockerfile
FROM ghcr.io/puppeteer/puppeteer:latest
# Your app code
```

## Testing Locally

Your local environment doesn't need Aptfile - Puppeteer's bundled Chrome works fine. The Aptfile is only for Render's Ubuntu environment.

## Environment Variables Summary

| Variable | Value | Purpose |
|----------|-------|---------|
| `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD` | `true` | Skip downloading Chrome during npm install |
| `PUPPETEER_EXECUTABLE_PATH` | `/usr/bin/chromium-browser` | Tell Puppeteer where to find Chrome |

## Cost Impact

Chromium packages (~200MB) will:
- Increase build time by ~30-60 seconds
- Use disk space (included in Render plans)
- No impact on runtime performance
