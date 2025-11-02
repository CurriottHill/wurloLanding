# PDF Generation Implementation

## Overview
Learning plan PDFs are generated using **pdfmake** instead of Puppeteer to avoid deployment issues on Render.

## Why pdfmake?
- ✅ **No system dependencies** - Works on any Node.js environment
- ✅ **Fast deployment** - No Chromium installation needed
- ✅ **Lightweight** - Small package size, quick install
- ✅ **Reliable** - Pure JavaScript, no headless browser quirks
- ✅ **Render-compatible** - Deploys instantly without build timeouts

## Architecture

### Dependencies
```json
{
  "pdfmake": "^0.2.10",        // Core PDF generation
  "html-to-pdfmake": "^2.4.0", // Converts HTML to pdfmake format
  "jsdom": "^24.0.0",          // HTML parsing for conversion
  "marked": "^12.0.2"          // Markdown to HTML (for AI-generated content)
}
```

### Flow
```
AI-generated markdown
  ↓
marked.parse() → HTML
  ↓
htmlToPdfmake() → pdfmake content array
  ↓
pdfPrinter.createPdfKitDocument() → PDF Buffer
  ↓
base64 encoding → Frontend download
```

## Styling

### Custom Fonts
Uses **Noto Sans** (already in `/server/fonts/`):
- Regular: `NotoSans-VariableFont_wdth,wght.ttf`
- Italic: `NotoSans-Italic-VariableFont_wdth,wght.ttf`

### Color Palette
```javascript
Brand Primary: #0f172a (dark slate)
Brand Accent:  #14B8A6 (teal)
Text Primary:  #0f172a
Text Medium:   #475569
Text Light:    #64748b
Background:    #f8fafc
```

### Typography
- **H1**: 24px bold, dark slate
- **H2**: 18px bold, underlined with accent
- **H3**: 15px bold, light background
- **H4**: 13px bold
- **Body**: 11px, medium gray, 1.4 line-height

### Emojis
Emojis are preserved from the AI-generated content:
- Section headers often include: 📚 📝 🎯 ✓ 🔍 🎉
- Footer CTA uses: 🚀

## Document Structure

### Header (Every Page)
```
Wurlo
Goal: [user's goal]        Level: [user's experience]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Content
AI-generated learning plan with:
- Phases and modules
- Granular daily lessons
- Practice activities
- Resource links
- Checkpoints

### Footer CTA (Last Page)
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Ready to start learning?              Visit wurlo.org
Generate a full personalized course
based on this plan.
```

### Page Footer
```
© 2025 Wurlo                             Page 1 of 12
```

## API Response Format

```json
{
  "placement_summary": {
    "pdf": {
      "filename": "wurlo-learning-plan-pass-gcse-math-2025-11-02.pdf",
      "contentType": "application/pdf",
      "base64": "JVBERi0xLjMKJcTl8uXrp/Og0MTGCjQgMCBv..."
    }
  }
}
```

## Local Testing

```bash
cd server
npm install
npm run dev

# Submit placement test
# Check logs for:
# [PDF] Creating document with pdfmake...
# [PDF] ✓ Document created, size: 245632 bytes
```

## Deployment (Render)

No special configuration needed! Just:
```bash
git push
```

Render will:
1. Run `npm install` (installs pdfmake, jsdom, html-to-pdfmake)
2. Start server
3. PDF generation works immediately

## Troubleshooting

### PDF is null
Check logs for:
```
[PDF Generation] ❌ CRITICAL: Failed to build PDF
```

Common causes:
- Fonts not found → Check `/server/fonts/` exists
- Invalid HTML → Check AI response parsing
- pdfmake error → Check `defaultStyles` configuration

### Missing styling
- Verify `defaultStyles` in `htmlToPdfmake()` call
- Check `docDefinition.styles` object
- Ensure colors are hex strings (not CSS vars)

### Emojis not showing
- Noto Sans supports most emojis
- Some exotic emojis may render as boxes
- AI usually uses common emojis (✓ 🎯 📚 🚀)

### File too large
- Typical size: 100-500KB
- If >1MB, check for:
  - Embedded images (not supported yet)
  - Extremely long content
  - Duplicate content

## Future Enhancements

### Images Support
```javascript
// Add to pdfmake content
{
  image: 'data:image/png;base64,...',
  width: 150,
  margin: [0, 10]
}
```

### Progress Bars
```javascript
{
  canvas: [
    { type: 'rect', x: 0, y: 0, w: 200, h: 10, r: 5, color: '#e2e8f0' },
    { type: 'rect', x: 0, y: 0, w: 140, h: 10, r: 5, color: '#14B8A6' }
  ]
}
```

### Tables
```javascript
{
  table: {
    widths: ['*', 100, 100],
    body: [
      ['Module', 'Status', 'Time'],
      ['Quadratics', '✓ Complete', '45 min']
    ]
  }
}
```

## Performance

- **Generation time**: ~200-500ms (vs 2-5s with Puppeteer)
- **Memory usage**: ~50MB (vs 200-500MB with Chromium)
- **Deploy time**: 30-60s (vs 3-5 min with Aptfile)
- **Cold start**: Instant (no browser launch)

## Migration from Puppeteer

**Removed:**
- ❌ `puppeteer` package
- ❌ `Aptfile` (Chromium install)
- ❌ `render.yaml` (Puppeteer env vars)
- ❌ Chrome path detection logic

**Added:**
- ✅ `pdfmake` + `html-to-pdfmake` + `jsdom`
- ✅ Custom font configuration
- ✅ Style mapping for HTML elements
- ✅ Branded header and footer

**Benefits:**
- Faster builds
- Smaller dependencies
- No deployment failures
- Better reliability
