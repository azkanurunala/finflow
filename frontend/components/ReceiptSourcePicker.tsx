/**
 * G6 — Unified Camera/Gallery picker for receipt scanning entry points.
 *
 * Issue #17: receipt-scan was Camera-only on some entry points and Gallery-only
 * on others. This component centralises the choice via an ActionSheet so every
 * entry point opens the same picker, returning the selected URI through a single
 * callback regardless of source.
 */

import React, { useCallback, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

export type ReceiptSource = 'camera' | 'gallery';

export interface ReceiptPickResult {
  uri: string;
  source: ReceiptSource;
  width?: number;
  height?: number;
  fileSize?: number;
}

export interface ReceiptSourcePickerProps {
  visible: boolean;
  onClose: () => void;
  onPicked: (result: ReceiptPickResult) => void | Promise<void>;
  title?: string;
}

async function ensureCameraPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      'Camera permission required',
      'Allow camera access in Settings to scan receipts with your camera.'
    );
    return false;
  }
  return true;
}

async function ensureLibraryPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      'Photo library permission required',
      'Allow photo library access in Settings to pick a receipt from your gallery.'
    );
    return false;
  }
  return true;
}

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  allowsEditing: true,
  quality: 0.85,
};

export async function pickFromCamera(): Promise<ReceiptPickResult | null> {
  if (!(await ensureCameraPermission())) return null;
  const result = await ImagePicker.launchCameraAsync(PICKER_OPTIONS);
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    source: 'camera',
    width: asset.width,
    height: asset.height,
    fileSize: asset.fileSize,
  };
}

export async function pickFromGallery(): Promise<ReceiptPickResult | null> {
  if (!(await ensureLibraryPermission())) return null;
  const result = await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    source: 'gallery',
    width: asset.width,
    height: asset.height,
    fileSize: asset.fileSize,
  };
}

export const ReceiptSourcePicker: React.FC<ReceiptSourcePickerProps> = ({
  visible,
  onClose,
  onPicked,
  title = 'Add a receipt',
}) => {
  const onCamera = useCallback(async () => {
    const picked = await pickFromCamera();
    onClose();
    if (picked) await onPicked(picked);
  }, [onClose, onPicked]);

  const onGallery = useCallback(async () => {
    const picked = await pickFromGallery();
    onClose();
    if (picked) await onPicked(picked);
  }, [onClose, onPicked]);

  const sheetStyle = useMemo(
    () => [styles.sheet, Platform.OS === 'ios' ? styles.sheetIos : styles.sheetAndroid],
    []
  );

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      testID="receipt-source-picker-modal"
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
        testID="receipt-source-picker-backdrop"
      >
        <View style={sheetStyle} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>{title}</Text>

          <TouchableOpacity
            style={styles.option}
            onPress={onCamera}
            testID="receipt-source-picker-camera"
            accessibilityRole="button"
            accessibilityLabel="Scan receipt with camera"
          >
            <Ionicons name="camera" size={22} color="#4DB6AC" />
            <Text style={styles.optionText}>Camera</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.option}
            onPress={onGallery}
            testID="receipt-source-picker-gallery"
            accessibilityRole="button"
            accessibilityLabel="Pick receipt from gallery"
          >
            <Ionicons name="images" size={22} color="#4DB6AC" />
            <Text style={styles.optionText}>Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancel}
            onPress={onClose}
            testID="receipt-source-picker-cancel"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  sheetIos: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  sheetAndroid: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  title: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    gap: 14,
  },
  optionText: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  cancel: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  cancelText: {
    fontSize: 16,
    color: '#EF4444',
    fontWeight: '600',
  },
});

export default ReceiptSourcePicker;
