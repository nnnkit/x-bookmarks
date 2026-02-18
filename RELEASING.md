# Releasing the Extension ZIP

This repo is set up to publish a ZIP users can download from GitHub Releases and load via Chrome "Developer mode".

## Maintainer release flow

1. Update extension version in both files:
   - `package.json`
   - `public/manifest.json`
2. Commit and push to `main`.
3. Create and push a version tag:

```bash
git tag v1.0.1
git push origin v1.0.1
```

4. GitHub Actions workflow `Release Extension ZIP` will:
   - install dependencies
   - build to `dist/`
   - create `release/x-bookmarks-tab-v<version>.zip`
   - attach ZIP to the GitHub Release for that tag

If the tag version does not match `dist/manifest.json` version, the workflow fails.

## Local packaging (optional)

```bash
pnpm package:extension
```

Output ZIP:

`release/x-bookmarks-tab-v<version>.zip`

## End-user install (Developer mode)

1. Download the ZIP from the latest GitHub Release.
2. Unzip it.
3. Open `chrome://extensions`.
4. Enable **Developer mode**.
5. Click **Load unpacked** and select the unzipped folder.
