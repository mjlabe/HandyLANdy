import { createContext, use, useEffect, useState, useSyncExternalStore, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { createPrinterSession } from '@/printer/session';
import { profileRepository } from '@/storage/repository';
import { createPrinterController, type PrinterState } from './controller';

const PrinterContext = createContext<PrinterState | null>(null);

export function PrinterProvider({ children }: PropsWithChildren) {
  const [controller] = useState(() => createPrinterController({
    repository: profileRepository,
    createSession: createPrinterSession,
    initialForeground: AppState.currentState === 'active' || AppState.currentState === null,
  }));
  const value = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    void controller.start();
    controller.setForeground(AppState.currentState === 'active' || AppState.currentState === null);
    const subscription = AppState.addEventListener('change', (state) => controller.setForeground(state === 'active'));
    const timer = setInterval(() => controller.tick(), 1000);
    return () => { subscription.remove(); clearInterval(timer); controller.dispose(); };
  }, [controller]);
  return <PrinterContext value={value}>{children}</PrinterContext>;
}

export function usePrinters() {
  const state = use(PrinterContext);
  if (!state) throw new Error('PrinterProvider is required.');
  return state;
}
