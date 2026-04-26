// afterSign hook for electron-builder.
//
// Uses the macOS Keychain profile "snapcue-notarize" (created once via
// `xcrun notarytool store-credentials`) instead of APPLE_ID /
// APPLE_APP_SPECIFIC_PASSWORD env vars. This means pack works in any
// shell without exporting credentials each time.
//
// To rotate the password: regenerate at appleid.apple.com, then re-run
// `xcrun notarytool store-credentials snapcue-notarize ...`.

const { notarize } = require('@electron/notarize')

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context
  if (electronPlatformName !== 'darwin') return

  const appName = context.packager.appInfo.productFilename
  const appPath = `${appOutDir}/${appName}.app`

  console.log(`  • notarizing app via keychain profile  file=${appPath}`)
  const start = Date.now()

  await notarize({
    tool: 'notarytool',
    appPath,
    keychainProfile: 'snapcue-notarize',
  })

  const elapsed = ((Date.now() - start) / 1000).toFixed(0)
  console.log(`  • notarization successful  elapsed=${elapsed}s`)
}
