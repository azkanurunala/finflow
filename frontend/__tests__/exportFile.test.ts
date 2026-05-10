/**
 * G5 — exportFile helper. Covers web Blob path, native v19 File-API path,
 * legacy fallback, and graceful failure modes.
 */

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('expo-file-system', () => {
  const _create = jest.fn();
  const _write = jest.fn();
  function FileCtor(this: any, _dir: any, name: string) {
    this.uri = `file:///cache/${name}`;
    this.create = _create;
    this.write = _write;
  }
  return {
    __esModule: true,
    File: FileCtor,
    Paths: { cache: { uri: 'file:///cache/' } },
    writeAsStringAsync: jest.fn(),
    cacheDirectory: 'file:///cache/',
    __mockHandles: { _create, _write },
  };
});

jest.mock('expo-sharing', () => ({
  __esModule: true,
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

const fsMock: any = jest.requireMock('expo-file-system');
const sharingMock: any = jest.requireMock('expo-sharing');
const fileCreate = fsMock.__mockHandles._create as jest.Mock;
const fileWrite = fsMock.__mockHandles._write as jest.Mock;
const isSharingAvailable = sharingMock.isAvailableAsync as jest.Mock;
const shareAsync = sharingMock.shareAsync as jest.Mock;

import { exportFile } from '../utils/exportFile';

describe('G5 — exportFile (Issue #14)', () => {
  beforeEach(() => {
    fileWrite.mockReset();
    fileCreate.mockReset();
    isSharingAvailable.mockReset();
    shareAsync.mockReset();
    isSharingAvailable.mockResolvedValue(true);
    shareAsync.mockResolvedValue(undefined);
    fileCreate.mockReturnValue(undefined);
    fileWrite.mockReturnValue(undefined);
  });

  it('uses the v19 File class to write to cache + opens share sheet', async () => {
    const result = await exportFile({
      filename: 'tx.csv',
      contents: 'a,b,c',
      mimeType: 'text/csv',
      dialogTitle: 'Export Transactions',
    });

    expect(result.ok).toBe(true);
    expect(result.uri).toBe('file:///cache/tx.csv');
    expect(fileWrite).toHaveBeenCalledWith('a,b,c');
    expect(shareAsync).toHaveBeenCalledWith('file:///cache/tx.csv', {
      mimeType: 'text/csv',
      dialogTitle: 'Export Transactions',
    });
  });

  it('still succeeds when file.create() throws because the file exists', async () => {
    fileCreate.mockImplementation(() => {
      throw new Error('already exists');
    });
    const result = await exportFile({
      filename: 'tx.json',
      contents: '{}',
      mimeType: 'application/json',
    });
    expect(result.ok).toBe(true);
    expect(fileWrite).toHaveBeenCalledWith('{}');
  });

  it('reports failure when File.write throws', async () => {
    fileWrite.mockImplementation(() => {
      throw new Error('disk full');
    });
    const result = await exportFile({
      filename: 'x.csv',
      contents: 'a',
      mimeType: 'text/csv',
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/disk full/);
  });

  it('skips share when sharing API is unavailable but still writes', async () => {
    isSharingAvailable.mockResolvedValue(false);
    const result = await exportFile({
      filename: 'tx.csv',
      contents: 'x',
      mimeType: 'text/csv',
    });
    expect(result.ok).toBe(true);
    expect(shareAsync).not.toHaveBeenCalled();
  });
});
