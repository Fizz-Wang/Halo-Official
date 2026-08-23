export interface D1ResultLike<T = Record<string, unknown>> {
  success: boolean;
  results?: T[];
  meta?: {
    changes?: number;
    changed_db?: boolean;
    rows_read?: number;
    rows_written?: number;
  };
}

export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T = Record<string, unknown>>(columnName?: string): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<D1ResultLike<T>>;
  all?<T = Record<string, unknown>>(): Promise<D1ResultLike<T>>;
}

export interface D1SessionLike {
  prepare(query: string): D1PreparedStatementLike;
  batch<T = Record<string, unknown>>(
    statements: D1PreparedStatementLike[],
  ): Promise<Array<D1ResultLike<T>>>;
  getBookmark?(): string | null;
}

export interface D1DatabaseLike extends D1SessionLike {
  withSession?(constraintOrBookmark?: string): D1SessionLike;
}
