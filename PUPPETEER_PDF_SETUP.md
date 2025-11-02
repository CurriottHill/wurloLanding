# Puppeteer PDF Generation Setup

## Overview
Learning plan PDFs are now generated using **Puppeteer** for full CSS fidelity with **pdfmake** as a fallback. This ensures that all styling, emojis, colors, and responsive design are preserved exactly as designed.

## Features

### ✅ Full CSS Rendering
- **100% CSS compatibility** - All styles from the HTML template are preserved
- **Web fonts** - Inter font family loaded from Google Fonts
- **Emojis** - Full Unicode emoji support (🚀 📚 🎯 ✓ etc.)
- **Colors & gradients** - Brand colors, backgrounds, borders rendered perfectly
- **Typography** - Proper font weights, sizes, spacing, and line heights

### ✅ Responsive Design
- **A4 viewport** - 794×1123px at 2× device scale for crisp rendering
- **Mobile optimizations** - CSS media queries for smaller viewports
- **Flexible layouts** - Grid and flexbox layouts that adapt to content
- **Print optimizations** - Page break controls, proper margins

### ✅ Dev & Production Compatible
- **Dev mode** - Uses bundled Chromium (auto-downloaded with `npm install`)
- **Production mode** - Detects system Chromium at common paths
- **Fallback** - Uses pdfmake if Puppeteer fails
- **Environment flag** - `USE_PUPPETEER=false` to force pdfmake

## Architecture

### PDF Generation Flow
```
HTML Template (CSS + Content)
  ↓
Puppeteer Launch (Chromium)
  ↓
Page.setContent() with waitUntil conditions
  ↓
Wait for fonts to load
  ↓
page.pdf() → Buffer
  ↓
Base64 encode → Frontend
```

### Chromium Detection (Production)
```javascript
const chromiumPaths = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
];
```

## Configuration

### Environment Variables
```bash
# Optional: Force pdfmake fallback
USE_PUPPETEER=false

# Optional: Custom Chromium path
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

### Puppeteer Launch Options
```javascript
{
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--disable-extensions',
    '--disable-web-security',
    '--font-render-hinting=medium',
    '--enable-font-antialiasing',
    '--force-color-profile=srgb',
    '--disable-features=VizDisplayCompositor'
  ]
}
```

### Viewport Settings
```javascript
{
  width: 794,  // A4 width at 96 DPI
  height: 1123, // A4 height at 96 DPI
  deviceScaleFactor: 2, // Retina/high-DPI rendering
}
```

### PDF Options
```javascript
{
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: false,
  margin: { 
    top: '20mm', 
    bottom: '20mm', 
    left: '15mm', 
    right: '15mm' 
  },
  displayHeaderFooter: false,
}
```

## Local Development

### 1. Install Dependencies
```bash
cd server
npm install
```

Puppeteer will automatically download bundled Chromium (~150MB) to:
- Mac: `~/.cache/puppeteer/chrome/`
- Linux: `~/.cache/puppeteer/chrome/`
- Windows: `%USERPROFILE%\.cache\puppeteer\chrome\`

### 2. Start Server
```bash
npm run dev
```

### 3. Test PDF Generation
```bash
# Submit final placement test answer to trigger PDF generation
curl -s http://localhost:3000/onboarding/answer \
  -H "Content-Type: application/json" \
  -d '{"user_id":"1","attempt_id":12,"question_id":428,"response":"A","is_skip":false}' \
  | jq -e -r '.placement_summary.pdf.base64' \
  | base64 --decode > ~/Desktop/wurlo-learning-plan.pdf
```

### 4. Check Logs
Look for:
```
[PDF] Attempting Puppeteer render for full CSS fidelity...
[PDF] Using bundled Chromium (dev mode)
[PDF] Browser launched successfully
[PDF] Rendering PDF...
[PDF] ✓ Puppeteer render succeeded: 245632 bytes
```

## Production Deployment (Render)

### 1. Install System Chromium

Create `Aptfile` in project root:
```
chromium-browser
chromium-codecs-ffmpeg
```

### 2. Configure Environment

In Render dashboard, add:
```bash
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
USE_PUPPETEER=true
```

### 3. Deploy
```bash
git push
```

Render will:
1. Install `chromium-browser` via Aptfile
2. Run `npm install` (skips Chromium download)
3. Start server with system Chromium

### 4. Verify Deployment
Check logs for:
```
[PDF] Attempting Puppeteer render for full CSS fidelity...
[PDF] Using system Chrome at: /usr/bin/chromium-browser
[PDF] Browser launched successfully
[PDF] ✓ Puppeteer render succeeded
```

## Styling Features

### Brand Colors
```css
--primary: #0f172a (dark slate)
--accent: #14B8A6 (teal)
--text: #0f172a
--text-medium: #475569
--text-light: #64748b
--bg: #ffffff
--bg-subtle: #f8fafc
```

### Typography
- **H1**: 32px, bold, dark slate
- **H2**: 20px, bold with teal underline
- **H3**: 17px, semi-bold, light background
- **H4**: 15px, semi-bold
- **Body**: 14px, medium gray, 1.7 line-height

### Responsive Breakpoints
```css
@media (max-width: 768px) {
  /* Smaller padding, font sizes for mobile */
}

