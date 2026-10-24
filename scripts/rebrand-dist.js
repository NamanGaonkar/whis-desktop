const fs = require('fs');
const path = require('path');

const targetDirs = [
  path.join(__dirname, '../packages/app/dist'),
  path.join(__dirname, '../packages/desktop/release/win-unpacked/resources/app-dist')
];

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else {
      results.push(fullPath);
    }
  });
  return results;
}

const replacements = [
  // Links & docs
  { from: /https:\/\/paseo\.sh\/docs\/configuration/g, to: 'https://github.com/NamanGaonkar/whis-desktop#configuration' },
  { from: /https:\/\/paseo\.sh\/docs\/skills/g, to: 'https://github.com/NamanGaonkar/whis-desktop#skills' },
  { from: /https:\/\/paseo\.sh\/docs\/cli/g, to: 'https://github.com/NamanGaonkar/whis-desktop#cli' },
  { from: /https:\/\/paseo\.sh\/changelog/g, to: 'https://github.com/NamanGaonkar/whis-desktop/releases' },
  { from: /https:\/\/paseo\.sh/g, to: 'https://github.com/NamanGaonkar/whis-desktop' },
  { from: /http:\/\/paseo\.sh/g, to: 'https://github.com/NamanGaonkar/whis-desktop' },
  { from: /paseo\.sh/g, to: 'github.com/NamanGaonkar/whis-desktop' },
  { from: /getpaseo\/paseo/g, to: 'NamanGaonkar/whis-desktop' },
  
  // Config files
  { from: /paseo\.json/g, to: 'whis.json' },

  // User-facing branding (Paseo -> Whis)
  // Be careful with internal module names like PaseoNativeTrace if any, but replace all user facing
  { from: /"Paseo"/g, to: '"Whis"' },
  { from: /'Paseo'/g, to: "'Whis'" },
  { from: /`Paseo`/g, to: '`Whis`' },
  { from: /Welcome to Paseo/g, to: 'Welcome to Whis' },
  { from: /Quitting Paseo/g, to: 'Quitting Whis' },
  { from: /About Paseo/g, to: 'About Whis' },
  { from: /Paseo CLI/g, to: 'Whis CLI' },
  { from: /Paseo worktree/g, to: 'Whis worktree' },
  { from: /Paseo Team/g, to: 'Whis Team' },
  { from: /Paseo team/g, to: 'Whis team' },
  { from: /Paseo Desktop/g, to: 'Whis Desktop' },
  { from: /Paseo notification test/g, to: 'Whis notification test' },
  { from: />Paseo</g, to: '>Whis<' },
  { from: />Paseo /g, to: '>Whis ' },
  { from: / Paseo /g, to: ' Whis ' },
  { from: / Paseo\./g, to: ' Whis.' },
  { from: / Paseo,/g, to: ' Whis,' },
  { from: / Paseo:/g, to: ' Whis:' },
  { from: / Paseo\?/g, to: ' Whis?' },
  { from: / Paseo!/g, to: ' Whis!' },
  { from: / Paseo"/g, to: ' Whis"' },
  { from: / Paseo'/g, to: " Whis'" },
  { from: /"Paseo /g, to: '"Whis ' },
  { from: /'Paseo /g, to: "'Whis " },
  { from: /`Paseo /g, to: '`Whis ' },
  { from: /appName:"Paseo"/g, to: 'appName:"Whis"' },
  { from: /title:"Paseo"/g, to: 'title:"Whis"' },
  { from: /name:"Paseo"/g, to: 'name:"Whis"' },
  { from: /shortName:"Paseo"/g, to: 'shortName:"Whis"' },
  { from: /app_name:"Paseo"/g, to: 'app_name:"Whis"' },
  { from: /"app_name":"Paseo"/g, to: '"app_name":"Whis"' },
  { from: /"appName":"Paseo"/g, to: '"appName":"Whis"' },

  // HTML theme background & title
  { from: /<title>Paseo<\/title>/g, to: '<title>Whis</title>' },
  { from: /content="Paseo"/g, to: 'content="Whis"' },
  { from: /#181b1a/gi, to: '#0c0d0e' },
  { from: /#181B1A/g, to: '#0C0D0E' }
];

let totalModified = 0;

targetDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    console.log(`Directory does not exist: ${dir}`);
    return;
  }
  const files = walk(dir);
  files.forEach(file => {
    const ext = path.extname(file);
    if (!['.js', '.html', '.json', '.txt'].includes(ext)) return;

    let content = fs.readFileSync(file, 'utf8');
    let modified = false;

    for (const r of replacements) {
      if (r.from.test(content)) {
        content = content.replace(r.from, r.to);
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(file, content, 'utf8');
      console.log(`Updated: ${file}`);
      totalModified++;
    }
  });
});

console.log(`Total files updated: ${totalModified}`);
