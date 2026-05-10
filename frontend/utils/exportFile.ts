/**
 * G5 — Cross-platform file export helper for the AI Insights Export flow.
 *
 * Issue #14: the previous code path failed with "Cannot read property 'UTF8' of
 * undefined" because expo-file-system v19 dropped the `cacheDirectory` constant
 * and the legacy `writeAsStringAsync` enum in favour of the class-based
 * `File` / `Paths` API. This helper centralises the v19 path so screens can
 * stay free of platform/version branching.
 *
 * On web → triggers a Blob download in the browser.
 * On native → writes to the cache directory via the new File API and opens the
 *             native share sheet via expo-sharing.
 */

import { Platform } from 'react-native';

export type ExportMimeType = 'application/json' | 'text/csv';

export interface ExportFileInput {
  filename: string;
  contents: string;
  mimeType: ExportMimeType;
  /** Title shown in the native share sheet. Ignored on web. */
  dialogTitle?: string;
}

export interface ExportFileResult {
  ok: boolean;
  uri?: string;
  reason?: string;
}

async function exportWeb(input: ExportFileInput): Promise<ExportFileResult> {
  try {
    const { filename, contents, mimeType } = input;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w: any = globalThis;
    if (!w.Blob || !w.URL || !w.document) {
      return { ok: false, reason: 'Browser download API not available' };
    }
    const blob = new w.Blob([contents], { type: `${mimeType};charset=utf-8` });
    const url = w.URL.createObjectURL(blob);
    const a = w.document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    w.URL.revokeObjectURL(url);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, reason: err?.message ?? 'Web export failed' };
  }
}

async function exportNative(input: ExportFileInput): Promise<ExportFileResult> {
  try {
    const { filename, contents, mimeType, dialogTitle } = input;
    // Synchronous require (babel-preset-expo + jest-resolve handle this; dynamic
    // ESM `import()` would require --experimental-vm-modules in Jest).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const FS: any = require('expo-file-system');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sharing: any = require('expo-sharing');

    const cacheDir = FS.Paths?.cache ?? FS.cacheDirectory;
    if (!cacheDir) {
      return { ok: false, reason: 'expo-file-system cache directory unavailable' };
    }

    let uri: string;
    if (FS.File && FS.Paths) {
      // v19+ class-based API.
      const file = new FS.File(FS.Paths.cache, filename);
      // create() throws if the file already exists; ignore that and overwrite.
      try {
        file.create();
      } catch {
        // already exists — fine, write() overwrites.
      }
      file.write(contents);
      uri = file.uri;
    } else {
      // Legacy API fallback (pre-v19).
      uri = `${cacheDir}${filename}`;
      await FS.writeAsStringAsync(uri, contents, { encoding: 'utf8' });
    }

    const sharingAvailable = await Sharing.isAvailableAsync();
    if (sharingAvailable) {
      await Sharing.shareAsync(uri, {
        mimeType,
        dialogTitle: dialogTitle ?? 'Export',
      });
    }
    return { ok: true, uri };
  } catch (err: any) {
    return { ok: false, reason: err?.message ?? 'Native export failed' };
  }
}

export async function exportFile(input: ExportFileInput): Promise<ExportFileResult> {
  if (Platform.OS === 'web') {
    return exportWeb(input);
  }
  return exportNative(input);
}
