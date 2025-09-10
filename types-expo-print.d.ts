declare module 'expo-print' {
  export function printToFileAsync(options: { html: string; base64?: boolean }): Promise<{ uri: string; base64?: string }>;
}