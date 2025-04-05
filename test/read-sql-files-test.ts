// noinspection SqlResolve
/* tslint:disable:no-console */

import * as path from 'node:path';
import { readSqlFiles } from '../src/util-reading-service-entries';
import { expect } from 'chai';
import { SqlFilesContent } from '../src';

describe('Test readSqlFiles', () => {
  let sqlContent: SqlFilesContent;

  it('directory sqls', () => {
    const dir = path.join(__dirname, 'testdata', 'sqls');
    const res = readSqlFiles(dir);
    expect(res.serviceEntries.length).equals(4);
    expect(res.sqlStatements.length).equals(2);

    sqlContent = res;
  });

  it('check content', () => {
    const abc = sqlContent.serviceEntries.filter((se) => se.serviceId === 'testabc');
    expect(abc.length).equals(1);
    expect(abc[0].serviceId).equals('testabc');
    expect(!!abc[0].statements).equals(true);
    const statements = abc[0].statements || '';
    const statementList = statements.split(';').map((e) => e.trim());
    expect(!!statements).equals(true);
    expect(statementList.filter((e) => !e).length).equals(1);
  });
});
