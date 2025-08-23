import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = 'kova_device_id';

// Generate a simple random device ID
function generateDeviceId(): string {
  return 'device_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
}

// Get or create device ID
export async function getDeviceId(): Promise<string> {
  try {
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    
    if (!deviceId) {
      deviceId = generateDeviceId();
      await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    
    return deviceId;
  } catch (error) {
    console.error('Error getting device ID:', error);
    // Fallback to generated ID if storage fails
    return generateDeviceId();
  }
}