@media print {
  /* Page break controls, remove backgrounds */
}
```

### Footer CTA
```html
<div class="footer-cta">
  <div class="footer-cta-content">
    <div class="footer-cta-text">
      <h3>🚀 Ready to start learning?</h3>
      <p>Generate a full personalized course based on this plan.</p>
    </div>
    <a href="https://wurlo.org" class="footer-cta-button">Visit wurlo.org</a>
  </div>
</div>
```

## Troubleshooting

### PDF is null or empty

**Check logs for:**
```
[PDF] ❌ Puppeteer rendering failed: ...
[PDF] Falling back to pdfmake renderer.
```

**Common causes:**
1. Chromium not found (production)
2. Font loading timeout
3. HTML rendering error
4. Memory limits exceeded

**Solutions:**
1. Verify `PUPPETEER_EXECUTABLE_PATH` is correct
2. Increase timeout in `page.setContent()`
3. Check HTML is valid
4. Increase memory limits in hosting

### Fonts not rendering

**Check:**
1. Google Fonts URL is accessible
2. Font loading wait is sufficient (500ms)
3. Font antialiasing flags are set

**Fix:**
```javascript
await page.evaluateHandle('document.fonts.ready');
await new Promise(resolve => setTimeout(resolve, 500));
```

### Emojis showing as boxes

**Check:**
1. Emoji font family is set in CSS
2. System supports Unicode emojis

**Fix in CSS:**
```css
.emoji {
  font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 
               'Noto Color Emoji', 'Android Emoji', sans-serif;
}
```

### Styling looks different than expected

**Check:**
1. `printBackground: true` in PDF options
2. `emulateMediaType('screen')` is called
3. CSS variables are defined
4. Viewport is set correctly

### Performance issues

**Symptoms:**
- Slow PDF generation (>10s)
- Memory errors
- Timeout errors

**Solutions:**
1. Reduce `waitUntil` options
2. Remove `networkidle0` if external resources slow
3. Increase timeout to 60s
4. Disable unnecessary browser features

## Performance

### Generation Time
- **Dev (bundled Chromium)**: 2-4 seconds
- **Production (system Chromium)**: 1-3 seconds
- **Fallback (pdfmake)**: 200-500ms

### Memory Usage
- **Chromium**: ~200-300MB per PDF
- **pdfmake**: ~50MB per PDF

### PDF Size
- **Typical**: 100-500KB
- **With images**: 500KB-2MB

## Fallback Behavior

If Puppeteer fails, the system automatically falls back to pdfmake:

```javascript
if (ENABLE_PUPPETEER) {
  try {
    return await puppeteerPdf(html);
  } catch (error) {
    console.error('[PDF] Falling back to pdfmake');
  }
}
return await pdfmakePdf(html);
```

**Fallback limitations:**
- No gradient backgrounds
- Limited emoji support
- Simplified typography
- No web fonts

## Testing Checklist

- [ ] PDF generates successfully in dev
- [ ] All colors render correctly
- [ ] Emojis display properly (🚀 📚 🎯)
- [ ] Typography matches design (fonts, sizes, weights)
- [ ] Footer CTA is visible with "Visit wurlo.org"
- [ ] Page breaks work correctly
- [ ] Margins are consistent
- [ ] Logo/branding is clear
- [ ] PDF opens in all viewers (Preview, Adobe, Chrome)
- [ ] File size is reasonable (<1MB)

## Future Enhancements

### Potential Improvements
1. **Custom page header/footer** - Add dynamic page headers
2. **Table of contents** - Generate clickable TOC
3. **Progress indicators** - Visual progress bars
4. **Image support** - Embed charts/diagrams
5. **Interactive elements** - Links to resources
6. **Dark mode** - Alternative color scheme
7. **Localization** - Multi-language support
8. **PDF metadata** - Title, author, keywords

### Alternative Solutions
- **wkhtmltopdf** - C++ library (faster but harder to deploy)
- **Prince XML** - Commercial solution (excellent quality)
- **WeasyPrint** - Python-based (good for simple layouts)
- **Gotenberg** - Dockerized API (microservice approach)

## Support

For issues or questions:
1. Check logs for error messages
2. Verify environment variables
3. Test with `USE_PUPPETEER=false` to isolate Puppeteer issues
4. Review HTML template for errors
5. Check Chromium installation on production
