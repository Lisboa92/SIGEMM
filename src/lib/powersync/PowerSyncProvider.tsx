import React, { useEffect, useState } from 'react';
import { PowerSyncContext } from '@powersync/react';
import { CommonPowerSyncDatabase } from '@powersync/web';
import { initPowerSync, getPowerSync } from './client';

export interface PowerSyncProviderProps {
  children: React.ReactNode;
}

export const PowerSyncProvider: React.FC<PowerSyncProviderProps> = ({ children }) => {
  const [db, setDb] = useState<CommonPowerSyncDatabase | null>(getPowerSync());

  useEffect(() => {
    let mounted = true;

    initPowerSync().then((instance) => {
      if (mounted && instance) {
        setDb(instance);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  if (!db) {
    // Se ainda estiver a inicializar o worker SQLite, renderizar os filhos directamente
    return <>{children}</>;
  }

  return (
    <PowerSyncContext.Provider value={db}>
      {children}
    </PowerSyncContext.Provider>
  );
};
