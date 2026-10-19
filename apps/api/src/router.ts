import { implement } from '@orpc/server';
import { contract, type User } from '@app/contract';
import {
  authenticate,
  createSession,
  createUser,
  deleteSession,
  findUserByToken,
  isEmailTaken,
} from './accounts';
import type { Db } from './db';
import { countMovies, countMoviesWithEmbedding, findMovie, listGenres, listMovies } from './movies';

/**
 * What every handler gets besides its input: the bearer token the caller
 * presented, if any. `app.ts` reads it off the request, so nothing below this
 * line touches an HTTP header — which is what keeps handlers testable.
 */
export interface RequestContext {
  token: string | undefined;
}

const os = implement(contract).$context<RequestContext>();

/**
 * A process that is up but cannot read its own SQLite file is not healthy, so
 * the probe runs a real query against a real table — which also proves the
 * migrations were applied.
 *
 * This is the one place the project's "fail loudly" rule inverts: reporting
 * `database: false` is exactly the loud failure this endpoint exists for, and
 * a health check that 500s tells a monitor less than one that answers.
 */
function isDatabaseReachable(db: Db): boolean {
  try {
    countMovies(db);
    return true;
  } catch {
    return false;
  }
}

/**
 * The implementation of the contract. Argument and return types are checked
 * against it, and its Zod schemas validate inputs before a handler runs, so
 * nothing here re-declares a shape. Handlers stay thin: the queries live in
 * `movies.ts` and `accounts.ts`.
 */
export function createRouter(db: Db) {
  /** Who is asking. No token, a stale one and junk are all the same answer. */
  const viewerOf = (context: RequestContext): User | undefined =>
    findUserByToken(db, context.token);

  return os.router({
    health: os.health.handler(() => ({
      /* `as const` keeps the literal the contract's `z.literal('ok')` wants;
         without it the inferred return type widens to `string`. */
      status: 'ok' as const,
      database: isDatabaseReachable(db),
    })),

    stats: os.stats.handler(() => {
      const movieCount = countMovies(db);

      return {
        movieCount,
        moviesWithEmbedding: countMoviesWithEmbedding(db),
        isIngested: movieCount > 0,
      };
    }),

    movies: {
      list: os.movies.list.handler(({ input }) => {
        const { items, total } = listMovies(db, input);

        return {
          items,
          page: input.page,
          pageSize: input.pageSize,
          total,
          /* At least one page even when nothing matches, so a pager never
             has to draw "page 1 of 0". */
          totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
        };
      }),

      get: os.movies.get.handler(({ input, errors }) => {
        const movie = findMovie(db, input.id);

        if (movie === undefined) {
          throw errors.NOT_FOUND({ message: `There is no film with id ${String(input.id)}.` });
        }

        return movie;
      }),

      genres: os.movies.genres.handler(() => listGenres(db)),
    },

    auth: {
      signUp: os.auth.signUp.handler(({ input, errors }) => {
        if (isEmailTaken(db, input.email)) {
          /* Declared in the contract, so the browser can render it against the
             email field instead of showing "something went wrong". */
          throw errors.CONFLICT({ message: 'That email address is already registered.' });
        }

        /* Signed in immediately: making someone sign up and then sign in again
           is asking them to fill in a form they have just filled in. */
        return createSession(createUser(db, input));
      }),

      signIn: os.auth.signIn.handler(({ input, errors }) => {
        const user = authenticate(db, input.email, input.password);

        if (user === undefined) {
          throw errors.UNAUTHORIZED({ message: 'That email and password do not match.' });
        }

        return createSession(user);
      }),

      me: os.auth.me.handler(({ context, errors }) => {
        const user = viewerOf(context);

        if (user === undefined) {
          throw errors.UNAUTHORIZED();
        }

        return user;
      }),

      signOut: os.auth.signOut.handler(({ context }) => {
        deleteSession(context.token);

        return { signedOut: true as const };
      }),
    },
  });
}
