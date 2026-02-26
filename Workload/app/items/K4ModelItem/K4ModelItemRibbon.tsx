import React from "react";
import { PageProps } from "../../App";
import {
  Ribbon,
  RibbonAction,
  createSaveAction,
  createSettingsAction,
} from "../../components/ItemEditor";
import { ViewContext } from "../../components";

interface K4ModelItemRibbonProps extends PageProps {
  viewContext: ViewContext;
  isSaveButtonEnabled: boolean;
  saveItemCallback: () => Promise<void>;
  openSettingsCallback: () => Promise<void>;
}

export function K4ModelItemRibbon({
  viewContext,
  isSaveButtonEnabled,
  saveItemCallback,
  openSettingsCallback,
}: K4ModelItemRibbonProps) {
  // FIX: pass disabled as second arg — never conditionally change the array length
  const saveAction = createSaveAction(saveItemCallback, !isSaveButtonEnabled);
  const settingsAction = createSettingsAction(openSettingsCallback);

  const homeToolbarActions: RibbonAction[] = [
    saveAction,
    settingsAction,
  ];

  return (
    <Ribbon
      homeToolbarActions={homeToolbarActions}
      viewContext={viewContext}
    />
  );
}
