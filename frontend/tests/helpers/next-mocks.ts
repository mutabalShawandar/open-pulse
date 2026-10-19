// Next's redirect()/notFound() throw to abort rendering; mimic that so tests can
// assert on where a request would have been sent.
export class RedirectError extends Error {
  constructor(public readonly location: string) {
    super(`redirect:${location}`);
  }
}
export class NotFoundError extends Error {
  constructor() {
    super("not-found");
  }
}

export const navigationMock = {
  redirect: (location: string): never => {
    throw new RedirectError(location);
  },
  notFound: (): never => {
    throw new NotFoundError();
  },
};

// next-intl's getTranslations(namespace) -> t(key); echoes "namespace.key" so
// assertions do not depend on the English copy.
export function translationsMock() {
  return async (namespace?: string) => {
    const t = (key: string, values?: Record<string, unknown>) =>
      [namespace, key].filter(Boolean).join(".") + (values ? `:${JSON.stringify(values)}` : "");
    return t;
  };
}
