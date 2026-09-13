import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';
import "@/lib/locationTask";

import { LoginScreen } from '@/components/auth/LoginScreen';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuthContext } from '@/hooks/useAuth';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootNavigator() {
  const colorScheme = useColorScheme();
  const { auth, carregandoSessao } = useAuthContext();

  if (carregandoSessao) {
    // Ainda checando se existe uma sessão salva no aparelho.
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F5F9' }}>
        <ActivityIndicator size="large" color="#FF7A29" />
      </View>
    );
  }

  if (!auth) {
    return <LoginScreen />;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
