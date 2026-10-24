const fs = require("fs");
const path = require("path");

const targetDirs = [
  path.join(__dirname, "../packages/app/dist"),
  path.join(__dirname, "../packages/desktop/release/win-unpacked/resources/app-dist"),
  path.join("C:/Users/Naman Gaonkar/Desktop/AITD/Projects/Whis Desktop/packages/app/dist"),
  path.join(
    "C:/Users/Naman Gaonkar/Desktop/AITD/Projects/Whis Desktop/packages/desktop/release/win-unpacked/resources/app-dist",
  ),
];

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
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

const WHIS_VECTOR_PATH =
  "M 60 70 H 200 V 120 H 110 V 210 H 60 Z M 500 70 H 640 V 210 H 590 V 120 H 500 Z M 60 490 H 110 V 580 H 200 V 630 H 60 Z M 590 490 H 640 V 630 H 500 V 580 H 590 Z M 140 200 H 225 V 450 H 305 V 260 H 395 V 450 H 475 V 200 H 560 V 470 L 500 540 H 380 L 350 500 L 320 540 H 200 L 140 470 Z";

const replacements = [
  // Links & docs
  {
    from: /https:\/\/paseo\.sh\/docs\/configuration/g,
    to: "https://github.com/NamanGaonkar/whis-desktop#configuration",
  },
  {
    from: /https:\/\/paseo\.sh\/docs\/skills/g,
    to: "https://github.com/NamanGaonkar/whis-desktop#skills",
  },
  {
    from: /https:\/\/paseo\.sh\/docs\/cli/g,
    to: "https://github.com/NamanGaonkar/whis-desktop#cli",
  },
  {
    from: /https:\/\/paseo\.sh\/changelog/g,
    to: "https://github.com/NamanGaonkar/whis-desktop/releases",
  },
  { from: /https:\/\/paseo\.sh/g, to: "https://github.com/NamanGaonkar/whis-desktop" },
  { from: /http:\/\/paseo\.sh/g, to: "https://github.com/NamanGaonkar/whis-desktop" },
  { from: /paseo\.sh/g, to: "github.com/NamanGaonkar/whis-desktop" },
  { from: /getpaseo\/paseo/g, to: "NamanGaonkar/whis-desktop" },

  // Snail splash SVG mask -> Whis vector
  { from: /M291\.495 91\.399C333\.897[^'"]*?405\.722Z/g, to: WHIS_VECTOR_PATH },
  { from: /paseo-splash-shimmer/g, to: "whis-splash-shimmer" },

  // Default port updates
  { from: /127\.0\.0\.1:6767/g, to: "127.0.0.1:6868" },
  { from: /localhost:6767/g, to: "localhost:6868" },

  // Config files
  { from: /paseo\.json/g, to: "whis.json" },

  // User-facing branding (Paseo -> Whis)
  { from: /"Paseo"/g, to: '"Whis"' },
  { from: /'Paseo'/g, to: "'Whis'" },
  { from: /`Paseo`/g, to: "`Whis`" },
  { from: /Welcome to Paseo/g, to: "Welcome to Whis" },
  { from: /Quitting Paseo/g, to: "Quitting Whis" },
  { from: /About Paseo/g, to: "About Whis" },
  { from: /Paseo CLI/g, to: "Whis CLI" },
  { from: /Paseo worktree/g, to: "Whis worktree" },
  { from: /Paseo Team/g, to: "Whis Team" },
  { from: /Paseo team/g, to: "Whis team" },
  { from: /Paseo Desktop/g, to: "Whis Desktop" },
  { from: /Paseo notification test/g, to: "Whis notification test" },
  { from: />Paseo</g, to: ">Whis<" },
  { from: />Paseo /g, to: ">Whis " },
  { from: / Paseo /g, to: " Whis " },
  { from: / Paseo\./g, to: " Whis." },
  { from: / Paseo,/g, to: " Whis," },
  { from: / Paseo:/g, to: " Whis:" },
  { from: / Paseo\?/g, to: " Whis?" },
  { from: / Paseo!/g, to: " Whis!" },
  { from: / Paseo"/g, to: ' Whis"' },
  { from: / Paseo'/g, to: " Whis'" },
  { from: /"Paseo /g, to: '"Whis ' },
  { from: /'Paseo /g, to: "'Whis " },
  { from: /`Paseo /g, to: "`Whis " },
  { from: /appName:"Paseo"/g, to: 'appName:"Whis"' },
  { from: /title:"Paseo"/g, to: 'title:"Whis"' },
  { from: /name:"Paseo"/g, to: 'name:"Whis"' },
  { from: /shortName:"Paseo"/g, to: 'shortName:"Whis"' },
  { from: /app_name:"Paseo"/g, to: 'app_name:"Whis"' },
  { from: /"app_name":"Paseo"/g, to: '"app_name":"Whis"' },
  { from: /"appName":"Paseo"/g, to: '"appName":"Whis"' },

  // HTML theme background & title
  { from: /<title>Paseo<\/title>/g, to: "<title>Whis</title>" },
  { from: /content="Paseo"/g, to: 'content="Whis"' },
  { from: /#181b1a/gi, to: "#0c0d0e" },
  { from: /#181B1A/g, to: "#0C0D0E" },
];

let totalModified = 0;

targetDirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    return;
  }
  const files = walk(dir);
  files.forEach((file) => {
    const ext = path.extname(file);
    if (![".js", ".html", ".json", ".txt"].includes(ext)) return;

    let content = fs.readFileSync(file, "utf8");
    let modified = false;

    for (const r of replacements) {
      if (r.from.test(content)) {
        content = content.replace(r.from, r.to);
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(file, content, "utf8");
      console.log(`Updated: ${file}`);
      totalModified++;
    }
  });
});

console.log(`Total files updated: ${totalModified}`);
