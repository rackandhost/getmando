import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FOCUSED_TEST_PATTERNS = [
  { label: '.only', regex: /\b(?:describe|it|test|suite|context|specify)\s*\.\s*only\s*\(/g },
  { label: 'fit', regex: /\bfit\s*\(/g },
  { label: 'fdescribe', regex: /\bfdescribe\s*\(/g },
];

const IGNORED_DIRECTORIES = new Set(['.angular', '.git', 'dist', 'node_modules']);

export function isTestFilePath(filePath) {
  return /(?:^|\/)[^/]+\.(?:spec|test)\.(?:[cm]?[jt]sx?)$/u.test(filePath);
}

function sanitizeContentForPatternMatch(content) {
  let result = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplateLiteral = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < content.length; index += 1) {
    const current = content[index];
    const next = content[index + 1];
    const previous = content[index - 1];

    if (inLineComment) {
      result += current === '\n' ? '\n' : ' ';

      if (current === '\n') {
        inLineComment = false;
      }

      continue;
    }

    if (inBlockComment) {
      if (current === '*' && next === '/') {
        result += '  ';
        inBlockComment = false;
        index += 1;
        continue;
      }

      result += current === '\n' ? '\n' : ' ';
      continue;
    }

    if (!inDoubleQuote && !inTemplateLiteral && current === "'" && previous !== '\\') {
      inSingleQuote = !inSingleQuote;
      result += ' ';
      continue;
    }

    if (!inSingleQuote && !inTemplateLiteral && current === '"' && previous !== '\\') {
      inDoubleQuote = !inDoubleQuote;
      result += ' ';
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && current === '`' && previous !== '\\') {
      inTemplateLiteral = !inTemplateLiteral;
      result += ' ';
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && !inTemplateLiteral && current === '/' && next === '/') {
      result += '  ';
      inLineComment = true;
      index += 1;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && !inTemplateLiteral && current === '/' && next === '*') {
      result += '  ';
      inBlockComment = true;
      index += 1;
      continue;
    }

    result += inSingleQuote || inDoubleQuote || inTemplateLiteral ? ' ' : current;
  }

  return result;
}

function lineNumberFromIndex(content, index) {
  return content.slice(0, index + 1).split('\n').length;
}

export function collectFocusedTestViolations(files) {
  return files.flatMap(({ path: filePath, content }) => {
    if (!isTestFilePath(filePath)) {
      return [];
    }

    const searchableContent = sanitizeContentForPatternMatch(content);

    return FOCUSED_TEST_PATTERNS.flatMap(({ label, regex }) =>
      Array.from(searchableContent.matchAll(regex), (match) => {
        const matchText = match[0] ?? '';
        const lineAnchorOffset = label === '.only' ? matchText.indexOf('.only') : 0;

        return {
          filePath,
          line: lineNumberFromIndex(searchableContent, (match.index ?? 0) + lineAnchorOffset),
          pattern: label,
        };
      }),
    ).sort((left, right) => left.line - right.line);
  });
}

async function collectTestFiles(rootDir, currentDir = rootDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      files.push(...(await collectTestFiles(rootDir, path.join(currentDir, entry.name))));
      continue;
    }

    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = path.relative(rootDir, absolutePath);

    if (!isTestFilePath(relativePath)) {
      continue;
    }

    files.push({
      path: relativePath,
      content: await readFile(absolutePath, 'utf8'),
    });
  }

  return files;
}

export async function checkFocusedTests(rootDir) {
  const files = await collectTestFiles(rootDir);

  return collectFocusedTestViolations(files);
}

async function main() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const repositoryRoot = path.resolve(scriptDirectory, '..');
  const violations = await checkFocusedTests(repositoryRoot);

  if (violations.length === 0) {
    console.log('Focused test check passed.');
    return;
  }

  console.error('Focused test check failed. Remove committed focused tests:');

  for (const violation of violations) {
    console.error(`- ${violation.filePath}:${violation.line} (${violation.pattern})`);
  }

  process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
