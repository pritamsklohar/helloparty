import React from 'react';
import { StyleSheet, View, SafeAreaView, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';

export default function App() {
  // Production URL. You can change this to your local computer's IP address
  // (e.g. 'http://192.168.1.100:5173') when testing local development in real-time!
  const WEB_URL = 'https://helloparty.onrender.com'; 

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" backgroundColor="#F5F7FB" />
      <View style={styles.webViewContainer}>
        <WebView 
          source={{ uri: WEB_URL }} 
          style={styles.webview}
          allowsBackForwardNavigationGestures={true}
          domStorageEnabled={true}
          javaScriptEnabled={true}
          originWhitelist={['*']}
          scalesPageToFit={true}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback={true}
          userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Mobile Safari/537.36"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FB',
    paddingTop: Platform.OS === 'android' ? 35 : 0,
  },
  webViewContainer: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
});
