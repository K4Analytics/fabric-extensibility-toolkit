import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Input,
  Switch,
  Button,
  Field,
  Title2,
  Body1,
} from "@fluentui/react-components";
import { Save24Regular, Dismiss24Regular } from "@fluentui/react-icons";
import { WorkloadClientAPI } from "@ms-fabric/workload-client";
import { ItemWithDefinition, saveWorkloadItem } from "../../controller/ItemCRUDController";
import { K4ModelItemDefinition } from "./K4ModelItemDefinition";
import "./K4ModelItem.scss";

interface K4ModelItemSettingsProps {
  item: ItemWithDefinition<K4ModelItemDefinition> | undefined;
  definition: K4ModelItemDefinition;
  workloadClient: WorkloadClientAPI;
  onSave: (updated: K4ModelItemDefinition) => void;
  onCancel: () => void;
}

export function K4ModelItemSettings({
  item,
  definition,
  workloadClient,
  onSave,
  onCancel,
}: K4ModelItemSettingsProps) {
  const { t } = useTranslation();
  const [serverUrl, setServerUrl] = useState(definition.serverUrl ?? "");
  const [modelId, setModelId] = useState(definition.modelId ?? "");
  const [entraIdSso, setEntraIdSso] = useState(definition.entraIdSsoEnabled ?? true);
  const [apiKey, setApiKey] = useState(definition.apiKey ?? "");
  const [username, setUsername] = useState(definition.username ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const isValid = serverUrl.trim().length > 0 && modelId.trim().length > 0;

  const handleSave = async () => {
    if (!item || !isValid) return;
    setIsSaving(true);
    try {
      const cleanUrl = serverUrl.trim().endsWith("/")
        ? serverUrl.trim().slice(0, -1)
        : serverUrl.trim();

      const updated: K4ModelItemDefinition = {
        ...definition,
        serverUrl: cleanUrl,
        modelId: modelId.trim(),
        entraIdSsoEnabled: entraIdSso,
        apiKey: entraIdSso ? undefined : apiKey,
        username: entraIdSso ? undefined : username,
      };

      item.definition = updated;
      await saveWorkloadItem<K4ModelItemDefinition>(workloadClient, item);
      onSave(updated);
    } catch (err) {
      console.error("K4Settings: Failed to save", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="k4-settings-container">
      <div className="k4-settings-header">
        <Title2>{t("K4_Settings_Title", "Connection Settings")}</Title2>
        <Body1>
          {t("K4_Settings_Description", "Update your K4 server connection for this item.")}
        </Body1>
      </div>

      <div className="k4-setup-form">
        <Field
          label={t("K4_Label_Server", "Server URL")}
          required
          validationMessage={
            serverUrl && !serverUrl.startsWith("http")
              ? t("K4_Validation_Url", "URL must start with https://")
              : undefined
          }
        >
          <Input
            value={serverUrl}
            onChange={(_, data) => setServerUrl(data.value)}
            placeholder="https://your-company.k4analytics.cloud"
          />
        </Field>

        <Field label={t("K4_Label_Model", "Model ID")} required>
          <Input
            value={modelId}
            onChange={(_, data) => setModelId(data.value)}
            placeholder="e.g. MyPlanningModel"
          />
        </Field>

        <Field label={t("K4_Label_EntraId", "Entra ID Single Sign-On")}>
          <Switch
            checked={entraIdSso}
            onChange={(_, data) => setEntraIdSso(data.checked)}
            label={
              entraIdSso
                ? t("K4_EntraId_On", "Enabled — users authenticate via Microsoft Entra ID")
                : t("K4_EntraId_Off", "Disabled — use API key authentication")
            }
          />
        </Field>

        {!entraIdSso && (
          <>
            <Field label={t("K4_Label_ApiKey", "API Key")}>
              <Input
                type="password"
                value={apiKey}
                onChange={(_, data) => setApiKey(data.value)}
                placeholder="Enter K4 API key"
              />
            </Field>
            <Field label={t("K4_Label_Username", "Username")}>
              <Input
                value={username}
                onChange={(_, data) => setUsername(data.value)}
                placeholder="K4 username"
              />
            </Field>
          </>
        )}

        <div className="k4-settings-actions">
          <Button
            appearance="primary"
            disabled={!isValid || isSaving}
            onClick={handleSave}
            icon={<Save24Regular />}
          >
            {isSaving
              ? t("K4_Settings_Saving", "Saving...")
              : t("K4_Settings_Save", "Save & reconnect")}
          </Button>
          <Button
            appearance="secondary"
            onClick={onCancel}
            icon={<Dismiss24Regular />}
          >
            {t("K4_Settings_Cancel", "Cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
}
