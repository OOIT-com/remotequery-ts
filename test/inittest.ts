import { DriverLight, newRemoteQueryLight } from '../lib';
import { Context, PRecord } from '../src';

export const getTestRemoteQueryLight = () => {
  const driver: DriverLight = {
    processSql: async (sql: string, parameters?: PRecord, context?: Partial<Context>) => {
      // tslint:disable-next-line:no-console
      console.log(sql);
      return {};
    },
    destroy: () => {
      // tslint:disable-next-line:no-console
      console.log('destroyed');
    }
  };

  return newRemoteQueryLight(driver, []);
};
