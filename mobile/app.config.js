// Dynamic config layered over app.json (Expo merges: app.json -> this file).
// react-native-maps needs a Google Maps API key baked into the Android build.
// Default to the Firebase key from google-services.json — it belongs to the
// same GCP project, so enabling "Maps SDK for Android" there makes it valid
// for Maps too. Override with GOOGLE_MAPS_ANDROID_API_KEY at build time if a
// separate, restricted key is preferred.
const googleServices = require('./google-services.json');

module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...config.plugins,
    [
      'react-native-maps',
      {
        androidGoogleMapsApiKey:
          process.env.GOOGLE_MAPS_ANDROID_API_KEY ??
          googleServices.client[0].api_key[0].current_key,
      },
    ],
  ],
});
