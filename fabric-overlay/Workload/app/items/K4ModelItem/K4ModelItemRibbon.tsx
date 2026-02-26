import React from "react";
import { useTranslation } from "react-i18next";
import { PageProps } from "../../App";
import {
  Ribbon,
  RibbonStandardActions,
  ViewNavigationContext,
} from "../../components/ItemEditor";

interface K4ModelItemRibbonProps extends PageProps {
  viewContext: ViewNavigationContext;
  isSaveButtonEnabled: boolean;
  saveItemCallback: () => Promise<void>;
  openSettingsCallback: () => Promise<void>;
}

/**
 * K4ModelItemRibbon — the toolbar shown above the K4 embed.
 * Provides Save and Settings actions following Fabric patterns.
 */
export function K4ModelItemRibbon({
  isSaveButtonEnabled,
  saveItemCallback,
  openSettingsCallback,
}: K4ModelItemRibbonProps) {
  const { t } = useTranslation();

  return (
    <Ribbon>
      <RibbonStandardActions
        isSaveEnabled={isSaveButtonEnabled}
        onSave={saveItemCallback}
        isSettingsEnabled={true}
        onSettings={openSettingsCallback}
      />
    </Ribbon>
  );
}
