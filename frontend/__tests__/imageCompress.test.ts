/**
 * PG5 — receipt image compress + resize.
 *
 * Verifies: (a) images at or below the cap are passed through, (b)
 * oversized images are resized to fit the long-edge cap while preserving
 * aspect ratio, (c) JPEG output uses q=0.85, (d) manipulator failures
 * fall through to passthrough instead of blocking the upload, (e)
 * missing width/height short-circuit safely.
 */

jest.mock('expo-image-manipulator', () => {
  const renderAsync = jest.fn();
  const resize = jest.fn();
  const manipulate = jest.fn();
  const saveAsync = jest.fn();
  return {
    __esModule: true,
    ImageManipulator: { manipulate },
    SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
    __mocks: { manipulate, resize, renderAsync, saveAsync },
  };
});

jest.mock('expo-file-system', () => ({
  __esModule: true,
  getInfoAsync: jest.fn(),
}));

import { compressForUpload, MAX_LONG_EDGE_PX, JPEG_QUALITY } from '../utils/imageCompress';

const manipMocks = jest.requireMock('expo-image-manipulator') as {
  __mocks: { manipulate: jest.Mock; resize: jest.Mock; renderAsync: jest.Mock; saveAsync: jest.Mock };
};
const fs = jest.requireMock('expo-file-system') as { getInfoAsync: jest.Mock };

const arm = (resized: { uri: string; width: number; height: number }) => {
  manipMocks.__mocks.saveAsync.mockResolvedValue(resized);
  const imageRef = { saveAsync: manipMocks.__mocks.saveAsync };
  manipMocks.__mocks.renderAsync.mockResolvedValue(imageRef);
  const context = {
    resize: manipMocks.__mocks.resize,
    renderAsync: manipMocks.__mocks.renderAsync,
  };
  // chainable resize: returns the same context
  manipMocks.__mocks.resize.mockReturnValue(context);
  manipMocks.__mocks.manipulate.mockReturnValue(context);
};

describe('PG5 — image compression', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.getInfoAsync.mockResolvedValue({ size: 250000 });
  });

  it('passes through images whose long edge is already at the cap', async () => {
    const result = await compressForUpload({ uri: 'file://x.jpg', width: 1600, height: 900 });
    expect(result.resized).toBe(false);
    expect(result.uri).toBe('file://x.jpg');
    expect(manipMocks.__mocks.manipulate).not.toHaveBeenCalled();
  });

  it('passes through images whose long edge is below the cap', async () => {
    const result = await compressForUpload({ uri: 'file://x.jpg', width: 800, height: 600 });
    expect(result.resized).toBe(false);
    expect(manipMocks.__mocks.manipulate).not.toHaveBeenCalled();
  });

  it('resizes landscape images to width=1600 preserving aspect ratio', async () => {
    arm({ uri: 'file://x-compressed.jpg', width: MAX_LONG_EDGE_PX, height: 1200 });
    const result = await compressForUpload({ uri: 'file://x.jpg', width: 4032, height: 3024 });
    expect(result.resized).toBe(true);
    expect(result.uri).toBe('file://x-compressed.jpg');
    expect(manipMocks.__mocks.resize).toHaveBeenCalledWith({
      width: MAX_LONG_EDGE_PX,
      height: 1200,
    });
  });

  it('resizes portrait images to height=1600 preserving aspect ratio', async () => {
    // 3024×4032 input → scale 1600/4032 ≈ 0.3968 → 1200×1600.
    arm({ uri: 'file://p.jpg', width: 1200, height: MAX_LONG_EDGE_PX });
    const result = await compressForUpload({ uri: 'file://orig.jpg', width: 3024, height: 4032 });
    expect(result.resized).toBe(true);
    expect(manipMocks.__mocks.resize).toHaveBeenCalledWith({
      width: 1200,
      height: MAX_LONG_EDGE_PX,
    });
  });

  it('saves the resized image as JPEG at q=0.85', async () => {
    arm({ uri: 'file://x.jpg', width: 1600, height: 1200 });
    await compressForUpload({ uri: 'file://orig.jpg', width: 4032, height: 3024 });
    expect(manipMocks.__mocks.saveAsync).toHaveBeenCalledWith({
      format: 'jpeg',
      compress: JPEG_QUALITY,
    });
  });

  it('returns the post-compression byte size when expo-file-system can stat it', async () => {
    arm({ uri: 'file://small.jpg', width: 1600, height: 1200 });
    fs.getInfoAsync.mockResolvedValue({ size: 410_000 });
    const result = await compressForUpload({ uri: 'file://orig.jpg', width: 4032, height: 3024 });
    expect(result.byteSize).toBe(410_000);
  });

  it('falls through to passthrough when manipulator throws (never blocks the upload)', async () => {
    manipMocks.__mocks.manipulate.mockImplementation(() => {
      throw new Error('native crash');
    });
    const result = await compressForUpload({ uri: 'file://orig.jpg', width: 4032, height: 3024 });
    expect(result.resized).toBe(false);
    expect(result.uri).toBe('file://orig.jpg');
  });

  it('short-circuits safely when width or height is missing', async () => {
    const result = await compressForUpload({ uri: 'file://x.jpg' });
    expect(result.resized).toBe(false);
    expect(manipMocks.__mocks.manipulate).not.toHaveBeenCalled();
  });

  it('survives an expo-file-system stat rejection (byteSize remains undefined)', async () => {
    arm({ uri: 'file://x.jpg', width: 1600, height: 1200 });
    fs.getInfoAsync.mockRejectedValue(new Error('stat failed'));
    const result = await compressForUpload({ uri: 'file://orig.jpg', width: 4032, height: 3024 });
    expect(result.resized).toBe(true);
    expect(result.byteSize).toBeUndefined();
  });
});
