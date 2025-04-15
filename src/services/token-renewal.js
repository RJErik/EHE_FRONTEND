// src/services/token-renewal.js
/**
 * Service to handle periodic JWT token renewal for HttpOnly cookies
 */
class TokenRenewalService {
    constructor() {
        this.renewalInterval = null;
        this.renewalPeriodMs = 780000; // Renew every 3 minutes (180,000 ms)
        this.maxRetries = 3;
        this.retryCount = 0;
        this.isRenewing = false;
    }

    /**
     * Starts periodic token renewal
     */
    startTokenRenewal() {
        if (this.renewalInterval) {
            this.stopTokenRenewal();
        }

        // Set up the interval for periodic renewal
        this.renewalInterval = setInterval(() => {
            this.renewToken();
        }, this.renewalPeriodMs);

        console.log('Token renewal started - will renew every 3 minutes');
    }

    /**
     * Stops periodic token renewal
     */
    stopTokenRenewal() {
        if (this.renewalInterval) {
            clearInterval(this.renewalInterval);
            this.renewalInterval = null;
            console.log('Token renewal stopped');
        }
    }

    /**
     * Makes request to renew the token
     */
    async renewToken() {
        if (this.isRenewing) {
            return; // Prevent concurrent renewal requests
        }

        this.isRenewing = true;

        try {
            const response = await fetch('http://localhost:8080/api/user/renew-token', {
                method: 'POST',
                credentials: 'include', // Include cookies in request
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Token renewal failed: ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                console.log('Token renewed successfully');
                this.retryCount = 0; // Reset retry count on success
            } else {
                console.error('Token renewal returned error:', data.message);
                this.handleRenewalError(new Error(data.message));
            }
        } catch (error) {
            this.handleRenewalError(error);
        } finally {
            this.isRenewing = false;
        }
    }

    /**
     * Handles token renewal errors with retry logic
     */
    handleRenewalError(error) {
        console.error('Token renewal error:', error);

        if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            const retryDelay = Math.pow(2, this.retryCount) * 1000; // Exponential backoff

            console.log(`Retrying token renewal in ${retryDelay / 1000}s (attempt ${this.retryCount}/${this.maxRetries})`);

            setTimeout(() => {
                this.renewToken();
            }, retryDelay);
        } else {
            console.error(`Token renewal failed after ${this.maxRetries} attempts`);
            // Force logout after max retries
            window.location.href = 'http://localhost:5173';
        }
    }
}

// Export a singleton instance
const tokenRenewalService = new TokenRenewalService();
export default tokenRenewalService;
