/** Moving one item of a list to another place, by drag or by key. */

/** The index an item dropped at `y` takes among the rest, given their middles from top to bottom. */
export const dropIndex = (middles: ReadonlyArray<number>, y: number): number =>
  middles.filter((middle) => middle < y).length

/** `order` with `item` taken out and put back at `index`. */
export const moved = <T>(order: ReadonlyArray<T>, item: T, index: number): Array<T> => {
  const rest = order.filter((other) => other !== item)
  return [...rest.slice(0, index), item, ...rest.slice(index)]
}
