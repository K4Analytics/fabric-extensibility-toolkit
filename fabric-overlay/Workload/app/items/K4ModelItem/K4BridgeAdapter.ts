import {
  HostCommunication,
  HostMessageHandler,
  EmbedProperties,
  CheckDownloadFileStatus,
} from "@k4/bridge";
import { WorkloadClientAPI } from "@ms-fabric/workload-client";
import { K4AuthService } from "./K4AuthService";
import { K4ModelItemDefinition } from "./K4ModelItemDefinition";
import {
  saveItemDefinition,
} from "../../controller/ItemCRUDController";

/**
 * K4BridgeAdapter implements the @k4/bridge HostMessageHandler interface,
 * providing Fabric-context implementations for all methods that the K4 embed
 * can call via postMessage.
 *
 * This is the direct equivalent of the PBI visual class (visual.ts) — the K4
 * embed sees no difference between running inside Power BI or Fabric. It sends
 * the same messages and receives the same responses.
 *
 * Architecture:
 *   K4 Embed (iframe) ←→ @k4/bridge postMessage ←→ K4BridgeAdapter ←→ Fabric APIs
 *
 * NOTE: EmbedProperties.hostName is typed as "MSPOWERBI" | "QLIKSENSE" in the
 * current @k4/bridge. For the Fabric workload, the bridge types should be
 * updated to include "MSFABRIC". Until then, we use a type assertion.
 * Similarly, the license field should include "Fabric".
 */
export class K4BridgeAdapter implements HostMessageHandler {
  private communication: HostCommunication;
  private currentProperties: EmbedProperties | undefined;

