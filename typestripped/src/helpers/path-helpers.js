/**
 Returns the last `/`-separated segment of an internal path, or the whole path if that segment is empty.
 */
export function lastPathSegment(path) {
    return path.split('/').pop() || path;
}
/**
 Normalizes a `/Lotus/StoreItems/...` key to the `/Lotus/...` form used by the item's type path.
 */
export function normalizeStoreItemPath(path) {
    return path.replace('/Lotus/StoreItems/', '/Lotus/');
}
//# sourceMappingURL=path-helpers.js.map