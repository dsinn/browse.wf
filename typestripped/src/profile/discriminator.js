/**
 Cross-platform player name discriminators (the "#123" shown after a name linked across platforms).

 Ported from upstream's platform-suffix.pluto (removed from this fork) so that the profile and platform suffix pages
 do not need to load the PlutoScript runtime (a WebAssembly build served from a third-party host) just to compute
 a CRC-32.
 */
import { buf as crc32 } from 'crc-32';
/**
 Indexed by platform id (PC, PlayStation, Xbox, Switch, iOS, Android)
 */
const MAGIC_NUMBERS = [753, 639, 247, 37, 60, 161];
const UINT32_RANGE = 2 ** 32;
/**
 Computes the discriminator for a name on a platform.
 Returns undefined for an unknown platform id, as the Pluto original errored there.
 */
export function getDiscriminator(name, platformId) {
    const magicNumber = MAGIC_NUMBERS[platformId];
    if (magicNumber === undefined) {
        return undefined;
    }
    // Matches Lua's string.lower(), which only lowercases ASCII letters
    const lowered = name.replaceAll(/[A-Z]/gu, character => character.toLowerCase());
    // The crc-32 package returns a signed 32-bit integer, while Pluto's crypto.crc32 is unsigned
    const signedChecksum = crc32(new TextEncoder().encode(lowered + '595'));
    const checksum = signedChecksum < 0 ? signedChecksum + UINT32_RANGE : signedChecksum;
    return (checksum + magicNumber) % 1000;
}
window.getDiscriminator = getDiscriminator;
//# sourceMappingURL=discriminator.js.map