  constructor(
    private readonly embedId: string,
    private readonly definition: K4ModelItemDefinition,
    private readonly authService: K4AuthService,
    private readonly workloadClient: WorkloadClientAPI,
    private readonly itemId: string,
    private readonly username: string
  ) {
    this.communication = new HostCommunication(embedId, this);
    this.buildProperties();
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────

  /**
   * Start the bridge communication.
   * Waits for the K4 embed iframe to send its "initialized" message,
   * then sends the initial properties.
   */
  async start(): Promise<{ publicUri: string }> {
    const config = await this.communication.start();
    // After embed reports ready, push the initial config
    if (this.currentProperties) {
      this.communication.setCurrentConfig(this.currentProperties);
    }
    return config;
  }

  /**
   * Stop listening for messages from the embed.
   */
  stop(): void {
    this.communication.stop();
  }

  /**
   * Update properties and push to the embed.
   */
  updateDefinition(definition: K4ModelItemDefinition): void {
    Object.assign(this.definition, definition);
    this.buildProperties();
    if (this.currentProperties) {
      this.communication.setCurrentConfig(this.currentProperties);
    }
  }

  // ─── HostMessageHandler Interface ───────────────────────────────────

  /**
   * Called by the K4 embed to get the current configuration.
   * Maps Fabric item metadata → EmbedProperties.
   */
  getProperties = (): EmbedProperties => {
    if (!this.currentProperties) {
      throw new Error("K4BridgeAdapter: properties not initialized");
    }
    return this.currentProperties;
  };

  /**
   * Called by the K4 embed to get an auth token.
   * Bridges Fabric Entra → K4 OBO.
   */
  getAccessToken = async (): Promise<{ type: string; token: string }> => {
    return this.authService.getAccessToken(
      this.definition.serverUrl!,
      this.definition.entraIdSsoEnabled ?? true,
      this.definition.username ?? this.username,
      this.definition.apiKey
    );
  };

  /**
   * Called by the K4 embed to persist the selected model name.
   * In PBI this used host.persistProperties; in Fabric we update the item definition.
   */
  setModelName = async (name: string): Promise<void> => {
    this.definition.modelId = name;
    this.buildProperties();

    try {
      await saveItemDefinition(
        this.workloadClient,
        this.itemId,
        this.definition
      );
    } catch (error) {
      console.error("K4BridgeAdapter: Failed to save model name", error);
    }
  };

  /**
   * Called by the K4 embed to download a file (e.g., Excel export).
   *
   * In PBI, this goes through the downloadService with base64 encoding.
   * In Fabric, we use a standard browser download via Blob URL.
   * Requires EnableSandboxRelaxation=true in WorkloadManifest.xml.
   */
  downloadFile = async (file: Blob, name: string): Promise<void> => {
    const url = URL.createObjectURL(file);
    try {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = name;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  /**
   * Called by the K4 embed to check if file downloads are supported.
   * In Fabric with sandbox relaxation enabled, we use "custom" mode
   * (same as the PBI visual returns).
   */
  checkDownloadFileStatus = async (): Promise<CheckDownloadFileStatus> => {
    return "custom";
  };

  /**
   * Called by the K4 embed to get a local storage value.
   * In PBI this uses storageV2Service; in Fabric we use browser localStorage
   * scoped by item ID.
   */
  getLocalStorageValue = async (key: string): Promise<string | null> => {
    try {
      return localStorage.getItem(this.scopedKey(key));
    } catch {
      return null;
    }
  };

  /**
   * Called by the K4 embed to set a local storage value.
   */
  setLocalStorageValue = async (key: string, value: string): Promise<void> => {
    try {
      localStorage.setItem(this.scopedKey(key), value);
    } catch {
      // Storage quota exceeded — non-fatal
    }
  };

  /**
   * Called by the K4 embed to clear a local storage value.
   */
  clearLocalStorageValue = async (key: string): Promise<void> => {
    try {
      localStorage.removeItem(this.scopedKey(key));
    } catch {
      // Non-fatal
    }
  };

  // ─── Private Helpers ────────────────────────────────────────────────

  /**
   * Build EmbedProperties from the current item definition.
   * This maps Fabric item metadata → the same interface the K4 embed expects.
   */
  private buildProperties(): void {
    // NOTE: hostName and license need type updates in @k4/bridge.
    // For now we use "MSPOWERBI" / "Power BI" as fallback to ensure compatibility.
    // TODO: Update @k4/bridge types to add "MSFABRIC" and "Fabric",
    //       then change these values.
    this.currentProperties = {
      modelName: this.definition.modelId ?? "",
      publicUri: this.definition.serverUrl ?? "",
      hostName: "MSPOWERBI" as EmbedProperties["hostName"],
      // ↑ Change to "MSFABRIC" after updating @k4/bridge types
      license: "Power BI" as EmbedProperties["license"],
      // ↑ Change to "Fabric" after updating @k4/bridge types
      authenticationType: this.definition.entraIdSsoEnabled
        ? "Bearer"
        : "Basic",
      username: this.definition.username ?? this.username ?? "",
      editMode: true, // Fabric item permissions control edit access
      debug: false,
      datasets: {}, // No PBI DataView in Fabric context
      filters: this.buildFilters(),
      hidden: this.definition.showCondition === "off",
      loadMessage: this.definition.loadMessage,
      dynamicRows: this.definition.dynamicRows,
    };
  }

  /**
   * Build filters from the definition's context property.
   * Simplified version of visual.ts k4_getFilters — we only handle the
   * static context string since there's no PBI DataView in Fabric.
   */
  private buildFilters(): Record<string, string> {
    const filters: Record<string, string[]> = {};

    if (this.definition.context) {
      try {
        const parts = this.definition.context.split(";");
        for (const part of parts) {
          const [name, values] = part.split(":");
          if (name && values) {
            if (!(name in filters)) filters[name] = [];
            for (const v of values.split(",").map((s) => s.trim())) {
              if (!filters[name].includes(v)) {
                filters[name].push(v);
              }
            }
          }
        }
      } catch {
        // Malformed context string — non-fatal
      }
    }

    const result: Record<string, string> = {};
    for (const key in filters) {
      const joined = filters[key]
        .filter((v) => v.trim().length > 0)
        .join(",");
      if (joined.length > 0) {
        result[key] = joined;
      }
    }
    return result;
  }

  /**
   * Scope localStorage keys by item ID to avoid collisions.
   */
  private scopedKey(key: string): string {
    return `k4.fabric.${this.itemId}.${key}`;
  }
}
