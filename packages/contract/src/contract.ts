import { oc } from '@orpc/contract';
import { z } from 'zod';
import {
  movieListInputSchema,
  movieListSchema,
  movieSchema,
  sessionSchema,
  signInSchema,
  signUpSchema,
  userSchema,
} from './zod';

/**
 * The HTTP surface, built from the Zod schemas which were themselves built
 * from the table. This is the last derived artefact: the API handlers and the
 * browser client are both typed by it.
 *
 * Paths here are relative — the Express app mounts the whole contract under
 * `/api`, so `/stats` is served at `/api/stats`.
 *
 * None of the movie outputs can carry `plot_embedding`: they are all built
 * from `movieSchema`, which omits it.
 */
export const contract = {
  health: oc
    .route({ method: 'GET', path: '/health' })
    .output(z.object({ status: z.literal('ok'), database: z.boolean() })),

  stats: oc.route({ method: 'GET', path: '/stats' }).output(
    z.object({
      movieCount: z.number().int(),
      moviesWithEmbedding: z.number().int(),
      /* False on a fresh clone, which is what makes the web app show the
         "run npm run ingest" empty state rather than an empty grid. */
      isIngested: z.boolean(),
    }),
  ),

  movies: {
    list: oc
      .route({ method: 'GET', path: '/movies' })
      .input(movieListInputSchema)
      .output(movieListSchema),

    get: oc
      .route({ method: 'GET', path: '/movies/{id}' })
      .input(z.object({ id: z.coerce.number<number>().int().positive() }))
      .output(movieSchema)
      /* An unknown id is an expected outcome of a shared link, so it is a
         declared 404 the page can render as "no such film" — not a 500. */
      .errors({ NOT_FOUND: {} }),

    /* Every genre that appears on at least one film, for the filter control. */
    genres: oc.route({ method: 'GET', path: '/genres' }).output(z.array(z.string())),
  },

  /**
   * Accounts. These are already built, so that Exercise 2 is about favourites
   * rather than about re-deriving a sign-up form. None of them can return a
   * password hash: every output is built from `userSchema`, which omits it.
   */
  auth: {
    signUp: oc
      .route({ method: 'POST', path: '/auth/sign-up' })
      .input(signUpSchema)
      .output(sessionSchema)
      /* A taken address is an expected outcome of a sign-up form, so it is a
         declared 409 the browser can show against the field — not a 500. */
      .errors({ CONFLICT: {} }),

    signIn: oc
      .route({ method: 'POST', path: '/auth/sign-in' })
      .input(signInSchema)
      .output(sessionSchema)
      /* One error for "no such email" and "wrong password" together, on
         purpose: telling them apart tells a stranger which addresses exist. */
      .errors({ UNAUTHORIZED: {} }),

    me: oc
      .route({ method: 'GET', path: '/auth/me' })
      .output(userSchema)
      /* Presenting nothing, and presenting junk, are the same answer. */
      .errors({ UNAUTHORIZED: {} }),

    signOut: oc
      .route({ method: 'POST', path: '/auth/sign-out' })
      /* Succeeds even when the caller was not signed in: signing out asks for a
         state, not a transition, and the state is reached either way. */
      .output(z.object({ signedOut: z.literal(true) })),
  },
};
