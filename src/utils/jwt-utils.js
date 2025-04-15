// src/utils/jwt-utils.js
/**
 * Decodes a JWT token without validation
 * @param {string} token - The JWT token to decode
 * @returns {Object|null} The decoded token payload or null if invalid
 */
export function decodeJwt(token) {
    try {
        // JWT tokens consist of three parts: header.payload.signature
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        // Decode the payload (middle part)
        const payload = JSON.parse(atob(parts[1]));
        return payload;
    } catch (error) {
        console.error('Error decoding JWT:', error);
        return null;
    }
}

/**
 * Gets remaining time in milliseconds until token expiration
 * @param {Object} decodedToken - The decoded JWT token
 * @returns {number} Milliseconds until expiration, 0 if expired or invalid
 */
export function getTokenRemainingTime(decodedToken) {
    if (!decodedToken || !decodedToken.exp) return 0;

    // exp is in seconds, convert to milliseconds
    const expirationTime = decodedToken.exp * 1000;
    const currentTime = Date.now();

    return Math.max(0, expirationTime - currentTime);
}

/**
 * Extracts a JWT token from cookies
 * @returns {string|null} The JWT token or null if not found
 */
export function getJwtFromCookies() {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'jwt') {
            return value;
        }
    }
    return null;
}
