import { createSelectSchema } from 'drizzle-orm/zod';
import { z } from 'zod';
import { movies, users } from './schema';

/**
 * Drizzle maps a `mode: 'json'` column to "anything at all", because JSON is
 * anything at all — `createSelectSchema(movies).shape.genres` happily accepts
 * `[1, 2, 3]`. Naming the element type here is a refinement of the derived
 * schema, not a second declaration of the column. See the change-schema skill.
 */
const stringArray = z.array(z.string());

const arrayColumns = {
  genres: stringArray,
  castMembers: stringArray,
  directors: stringArray,
  writers: stringArray,
  countries: stringArray,
  languages: stringArray,
};

/** A movie as the API returns it: every column except the 6 KiB vector. */
export const movieSchema = createSelectSchema(movies, arrayColumns).omit({
  plotEmbedding: true,
});

export type Movie = z.infer<typeof movieSchema>;

/** What a card in the list needs — the detail page fetches the rest. */
export const movieSummarySchema = movieSchema.pick({
  id: true,
  title: true,
  poster: true,
  genres: true,
  imdbRating: true,
  runtime: true,
  rated: true,
  plot: true,
});

export type MovieSummary = z.infer<typeof movieSummarySchema>;

export const movieSortSchema = z.enum(['title', 'rating']);

export type MovieSort = z.infer<typeof movieSortSchema>;

export const maxPageSize = 48;

/**
 * The list's query string. GET input arrives as strings, so numbers are
 * coerced; the `<number>` keeps the client's input typed as a number rather
 * than `unknown`. An out-of-range page size is a 400, not a silent clamp —
 * a caller asking for 10,000 rows has a bug worth hearing about.
 */
export const movieListInputSchema = z.object({
  page: z.coerce.number<number>().int().min(1).default(1),
  pageSize: z.coerce.number<number>().int().min(1).max(maxPageSize).default(24),
  q: z.string().trim().max(100).optional(),
  genre: z.string().trim().max(50).optional(),
  sort: movieSortSchema.default('title'),
});

export type MovieListInput = z.infer<typeof movieListInputSchema>;

/** One page, plus what a pager needs to draw itself without a second request. */
export const movieListSchema = z.object({
  items: z.array(movieSummarySchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

export type MovieList = z.infer<typeof movieListSchema>;

/** What a row looks like on the way in. Drizzle types the insert itself. */
export type MovieDraft = typeof movies.$inferInsert;

/**
 * A user as the API returns them.
 *
 * `.omit()` on the derived schema rather than a fresh `z.object`, which is what
 * makes the omission load-bearing: the password hash is excluded *because it is
 * named here*, so putting it back would be a deliberate edit to this line.
 * `apps/api/test/accounts.test.ts` fails if it ever reappears.
 */
export const userSchema = createSelectSchema(users).omit({ passwordHash: true });

export type User = z.infer<typeof userSchema>;

/**
 * Signing up. Note that `password` is not a column — the table stores
 * `passwordHash`, and the two must never be confused. Hence a derived pick of
 * the real columns, extended with the request-only one.
 */
export const signUpSchema = createSelectSchema(users, {
  /* Refinements on derived columns: `text()` alone would accept "" and a 100 KB
     display name, because the table does not care and the API must.

     The email is normalised here because this is the edge — `" Ada@EXAMPLE.com "`
     and `"ada@example.com"` are one person, and nothing downstream should have
     to know that. Trim and case come first, since the padded form is not a
     valid address. */
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  displayName: z.string().trim().min(1).max(60),
})
  .pick({ email: true, displayName: true })
  /* A length floor and nothing else. Real password rules are out of scope. */
  .extend({ password: z.string().min(8).max(200) });

/** Signing in needs the identifier and the secret, and nothing else. */
export const signInSchema = signUpSchema.pick({ email: true, password: true });

/**
 * What a successful sign-up or sign-in hands back: a token to present on later
 * requests, and who the caller now is.
 *
 * The token is not a column anywhere — sessions live in memory in the API
 * process, so this is one of the few shapes in the repo with nothing upstream
 * of it. See `apps/api/src/accounts.ts`.
 */
export const sessionSchema = z.object({
  token: z.string().min(1),
  user: userSchema,
});

export type Session = z.infer<typeof sessionSchema>;
