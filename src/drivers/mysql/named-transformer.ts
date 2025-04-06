export type TransformationResult = {
  sqlt: string;
  parameterNames: string[];
};

export const nameTransformer = (sqlQuery: string): TransformationResult => {
  const parameterNames: string[] = [];
  const pattern = /:(\w+)/g;
  const matcher = sqlQuery.matchAll(pattern);
  let sqlt = sqlQuery;

  for (const match of matcher) {
    const paramName = match[1];
    parameterNames.push(paramName);
    sqlt = sqlt.replace(`:${paramName}`, `?`);
  }

  return { sqlt, parameterNames };
};
