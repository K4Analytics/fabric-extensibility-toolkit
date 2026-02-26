import { WorkloadClientAPI } from "@ms-fabric/workload-client";

// Error code 3 = InteractionRequired from Fabric auth SDK
const INTERACTION_REQUIRED = 3;

export class K4AuthService {
  private currentEntraToken: string | undefined;
  private currentOboToken: string | undefined;
  private currentUsername: string | undefined;

  constructor(private readonly workloadClient: WorkloadClientAPI) {}

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

    let accessTokenResult: { token: string } | undefined;

    try {
      // Try silent acquisition first
      accessTokenResult =
        await this.workloadClient.auth.acquireFrontendAccessToken({
          scopes: ["https://k4analytics.cloud/.default"],
        });
    } catch (error: any) {
      // InteractionRequired — fall back to interactive popup
      if (error?.error === INTERACTION_REQUIRED || error === INTERACTION_REQUIRED) {
        console.log("K4AuthService: Silent auth failed, trying interactive popup...");
        try {
          accessTokenResult =
            await (this.workloadClient.auth as any).acquireFrontendAccessTokenInteractive?.({
              scopes: ["https://k4analytics.cloud/.default"],
            });
        } catch (interactiveError) {
          console.error("K4AuthService: Interactive auth also failed", interactiveError);
          throw new Error("Authentication failed. Please ensure you have consented to K4 Analytics permissions.");
        }
      } else {
        throw error;
      }
    }

    if (!accessTokenResult?.token) {
      throw new Error("Could not acquire Entra token from Fabric host.");
    }

    if (
      this.currentEntraToken === accessTokenResult.token &&
      this.currentOboToken &&
      this.isTokenValid(this.currentOboToken)
    ) {
      return { type: "Bearer", token: this.currentOboToken };
    }

    this.currentEntraToken = accessTokenResult.token;
    const oboToken = await this.fetchOnBehalfOf(
      accessTokenResult.token,
      serverUrl
    );
    this.currentOboToken = oboToken;

    return { type: "Bearer", token: this.currentOboToken };
  }

  getUsername(): string | undefined {
    return this.currentUsername;
  }

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

    try {
      const claims = this.extractTokenClaims(result.accessToken);
      this.currentUsername =
        claims.upn ?? claims.preferred_username ?? claims.email;
    } catch {
      // Non-fatal
    }

    return result.accessToken;
  }

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
