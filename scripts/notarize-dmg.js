// afterAllArtifactBuild hook for electron-builder.
//
// Signs + notarizes + staples the DMG container after electron-builder
// has built it. Without this, the DMG itself shows "Apple cannot
// verify..." on first open even though the .app inside is notarized.
//
// Why a separate hook from scripts/notarize.js: that one runs in the
// `afterSign` phase (after the .app is signed, before the DMG exists).
// DMG signing/notarization needs a hook that fires *after* the DMG
// artifact has been written to disk.

const { execFileSync } = require('child_process')
const { notarize } = require('@electron/notarize')

const SIGNING_IDENTITY = 'Developer ID Application: Yangxiuye Gu (2658LDPHG8)'
const KEYCHAIN_PROFILE = 'snapcue-notarize'

exports.default = async function notarizingDmg(buildResult) {
  const dmgs = buildResult.artifactPaths.filter((p) => p.endsWith('.dmg'))
  if (dmgs.length === 0) return []

  for (const dmgPath of dmgs) {
    console.log(`  • signing DMG  file=${dmgPath}`)
    execFileSync(
      'codesign',
      ['--sign', SIGNING_IDENTITY, '--force', '--timestamp', dmgPath],
      { stdio: 'inherit' },
    )

    console.log(`  • notarizing DMG via keychain profile  file=${dmgPath}`)
    const start = Date.now()
    await notarize({
      tool: 'notarytool',
      appPath: dmgPath,
      keychainProfile: KEYCHAIN_PROFILE,
    })
    const elapsed = ((Date.now() - start) / 1000).toFixed(0)
    console.log(`  • DMG notarization successful  elapsed=${elapsed}s`)

    console.log(`  • stapling DMG  file=${dmgPath}`)
    execFileSync('xcrun', ['stapler', 'staple', dmgPath], { stdio: 'inherit' })
  }

  return []
}
