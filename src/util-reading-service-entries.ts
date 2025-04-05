import fs from 'fs';
import { ServiceEntry, SqlFilesContent, SqlStatementWithFilename, SRecord } from './types';
import { consoleLogger, trim } from './utils';

const logger = consoleLogger;

export function processParameter(parameters: SRecord, line: string): void {
  const p = line.split('=');
  if (p.length > 1) {
    const name = trim(p[0]);
    parameters[name] = trim(p[1]);
  }
}

const createServiceEntry = (parameters: SRecord, statements: string, origin: string): ServiceEntry | undefined => {
  const serviceId = parameters.SERVICE_ID;
  const roles = (parameters.ROLES ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter((e) => !!e);
  if (!serviceId) {
    consoleLogger.warn('No serviceId');
    return;
  }
  if (!statements) {
    consoleLogger.warn('No statements');
    return;
  }

  return { serviceId, statements, roles, origin };
};

const processRqSqlText = (rqSqlText: string, source: string): ServiceEntry[] => {
  const serviceEntries: ServiceEntry[] = [];
  let parameters = {};
  let statements = '';

  const lines = rqSqlText.split('\n');
  let inComment = false;
  let inStatement = false;

  for (const line2 of lines) {
    const line = line2.trim();
    if (!line) {
      continue;
    }
    // comment
    if (line.startsWith('--')) {
      if (!inComment) {
        //
        // execute collected
        //
        if (inStatement) {
          const se1 = createServiceEntry(parameters, statements, source);
          if (se1) {
            serviceEntries.push(se1);
          }
          statements = '';
          parameters = {};
          inStatement = false;
        }
      }
      inComment = true;
      processParameter(parameters, line.substring(2));
      continue;
    }
    inComment = false;
    inStatement = true;
    statements += line2 + '\n';
  }

  if (inStatement) {
    const se = createServiceEntry(parameters, statements, source);
    if (se) {
      serviceEntries.push(se);
    }
  }

  return serviceEntries;
};
export const readSqlFiles = (sqlDir: string): SqlFilesContent => {
  const serviceEntries: ServiceEntry[] = [];
  const sqlStatements: SqlStatementWithFilename[] = [];
  const rc: SqlFilesContent = { serviceEntries, sqlStatements };

  const sqlfileNames = fs.readdirSync(sqlDir);
  //
  // SQL
  //
  for (const filename of sqlfileNames) {
    if (filename.endsWith('.sql') && !filename.endsWith('.rq.sql')) {
      logger.info(`Start loading as SQL file: ${filename}`);
      const text = fs.readFileSync(sqlDir + '/' + filename, 'utf8');
      logger.debug(text);
      // TODO let result =
      sqlStatements.push({ text, origin: filename });
    }
  }

  //
  // RQ.SQL
  //
  for (const filename of sqlfileNames) {
    if (filename.endsWith('.rq.sql')) {
      logger.info(`Start loading as RQ-SQL file: ${filename}`);
      const text = fs.readFileSync(sqlDir + '/' + filename, 'utf8');
      logger.debug(text);
      processRqSqlText(text, filename).forEach((e) => serviceEntries.push(e));
    }
  }

  return rc;
};
