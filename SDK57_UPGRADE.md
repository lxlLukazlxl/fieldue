# Fielduo — atualização para Expo SDK 57

Esta versão preserva o código do Fielduo recebido e atualiza o aplicativo mobile para Expo SDK 57, compatível com o Expo Go SDK 57.

## O que foi atualizado

- Expo SDK 54 → 57
- React 19.1 → 19.2.3
- React Native 0.81 → 0.86.3
- Expo Router atualizado para a linha 57
- Bibliotecas Expo atualizadas para versões compatíveis com SDK 57
- Reanimated / Worklets / Gesture Handler atualizados
- Imports antigos de `@react-navigation/*` usados pelo app foram ajustados para as entradas compatíveis do Expo Router
- `node_modules`, `.expo`, `.env` e certificado privado não são incluídos no ZIP

## Como instalar no Windows

Na pasta raiz do Fielduo:

```powershell
npm install
npx expo install --fix
npx expo-doctor
```

Depois:

```powershell
npx expo start --clear
```

Escaneie o QR Code usando o Expo Go SDK 57.

O backend continua separado em `ServidorFielduo`:

```powershell
cd ServidorFielduo
npm install
npm start
```

## Observação

O Expo recomenda `npx expo install --fix` e `npx expo-doctor` após a atualização para alinhar eventuais dependências transitivas ao SDK instalado.
