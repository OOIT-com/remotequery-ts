import { Context, DriverLight, Request, Result, ServiceEntry, SplitStatementFunction } from './types';
import { checkAccess, splitStatements } from './utils';

export class RemoteQueryLight {
  private readonly driver: DriverLight;
  private serviceEntryMap: Record<string, ServiceEntry> = {};
  private splitStatementFunction: SplitStatementFunction = splitStatements;

  public constructor(driver: DriverLight, serviceEntries: ServiceEntry[]) {
    this.driver = driver;
    serviceEntries.forEach((se) => (this.serviceEntryMap[se.serviceId] = se));
  }

  public run = async (request: Request): Promise<Result> => {
    const serviceEntry = this.serviceEntryMap[request.serviceId];
    if (!serviceEntry) {
      return { exception: `No service entry found for serviceId: ${request.serviceId}` };
    }
    const accessCheckResult = checkAccess(request.roles || [], serviceEntry.roles);
    if (accessCheckResult) {
      return { exception: `Access check failed for ${request.serviceId}: ${accessCheckResult}` };
    }
    const context: Partial<Context> = { serviceEntry };
    if (serviceEntry.statements) {
      const sqls = this.splitStatementFunction(serviceEntry.statements);
      let result: Result = {};
      for (const sql of sqls) {
        result = await this.driver.processSql(sql, request.parameters, context);
      }
      return result;
    } else if (serviceEntry.service) {
      return serviceEntry.service(request, context);
    }
    return { exception: `No statements and no service found for: ${request.serviceId}` };
  };

  public setSplitStatementFunction(splitStatementFunction: SplitStatementFunction) {
    this.splitStatementFunction = splitStatementFunction;
  }
}

// After
export const newRemoteQueryLight = (driver: DriverLight, serviceEntries: ServiceEntry[]): RemoteQueryLight =>
  new RemoteQueryLight(driver, serviceEntries);
