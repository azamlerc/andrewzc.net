#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const folderPath = process.argv[2];

if (!folderPath) {
  console.error("Usage: node check-json.js <folder-path>");
  process.exit(1);
}

if (!fs.existsSync(folderPath)) {
  console.error(`Folder does not exist: ${folderPath}`);
  process.exit(1);
}

const entries = fs.readdirSync(folderPath);
const jsonFiles = entries.filter(file => file.toLowerCase().endsWith(".json"));

if (jsonFiles.length === 0) {
  console.log("No JSON files found.");
  process.exit(0);
}

let hasErrors = false;

for (const file of jsonFiles) {
  const fullPath = path.join(folderPath, file);

  try {
    const content = fs.readFileSync(fullPath, "utf8");
    JSON.parse(content);
  } catch (err) {
    hasErrors = true;
    console.error(`❌ Failed to parse: ${file}`);
    console.error(`   ${err.message}\n`);
  }
}

if (!hasErrors) {
  console.log("✅ All JSON files parsed successfully.");
} else {
  process.exit(2);
}