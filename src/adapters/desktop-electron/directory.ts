import { dialog } from 'electron';
import type { BrowserWindow } from 'electron';

export async function chooseDirectory(
  window: BrowserWindow,
): Promise<string | null> {
  const result = await dialog.showOpenDialog(window, {
    title: 'Open directory in Manifold',
    properties: ['openDirectory', 'dontAddToRecent'],
  });
  return result.canceled ? null : (result.filePaths[0] ?? null);
}
