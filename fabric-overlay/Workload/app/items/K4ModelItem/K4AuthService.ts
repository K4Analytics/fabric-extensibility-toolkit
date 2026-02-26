import { WorkloadClientAPI } from "@ms-fabric/workload-client";

/**
 * K4AuthService bridges Fabric's Entra ID authentication to K4's OBO token flow.
 *
 * Flow:
 *   1. Fabric host provides an Entra ID token via workloadClient.auth
 *   2. We send that token to K4 server's /obotoken endpoint
 *   3. K4 server exchanges it for a K4-scoped access token
 *   4. The K4 embed uses this token for all API calls
 *
 * This is the same flow as the PBI visual (visual.ts lines 477-520),
 * just with Fabric as the token source instead of Power BI.
 */
export class K4AuthService {
  private currentEntraToken: string | undefined;
  private currentOboToken: string | undefined;
  private currentUsername: string | undefined;

  constructor(private readonly workloadClient: WorkloadClientAPI) {}

  /**
   * Get an access token for the K4 embed.
   * Handles both Entra ID SSO and Basic auth modes.
   */
  async getAccessToken(
    serverUrl: string,
    entraIdEnabled: boolean,
    username?: string,
    apiKey?: string
  ): Promise<{ type: string; token: string }> {
    if (!entraIdEnabled) {
      return {
        type: "Basic",
        token: btoa(`${username ?? ""}:${apiKey ?? ""}`),
      };
    }

    // Acquire Entra token from Fabric host
    const accessTokenResult =
      await this.workloadClient.auth.acquireFrontendAccessToken({
        // Request token for K4's Entra app scope
        additionalScopesToConsent: ["https://k4analytics.cloud/.default"],
      });

    if (!accessTokenResult?.token) {
      throw new Error("Could not acquire Entra token from Fabric host.");
    }

    // If Entra token hasn't changed and OBO token is still valid, reuse it
    if (
      this.currentEntraToken === accessTokenResult.token &&
      this.currentOboToken &&
      this.isTokenValid(this.currentOboToken)
    ) {
      return { type: "Bearer", token: this.currentOboToken };
    }

    // Exchange Entra token for K4 OBO token
    this.currentEntraToken = accessTokenResult.token;
    const oboToken = await this.fetchOnBehalfOf(
      accessTokenResult.token,
      serverUrl
    );
    this.currentOboToken = oboToken;

    return { type: "Bearer", token: this.currentOboToken };
  }

  /**
   * Extract the username from the current OBO token.
   * Called after initial auth to populate EmbedProperties.username.
   */
  getUsername(): string | undefined {
    return this.currentUsername;
  }

  /**
   * Initialize the auth service and extract the username.
   * Should be called once when the item editor mounts.
   */
  async initialize(serverUrl: string): Promise<string | undefined> {
    try {
      const tokenResult = await this.getAccessToken(serverUrl, true);
      if (tokenResult.token && tokenResult.type === "Bearer") {
        const claims = this.extractTokenClaims(tokenResult.token);
        this.currentUsername =
          claims.upn ?? claims.preferred_username ?? claims.email;
      }
    } catch (error) {
      console.error("K4AuthService: Error during initialization", error);
    }
    return this.currentUsername;
  }

  /**
   * Exchange a Fabric/Entra token for a K4 OBO token.
   * Same as visual.ts fetchOnBehalfOf (lines 522-547).
   */
  private async fetchOnBehalfOf(
    entraToken: string,
    serverUrl: string
  ): Promise<string> {
    const response = await fetch(`${serverUrl}/obotoken`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${entraToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to acquire K4 OBO token: ${response.status} ${response.statusText}`
      );
    }

    const result = (await response.json()) as {
      accessToken: string | undefined;
    };
    if (!result.accessToken) {
      throw new Error("OBO response does not contain accessToken.");
    }

    // Extract username from the OBO token
    try {
      const claims = this.extractTokenClaims(result.accessToken);
      this.currentUsername =
        claims.upn ?? claims.preferred_username ?? claims.email;
    } catch {
      // Non-fatal — username extraction is best-effort
    }

    return result.accessToken;
  }

  /**
   * Decode JWT claims. Same as visual.ts extractTokenClaims (lines 549-572).
   */
  private extractTokenClaims(token: string): TokenClaims {
    const tokenPartsRegex = /^([^.\s]*)\.([^.\s]+)\.([^.\s]*)$/;
    const matches = tokenPartsRegex.exec(token);
    if (!matches || matches.length < 4) {
      throw new Error("Invalid JWT token format");
    }
    let encoded = matches[2].replace(/-/g, "+").replace(/_/g, "/");
    switch (encoded.length % 4) {
      case 0:
        break;
      case 2:
        encoded += "==";
        break;
      case 3:
        encoded += "=";
        break;
      default:
        throw new Error("Invalid base64 string");
    }
    const decoded = new TextDecoder().decode(
      Uint8Array.from(atob(encoded), (c) => c.codePointAt(0) || 0)
    );
    return JSON.parse(decoded) as TokenClaims;
  }

  /**
   * Check if a JWT token is still valid (not expired).
   * Same as visual.ts isTokenValid (lines 574-588).
   */
  private isTokenValid(token: string): boolean {
    try {
      const claims = this.extractTokenClaims(token);
      const now = Math.floor(Date.now() / 1000);
      return claims.nbf <= now && claims.exp > now + 60;
    } catch {
      return false;
    }
  }
}

interface TokenClaims {
  iat: number;
  nbf: number;
  exp: number;
  upn?: string;
  preferred_username?: string;
  email?: string;
}
