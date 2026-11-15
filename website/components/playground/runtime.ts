import type { VersionOption } from '@/app/(home)/playground/versions';

/**
 * Loading the SayKit release the playground runs on. Every published version is a
 * module on a CDN, so switching versions is switching a URL, and because every
 * approving review on a pull request publishes the workspace to pkg.pr.new, which
 * esm.sh serves under `/pr/`, a pull request loads exactly the way a release does.
 * That symmetry is why the preview helpers live here rather than off on their own:
 * they exist to name one of these URLs.
 */

/** Mirrors the `Message` shape from `@saykit/config`. */
export type Message = {
  message: string;
  id?: string;
  context?: string;
  comments: string[];
  references: string[];
};

export type Transformer = {
  extract: (code: string, id: string) => Message[];
  transform: (code: string, id: string) => string;
};

/** The pieces of a given SayKit release the playground drives. */
export type Runtime = {
  transformer: Transformer;
  generateHash: (input: string, context?: string) => string;
};

/** The JSX transformer also handles the plain-JS forms, so one `.tsx` id covers both. */
export const FILE_ID = 'playground.tsx';

/* ------------------------------------------------------------------- previews */

/**
 * Prefixed rather than carried as a bare commit, so a single `version` string can
 * name either a release or a preview, the select, the share fragment and the
 * runtime cache all keep working unchanged.
 */
const PREFIX = 'pr-';

/** pkg.pr.new keys its builds on the commit, abbreviated or in full. */
const COMMIT = /^[0-9a-f]{7,40}$/;

/** The commit a preview version names, or `null` if it names a release. */
export function previewCommit(version: string) {
  return version.startsWith(PREFIX) ? version.slice(PREFIX.length) : null;
}

/**
 * Reads the `?preview=<commit>` the pipeline links to from a pull request. The
 * commit is validated rather than trusted: it is interpolated into the URL the
 * playground then imports its runtime from.
 */
export function previewOption(search: string): VersionOption | null {
  const commit = new URLSearchParams(search).get('preview');
  if (!commit || !COMMIT.test(commit)) return null;

  return { value: `${PREFIX}${commit}`, label: `preview (${commit.slice(0, 7)})` };
}

/* -------------------------------------------------------------------- loading */

const runtimes = new Map<string, Promise<Runtime>>();

/** The repository pkg.pr.new publishes preview builds from. */
const REPOSITORY = 'k0d13/saykit';

/** esm.sh proxies pkg.pr.new under `/pr/`, so a preview loads like any other package. */
function moduleUrl(name: string, version: string, path = '') {
  const commit = previewCommit(version);
  return commit
    ? `https://esm.sh/pr/${REPOSITORY}/${name}@${commit}${path}`
    : `https://esm.sh/${name}@${version}${path}`;
}

type MessagesModule = { generateHash: Runtime['generateHash'] };

/**
 * The message IR moved out of `/features/messages` in 1.0.0. Previews and 1.x releases are
 * always current, but `0.0.0-beta-<timestamp>` snapshots sit on either side of the move, so those
 * try the current path and fall back to the old one.
 */
function loadMessages(version: string): Promise<MessagesModule> {
  const load = (path: string) =>
    import(
      /* webpackIgnore: true */ moduleUrl('@saykit/config', version, path)
    ) as Promise<MessagesModule>;

  if (previewCommit(version) || Number.parseInt(version, 10) >= 1) return load('/messages');
  if (!version.includes('-beta-')) return load('/features/messages');
  return load('/messages').catch(() => load('/features/messages'));
}

/**
 * The workspace packages depend on each other by caret range, and esm.sh cannot
 * resolve `^0.0.0-beta-<timestamp>`: the entry loads but its imports 404. Pinning
 * the siblings to the exact version being loaded sidesteps that, and is a no-op
 * for stable releases. A preview needs none of it: pkg.pr.new rewrites those ranges
 * to the sibling builds from the same commit before publishing.
 */
function transformerUrl(version: string) {
  const url = moduleUrl('@saykit/transform-jsx', version);
  if (previewCommit(version)) return url;

  const deps = [`@saykit/config@${version}`, `@saykit/transform-js@${version}`].join(',');
  return `${url}?deps=${deps}`;
}

export function loadRuntime(version: string): Promise<Runtime> {
  let pending = runtimes.get(version);

  if (!pending) {
    pending = Promise.all([
      import(/* webpackIgnore: true */ transformerUrl(version)) as Promise<{
        default: () => Transformer;
      }>,
      // Same version as the transformer, so a displayed id always matches what
      // that release would actually write into the catalogue
      loadMessages(version),
    ]).then(([transform, messages]) => {
      const transformer = transform.default();
      if (typeof transformer?.extract !== 'function' || typeof transformer.transform !== 'function')
        throw new Error(`@saykit/transform-jsx@${version} does not expose a usable transformer.`);
      return { transformer, generateHash: messages.generateHash };
    });

    // Don't cache a rejection, since a transient network failure should be
    // retryable
    // The identity check avoids evicting a newer attempt that already succeeded
    pending.catch(() => {
      if (runtimes.get(version) === pending) runtimes.delete(version);
    });
    runtimes.set(version, pending);
  }

  return pending;
}
