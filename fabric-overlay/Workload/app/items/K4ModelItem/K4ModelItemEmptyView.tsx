import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Input,
  Label,
  Switch,
  Button,
  Field,
} from "@fluentui/react-components";
import {
  PlugConnected20Regular,
} from "@fluentui/react-icons";
import {
  ItemEditorEmptyView,
  EmptyStateTask,
} from "../../components/ItemEditor";
import { K4ModelItemDefinition } from "./K4ModelItemDefinition";
import "./K4ModelItem.scss";

interface K4ModelItemEmptyViewProps {
  definition: K4ModelItemDefinition;
  onDefinitionChange: (definition: K4ModelItemDefinition) => void;
}

/**
 * K4ModelItemEmptyView — the setup wizard shown when a new K4 Model item
 * is created and no server/model configuration exists yet.
 *
 * Collects the minimum required settings:
 *   - Server URL (the K4 server endpoint)
 *   - Model ID (the K4 model to open)
 *   - Entra ID SSO toggle
 *   - Optional: API Key and Username (for non-SSO auth)
 */
export function K4ModelItemEmptyView({
  definition,
  onDefinitionChange,
}: K4ModelItemEmptyViewProps) {
  const { t } = useTranslation();
  const [serverUrl, setServerUrl] = useState(definition.serverUrl ?? "");
  const [modelId, setModelId] = useState(definition.modelId ?? "");
  const [entraIdSso, setEntraIdSso] = useState(
    definition.entraIdSsoEnabled ?? true
  );
  const [apiKey, setApiKey] = useState(definition.apiKey ?? "");
  const [username, setUsername] = useState(definition.username ?? "");

  const isValid = serverUrl.trim().length > 0 && modelId.trim().length > 0;

  const handleConnect = () => {
    const cleanUrl = serverUrl.endsWith("/")
      ? serverUrl.slice(0, -1)
      : serverUrl;

    onDefinitionChange({
      ...definition,
      serverUrl: cleanUrl,
      modelId: modelId.trim(),
      entraIdSsoEnabled: entraIdSso,
      apiKey: entraIdSso ? undefined : apiKey,
      username: entraIdSso ? undefined : username,
    });
  };

  const tasks: EmptyStateTask[] = [
    {
      id: "connect",
      label: t("K4_Empty_Connect", "Connect to K4"),
      icon: <PlugConnected20Regular />,
      description: t(
        "K4_Empty_Connect_Desc",
        "Enter your K4 server URL and model ID to get started."
      ),
      onClick: handleConnect,
    },
  ];

  return (
    <ItemEditorEmptyView
      title={t("K4_Empty_Title", "Connect to K4 Analytics")}
      description={t(
        "K4_Empty_Description",
        "Configure your K4 server connection to embed a planning model in this Fabric workspace."
      )}
      imageAlt="K4 Analytics setup"
      tasks={tasks}
    >
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

        <Field
          label={t("K4_Label_Model", "Model ID")}
          required
        >
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

        <Button
          appearance="primary"
          disabled={!isValid}
          onClick={handleConnect}
          icon={<PlugConnected20Regular />}
        >
          {t("K4_Button_Connect", "Connect")}
        </Button>
      </div>
    </ItemEditorEmptyView>
  );
}
