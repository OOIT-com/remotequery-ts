// noinspection SqlResolve
/* tslint:disable:no-console */

import { expect } from 'chai';
import { splitStatements } from '../src';

describe('Split statements', () => {
  it('test multiple ;', () => {
    const statements = 'hello;;there';
    const list = splitStatements(statements);
    expect(list.length).equals(2);
  });
});
