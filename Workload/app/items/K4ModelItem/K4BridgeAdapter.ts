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

export class K4BridgeAdapter implements HostMessageHandler {
  private communication: HostCommunication;
  private currentProperties: EmbedProperties | undefined;

  constructor(
    embedId: string,
    private readonly definition: K4ModelItemDefinition,
    private readonly authService: K4AuthService,
    private readonly workloadClient: WorkloadClientAPI,
    private readonly itemId: string,
    private readonly username: string
  ) {
    this.communication = new HostCommunication(embedId, this);
    this.buildProperties();
  }

  async start(): Promise<{ publicUri: string }> {
    const config = await this.communication.start();
    if (this.currentProperties) {
      this.communication.setCurrentConfig(this.currentProperties);
    }
    return config;
  }

  stop(): void {
    this.communication.stop();
  }

  updateDefinition(definition: K4ModelItemDefinition): void {
    Object.assign(this.definition, definition);
    this.buildProperties();
    if (this.currentProperties) {
      this.communication.setCurrentConfig(this.currentProperties);
    }
  }

  getProperties = (): EmbedProperties => {
    if (!this.currentProperties) {
      throw new Error("K4BridgeAdapter: properties not initialized");
    }
    return this.currentProperties;
  };

  getAccessToken = async (): Promise<{ type: string; token: string }> => {
    return this.authService.getAccessToken(
      this.definition.serverUrl!,
      this.definition.entraIdSsoEnabled ?? true,
      this.definition.username ?? this.username,
      this.definition.apiKey
    );
  };

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

  checkDownloadFileStatus = async (): Promise<CheckDownloadFileStatus> => {
    return "custom";
  };

  getLocalStorageValue = async (key: string): Promise<string | null> => {
    try {
      return localStorage.getItem(this.scopedKey(key));
    } catch {
      return null;
    }
  };

  setLocalStorageValue = async (key: string, value: string): Promise<void> => {
    try {
      localStorage.setItem(this.scopedKey(key), value);
    } catch {
      // Storage quota exceeded
    }
  };

  clearLocalStorageValue = async (key: string): Promise<void> => {
    try {
      localStorage.removeItem(this.scopedKey(key));
    } catch {
      // Non-fatal
    }
  };

  private buildProperties(): void {
    this.currentProperties = {
      modelName: this.definition.modelId ?? "",
      publicUri: this.definition.serverUrl ?? "",
      hostName: "MSPOWERBI" as EmbedProperties["hostName"],
      license: "Power BI" as EmbedProperties["license"],
      authenticationType: this.definition.entraIdSsoEnabled
        ? "Bearer"
        : "Basic",
      username: this.definition.username ?? this.username ?? "",
      editMode: true,
      debug: false,
      datasets: {},
      filters: this.buildFilters(),
      hidden: this.definition.showCondition === "off",
      loadMessage: this.definition.loadMessage,
      dynamicRows: this.definition.dynamicRows,
    };
  }

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
        // Malformed context string
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

  private scopedKey(key: string): string {
    return `k4.fabric.${this.itemId}.${key}`;
  }
}
