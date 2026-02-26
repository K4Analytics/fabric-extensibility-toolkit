import React, { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { NotificationType } from "@ms-fabric/workload-client";
import { PageProps, ContextProps } from "../../App";
import {
  ItemWithDefinition,
  getWorkloadItem,
  saveWorkloadItem,
} from "../../controller/ItemCRUDController";
import { callNotificationOpen } from "../../controller/NotificationController";
import {
  ItemEditor,
} from "../../components/ItemEditor";
import {
  K4ModelItemDefinition,
  DEFAULT_K4_MODEL_DEFINITION,
} from "./K4ModelItemDefinition";
import { K4BridgeAdapter } from "./K4BridgeAdapter";
import { K4AuthService } from "./K4AuthService";
import { K4ModelItemEmptyView } from "./K4ModelItemEmptyView";
import { K4ModelItemSettings } from "./K4ModelItemSettings";
import { K4ModelItemRibbon } from "./K4ModelItemRibbon";
import "./K4ModelItem.scss";

export const EDITOR_VIEW_TYPES = {
  EMPTY: "empty",
  MODEL: "model",
  SETTINGS: "settings",
} as const;

const enum SaveStatus {
  NotSaved = "NotSaved",
  Saving = "Saving",
  Saved = "Saved",
}

interface EmptyViewWrapperProps {
  currentDefinition: K4ModelItemDefinition;
  setCurrentDefinition: (def: K4ModelItemDefinition) => void;
  setSaveStatus: (status: any) => void;
  setCurrentView: ((view: string) => void) | null;
}

function EmptyViewWrapper({
  currentDefinition,
  setCurrentDefinition,
  setSaveStatus,
  setCurrentView,
}: EmptyViewWrapperProps) {
  return (
    <K4ModelItemEmptyView
      definition={currentDefinition}
      onDefinitionChange={(updated) => {
        setCurrentDefinition(updated);
        setSaveStatus(SaveStatus.NotSaved);
        if (updated.serverUrl && updated.modelId && setCurrentView) {
          setCurrentView(EDITOR_VIEW_TYPES.MODEL);
        }
      }}
    />
  );
}

interface SettingsViewWrapperProps {
  item: ItemWithDefinition<K4ModelItemDefinition> | undefined;
  currentDefinition: K4ModelItemDefinition;
  setCurrentDefinition: (def: K4ModelItemDefinition) => void;
  setSaveStatus: (status: any) => void;
  setCurrentView: ((view: string) => void) | null;
  workloadClient: any;
}

function SettingsViewWrapper({
  item,
  currentDefinition,
  setCurrentDefinition,
  setSaveStatus,
  setCurrentView,
  workloadClient,
}: SettingsViewWrapperProps) {
  return (
    <K4ModelItemSettings
      item={item}
      definition={currentDefinition}
      workloadClient={workloadClient}
      onSave={(updated) => {
        setCurrentDefinition(updated);
        setSaveStatus(SaveStatus.NotSaved);
        if (setCurrentView) {
          setCurrentView(EDITOR_VIEW_TYPES.MODEL);
        }
      }}
      onCancel={() => {
        if (setCurrentView) {
          setCurrentView(EDITOR_VIEW_TYPES.MODEL);
        }
      }}
    />
  );
}

export function K4ModelItemEditor(props: PageProps) {
  const { workloadClient } = props;
  const pageContext = useParams<ContextProps>();
  const { t } = useTranslation();
  const { pathname } = useLocation();

  const [isLoading, setIsLoading] = useState(true);
  const [item, setItem] =
    useState<ItemWithDefinition<K4ModelItemDefinition>>();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(SaveStatus.NotSaved);
  const [currentDefinition, setCurrentDefinition] =
    useState<K4ModelItemDefinition>({ ...DEFAULT_K4_MODEL_DEFINITION });
  const [viewSetter, setViewSetter] = useState<
    ((view: string) => void) | null
  >(null);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const bridgeRef = useRef<K4BridgeAdapter | null>(null);
  const authServiceRef = useRef<K4AuthService | null>(null);

  async function loadDataFromUrl(
    ctx: ContextProps,
    _path: string
  ): Promise<void> {
    if (ctx.itemObjectId && item && item.id === ctx.itemObjectId) {
      return;
    }

    setIsLoading(true);
    if (ctx.itemObjectId) {
      try {
        let loadedItem = await getWorkloadItem<K4ModelItemDefinition>(
          workloadClient,
          ctx.itemObjectId
        );

        if (!loadedItem.definition) {
          setSaveStatus(SaveStatus.NotSaved);
          loadedItem = {
            ...loadedItem,
            definition: { ...DEFAULT_K4_MODEL_DEFINITION },
          };
        } else {
          setSaveStatus(SaveStatus.Saved);
        }

        setItem(loadedItem);
        setCurrentDefinition(
          loadedItem.definition ?? { ...DEFAULT_K4_MODEL_DEFINITION }
        );
      } catch (error) {
        console.error("K4ModelItemEditor: Failed to load item", error);
        setItem(undefined);
      }
    }
    setIsLoading(false);
  }

  useEffect(() => {
    loadDataFromUrl(pageContext, pathname);
  }, [pageContext, pathname]);

  useEffect(() => {
    if (
      item?.id &&
      currentDefinition.serverUrl &&
      currentDefinition.modelId
    ) {
      if (bridgeRef.current) {
        bridgeRef.current.stop();
        bridgeRef.current = null;
      }

      const embedId = `fabric.${item.id}`;
      const existingFrame = document.getElementById(embedId);
      if (existingFrame) {
        existingFrame.remove();
      }

      if (!authServiceRef.current) {
        authServiceRef.current = new K4AuthService(workloadClient);
      }

      const serverUrl = currentDefinition.serverUrl.endsWith("/")
        ? currentDefinition.serverUrl.slice(0, -1)
        : currentDefinition.serverUrl;

      const src = `${serverUrl}/embed.html?embedId=${embedId}`;

      const initEmbed = async () => {
        try {
          const response = await fetch(src, { method: "GET", cache: "no-store" });
          if (!response.ok) {
            console.error(`K4: Failed to load embed: ${response.status}`);
            return;
          }
          const content = await response.text();
          if (!content.includes("<title>K4 Analytics - Embed</title>")) {
            console.error("K4: Invalid embed URL");
            return;
          }

          let username = currentDefinition.username ?? "";
          if (currentDefinition.entraIdSsoEnabled) {
            const authUsername =
              await authServiceRef.current!.initialize(serverUrl);
            if (authUsername) {
              username = authUsername;
            }
          }

          const container = document.getElementById("k4-embed-container");
          if (!container) return;

          const frame = document.createElement("iframe");
          frame.id = embedId;
          frame.src = src;
          frame.style.width = "100%";
          frame.style.height = "100%";
          frame.style.border = "none";
          container.appendChild(frame);
          iframeRef.current = frame;

          const bridge = new K4BridgeAdapter(
            embedId,
            currentDefinition,
            authServiceRef.current!,
            workloadClient,
            item.id,
            username
          );
          bridgeRef.current = bridge;

          await bridge.start();
        } catch (error) {
          console.error("K4: Error initializing embed", error);
        }
      };

      initEmbed();

      return () => {
        if (bridgeRef.current) {
          bridgeRef.current.stop();
          bridgeRef.current = null;
        }
        const frame = document.getElementById(embedId);
        if (frame) frame.remove();
      };
    }

    return undefined;
  }, [
    item?.id,
    currentDefinition.serverUrl,
    currentDefinition.modelId,
    currentDefinition.entraIdSsoEnabled,
  ]);

  async function saveItem(): Promise<void> {
    if (!item) return;

    setSaveStatus(SaveStatus.Saving);
    item.definition = { ...currentDefinition };
    setCurrentDefinition(item.definition);

    try {
      const result = await saveWorkloadItem<K4ModelItemDefinition>(
        workloadClient,
        item
      );
      if (result) {
        setSaveStatus(SaveStatus.Saved);
        callNotificationOpen(
          workloadClient,
          t("K4_Saved_Title", "Saved"),
          t("K4_Saved_Text", { itemName: item.displayName }),
          undefined,
          undefined
        );
      } else {
        throw new Error("Save returned no result");
      }
    } catch (error) {
      setSaveStatus(SaveStatus.NotSaved);
      callNotificationOpen(
        workloadClient,
        t("K4_SaveFailed_Title", "Save Failed"),
        t("K4_SaveFailed_Text", { itemName: item.displayName }),
        NotificationType.Error,
        undefined
      );
    }
  }

  const handleOpenSettings = async () => {
    if (viewSetter) {
      viewSetter(EDITOR_VIEW_TYPES.SETTINGS);
    }
  };

  const isSaveEnabled = (currentView: string) => {
    if (currentView === EDITOR_VIEW_TYPES.EMPTY) return false;
    if (currentView === EDITOR_VIEW_TYPES.SETTINGS) return false;
    if (saveStatus === SaveStatus.Saved) return false;
    return true;
  };

  const hasValidConfig =
    !!currentDefinition.serverUrl && !!currentDefinition.modelId;

  const views = [
    {
      name: EDITOR_VIEW_TYPES.EMPTY,
      component: (
        <EmptyViewWrapper
          currentDefinition={currentDefinition}
          setCurrentDefinition={setCurrentDefinition}
          setSaveStatus={setSaveStatus}
          setCurrentView={viewSetter}
        />
      ),
    },
    {
      name: EDITOR_VIEW_TYPES.MODEL,
      component: (
        <div className="k4-model-editor-view">
          <div id="k4-embed-container" className="k4-embed-container" />
        </div>
      ),
    },
    {
      name: EDITOR_VIEW_TYPES.SETTINGS,
      component: (
        <SettingsViewWrapper
          item={item}
          currentDefinition={currentDefinition}
          setCurrentDefinition={setCurrentDefinition}
          setSaveStatus={setSaveStatus}
          setCurrentView={viewSetter}
          workloadClient={workloadClient}
        />
      ),
    },
  ];

  useEffect(() => {
    if (!isLoading && item && viewSetter) {
      const correctView = hasValidConfig
        ? EDITOR_VIEW_TYPES.MODEL
        : EDITOR_VIEW_TYPES.EMPTY;
      viewSetter(correctView);
    }
  }, [isLoading, item, viewSetter, hasValidConfig]);

  return (
    <ItemEditor
      isLoading={isLoading}
      loadingMessage={t("K4_Loading", "Loading K4 Model...")}
      ribbon={(context) => (
        <K4ModelItemRibbon
          {...props}
          viewContext={context}
          isSaveButtonEnabled={isSaveEnabled(context.currentView)}
          saveItemCallback={saveItem}
          openSettingsCallback={handleOpenSettings}
        />
      )}
      views={views}
      viewSetter={(setCurrentView) => {
        if (!viewSetter) {
          setViewSetter(() => setCurrentView);
        }
      }}
    />
  );
}
