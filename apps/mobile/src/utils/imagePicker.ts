import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

export interface SelectedPhoto {
  uri: string;
  name: string;
  type: string;
  size?: number;
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB limit
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export async function pickImageFromGallery(): Promise<SelectedPhoto | null> {
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permission Required',
        'Please grant access to your photo library to select visit photos.'
      );
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];
    const name = asset.fileName || asset.uri.split('/').pop() || 'visit_photo.jpg';
    let type = asset.mimeType || 'image/jpeg';
    if (!type.includes('/')) {
      type = name.endsWith('.png') ? 'image/png' : 'image/jpeg';
    }

    // Client-side file size validation (5MB max)
    if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE_BYTES) {
      Alert.alert(
        'File Too Large',
        `The selected image size (${(asset.fileSize / (1024 * 1024)).toFixed(1)}MB) exceeds the maximum allowed 5MB limit.`
      );
      return null;
    }

    // Client-side MIME validation
    if (!ALLOWED_MIME_TYPES.includes(type.toLowerCase())) {
      Alert.alert(
        'Unsupported Format',
        'Only JPEG, PNG, and WebP images are supported.'
      );
      return null;
    }

    return {
      uri: asset.uri,
      name,
      type,
      size: asset.fileSize,
    };
  } catch (error: any) {
    Alert.alert('Image Picker Error', error.message || 'Unable to open photo library.');
    return null;
  }
}
