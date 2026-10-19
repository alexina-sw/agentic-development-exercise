import { and, asc, count, desc, eq, isNotNull, sql, type SQL } from 'drizzle-orm';
import { movies, type Movie, type MovieListInput, type MovieSummary } from '@app/contract';
import type { Db } from './db';

/**
 * Data access for the `movies` table. Everything here goes through Drizzle's
 * query builder rather than a SQL string, so a column rename in `schema.ts`
 * becomes a type error here instead of a runtime one.
 */

/**
 * Who is asking, or `undefined` for a signed-out caller.
 *
 * Reads take it because some facts about a film — whether *you* have favourited
 * it — are facts about the pair, not about the film. Nothing on `main` uses it
 * yet; exercise 2 is what gives it meaning.
 */
export type Viewer = number | undefined;

/**
 * Every column except the vector, named one by one because Drizzle has no
 * "all columns but this one" helper. `plot_embedding` is 6 KiB a row and is
 * never sent to a browser, so it is not read in the first place.
 *
 * This list cannot silently drift: anything annotated as returning `Movie` —
 * a type derived from the table — stops compiling if a column added to
 * `schema.ts` is left out here.
 */
export const movieColumns = {
  id: movies.id,
  imdbId: movies.imdbId,
  title: movies.title,
  type: movies.type,
  plot: movies.plot,
  fullplot: movies.fullplot,
  poster: movies.poster,
  rated: movies.rated,
  runtime: movies.runtime,
  genres: movies.genres,
  castMembers: movies.castMembers,
  directors: movies.directors,
  writers: movies.writers,
  countries: movies.countries,
  languages: movies.languages,
  imdbRating: movies.imdbRating,
  imdbVotes: movies.imdbVotes,
  metacritic: movies.metacritic,
  awardsWins: movies.awardsWins,
  awardsNominations: movies.awardsNominations,
  awardsText: movies.awardsText,
  numMflixComments: movies.numMflixComments,
  ingestedAt: movies.ingestedAt,
};

/**
 * `COUNT(*)` always produces exactly one row, but `noUncheckedIndexedAccess`
 * does not know that, so the impossible case gets a message rather than a `!`.
 */
function firstCount(rows: readonly { value: number }[]): number {
  const [row] = rows;
  if (row === undefined) {
    throw new Error(`Expected COUNT(*) to return one row, got ${String(rows.length)}`);
  }
  return row.value;
}

/**
 * Counted in SQLite. Reading the rows and taking `.length` would pull every
 * movie — including its 6 KiB vector — across the driver to learn one number.
 */
export function countMovies(db: Db): number {
  return firstCount(db.select({ value: count() }).from(movies).all());
}

/** How much of the table exercise 3 can actually use: 28 dataset rows ship without a vector. */
export function countMoviesWithEmbedding(db: Db): number {
  return firstCount(
    db.select({ value: count() }).from(movies).where(isNotNull(movies.plotEmbedding)).all(),
  );
}

/** The columns a list card needs, typed against `MovieSummary` so they cannot drift. */
const movieSummaryColumns = {
  id: movies.id,
  title: movies.title,
  poster: movies.poster,
  genres: movies.genres,
  imdbRating: movies.imdbRating,
  runtime: movies.runtime,
  rated: movies.rated,
  plot: movies.plot,
};

/** `%` and `_` in a search are letters the user typed, not wildcards. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/**
 * The search and genre filter as one `WHERE`, shared by the page query and its
 * count so the two can never disagree about which films match.
 */
function listFilter({ q, genre }: Pick<MovieListInput, 'q' | 'genre'>): SQL | undefined {
  const conditions: SQL[] = [];

  /* SQLite's LIKE is case-insensitive for ASCII, which is what "alien"
     finding "Alien" needs. */
  if (q !== undefined && q !== '') {
    conditions.push(sql`${movies.title} like ${`%${escapeLike(q)}%`} escape '\\'`);
  }

  /* `genres` is a JSON array, so membership is a lookup in `json_each` rather
     than a LIKE that would let "Drama" match "Docudrama". */
  if (genre !== undefined && genre !== '') {
    conditions.push(
      sql`exists (select 1 from json_each(${movies.genres}) where json_each.value = ${genre})`,
    );
  }

  return and(...conditions);
}

/**
 * Ordering ends on `id` so that films with equal ratings or titles keep a fixed
 * order — otherwise one could appear on both page 1 and page 2. Unrated films
 * go last rather than first, which is where SQLite puts NULLs in a DESC sort.
 */
function listOrder(sort: MovieListInput['sort']): SQL[] {
  if (sort === 'rating') {
    return [sql`${movies.imdbRating} is null`, desc(movies.imdbRating), asc(movies.id)];
  }

  return [sql`${movies.title} collate nocase`, asc(movies.id)];
}

export function listMovies(
  db: Db,
  input: MovieListInput,
): { items: MovieSummary[]; total: number } {
  const where = listFilter(input);

  const total = firstCount(db.select({ value: count() }).from(movies).where(where).all());

  const items = db
    .select(movieSummaryColumns)
    .from(movies)
    .where(where)
    .orderBy(...listOrder(input.sort))
    .limit(input.pageSize)
    .offset((input.page - 1) * input.pageSize)
    .all();

  return { items, total };
}

/** `undefined` for an unknown id; the handler decides that it is a 404. */
export function findMovie(db: Db, id: number): Movie | undefined {
  return db.select(movieColumns).from(movies).where(eq(movies.id, id)).get();
}

/** Every distinct genre across the catalogue, alphabetically. */
export function listGenres(db: Db): string[] {
  const rows = db.all<{ genre: string }>(
    sql`select distinct json_each.value as genre from ${movies}, json_each(${movies.genres}) order by genre`,
  );

  return rows.map((row) => row.genre);
}
