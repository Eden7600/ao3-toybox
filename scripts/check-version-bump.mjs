import { execFileSync } from 'node:child_process'

function gitShow(ref) {
  try {
    return execFileSync('git', ['show', ref], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return null
  }
}

function parse(raw) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(raw)
  return m ? m.slice(1).map(Number) : null
}

const headRaw = gitShow('HEAD:package.json')
if (headRaw === null) process.exit(0) // initial commit, nothing to compare against

// ":package.json" is the index (staged) copy — what the commit will actually contain
const stagedRaw = gitShow(':package.json')
if (stagedRaw === null) {
  console.error('version check: package.json is missing from the index')
  process.exit(1)
}

const headVersion = JSON.parse(headRaw).version
const stagedVersion = JSON.parse(stagedRaw).version
const prev = parse(headVersion)
const next = parse(stagedVersion)

if (!next) {
  console.error(`version check: "${stagedVersion}" is not a valid MAJOR.MINOR.PATCH version`)
  process.exit(1)
}

const [pMaj, pMin, pPat] = prev
const [nMaj, nMin, nPat] = next
const isProperBump =
  (nMaj === pMaj + 1 && nMin === 0 && nPat === 0) ||
  (nMaj === pMaj && nMin === pMin + 1 && nPat === 0) ||
  (nMaj === pMaj && nMin === pMin && nPat === pPat + 1)

if (!isProperBump) {
  console.error(`version check: staged version is ${stagedVersion}, but HEAD is ${headVersion}`)
  console.error(
    `expected one of: ${pMaj}.${pMin}.${pPat + 1} (patch), ${pMaj}.${pMin + 1}.0 (minor), ${pMaj + 1}.0.0 (major)`
  )
  if (stagedVersion === headVersion) {
    console.error('bump the version in package.json and stage it with: git add package.json')
  }
  process.exit(1)
}
