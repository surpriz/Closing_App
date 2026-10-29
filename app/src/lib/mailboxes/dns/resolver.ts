import { Resolver } from "node:dns/promises";

export type DnsResolver = {
  mx(domain: string): Promise<{ exchange: string; priority: number }[]>;
  txt(name: string): Promise<string[]>;
  cname(name: string): Promise<string[]>;
};

/** Only impure file of the DNS checks: everything else takes a DnsResolver so tests never touch the network. */
export function nodeResolver(timeoutMs = 3000): DnsResolver {
  const resolver = new Resolver({ timeout: timeoutMs, tries: 1 });

  // A missing record is an answer, not a failure; anything else (SERVFAIL, timeout) is thrown.
  async function lookup<T>(run: () => Promise<T[]>): Promise<T[]> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("DNS lookup timed out")), timeoutMs);
    });
    try {
      return await Promise.race([run(), timeout]);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOTFOUND" || code === "ENODATA") return [];
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    mx: (domain) => lookup(() => resolver.resolveMx(domain)),
    // A TXT record can be split in 255-char chunks: they form one string.
    txt: (name) => lookup(() => resolver.resolveTxt(name)).then((records) => records.map((chunks) => chunks.join(""))),
    cname: (name) => lookup(() => resolver.resolveCname(name)),
  };
}
