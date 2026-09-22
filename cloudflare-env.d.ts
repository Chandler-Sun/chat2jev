interface CloudflareEnv {
  JEV_ROUTES?: {
    get(key: string, type?: string): Promise<string | null>;
    put(key: string, value: string): Promise<void>;
  };
}
