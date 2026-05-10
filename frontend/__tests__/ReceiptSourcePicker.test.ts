/**
 * G6 — picker helper tests. We exercise pickFromCamera / pickFromGallery directly
 * (no React rendering) since the React Native test renderer trips on the Modal /
 * Ionicons / TouchableOpacity stack under jest@30 + the existing preset combo.
 * Component-level snapshot/interaction tests will land alongside the snapshot
 * infrastructure introduced in G11/G12.
 */

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

jest.mock('expo-image-picker', () => {
  const surface = {
    requestCameraPermissionsAsync: jest.fn(),
    requestMediaLibraryPermissionsAsync: jest.fn(),
    launchCameraAsync: jest.fn(),
    launchImageLibraryAsync: jest.fn(),
    MediaTypeOptions: { Images: 'Images' },
  };
  return { __esModule: true, default: surface, ...surface };
});

const ipMock: any = jest.requireMock('expo-image-picker');
const requestCamera = ipMock.default.requestCameraPermissionsAsync as jest.Mock;
const requestLibrary = ipMock.default.requestMediaLibraryPermissionsAsync as jest.Mock;
const launchCamera = ipMock.default.launchCameraAsync as jest.Mock;
const launchLibrary = ipMock.default.launchImageLibraryAsync as jest.Mock;

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Alert: { alert: jest.fn() },
  StyleSheet: { create: (s: any) => s },
  Modal: 'Modal',
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
}));

import { pickFromCamera, pickFromGallery } from '../components/ReceiptSourcePicker';

describe('G6 — ReceiptSourcePicker helpers (Issue #17)', () => {
  beforeEach(() => {
    requestCamera.mockReset();
    requestLibrary.mockReset();
    launchCamera.mockReset();
    launchLibrary.mockReset();
  });

  describe('pickFromCamera', () => {
    it('returns null when permission denied', async () => {
      requestCamera.mockResolvedValue({ status: 'denied' });
      await expect(pickFromCamera()).resolves.toBeNull();
      expect(launchCamera).not.toHaveBeenCalled();
    });

    it('returns null when user cancels', async () => {
      requestCamera.mockResolvedValue({ status: 'granted' });
      launchCamera.mockResolvedValue({ canceled: true, assets: null });
      await expect(pickFromCamera()).resolves.toBeNull();
    });

    it('returns the asset URI tagged source=camera', async () => {
      requestCamera.mockResolvedValue({ status: 'granted' });
      launchCamera.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://camera.jpg', width: 1080, height: 1920, fileSize: 12345 }],
      });
      await expect(pickFromCamera()).resolves.toEqual({
        uri: 'file://camera.jpg',
        source: 'camera',
        width: 1080,
        height: 1920,
        fileSize: 12345,
        base64: undefined,
      });
    });

    it('forwards includeBase64=true to ImagePicker and returns the bytes', async () => {
      requestCamera.mockResolvedValue({ status: 'granted' });
      launchCamera.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://camera.jpg', base64: 'AAA111' }],
      });
      const result = await pickFromCamera({ includeBase64: true, quality: 0.8 });
      expect(result?.base64).toBe('AAA111');
      expect(launchCamera).toHaveBeenCalledWith(
        expect.objectContaining({ base64: true, quality: 0.8 })
      );
    });
  });

  describe('pickFromGallery', () => {
    it('returns null when permission denied', async () => {
      requestLibrary.mockResolvedValue({ status: 'denied' });
      await expect(pickFromGallery()).resolves.toBeNull();
      expect(launchLibrary).not.toHaveBeenCalled();
    });

    it('returns the asset URI tagged source=gallery', async () => {
      requestLibrary.mockResolvedValue({ status: 'granted' });
      launchLibrary.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://gallery.jpg', width: 800, height: 600 }],
      });
      await expect(pickFromGallery()).resolves.toEqual({
        uri: 'file://gallery.jpg',
        source: 'gallery',
        width: 800,
        height: 600,
        fileSize: undefined,
        base64: undefined,
      });
    });

    it('passes includeBase64 through and surfaces the bytes', async () => {
      requestLibrary.mockResolvedValue({ status: 'granted' });
      launchLibrary.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://g.jpg', base64: 'BBB222' }],
      });
      const result = await pickFromGallery({ includeBase64: true });
      expect(result?.base64).toBe('BBB222');
      expect(launchLibrary).toHaveBeenCalledWith(expect.objectContaining({ base64: true }));
    });
  });
});
