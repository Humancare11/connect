const fs = require('fs');
const path = require('path');

const srcDir = 'c:\\Users\\HUMANCARE\\OneDrive\\Desktop\\HumancareConnect\\connect\\frontend\\src';

// Helper to recursively find files
function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const name = path.join(dir, file);
    if (fs.statSync(name).isDirectory()) {
      getFiles(name, fileList);
    } else {
      fileList.push(name);
    }
  }
  return fileList;
}

const allFiles = getFiles(srcDir);

// Let's process files
allFiles.forEach(filePath => {
  const ext = path.extname(filePath);
  if (ext !== '.css' && ext !== '.jsx' && ext !== '.html') return;

  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // 1. Remove font imports of non-standard fonts to keep it clean, or keep Inter/Satoshi
  // Let's remove non-standard font imports or replace them
  content = content.replace(/@import\s+url\(['"]https:\/\/fonts\.googleapis\.com\/css2\?family=(?!Inter|Satoshi)[^'"]+['"]\);?/gi, '');
  content = content.replace(/@import\s+url\(['"]https:\/\/api\.fontshare\.com\/v2\/css\?f\[\]=(?!satoshi)[^'"]+['"]\);?/gi, '');

  // 2. Replace font-family declarations
  // regex: font-family:\s*([^;!]+)(!important)?\s*;
  content = content.replace(/font-family:\s*([^;!]+)(!important)?\s*;/gi, (match, fontVal, importantPart) => {
    const val = fontVal.trim().toLowerCase();
    const imp = importantPart ? ' ' + importantPart.trim() : '';

    // If it's inherit, initial, unset, keep it
    if (val === 'inherit' || val === 'initial' || val === 'unset') {
      return `font-family: ${fontVal.trim()}${imp};`;
    }

    // Determine primary vs secondary
    // Satoshi, Sora, Syne, Fraunces, Cormorant, Playfair, Outfit, display, heading
    if (
      val.includes('satoshi') ||
      val.includes('sora') ||
      val.includes('syne') ||
      val.includes('fraunces') ||
      val.includes('cormorant') ||
      val.includes('playfair') ||
      val.includes('outfit') ||
      val.includes('display') ||
      val.includes('heading') ||
      val.includes('playfair display')
    ) {
      return `font-family: var(--font-primary)${imp};`;
    }

    // Default to secondary (Inter, DM Sans, Plus Jakarta Sans, Epilogue, sans-serif)
    return `font-family: var(--font-secondary)${imp};`;
  });

  // 3. Replace direct font-family CSS variables if they are set to strings
  content = content.replace(/--font-heading:\s*[^;]+;/gi, '--font-heading: var(--font-primary);');
  content = content.replace(/--font-body:\s*[^;]+;/gi, '--font-body: var(--font-secondary);');
  content = content.replace(/--font-sans:\s*[^;]+;/gi, '--font-sans: var(--font-secondary);');
  content = content.replace(/--display:\s*[^;]+;/gi, '--display: var(--font-primary);');
  content = content.replace(/--body:\s*[^;]+;/gi, '--body: var(--font-secondary);');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated fonts in: ${filePath}`);
  }
});

console.log('Font migration complete!');
